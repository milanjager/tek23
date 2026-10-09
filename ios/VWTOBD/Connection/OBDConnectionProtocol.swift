import Foundation

// MARK: - Connection state

enum OBDConnectionState: Equatable {
    case disconnected
    case scanning
    case connecting
    case initializing   // ELM327 AT command sequence in progress
    case ready          // polling active
    case error(String)

    static func == (lhs: Self, rhs: Self) -> Bool {
        switch (lhs, rhs) {
        case (.disconnected, .disconnected), (.scanning, .scanning),
             (.connecting, .connecting), (.initializing, .initializing),
             (.ready, .ready): return true
        case (.error(let a), .error(let b)): return a == b
        default: return false
        }
    }

    var label: String {
        switch self {
        case .disconnected:  return "Disconnected"
        case .scanning:      return "Scanning…"
        case .connecting:    return "Connecting…"
        case .initializing:  return "Initialising…"
        case .ready:         return "Connected"
        case .error(let m):  return m
        }
    }

    var isReady: Bool { if case .ready = self { return true }; return false }

    var sfSymbol: String {
        switch self {
        case .ready:        return "cable.connector"
        case .disconnected: return "cable.connector.slash"
        case .scanning:     return "antenna.radiowaves.left.and.right"
        case .connecting, .initializing: return "ellipsis.circle"
        case .error:        return "exclamationmark.circle"
        }
    }

    var color: Color {
        switch self {
        case .ready:        return .green
        case .disconnected: return .red
        case .error:        return .orange
        default:            return .yellow
        }
    }
}

// MARK: - Discovered device (BLE)

struct DiscoveredDevice: Identifiable, Equatable {
    let id:   UUID      // CBPeripheral.identifier
    let name: String
    let rssi: Int       // negative dBm

    var signalBars: Int {
        switch rssi {
        case -60...:        return 3
        case -75..<(-60):   return 2
        default:            return 1
        }
    }
}

// MARK: - Delegate protocol (always called on main actor)

@MainActor
protocol OBDConnectionDelegate: AnyObject {
    func connectionStateChanged(_ state: OBDConnectionState)
    func connectionReceivedData(_ raw: String)
    func connectionDiscoveredDevice(_ device: DiscoveredDevice)
}

// MARK: - SwiftUI Color shim (used by OBDConnectionState.color)
import SwiftUI
