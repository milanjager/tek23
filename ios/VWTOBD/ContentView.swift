import SwiftUI

struct ContentView: View {
    @EnvironmentObject var vm: OBDViewModel

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Dashboard", systemImage: "gauge.with.needle") }

            FaultCodesView()
                .badge(vm.faultCodes.filter { $0.severity == .critical }.count)
                .tabItem { Label("Fault Codes", systemImage: "exclamationmark.triangle.fill") }

            LiveDataView()
                .tabItem { Label("Live Data", systemImage: "waveform.path.ecg") }

            TemplatesView()
                .tabItem { Label("Templates", systemImage: "list.clipboard.fill") }

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }
        }
        .tint(Color.appAccent)
    }
}
