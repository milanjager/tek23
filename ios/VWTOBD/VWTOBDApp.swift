import SwiftUI

@main
struct VWTOBDApp: App {
    @StateObject private var viewModel = OBDViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(viewModel)
                .preferredColorScheme(.dark)
        }
    }
}
