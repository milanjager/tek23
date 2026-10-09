import SwiftUI

enum Severity: String, CaseIterable {
    case critical = "Critical"
    case warning  = "Warning"
    case info     = "Info"

    var color: Color {
        switch self {
        case .critical: return .red
        case .warning:  return .orange
        case .info:     return Color(hex: "#1e6fd9")
        }
    }

    var sfSymbol: String {
        switch self {
        case .critical: return "xmark.circle.fill"
        case .warning:  return "exclamationmark.triangle.fill"
        case .info:     return "info.circle.fill"
        }
    }
}

enum DTCSystem: String, CaseIterable {
    case engine       = "Engine"
    case transmission = "Transmission"
    case abs          = "ABS"
    case airbag       = "Airbag"
    case hvac         = "HVAC"
    case fuel         = "Fuel"
    case emissions    = "Emissions"

    var sfSymbol: String {
        switch self {
        case .engine:       return "bolt.circle"
        case .transmission: return "gearshape.2"
        case .abs:          return "car.front.waves.down"
        case .airbag:       return "figure.seated.seatbelt"
        case .hvac:         return "thermometer.medium"
        case .fuel:         return "fuelpump"
        case .emissions:    return "aqi.medium"
        }
    }

    var color: Color {
        switch self {
        case .engine:       return .red
        case .transmission: return .orange
        case .abs:          return .yellow
        case .airbag:       return .purple
        case .hvac:         return Color(hex: "#1e6fd9")
        case .fuel:         return .green
        case .emissions:    return Color(hex: "#8888a0")
        }
    }
}

struct FaultCode: Identifiable {
    let id           = UUID()
    let code:          String
    let system:        DTCSystem
    let severity:      Severity
    let shortDesc:     String
    let fullDesc:      String
    let probableCause: String
    let fixHint:       String
    var isExpanded:    Bool = false
}
