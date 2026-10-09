import Foundation
import Combine

enum AdapterType: String, CaseIterable {
    case bluetooth = "ELM327 Bluetooth"
    case wifi      = "ELM327 Wi-Fi"
}

enum OBDProtocol: String, CaseIterable {
    case auto     = "Auto (Recommended)"
    case iso9141  = "ISO 9141-2"
    case iso14230 = "ISO 14230-4 KWP"
    case can      = "ISO 15765-4 CAN"
}

@MainActor
final class OBDViewModel: ObservableObject {

    // MARK: - Connection

    @Published var connectionState: OBDConnectionState = .disconnected
    @Published var isConnected: Bool = false
    @Published var adapterType: AdapterType = .bluetooth
    @Published var obdProtocol: OBDProtocol = .auto

    // MARK: - Demo mode

    @Published var isDemoMode: Bool = true {
        didSet {
            if isDemoMode {
                disconnectAdapter()
                startDemo()
            } else {
                stopDemo()
                connectionState = .disconnected
            }
        }
    }

    // MARK: - Live gauges

    @Published var rpm:         Double = 0
    @Published var speed:       Double = 0
    @Published var coolantTemp: Double = 18
    @Published var engineLoad:  Double = 14

    // MARK: - Fault codes

    @Published var faultCodes:   [FaultCode] = []
    @Published var isScanning:   Bool = false
    @Published var scanProgress: Double = 0

    // MARK: - PIDs

    @Published var pids: [LiveDataPID] = []
    @Published var refreshRate: TimeInterval = 1.0

    // MARK: - Settings

    @Published var useFahrenheit: Bool = false
    @Published var useMPH:        Bool = false
    @Published var vin:           String = ""

    // MARK: - BLE scan

    @Published var bleDevices: [DiscoveredDevice] = []

    // MARK: - WiFi config

    @Published var wifiHost: String = "192.168.0.10"
    @Published var wifiPort: String = "35000"

    // MARK: - Template runner

    @Published var activeTemplate: DiagnosticTemplate? = nil
    @Published var runnerSteps:    [TemplateStep] = []
    @Published var runnerIndex:    Int = 0

    // MARK: - Private: transports

    private let bleConn  = BLEOBDConnection()
    private let wifiConn = WiFiOBDConnection()
    private var activeTransport: ActiveTransport = .none

    private enum ActiveTransport {
        case none, ble, wifi
    }

    // MARK: - Private: ELM327 command queue

    private typealias ResponseHandler = (String) -> Void
    private var commandQueue:        [(cmd: String, handler: ResponseHandler)] = []
    private var isWaitingForResponse = false
    private var responseTimeout:     Task<Void, Never>?

    // MARK: - Private: simulation / polling

    private var simTimer:   AnyCancellable?
    private var pollTimer:  AnyCancellable?
    private var scanTimer:  Timer?
    private var pollIndex = 0

    // MARK: - ELM327 init sequence

    private let elm327Init = ["ATZ", "ATE0", "ATL0", "ATS0", "ATH0", "ATSP0", "0100"]

    // MARK: - Init

    init() {
        buildPIDs()
        bleConn.delegate  = self
        wifiConn.delegate = self
        startDemo()
    }

    // MARK: - Demo mode

    private func startDemo() {
        isConnected    = true
        connectionState = .ready
        faultCodes     = VWT5FaultCodes.demoCodes
        rpm            = 820
        startSimulation()
    }

    private func stopDemo() {
        stopSimulation()
        isConnected    = false
        rpm = 0; speed = 0; coolantTemp = 18; engineLoad = 14
        pids.indices.forEach { pids[$0].value = 0 }
        faultCodes = []
    }

    // MARK: - BLE

    func startBLEScan() {
        guard !isDemoMode else { return }
        bleDevices = []
        activeTransport = .ble
        bleConn.startScan()
    }

    func stopBLEScan() {
        bleConn.stopScan()
        if case .scanning = connectionState {
            connectionState = .disconnected
        }
    }

    func connectBLE(_ device: DiscoveredDevice) {
        activeTransport = .ble
        bleConn.connect(to: device)
    }

    // MARK: - WiFi

