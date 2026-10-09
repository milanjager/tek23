import SwiftUI

enum Difficulty: String {
    case beginner     = "Beginner"
    case intermediate = "Intermediate"

    var color: Color {
        switch self {
        case .beginner:     return .green
        case .intermediate: return .orange
        }
    }
}

enum StepStatus {
    case pending, inProgress, passed, failed

    var color: Color {
        switch self {
        case .pending:    return Color(hex: "#8888a0")
        case .inProgress: return Color(hex: "#1e6fd9")
        case .passed:     return .green
        case .failed:     return .red
        }
    }

    var sfSymbol: String {
        switch self {
        case .pending:    return "circle"
        case .inProgress: return "arrow.right.circle.fill"
        case .passed:     return "checkmark.circle.fill"
        case .failed:     return "xmark.circle.fill"
        }
    }
}

struct TemplateStep: Identifiable {
    let id          = UUID()
    let number:       Int
    let instruction:  String
    let lookFor:      String
    var status:       StepStatus = .pending
}

struct DiagnosticTemplate: Identifiable {
    let id:                UUID = UUID()
    let name:              String
    let sfSymbol:          String
    let description:       String
    let estimatedMinutes:  Int
    let difficulty:        Difficulty
    let relevantCodes:     [String]
    var steps:             [TemplateStep]
}
