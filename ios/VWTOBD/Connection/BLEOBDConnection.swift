import CoreBluetooth
import Foundation

// Known ELM327 BLE service UUIDs (most common clone adapters first)
private let knownServiceUUIDs: [CBUUID] = [
    CBUUID(string: "FFE0"),                                          // generic ELM327 clone
    CBUUID(string: "18F0"),                                          // some Vgate/OBDLink
    CBUUID(string: "FFF0"),                                          // OBDLink MX+
    CBUUID(string: "E7810A71-73AE-499D-8C15-FAA9AEF0C3F2"),         // Kiwi 3
]
private let knownCharUUIDs: [CBUUID] = [
    CBUUID(string: "FFE1"),
    CBUUID(string: "18F1"),
    CBUUID(string: "FFF1"),
    CBUUID(string: "BEF8D6C9-9C21-4C9E-B632-BD58C1009F9F"),
]

// Name fragments that identify OBD adapters (uppercased check)
private let obdKeywords = ["OBD", "ELM", "ICAR", "VGATE", "LINK", "VEEPEAK", "KIWI", "CARISTA", "OBD2", "OBDII"]

final class BLEOBDConnection: NSObject {

    weak var delegate: (any OBDConnectionDelegate)?

    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var writeChar: CBCharacteristic?
    private var responseBuffer = ""
    private(set) var discoveredDevices: [DiscoveredDevice] = []
    private var scanActive = false

    override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: .main,
                                   options: [CBCentralManagerOptionShowPowerAlertKey: true])
    }

    // MARK: - Public API

    func startScan() {
        discoveredDevices = []
        scanActive = true
        if central.state == .poweredOn {
            central.scanForPeripherals(withServices: nil,
                                       options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
        }
        // If not powered on yet, scanning starts in centralManagerDidUpdateState
        Task { @MainActor in self.delegate?.connectionStateChanged(.scanning) }
    }

    func stopScan() {
        scanActive = false
        central.stopScan()
    }

    func connect(to device: DiscoveredDevice) {
        stopScan()
        let found = central.retrievePeripherals(withIdentifiers: [device.id])
        guard let p = found.first else {
            Task { @MainActor in self.delegate?.connectionStateChanged(.error("Device not reachable")) }
            return
        }
        peripheral = p
        p.delegate = self
        Task { @MainActor in self.delegate?.connectionStateChanged(.connecting) }
        central.connect(p, options: nil)
    }

    func disconnect() {
        if let p = peripheral { central.cancelPeripheralConnection(p) }
        resetState()
        Task { @MainActor in self.delegate?.connectionStateChanged(.disconnected) }
    }

    func send(_ command: String) {
        guard let p = peripheral, let c = writeChar else { return }
        let text = command.hasSuffix("\r") ? command : command + "\r"
        guard let data = text.data(using: .ascii) else { return }
        let writeType: CBCharacteristicWriteType =
            c.properties.contains(.writeWithoutResponse) ? .withoutResponse : .withResponse
        p.writeValue(data, for: c, type: writeType)
    }

    // MARK: - Private

    private func resetState() {
        peripheral = nil; writeChar = nil; responseBuffer = ""
    }
}

// MARK: - CBCentralManagerDelegate

extension BLEOBDConnection: CBCentralManagerDelegate {

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn, scanActive {
            central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
            return
        }
        guard central.state != .poweredOn else { return }
        let msg: String
        switch central.state {
        case .poweredOff:   msg = "Bluetooth is turned off"
        case .unauthorized: msg = "Bluetooth access denied — allow in Settings"
        case .unsupported:  msg = "Bluetooth LE not supported on this device"
        default:            msg = "Bluetooth unavailable"
        }
        Task { @MainActor in self.delegate?.connectionStateChanged(.error(msg)) }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = peripheral.name
            ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String)
            ?? ""
        guard !name.isEmpty else { return }
        let upper = name.uppercased()
        guard obdKeywords.contains(where: { upper.contains($0) }) else { return }
        guard !discoveredDevices.contains(where: { $0.id == peripheral.identifier }) else { return }

        let device = DiscoveredDevice(id: peripheral.identifier, name: name, rssi: RSSI.intValue)
        discoveredDevices.append(device)
        Task { @MainActor in self.delegate?.connectionDiscoveredDevice(device) }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        Task { @MainActor in self.delegate?.connectionStateChanged(.initializing) }
        peripheral.discoverServices(nil)
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        resetState()
        let msg = error?.localizedDescription ?? "Connection failed"
        Task { @MainActor in self.delegate?.connectionStateChanged(.error(msg)) }
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        resetState()
        if let error {
            Task { @MainActor in self.delegate?.connectionStateChanged(.error("Disconnected: \(error.localizedDescription)")) }
        } else {
            Task { @MainActor in self.delegate?.connectionStateChanged(.disconnected) }
        }
    }
}

// MARK: - CBPeripheralDelegate

extension BLEOBDConnection: CBPeripheralDelegate {

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let services = peripheral.services, error == nil else { return }
        // Prefer known services; fall back to all if none match
        let matching = services.filter { knownServiceUUIDs.contains($0.uuid) }
        (matching.isEmpty ? services : matching).forEach {
            peripheral.discoverCharacteristics(nil, for: $0)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard let chars = service.characteristics, error == nil else { return }
        for char in chars where knownCharUUIDs.contains(char.uuid) {
            if char.properties.contains(.notify) || char.properties.contains(.indicate) {
                peripheral.setNotifyValue(true, for: char)
            }
            if writeChar == nil,
               char.properties.contains(.write) || char.properties.contains(.writeWithoutResponse) {
                writeChar = char
            }
        }
        // If we found the write char the transport is ready; ViewModel runs ELM327 init
        if writeChar != nil {
            Task { @MainActor in self.delegate?.connectionStateChanged(.initializing) }
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard error == nil,
              let data = characteristic.value,
              let str  = String(data: data, encoding: .ascii) else { return }
        responseBuffer += str
        // ELM327 always ends a response with the '>' prompt
        while let range = responseBuffer.range(of: ">") {
            let response = String(responseBuffer[responseBuffer.startIndex..<range.upperBound])
            responseBuffer = String(responseBuffer[range.upperBound...])
            Task { @MainActor in self.delegate?.connectionReceivedData(response) }
        }
    }

    func peripheralIsReady(toSendWriteWithoutResponse peripheral: CBPeripheral) {
        // No queuing needed — our commands are short
    }
}