    func connectWiFi() {
        guard !isDemoMode else { return }
        let portNum = UInt16(wifiPort) ?? 35000
        activeTransport = .wifi
        wifiConn.connect(host: wifiHost, port: portNum)
    }

    // MARK: - Disconnect

    func disconnectAdapter() {
        responseTimeout?.cancel()
        commandQueue = []
        isWaitingForResponse = false
        pollTimer?.cancel()
        pollTimer = nil
        switch activeTransport {
        case .ble:  bleConn.disconnect()
        case .wifi: wifiConn.disconnect()
        case .none: break
        }
        activeTransport = .none
        isConnected = false
        connectionState = .disconnected
        rpm = 0; speed = 0; coolantTemp = 18; engineLoad = 14
        pids.indices.forEach { pids[$0].value = 0 }
        faultCodes = []
    }

    // MARK: - Command queue

    private func enqueue(_ cmd: String, handler: @escaping ResponseHandler) {
        commandQueue.append((cmd, handler))
        if !isWaitingForResponse { sendNextCommand() }
    }

    private func sendNextCommand() {
        guard !commandQueue.isEmpty else { return }
        isWaitingForResponse = true
        let command = commandQueue[0].cmd
        switch activeTransport {
        case .ble:  bleConn.send(command)
        case .wifi: wifiConn.send(command)
        case .none: break
        }
        // Safety timeout — remove stuck command after 4 s
        responseTimeout?.cancel()
        responseTimeout = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            guard !Task.isCancelled, let self else { return }
            if self.isWaitingForResponse {
                if !self.commandQueue.isEmpty { self.commandQueue.removeFirst() }
                self.isWaitingForResponse = false
                self.sendNextCommand()
            }
        }
    }

    // MARK: - ELM327 initialisation

    private func runELM327Init(step: Int = 0) {
        guard step < elm327Init.count else {
            // All init commands succeeded → start polling
            connectionState = .ready
            isConnected = true
            faultCodes  = []
            startRealPolling()
            return
        }
        let cmd = elm327Init[step]
        enqueue(cmd) { [weak self] response in
            guard let self else { return }
            // ATZ and 0100 may return something other than "OK" — that's fine
            if step > 0 && step < elm327Init.count - 1 && ELM327Parser.isError(response) {
                self.connectionState = .error("Init failed at \(cmd)")
                self.isConnected = false
                return
            }
            self.runELM327Init(step: step + 1)
        }
    }

    // MARK: - Real polling

    private func startRealPolling() {
        pollTimer?.cancel()
        pollTimer = Timer.publish(every: max(refreshRate, 0.5), on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in self?.pollNextPID() }
    }

    private func pollNextPID() {
        // Don't pile up commands
        guard commandQueue.isEmpty && !isWaitingForResponse else { return }
        let enabled = pids.filter { $0.isEnabled }
        guard !enabled.isEmpty else { return }
        let pid = enabled[pollIndex % enabled.count]
        pollIndex += 1
        enqueue(pid.pidHex) { [weak self] response in
            guard let self else { return }
            guard let value = ELM327Parser.parsePID(pidHex: pid.pidHex, response: response) else { return }
            if let i = self.pids.firstIndex(where: { $0.pidHex == pid.pidHex }) {
                self.pids[i].push(value)
            }
            switch pid.pidHex {
            case "010C": self.rpm = value
            case "010D": self.speed = value
            case "0105": self.coolantTemp = value
            case "0104": self.engineLoad = value
            default: break
            }
        }
    }

    // MARK: - Simulation (demo mode only)

    private func startSimulation() {
        stopSimulation()
        simTimer = Timer.publish(every: refreshRate, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in self?.tick() }
    }

    private func stopSimulation() {
        simTimer?.cancel()
        simTimer = nil
    }

    private func tick() {
        rpm         = (rpm         + Double.random(in: -25...25)).clamped(to: 720...900)
        coolantTemp = coolantTemp < 87
            ? min(coolantTemp + Double.random(in: 0.2...0.5), 90)
            : (coolantTemp + Double.random(in: -0.4...0.4)).clamped(to: 85...95)
        engineLoad  = (engineLoad  + Double.random(in: -2...2)).clamped(to: 10...24)
        tickPIDs()
    }

    private func tickPIDs() {
        for i in pids.indices {
            let v: Double
            switch pids[i].pidHex {
            case "010C": v = rpm
            case "010D": v = speed
            case "0105": v = coolantTemp
            case "0104": v = engineLoad
            case "010F": v = (pids[i].value + Double.random(in: -1...1)).clamped(to: 14...30)
            case "0110": v = (pids[i].value + Double.random(in: -0.4...0.4)).clamped(to: 2.5...5.5)
            case "0111": v = (pids[i].value + Double.random(in: -0.4...0.4)).clamped(to: 13...17)
            case "0106": v = (pids[i].value + Double.random(in: -0.5...0.5)).clamped(to: -4...4)
            case "0107": v = (pids[i].value + Double.random(in: -0.15...0.15)).clamped(to: -3...3)
            case "0114": v = (pids[i].value + Double.random(in: -0.04...0.04)).clamped(to: 0.1...0.9)
            case "015C": v = (pids[i].value + Double.random(in: -0.3...0.3)).clamped(to: 84...96)
            case "010E": v = (pids[i].value + Double.random(in: -0.4...0.4)).clamped(to: 3...8)
            default:     v = pids[i].value
            }
            pids[i].push(v)
        }
    }

    // MARK: - Fault codes

    func scanForCodes() {
        guard !isScanning else { return }
        isScanning = true; scanProgress = 0; faultCodes = []

        if isDemoMode {
            var progress = 0.0
            scanTimer = Timer.scheduledTimer(withTimeInterval: 0.07, repeats: true) { [weak self] t in
                guard let self else { t.invalidate(); return }
                progress += 0.02
                Task { @MainActor in self.scanProgress = min(progress, 1.0) }
                if progress >= 1.0 {
                    t.invalidate()
                    Task { @MainActor in
                        try? await Task.sleep(nanoseconds: 300_000_000)
                        self.isScanning = false
                        self.faultCodes = VWT5FaultCodes.demoCodes
                    }
                }
            }
            RunLoop.main.add(scanTimer!, forMode: .common)
        } else {
            // Real scan: pause poll, send mode 03, resume
            pollTimer?.cancel()
            commandQueue = []; isWaitingForResponse = false

            // Animate progress while waiting
            Task { [weak self] in
                for _ in 0..<50 {
                    try? await Task.sleep(nanoseconds: 60_000_000)
                    await MainActor.run { self?.scanProgress = min((self?.scanProgress ?? 0) + 0.018, 0.9) }
                }
            }

            enqueue("03") { [weak self] response in
                guard let self else { return }
                self.scanProgress = 1.0
                self.isScanning = false
                let rawCodes = ELM327Parser.parseDTCs(response)
                self.faultCodes = rawCodes.map { code in
                    VWT5FaultCodes.all.first { $0.code == code }
                        ?? FaultCode(
                            code: code,
                            system: .engine, severity: .warning,
                            shortDesc: "Unknown DTC",
                            fullDesc: "Code \(code) is not in the VW T5 database.",
                            probableCause: "Use a VAG-specific scanner for further diagnosis.",
                            fixHint: "Search '\(code) VW T5' for your engine variant."
                        )
                }
                if self.connectionState.isReady { self.startRealPolling() }
            }
        }
    }

    func clearCodes() {
        if !isDemoMode {
            enqueue("04") { _ in } // ELM327 clear codes command
        }
        faultCodes = []
    }

    func toggleExpand(_ code: FaultCode) {
        if let i = faultCodes.firstIndex(where: { $0.id == code.id }) {
            faultCodes[i].isExpanded.toggle()
        }
    }

    // MARK: - Template runner

    func startTemplate(_ template: DiagnosticTemplate) {
        var t = template
        t.steps.indices.forEach { t.steps[$0].status = .pending }
        activeTemplate = t
        runnerSteps    = t.steps
        runnerIndex    = 0
        if !runnerSteps.isEmpty { runnerSteps[0].status = .inProgress }
    }

    func advanceRunner(passed: Bool) {
        guard runnerIndex < runnerSteps.count else { return }
        runnerSteps[runnerIndex].status = passed ? .passed : .failed
        runnerIndex += 1
        if runnerIndex < runnerSteps.count { runnerSteps[runnerIndex].status = .inProgress }
    }

    func closeTemplate() {
        activeTemplate = nil; runnerSteps = []; runnerIndex = 0
    }

    var isTemplateFinished: Bool { runnerIndex >= runnerSteps.count }

    // MARK: - Units

    func displayTemp(_ c: Double) -> String {
        useFahrenheit
            ? String(format: "%.0f°F", c * 9 / 5 + 32)
            : String(format: "%.0f°C", c)
    }

    func displaySpeed(_ kmh: Double) -> String {
        useMPH
            ? String(format: "%.0f mph", kmh * 0.621371)
            : String(format: "%.0f km/h", kmh)
    }

    // MARK: - PID setup

    private func buildPIDs() {
        pids = [
            LiveDataPID(name: "Engine RPM",         unit: "rpm", group: .engine,  pidHex: "010C", value: 0,    minRange: 0,   maxRange: 7000),
            LiveDataPID(name: "Engine Load",        unit: "%",   group: .engine,  pidHex: "0104", value: 0,    minRange: 0,   maxRange: 100),
            LiveDataPID(name: "MAF Air Flow",       unit: "g/s", group: .engine,  pidHex: "0110", value: 0,    minRange: 0,   maxRange: 30),
            LiveDataPID(name: "Throttle Position",  unit: "%",   group: .engine,  pidHex: "0111", value: 0,    minRange: 0,   maxRange: 100),
            LiveDataPID(name: "Intake Air Temp",    unit: "°C",  group: .engine,  pidHex: "010F", value: 20,   minRange: -40, maxRange: 80),
            LiveDataPID(name: "Vehicle Speed",      unit: "km/h",group: .engine,  pidHex: "010D", value: 0,    minRange: 0,   maxRange: 255),
            LiveDataPID(name: "Short Fuel Trim B1", unit: "%",   group: .fuel,    pidHex: "0106", value: 0,    minRange: -25, maxRange: 25),
            LiveDataPID(name: "Long Fuel Trim B1",  unit: "%",   group: .fuel,    pidHex: "0107", value: 0,    minRange: -25, maxRange: 25),
            LiveDataPID(name: "O2 Sensor (B1S1)",   unit: "V",   group: .fuel,    pidHex: "0114", value: 0,    minRange: 0,   maxRange: 1.1),
            LiveDataPID(name: "Coolant Temp",       unit: "°C",  group: .cooling, pidHex: "0105", value: 18,   minRange: -40, maxRange: 120),
            LiveDataPID(name: "Oil Temp",           unit: "°C",  group: .cooling, pidHex: "015C", value: 0,    minRange: -40, maxRange: 150),
            LiveDataPID(name: "Timing Advance",     unit: "°",   group: .timing,  pidHex: "010E", value: 0,    minRange: -64, maxRange: 64),
        ]
    }
}

// MARK: - OBDConnectionDelegate

extension OBDViewModel: OBDConnectionDelegate {

    func connectionStateChanged(_ state: OBDConnectionState) {
        connectionState = state
        switch state {
        case .initializing:
            // BLE/WiFi transport is ready — start ELM327 AT command sequence
            commandQueue = []; isWaitingForResponse = false
            runELM327Init()
        case .disconnected, .error:
            pollTimer?.cancel()
            pollTimer = nil
            isConnected = false
            commandQueue = []; isWaitingForResponse = false
        case .ready:
            isConnected = true
        default:
            break
        }
    }

    func connectionReceivedData(_ raw: String) {
        responseTimeout?.cancel()
        responseTimeout = nil
        guard !commandQueue.isEmpty else { return }
        let handler = commandQueue.removeFirst().handler
        isWaitingForResponse = false
        handler(raw)
        sendNextCommand()
    }

    func connectionDiscoveredDevice(_ device: DiscoveredDevice) {
        if !bleDevices.contains(where: { $0.id == device.id }) {
            bleDevices.append(device)
        }
    }
}
