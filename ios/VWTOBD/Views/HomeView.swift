import SwiftUI

struct HomeView: View {
    @EnvironmentObject var vm: OBDViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    ConnectionBanner()
                    VWT5CarView()
                        .padding(.horizontal, 12)
                    gaugesGrid
                    quickActions
                }
                .padding(.vertical, 16)
            }
            .background(Color.appBackground)
            .navigationTitle("VW T5 OBD")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(vm.isConnected ? Color.green : Color.red)
                            .frame(width: 8, height: 8)
                        Text("VW T5 OBD")
                            .font(.headline)
                            .foregroundColor(.appText)
                    }
                }
            }
        }
    }

    private var gaugesGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            GaugeCard(
                title: "Engine RPM",
                value: String(format: "%.0f", vm.rpm),
                unit: "rpm",
                sfSymbol: "gauge.with.needle",
                color: .appAccent,
                progress: vm.rpm / 7000)

            GaugeCard(
                title: "Speed",
                value: vm.useMPH
                    ? String(format: "%.0f", vm.speed * 0.621371)
                    : String(format: "%.0f", vm.speed),
                unit: vm.useMPH ? "mph" : "km/h",
                sfSymbol: "speedometer",
                color: .green,
                progress: vm.speed / 220)

            GaugeCard(
                title: "Coolant",
                value: vm.displayTemp(vm.coolantTemp),
                unit: "",
                sfSymbol: "thermometer.medium",
                color: coolantColor,
                progress: (vm.coolantTemp + 40) / 160)

            GaugeCard(
                title: "Engine Load",
                value: String(format: "%.0f", vm.engineLoad),
                unit: "%",
                sfSymbol: "bolt.fill",
                color: loadColor,
                progress: vm.engineLoad / 100)
        }
        .padding(.horizontal, 16)
    }

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Quick Actions")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(.appSubtext)
                .padding(.horizontal, 16)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                QuickActionButton(title: "Scan Codes",  sfSymbol: "magnifyingglass",       color: .appAccent)
                QuickActionButton(title: "Live Data",   sfSymbol: "waveform.path.ecg",      color: .green)
                QuickActionButton(title: "Templates",   sfSymbol: "list.clipboard.fill",    color: .orange)
                QuickActionButton(title: "Settings",    sfSymbol: "gearshape.fill",         color: Color.appSubtext)
            }
            .padding(.horizontal, 16)
        }
    }

    private var coolantColor: Color {
        vm.coolantTemp < 60 ? .blue : vm.coolantTemp < 100 ? .green : .red
    }
    private var loadColor: Color {
        vm.engineLoad < 50 ? .green : vm.engineLoad < 80 ? .orange : .red
    }
}

// MARK: - Sub-views

struct ConnectionBanner: View {
    @EnvironmentObject var vm: OBDViewModel

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: vm.isConnected ? "cable.connector" : "cable.connector.slash")
                .foregroundColor(vm.isConnected ? .green : .red)
            VStack(alignment: .leading, spacing: 2) {
                Text(vm.isConnected ? "Connected" : "Disconnected")
                    .font(.subheadline.bold())
                    .foregroundColor(vm.isConnected ? .green : .red)
                Text(vm.isConnected
                     ? "\(vm.adapterType.rawValue) · Demo Mode"
                     : "No OBD adapter detected")
                    .font(.caption2)
                    .foregroundColor(.appSubtext)
            }
            Spacer()
            if vm.isConnected {
                Text("VW T5")
                    .font(.caption2.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.appAccent.opacity(0.2))
                    .foregroundColor(.appAccent)
                    .cornerRadius(6)
            }
        }
        .padding(14)
        .background(Color.appCard)
        .cornerRadius(14)
        .overlay(RoundedRectangle(cornerRadius: 14)
            .stroke(vm.isConnected ? Color.green.opacity(0.4) : Color.red.opacity(0.4), lineWidth: 1))
        .padding(.horizontal, 16)
    }
}

struct QuickActionButton: View {
    let title:    String
    let sfSymbol: String
    let color:    Color

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: sfSymbol)
                .font(.body)
                .foregroundColor(color)
                .frame(width: 28)
            Text(title)
                .font(.subheadline)
                .foregroundColor(.appText)
            Spacer()
        }
        .padding(14)
        .background(Color.appCard)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12)
            .stroke(Color.appCardBorder, lineWidth: 1))
    }
}
