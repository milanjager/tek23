import Foundation
import Combine

enum AdapterType: String, CaseIterable {
    case bluetooth = "ELM327 Bluetooth"
    case wifi      = "ELM327 WiFi"
}

enum OBDProtocol: String, CaseIterable {
    case auto     = "Auto (Recommended)"
    case iso9141  = "ISO 9141-2"
    case iso14230 = "ISO 14230-4 KWP"
    case can      = "ISO 15765-4 CAN"
}

@MainActor
final class OBDViewModel: ObservableObject {

    // MARK: Connection
    @Published var isConnected: Bool   = false
    @Published var adapterType: AdapterType   = .bluetooth
    @Published var obdProtocol: OBDProtocol   = .auto

    // MARK: Demo mode
    @Published var isDemoMode: Bool = true {
        didSet { isDemoMode ? connect() : disconnect() }
    }

    // MARK: Live gauges
    @Published var rpm:         Double = 800
    @Published var speed:       Double = 0
    @Published var coolantTemp: Double = 18
    @Published var engineLoad:  Double = 14

    // MARK: Fault codes
    @Published var faultCodes:   [FaultCode] = []
    @Published var isScanning:   Bool    = false
    @Published var scanProgress: Double  = 0

    // MARK: PIDs
    @Published var pids: [LiveDataPID] = []
    @Published var refreshRate: TimeInterval = 1.0

    // MARK: Settings
    @Published var useFahrenheit: Bool   = false
    @Published var useMPH:        Bool   = false
    @Published var vin:           String = ""

    // MARK: Template runner
    @Published var activeTemplate: DiagnosticTemplate? = nil
    @Published var runnerSteps:    [TemplateStep]       = []
    @Published var runnerIndex:    Int                  = 0

    // MARK: Private
    private var simTimer: AnyCancellable?
    private var scanTimer: Timer?

    init() {
        buildPIDs()
        connect()
    }

    // MARK: - Connection

    func connect() {
        isConnected    = true
        faultCodes     = VWT5FaultCodes.demoCodes
        startSimulation()
    }

    func disconnect() {
        isConnected    = false
        stopSimulation()
        rpm = 0; speed = 0; coolantTemp = 0; engineLoad = 0
        pids.indices.forEach { pids[$0].value = 0 }
    }

    // MARK: - Simulation

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

    // MARK: - Fault code actions

    func scanForCodes() {
        guard !isScanning else { return }
        isScanning   = true
        scanProgress = 0
        faultCodes   = []

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
    }

    func clearCodes() {
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
        if runnerIndex < runnerSteps.count {
            runnerSteps[runnerIndex].status = .inProgress
        }
    }

    func closeTemplate() {
        activeTemplate = nil
        runnerSteps    = []
        runnerIndex    = 0
    }

    var isTemplateFinished: Bool {
        runnerIndex >= runnerSteps.count
    }

    // MARK: - Units

    func displayTemp(_ c: Double) -> String {
        useFahrenheit
            ? String(format: "%.0f°F", c * 9/5 + 32)
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
            LiveDataPID(name: "Engine RPM",           unit: "rpm", group: .engine,  pidHex: "010C", value: 800,   minRange: 0,   maxRange: 7000),
            LiveDataPID(name: "Engine Load",          unit: "%",   group: .engine,  pidHex: "0104", value: 14,    minRange: 0,   maxRange: 100),
            LiveDataPID(name: "MAF Air Flow",         unit: "g/s", group: .engine,  pidHex: "0110", value: 3.8,   minRange: 0,   maxRange: 30),
            LiveDataPID(name: "Throttle Position",    unit: "%",   group: .engine,  pidHex: "0111", value: 15,    minRange: 0,   maxRange: 100),
            LiveDataPID(name: "Intake Air Temp",      unit: "°C",  group: .engine,  pidHex: "010F", value: 22,    minRange: -40, maxRange: 80),
            LiveDataPID(name: "Vehicle Speed",        unit: "km/h",group: .engine,  pidHex: "010D", value: 0,     minRange: 0,   maxRange: 255),
            LiveDataPID(name: "Short Fuel Trim B1",   unit: "%",   group: .fuel,    pidHex: "0106", value: -1.5,  minRange: -25, maxRange: 25),
            LiveDataPID(name: "Long Fuel Trim B1",    unit: "%",   group: .fuel,    pidHex: "0107", value: 0.8,   minRange: -25, maxRange: 25),
            LiveDataPID(name: "O2 Sensor 1 (B1S1)",  unit: "V",   group: .fuel,    pidHex: "0114", value: 0.45,  minRange: 0,   maxRange: 1.1),
            LiveDataPID(name: "Coolant Temp",         unit: "°C",  group: .cooling, pidHex: "0105", value: 18,    minRange: -40, maxRange: 120),
            LiveDataPID(name: "Oil Temp",             unit: "°C",  group: .cooling, pidHex: "015C", value: 88,    minRange: -40, maxRange: 150),
            LiveDataPID(name: "Timing Advance",       unit: "°",   group: .timing,  pidHex: "010E", value: 5.5,   minRange: -64, maxRange: 64),
        ]
    }
}
