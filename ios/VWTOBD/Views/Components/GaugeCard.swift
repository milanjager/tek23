import SwiftUI

struct GaugeCard: View {
    let title:    String
    let value:    String
    let unit:     String
    let sfSymbol: String
    let color:    Color
    let progress: Double   // 0…1

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: sfSymbol)
                    .font(.caption)
                    .foregroundColor(color)
                Text(title)
                    .font(.caption)
                    .foregroundColor(.appSubtext)
                Spacer()
            }

            HStack(alignment: .lastTextBaseline, spacing: 3) {
                Text(value)
                    .font(.title2.bold())
                    .foregroundColor(.appText)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                if !unit.isEmpty {
                    Text(unit)
                        .font(.caption2)
                        .foregroundColor(.appSubtext)
                }
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.appCardBorder)
                        .frame(height: 4)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(color)
                        .frame(width: geo.size.width * progress.clamped(to: 0...1), height: 4)
                }
            }
            .frame(height: 4)
        }
        .padding(14)
        .background(Color.appCard)
        .cornerRadius(14)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.appCardBorder, lineWidth: 1)
        )
    }
}

#Preview {
    HStack {
        GaugeCard(title: "RPM", value: "832", unit: "rpm",
                  sfSymbol: "gauge.with.needle", color: .appAccent, progress: 0.12)
        GaugeCard(title: "Coolant", value: "87°C", unit: "",
                  sfSymbol: "thermometer.medium", color: .red, progress: 0.8)
    }
    .padding()
    .background(Color.appBackground)
}
