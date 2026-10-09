import SwiftUI

struct ConnectView: View {
    @EnvironmentObject var vm: OBDViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var tab: ConnectTab = .bluetooth

    enum ConnectTab { case bluetooth, wifi }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Status bar
                statusBar
                    .padding(.horizontal, 16)
                    .padding(.top, 12)

                // Tab picker
                Picker("Connection type", selection: $tab) {
                    Label("Bluetooth", systemImage: "antenna.radiowaves.left.and.right")
                        .tag(ConnectTab.bluetooth)
                    Label("Wi-Fi", systemImage: "wifi")
                        .tag(ConnectTab.wifi)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                Divider().background(Color.appCardBorder)

                if tab == .bluetooth {
                    BluetoothPanel()
                } else {
                    WiFiPanel()
                }
            }
            .background(Color.appBackground)
            .navigationTitle("Connect Adapter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundColor(.appAccent)
                }
            }
        }
    }

    private var statusBar: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(vm.connectionState.color.opacity(0.15))
                    .frame(width: 32, height: 32)
                Image(systemName: vm.connectionState.sfSymbol)
                    .foregroundColor(vm.connectionState.color)
                    .font(.system(size: 15, weight: .semibold))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(vm.connectionState.label)
                    .font(.subheadline.bold())
                    .foregroundColor(vm.connectionState.color)
                Text("VW T5 OBD II · ELM327")
                    .font(.caption2)
                    .foregroundColor(.appSubtext)
            }
            Spacer()
            if vm.connectionState.isReady {
                Button("Disconnect") {
                    vm.disconnectAdapter()
                }
                .font(.caption.bold())
                .foregroundColor(.red)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color.red.opacity(0.12))
                .cornerRadius(8)
            }
        }
        .padding(12)
        .background(Color.appCard)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12)
            .stroke(vm.connectionState.color.opacity(0.3), lineWidth: 1))
    }
}

// MARK: - Bluetooth panel

private struct BluetoothPanel: View {
    @EnvironmentObject var vm: OBDViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Scan button
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Nearby Adapters")
                            .font(.subheadline.bold())
                            .foregroundColor(.appText)
                        Text("Make sure your OBD adapter is plugged into the car's OBD port")
                            .font(.caption2)
                            .foregroundColor(.appSubtext)
                    }
                    Spacer()
                    Button {
                        if case .scanning = vm.connectionState {
                            vm.stopBLEScan()
                        } else {
                            vm.startBLEScan()
                        }
                    } label: {
                        if case .scanning = vm.connectionState {
                            Label("Stop", systemImage: "stop.circle")
                                .font(.caption.bold())
                                .foregroundColor(.red)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(Color.red.opacity(0.12))
                                .cornerRadius(10)
                        } else {
                            Label("Scan", systemImage: "antenna.radiowaves.left.and.right")
                                .font(.caption.bold())
                                .foregroundColor(.appAccent)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(Color.appAccent.opacity(0.12))
                                .cornerRadius(10)
                        }
                    }
                }
                .padding(14)
                .background(Color.appCard)
                .cornerRadius(12)

                // Scanning indicator
                if case .scanning = vm.connectionState {
                    HStack(spacing: 8) {
                        ProgressView()
                            .tint(.appAccent)
                        Text("Scanning for OBD adapters…")
                            .font(.caption)
                            .foregroundColor(.appSubtext)
                    }
                    .padding(.horizontal, 4)
                }

                // Device list
                if !vm.bleDevices.isEmpty {
                    VStack(spacing: 8) {
                        ForEach(vm.bleDevices) { device in
                            BLEDeviceRow(device: device)
                        }
                    }
                } else if !(vm.connectionState == .scanning) {
                    emptyState
                }

                // Help note
                infoCard(
                    icon: "info.circle",
                    text: "Only ELM327-compatible adapters are shown. If your adapter isn't listed, try unplugging and re-plugging it, then scan again."
                )
            }
            .padding(16)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "antenna.radiowaves.left.and.right.slash")
                .font(.system(size: 36))
                .foregroundColor(.appSubtext)
            Text("No adapters found")
                .font(.subheadline)
                .foregroundColor(.appSubtext)
            Text("Tap Scan to search for nearby ELM327 Bluetooth adapters")
                .font(.caption)
                .foregroundColor(.appSubtext.opacity(0.7))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }
}

private struct BLEDeviceRow: View {
    @EnvironmentObject var vm: OBDViewModel
    let device: DiscoveredDevice

