import Foundation

enum ELM327Parser {

    // MARK: - Response helpers

    static func isError(_ response: String) -> Bool {
        let u = response.uppercased()
        return u.contains("NO DATA") || u.contains("ERROR") || u.contains("UNABLE")
            || u.contains("BUS INIT") || u.contains("STOPPED") || u.contains("CAN ERROR")
            || u.contains("FB ERROR") || u.contains("DATA ERROR")
            || response.trimmingCharacters(in: .whitespacesAndNewlines) == "?"
    }

    static func isOK(_ response: String) -> Bool {
        response.uppercased().contains("OK")
    }

    static func parseVersion(_ response: String) -> String? {
        let lines = cleaned(response)
        return lines.first { $0.uppercased().contains("ELM") || $0.uppercased().contains("OBD") }
    }

    // MARK: - PID parser
    // pidHex: "010C", "010D" etc (mode + pid, 4 hex chars)
    // Returns nil when no valid data found

    static func parsePID(pidHex: String, response: String) -> Double? {
        guard pidHex.count == 4,
              let modeVal = UInt8(pidHex.prefix(2), radix: 16) else { return nil }
        let pidOnly  = String(pidHex.suffix(2)).uppercased()
        let respMode = String(format: "%02X", modeVal + 0x40) // 01 → 41

        for line in cleaned(response) {
            let tokens = line.uppercased().components(separatedBy: " ").filter { !$0.isEmpty }
            guard tokens.count >= 3,
                  tokens[0] == respMode,
                  tokens[1] == pidOnly else { continue }
            let bytes = tokens.dropFirst(2).compactMap { UInt8($0, radix: 16) }
            return decode(pid: pidOnly, bytes: bytes)
        }
        return nil
    }

    // MARK: - DTC parser
    // Returns array of DTC code strings, e.g. ["P0299", "C0031"]

    static func parseDTCs(_ response: String) -> [String] {
        var codes: [String] = []
        for line in cleaned(response) {
            let tokens = line.uppercased().components(separatedBy: " ").filter { !$0.isEmpty }
            guard tokens.first == "43", tokens.count >= 3 else { continue }
            var i = 1
            while i + 1 < tokens.count {
                guard let b1 = UInt8(tokens[i], radix: 16),
                      let b2 = UInt8(tokens[i + 1], radix: 16),
                      !(b1 == 0 && b2 == 0) else { i += 2; continue }
                codes.append(dtcString(b1, b2))
                i += 2
            }
        }
        return codes
    }

    // MARK: - Private helpers

    private static func cleaned(_ response: String) -> [String] {
        response
            .components(separatedBy: CharacterSet(charactersIn: "\r\n>"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty && $0 != "?" }
    }

    private static func decode(pid: String, bytes: [UInt8]) -> Double? {
        guard !bytes.isEmpty else { return nil }
        let a = Double(bytes[0])
        let b = bytes.count > 1 ? Double(bytes[1]) : 0.0

        switch pid {
        case "0C": return (a * 256 + b) / 4.0           // RPM
        case "0D": return a                              // Speed km/h
        case "05": return a - 40                         // Coolant °C
        case "04": return a * 100.0 / 255.0             // Engine load %
        case "0F": return a - 40                         // IAT °C
        case "10": return (a * 256 + b) / 100.0         // MAF g/s
        case "11": return a * 100.0 / 255.0             // Throttle %
        case "06", "07": return (a - 128) * 100.0 / 128.0 // Fuel trim %
        case "14": return a / 200.0                     // O2 sensor V
        case "5C": return a - 40                         // Oil temp °C
        case "0E": return a / 2.0 - 64.0                // Timing advance °
        default:   return nil
        }
    }

    private static func dtcString(_ b1: UInt8, _ b2: UInt8) -> String {
        let sys  = ["P", "C", "B", "U"][Int((b1 >> 6) & 0x03)]
        let d1   = Int((b1 >> 4) & 0x03)
        let d2   = Int(b1 & 0x0F)
        let d3   = Int((b2 >> 4) & 0x0F)
        let d4   = Int(b2 & 0x0F)
        return String(format: "%@%d%X%X%X", sys, d1, d2, d3, d4).uppercased()
    }
}
