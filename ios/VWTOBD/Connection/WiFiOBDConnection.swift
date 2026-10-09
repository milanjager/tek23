import Foundation
import Network

// Most ELM327 WiFi adapters create a hotspot at 192.168.0.10:35000.
// The user connects their iPhone to that hotspot in iOS Settings first,
// then taps Connect here.

final class WiFiOBDConnection {

    weak var delegate: (any OBDConnectionDelegate)?

    private var connection: NWConnection?
    private var buffer = ""
    private let queue = DispatchQueue(label: "com.vwt5obd.wifi.io", qos: .userInitiated)

    // MARK: - Public API

    func connect(host: String, port: UInt16) {
        disconnect()
        let nwHost = NWEndpoint.Host(host)
        let nwPort = NWEndpoint.Port(rawValue: port) ?? 35000
        let conn   = NWConnection(host: nwHost, port: nwPort, using: .tcp)
        connection = conn

        conn.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                Task { @MainActor in self.delegate?.connectionStateChanged(.initializing) }
                self.receiveLoop()
            case .waiting(let err):
                Task { @MainActor in
                    self.delegate?.connectionStateChanged(.error("Waiting: \(err.localizedDescription)"))
                }
            case .failed(let err):
                Task { @MainActor in
                    self.delegate?.connectionStateChanged(.error(err.localizedDescription))
                }
            case .cancelled:
                Task { @MainActor in self.delegate?.connectionStateChanged(.disconnected) }
            default: break
            }
        }

        Task { @MainActor in self.delegate?.connectionStateChanged(.connecting) }
        conn.start(queue: queue)
    }

    func disconnect() {
        connection?.cancel()
        connection = nil
        buffer = ""
        Task { @MainActor in self.delegate?.connectionStateChanged(.disconnected) }
    }

    func send(_ command: String) {
        guard let conn = connection else { return }
        let text = command.hasSuffix("\r") ? command : command + "\r"
        guard let data = text.data(using: .ascii) else { return }
        conn.send(content: data, completion: .idempotent)
    }

    // MARK: - Private

    private func receiveLoop() {
        connection?.receive(minimumIncompleteLength: 1, maximumLength: 2048) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            if let error {
                Task { @MainActor in self.delegate?.connectionStateChanged(.error(error.localizedDescription)) }
                return
            }
            if let data, !data.isEmpty, let str = String(data: data, encoding: .ascii) {
                self.buffer += str
                while let range = self.buffer.range(of: ">") {
                    let response = String(self.buffer[self.buffer.startIndex..<range.upperBound])
                    self.buffer = String(self.buffer[range.upperBound...])
                    Task { @MainActor in self.delegate?.connectionReceivedData(response) }
                }
            }
            if !isComplete { self.receiveLoop() }
        }
    }
}