    private var isThisConnected: Bool { vm.connectionState.isReady }

    var body: some View {
        HStack(spacing: 12) {
            // Signal strength icon
            ZStack {
                Circle().fill(Color.appAccent.opacity(0.12)).frame(width: 40, height: 40)
                Image(systemName: signalIcon)
                    .foregroundColor(.appAccent)
                    .font(.system(size: 16, weight: .semibold))
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(device.name)
                    .font(.subheadline.bold())
                    .foregroundColor(.appText)
                Text("RSSI \(device.rssi) dBm")
                    .font(.caption2)
                    .foregroundColor(.appSubtext)
            }
            Spacer()
            Button {
                vm.connectBLE(device)
            } label: {
                Text(isThisConnected ? "Connected" : "Connect")
                    .font(.caption.bold())
                    .foregroundColor(isThisConnected ? .green : .appAccent)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background((isThisConnected ? Color.green : Color.appAccent).opacity(0.12))
                    .cornerRadius(10)
            }
            .disabled(isThisConnected)
        }
        .padding(14)
        .background(Color.appCard)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12)
            .stroke(Color.appCardBorder, lineWidth: 1))
    }

    private var signalIcon: String {
        switch device.signalBars {
        case 3:  return "wifi"
        case 2:  return "wifi"
        default: return "wifi.exclamationmark"
        }
    }
}

// MARK: - WiFi panel

private struct WiFiPanel: View {
    @EnvironmentObject var vm: OBDViewModel
    @FocusState private var hostFocused: Bool
    @FocusState private var portFocused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Step 1 callout
                infoCard(
                    icon: "1.circle.fill",
                    text: "Go to iPhone Settings → Wi-Fi and connect to your OBD adapter's hotspot (e.g. \"WiFi_OBDII\" or \"ELM327\")."
                )

                // Step 2: IP + port
                VStack(alignment: .leading, spacing: 12) {
                    Text("Step 2 — Enter adapter address")
                        .font(.caption.bold())
                        .foregroundColor(.appSubtext)

                    VStack(spacing: 8) {
                        LabeledTextField(label: "IP Address", placeholder: "192.168.0.10",
                                         text: $vm.wifiHost, keyboardType: .decimalPad,
                                         focused: $hostFocused)
                        LabeledTextField(label: "Port", placeholder: "35000",
                                         text: $vm.wifiPort, keyboardType: .numberPad,
                                         focused: $portFocused)
                    }
                }

                // Connect button
                Button {
                    hostFocused = false; portFocused = false
                    vm.connectWiFi()
                } label: {
                    HStack {
                        Spacer()
                        if case .connecting = vm.connectionState {
                            ProgressView().tint(.white)
                        } else if case .initializing = vm.connectionState {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "wifi.circle.fill")
                            Text("Connect via Wi-Fi")
                        }
                        Spacer()
                    }
                    .font(.subheadline.bold())
                    .foregroundColor(.white)
                    .padding(.vertical, 14)
                    .background(vm.connectionState.isReady ? Color.green : Color.appAccent)
                    .cornerRadius(12)
                }
                .disabled(vm.connectionState.isReady ||
                          vm.connectionState == .connecting ||
                          vm.connectionState == .initializing)

                infoCard(
                    icon: "info.circle",
                    text: "Default address for most ELM327 WiFi adapters is 192.168.0.10:35000. Check your adapter's manual if this doesn't work."
                )
            }
            .padding(16)
        }
    }
}

// MARK: - Shared helpers

private func infoCard(icon: String, text: String) -> some View {
    HStack(alignment: .top, spacing: 10) {
        Image(systemName: icon)
            .foregroundColor(.appAccent)
            .font(.system(size: 15))
        Text(text)
            .font(.caption)
            .foregroundColor(.appSubtext)
    }
    .padding(12)
    .background(Color.appCard)
    .cornerRadius(10)
    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.appCardBorder, lineWidth: 1))
}

private struct LabeledTextField: View {
    let label:        String
    let placeholder:  String
    @Binding var text: String
    let keyboardType: UIKeyboardType
    var focused: FocusState<Bool>.Binding

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundColor(.appSubtext)
                .frame(width: 90, alignment: .leading)
            TextField(placeholder, text: $text)
                .keyboardType(keyboardType)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .focused(focused)
                .font(.subheadline.monospacedDigit())
                .foregroundColor(.appText)
        }
        .padding(12)
        .background(Color.appCard)
        .cornerRadius(10)
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.appCardBorder, lineWidth: 1))
    }
}
