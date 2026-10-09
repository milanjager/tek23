import SwiftUI

struct TemplatesView: View {
    @EnvironmentObject var vm: OBDViewModel
    @State private var showRunner = false

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 12) {
                    Text("Select a template to run a guided step-by-step diagnosis.")
                        .font(.subheadline)
                        .foregroundColor(.appSubtext)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16)
                        .padding(.top, 8)

                    ForEach(DiagnosticTemplates.all) { template in
                        TemplateCard(template: template) {
                            vm.startTemplate(template)
                            showRunner = true
                        }
                    }
                }
                .padding(.bottom, 20)
            }
            .background(Color.appBackground)
            .navigationTitle("Diagnostic Templates")
        }
        .sheet(isPresented: $showRunner) {
            if let t = vm.activeTemplate {
                TemplateRunnerView(template: t)
                    .environmentObject(vm)
            }
        }
    }
}

// MARK: - Template Card

struct TemplateCard: View {
    let template: DiagnosticTemplate
    let onRun:    () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Image(systemName: template.sfSymbol)
                    .font(.title2)
                    .foregroundColor(.appAccent)
                    .frame(width: 36, height: 36)
                    .background(Color.appAccent.opacity(0.15))
                    .cornerRadius(10)

                VStack(alignment: .leading, spacing: 3) {
                    Text(template.name)
                        .font(.headline)
                        .foregroundColor(.appText)
                    HStack(spacing: 8) {
                        Label("~\(template.estimatedMinutes) min",
                              systemImage: "clock")
                            .font(.caption)
                            .foregroundColor(.appSubtext)
                        DifficultyBadge(difficulty: template.difficulty)
                    }
                }
                Spacer()
            }

            Text(template.description)
                .font(.subheadline)
                .foregroundColor(.appSubtext)
                .lineLimit(2)

            if !template.relevantCodes.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(template.relevantCodes, id: \.self) { code in
                            Text(code)
                                .font(.caption2.monospaced().bold())
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(Color.appCardBorder)
                                .foregroundColor(.appSubtext)
                                .cornerRadius(5)
                        }
                    }
                }
            }

            HStack {
                Spacer()
                Button(action: onRun) {
                    Label("Run Template", systemImage: "play.fill")
                        .font(.subheadline.bold())
                        .padding(.horizontal, 20)
                        .padding(.vertical, 9)
                        .background(Color.appAccent)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                }
            }
        }
        .padding(16)
        .background(Color.appCard)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16)
            .stroke(Color.appCardBorder, lineWidth: 1))
        .padding(.horizontal, 16)
    }
}

struct DifficultyBadge: View {
    let difficulty: Difficulty

    var body: some View {
        Text(difficulty.rawValue)
            .font(.caption2.bold())
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(difficulty.color.opacity(0.2))
            .foregroundColor(difficulty.color)
            .cornerRadius(5)
    }
}

// MARK: - Template Runner Sheet

struct TemplateRunnerView: View {
    let template: DiagnosticTemplate
    @EnvironmentObject var vm: OBDViewModel
    @Environment(\.dismiss) var dismiss

    var currentStep: TemplateStep? {
        vm.runnerIndex < vm.runnerSteps.count ? vm.runnerSteps[vm.runnerIndex] : nil
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Progress header
                progressHeader

                if vm.isTemplateFinished {
                    finishedView
                } else if let step = currentStep {
                    stepView(step)
                }
            }
            .background(Color.appBackground)
            .navigationTitle(template.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        vm.closeTemplate()
                        dismiss()
                    }
                    .foregroundColor(.appSubtext)
                }
            }
        }
    }

    private var progressHeader: some View {
        VStack(spacing: 10) {
            // Step indicators
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(vm.runnerSteps.indices, id: \.self) { i in
                        let step = vm.runnerSteps[i]
                        Circle()
                            .fill(step.status.color)
                            .frame(width: 28, height: 28)
                            .overlay(
                                Text("\(i + 1)")
                                    .font(.caption2.bold())
                                    .foregroundColor(.white)
                            )
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }

            ProgressView(value: Double(vm.runnerIndex),
                         total: Double(max(vm.runnerSteps.count, 1)))
                .tint(.appAccent)
                .padding(.horizontal, 16)

            Text("Step \(min(vm.runnerIndex + 1, vm.runnerSteps.count)) of \(vm.runnerSteps.count)")
                .font(.caption)
                .foregroundColor(.appSubtext)
                .padding(.bottom, 8)
        }
        .background(Color.appCard)
    }

    private func stepView(_ step: TemplateStep) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Step instruction
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Image(systemName: "wrench.and.screwdriver.fill")
                            .foregroundColor(.appAccent)
                        Text("What to do")
                            .font(.subheadline.bold())
                            .foregroundColor(.appSubtext)
                    }
                    Text(step.instruction)
                        .font(.body)
                        .foregroundColor(.appText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(16)
                .background(Color.appCard)
                .cornerRadius(14)

                // What to look for
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Image(systemName: "eye.fill")
                            .foregroundColor(.orange)
                        Text("What to look for")
                            .font(.subheadline.bold())
                            .foregroundColor(.appSubtext)
                    }
                    Text(step.lookFor)
                        .font(.body)
                        .foregroundColor(.appText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(16)
                .background(Color.appCard)
                .cornerRadius(14)

                // Pass / Fail buttons
                HStack(spacing: 12) {
                    Button {
                        vm.advanceRunner(passed: false)
                    } label: {
                        Label("Issue Found", systemImage: "xmark.circle.fill")
                            .font(.subheadline.bold())
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.red.opacity(0.15))
                            .foregroundColor(.red)
                            .cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.red.opacity(0.4), lineWidth: 1))
                    }

                    Button {
                        vm.advanceRunner(passed: true)
                    } label: {
                        Label("All Good", systemImage: "checkmark.circle.fill")
                            .font(.subheadline.bold())
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.green.opacity(0.15))
                            .foregroundColor(.green)
                            .cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.green.opacity(0.4), lineWidth: 1))
                    }
                }
                .padding(.top, 6)
            }
            .padding(16)
        }
    }

    private var finishedView: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 60))
                .foregroundColor(.appAccent)

            Text("Diagnosis Complete")
                .font(.title2.bold())
                .foregroundColor(.appText)

            let failed = vm.runnerSteps.filter { $0.status == .failed }.count
            let passed = vm.runnerSteps.filter { $0.status == .passed }.count

            VStack(spacing: 8) {
                ResultLine(label: "Steps passed",   value: "\(passed)", color: .green)
                ResultLine(label: "Issues found",   value: "\(failed)", color: failed > 0 ? .red : .green)
                if failed > 0 {
                    Text("Refer to the fault codes and fix hints for the failed steps.")
                        .font(.caption)
                        .foregroundColor(.appSubtext)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 20)
                }
            }
            .padding(16)
            .background(Color.appCard)
            .cornerRadius(14)
            .padding(.horizontal, 20)

            Button {
                vm.closeTemplate()
                dismiss()
            } label: {
                Text("Done")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.appAccent)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                    .padding(.horizontal, 20)
            }
            Spacer()
        }
    }
}

struct ResultLine: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundColor(.appSubtext)
            Spacer()
            Text(value)
                .font(.subheadline.bold())
                .foregroundColor(color)
        }
    }
}
