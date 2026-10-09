import SwiftUI

struct LiveDataView: View {
    @EnvironmentObject var vm: OBDViewModel

    var body: some View {
        NavigationStack {
            List {
                ForEach(PIDGroup.allCases, id: \.self) { group in
                    let pids = vm.pids.filter { $0.group == group }
                    if !pids.isEmpty {
                        Section {
                            ForEach(pids.indices, id: \.self) { i in
                                let idx = vm.pids.firstIndex(where: { $0.id == pids[i].id })!
                                PIDRow(pid: vm.pids[idx]) {
                                    vm.pids[idx].isEnabled.toggle()
                                }
                            }
                        } header: {
                            HStack(spacing: 6) {
                                Image(systemName: group.sfSymbol)
                                    .foregroundColor(group.color)
                                Text(group.rawValue.uppercased())
                                    .font(.caption.bold())
                                    .foregroundColor(.appSubtext)
                            }
                        }
                        .listRowBackground(Color.appCard)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.appBackground)
            .navigationTitle("Live Data")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    RefreshPicker(interval: $vm.refreshRate)
                }
            }
        }
    }
}

struct PIDRow: View {
    let pid:    LiveDataPID
    let toggle: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Toggle("", isOn: .init(get: { pid.isEnabled },
                                   set: { _ in toggle() }))
                .labelsHidden()
                .tint(.appAccent)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(pid.name)
                        .font(.subheadline)
                        .foregroundColor(pid.isEnabled ? .appText : .appSubtext)
                    Spacer()
                    Text(pid.display)
                        .font(.subheadline.bold().monospaced())
                        .foregroundColor(pid.isEnabled ? pid.group.color : .appSubtext)
                }
                if pid.isEnabled {
                    SparklineView(data: pid.history, color: pid.group.color, height: 22)
                }
            }
        }
        .padding(.vertical, 6)
        .opacity(pid.isEnabled ? 1 : 0.5)
    }
}

struct RefreshPicker: View {
    @Binding var interval: TimeInterval

    var body: some View {
        Menu {
            ForEach([1.0, 2.0, 5.0], id: \.self) { v in
                Button("\(Int(v)) s") { interval = v }
            }
        } label: {
            Label("\(Int(interval)) s", systemImage: "clock.arrow.2.circlepath")
                .font(.subheadline)
        }
    }
}
