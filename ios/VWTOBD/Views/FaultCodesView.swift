import SwiftUI

struct FaultCodesView: View {
    @EnvironmentObject var vm: OBDViewModel
    @State private var showClearConfirm = false
    @State private var filterSystem: DTCSystem? = nil

    var filtered: [FaultCode] {
        guard let s = filterSystem else { return vm.faultCodes }
        return vm.faultCodes.filter { $0.system == s }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Scan progress bar
                if vm.isScanning {
                    ProgressView(value: vm.scanProgress)
                        .progressViewStyle(.linear)
                        .tint(.appAccent)
                        .padding(.horizontal)
                        .padding(.top, 8)
                }

                // Filter chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip(label: "All", active: filterSystem == nil) {
                            filterSystem = nil
                        }
                        ForEach(DTCSystem.allCases, id: \.self) { sys in
                            FilterChip(label: sys.rawValue, active: filterSystem == sys) {
                                filterSystem = filterSystem == sys ? nil : sys
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                }

                Divider().background(Color.appCardBorder)

                if vm.isScanning {
                    scanningView
                } else if filtered.isEmpty {
                    emptyView
                } else {
                    codesList
                }
            }
            .background(Color.appBackground)
            .navigationTitle("Fault Codes")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        vm.scanForCodes()
                    } label: {
                        Label("Scan", systemImage: "magnifyingglass")
                            .font(.subheadline)
                    }
                    .disabled(vm.isScanning)
                }
                if !vm.faultCodes.isEmpty {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button(role: .destructive) {
                            showClearConfirm = true
                        } label: {
                            Label("Clear", systemImage: "trash")
                                .font(.subheadline)
                        }
                    }
                }
            }
            .confirmationDialog("Clear all fault codes?",
                                isPresented: $showClearConfirm,
                                titleVisibility: .visible) {
                Button("Clear All Codes", role: .destructive) { vm.clearCodes() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will clear all stored codes from the ECU. Only do this after recording them.")
            }
        }
    }

    private var scanningView: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "magnifyingglass.circle")
                .font(.system(size: 52))
                .foregroundColor(.appAccent)
                .symbolEffect(.pulse)
            Text("Scanning ECU modules…")
                .foregroundColor(.appSubtext)
            Text(String(format: "%.0f%%", vm.scanProgress * 100))
                .font(.title3.bold())
                .foregroundColor(.appText)
            Spacer()
        }
    }

    private var emptyView: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 52))
                .foregroundColor(.green)
            Text("No Fault Codes")
                .font(.headline)
                .foregroundColor(.appText)
            Text("Tap Scan to read codes from all ECU modules.")
                .font(.subheadline)
                .foregroundColor(.appSubtext)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button {
                vm.scanForCodes()
            } label: {
                Label("Scan Now", systemImage: "magnifyingglass")
                    .padding(.horizontal, 28)
                    .padding(.vertical, 10)
                    .background(Color.appAccent)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
            Spacer()
        }
    }

    private var codesList: some View {
        List {
            Section {
                HStack {
                    Text("\(filtered.count) code\(filtered.count == 1 ? "" : "s") found")
                        .font(.caption)
                        .foregroundColor(.appSubtext)
                    Spacer()
                    let critical = filtered.filter { $0.severity == .critical }.count
                    if critical > 0 {
                        Label("\(critical) critical", systemImage: "xmark.circle.fill")
                            .font(.caption.bold())
                            .foregroundColor(.red)
                    }
                }
                .listRowBackground(Color.appBackground)
            }

            ForEach(filtered) { code in
                FaultCodeRow(code: code) {
                    vm.toggleExpand(code)
                }
                .listRowBackground(Color.appCard)
                .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 12))
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.appBackground)
    }
}

// MARK: - FaultCodeRow

struct FaultCodeRow: View {
    let code:     FaultCode
    let onTap:    () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onTap) {
                HStack(spacing: 12) {
                    // System icon
                    Image(systemName: code.system.sfSymbol)
                        .font(.body)
                        .foregroundColor(code.system.color)
                        .frame(width: 28)

                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(code.code)
                                .font(.subheadline.bold().monospaced())
                                .foregroundColor(.appText)
                            Spacer()
                            SeverityBadge(severity: code.severity)
                        }
                        Text(code.shortDesc)
                            .font(.caption)
                            .foregroundColor(.appSubtext)
                            .lineLimit(1)
                    }

                    Image(systemName: code.isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundColor(.appSubtext)
                }
                .padding(.vertical, 10)
            }
            .buttonStyle(.plain)

            if code.isExpanded {
                Divider().background(Color.appCardBorder).padding(.leading, 40)

                VStack(alignment: .leading, spacing: 10) {
                    DetailRow(label: "Description", value: code.fullDesc)
                    DetailRow(label: "Probable Cause", value: code.probableCause)
                    DetailRow(label: "Fix Hint", value: code.fixHint)
                }
                .padding(.leading, 40)
                .padding(.trailing, 8)
                .padding(.vertical, 10)
            }
        }
    }
}

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(.caption.bold())
                .foregroundColor(.appSubtext)
            Text(value)
                .font(.caption)
                .foregroundColor(.appText)
        }
    }
}

struct SeverityBadge: View {
    let severity: Severity

    var body: some View {
        Label(severity.rawValue, systemImage: severity.sfSymbol)
            .font(.caption2.bold())
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(severity.color.opacity(0.18))
            .foregroundColor(severity.color)
            .cornerRadius(6)
    }
}

struct FilterChip: View {
    let label:  String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption.bold())
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(active ? Color.appAccent : Color.appCard)
                .foregroundColor(active ? .white : .appSubtext)
                .cornerRadius(20)
                .overlay(RoundedRectangle(cornerRadius: 20)
                    .stroke(active ? Color.appAccent : Color.appCardBorder, lineWidth: 1))
        }
    }
}
