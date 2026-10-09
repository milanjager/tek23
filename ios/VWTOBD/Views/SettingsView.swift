import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var vm: OBDViewModel

    var body: some View {
        NavigationStack {
            List {
                // Connection
                Section("OBD Adapter") {
                    Picker("Adapter Type", selection: $vm.adapterType) {
                        ForEach(AdapterType.allCases, id: \.self) {
                            Text($0.rawValue).tag($0)
                        }
                    }
                    Picker("OBD Protocol", selection: $vm.obdProtocol) {
                        ForEach(OBDProtocol.allCases, id: \.self) {
                            Text($0.rawValue).tag($0)
                        }
                    }
                    Toggle("Demo Mode (no adapter needed)", isOn: $vm.isDemoMode)
                        .tint(.appAccent)
                }
                .listRowBackground(Color.appCard)

                // Units
                Section("Units") {
                    Toggle("Use Fahrenheit (°F)", isOn: $vm.useFahrenheit)
                        .tint(.appAccent)
                    Toggle("Use Miles Per Hour (mph)", isOn: $vm.useMPH)
                        .tint(.appAccent)
                }
                .listRowBackground(Color.appCard)

                // VIN
                Section("Vehicle") {
                    HStack {
                        Text("VIN")
                            .foregroundColor(.appText)
                        Spacer()
                        TextField("e.g. WV1ZZZ7HZ6H000001", text: $vm.vin)
                            .font(.caption.monospaced())
                            .foregroundColor(.appAccent)
                            .multilineTextAlignment(.trailing)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                    }
                    if !vm.vin.isEmpty {
                        VINDecoderRow(vin: vm.vin)
                    }
                }
                .listRowBackground(Color.appCard)

                // About
                Section("About") {
                    LabeledContent("App Version", value: "1.0.0")
                    LabeledContent("OBD II Standard", value: "ISO 15031 / SAE J1979")
                    LabeledContent("Vehicle", value: "VW T5 Transporter (2003–2015)")
                    LabeledContent("Supported engines") {
                        Text("1.9 TDI · 2.0 TDI · 2.5 TDI · 2.0 Petrol · 3.2 V6")
                            .font(.caption)
                            .foregroundColor(.appSubtext)
                    }
                    Link("ELM327 Adapter Guide",
                         destination: URL(string: "https://www.elmelectronics.com/products/ics/obd/")!)
                        .foregroundColor(.appAccent)
                }
                .listRowBackground(Color.appCard)

                // Disclaimer
                Section {
                    Text("This app uses simulated data in Demo Mode. Always consult a qualified mechanic before undertaking repairs. Clearing fault codes does not fix underlying issues.")
                        .font(.caption)
                        .foregroundColor(.appSubtext)
                }
                .listRowBackground(Color.appBackground)
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.appBackground)
            .navigationTitle("Settings")
        }
    }
}

struct VINDecoderRow: View {
    let vin: String

    var make: String {
        guard vin.count >= 3 else { return "—" }
        switch String(vin.prefix(3)) {
        case "WV1", "WV2": return "VW Commercial"
        case "WVG": return "VW (SUV)"
        case "WV3": return "VW Bus"
        default: return vin.count >= 2 ? decodeMake(String(vin.prefix(2))) : "—"
        }
    }

    var modelYear: String {
        guard vin.count >= 10 else { return "—" }
        let c = vin[vin.index(vin.startIndex, offsetBy: 9)]
        let map: [Character: String] = [
            "1":"2001","2":"2002","3":"2003","4":"2004","5":"2005",
            "6":"2006","7":"2007","8":"2008","9":"2009","A":"2010",
            "B":"2011","C":"2012","D":"2013","E":"2014","F":"2015",
            "G":"2016","H":"2017","J":"2018","K":"2019","L":"2020",
        ]
        return map[c] ?? "—"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Make")
                    .font(.caption)
                    .foregroundColor(.appSubtext)
                Spacer()
                Text(make)
                    .font(.caption.bold())
                    .foregroundColor(.appText)
            }
            HStack {
                Text("Model Year")
                    .font(.caption)
                    .foregroundColor(.appSubtext)
                Spacer()
                Text(modelYear)
                    .font(.caption.bold())
                    .foregroundColor(.appText)
            }
        }
        .padding(.vertical, 2)
    }

    private func decodeMake(_ prefix: String) -> String {
        switch prefix {
        case "WV": return "Volkswagen"
        case "WA": return "Audi"
        case "WBA", "WBS": return "BMW"
        default: return "Unknown"
        }
    }
}
