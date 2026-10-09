import SwiftUI

enum PIDGroup: String, CaseIterable {
    case engine  = "Engine"
    case fuel    = "Fuel"
    case cooling = "Cooling"
    case timing  = "Timing"

    var sfSymbol: String {
        switch self {
        case .engine:  return "bolt.fill"
        case .fuel:    return "fuelpump.fill"
        case .cooling: return "thermometer.medium"
        case .timing:  return "timer"
        }
    }

    var color: Color {
        switch self {
        case .engine:  return Color(hex: "#1e6fd9")
        case .fuel:    return .green
        case .cooling: return .red
        case .timing:  return .orange
        }
    }
}

struct LiveDataPID: Identifiable {
    let id       = UUID()
    let name:      String
    let unit:      String
    let group:     PIDGroup
    let pidHex:    String
    var value:     Double
    let minRange:  Double
    let maxRange:  Double
    var isEnabled: Bool     = true
    var history:   [Double] = []

    mutating func push(_ newValue: Double) {
        value = newValue
        history.append(newValue)
        if history.count > 30 { history.removeFirst() }
    }

    var formatted: String {
        switch unit {
        case "V":              return String(format: "%.2f", value)
        case "%", "°", "g/s": return String(format: "%.1f", value)
        default:               return String(format: "%.0f", value)
        }
    }

    var display: String { "\(formatted) \(unit)" }

    var normalized: Double {
        guard maxRange > minRange else { return 0 }
        return ((value - minRange) / (maxRange - minRange)).clamped(to: 0...1)
    }
}
