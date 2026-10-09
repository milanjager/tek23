import SwiftUI

struct SparklineView: View {
    let data:    [Double]
    let color:   Color
    var height:  CGFloat = 28

    private var normalised: [Double] {
        guard let lo = data.min(), let hi = data.max(), hi > lo else {
            return data.map { _ in 0.5 }
        }
        return data.map { ($0 - lo) / (hi - lo) }
    }

    var body: some View {
        GeometryReader { geo in
            let pts = normalised
            if pts.count > 1 {
                let step = geo.size.width / CGFloat(pts.count - 1)
                Path { path in
                    for (i, v) in pts.enumerated() {
                        let x = CGFloat(i) * step
                        let y = geo.size.height * (1 - CGFloat(v))
                        if i == 0 { path.move(to: CGPoint(x: x, y: y)) }
                        else       { path.addLine(to: CGPoint(x: x, y: y)) }
                    }
                }
                .stroke(color, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))

                // Fill under line
                Path { path in
                    let start = CGPoint(x: 0, y: geo.size.height * (1 - CGFloat(pts[0])))
                    path.move(to: start)
                    for (i, v) in pts.enumerated() {
                        let x = CGFloat(i) * step
                        let y = geo.size.height * (1 - CGFloat(v))
                        path.addLine(to: CGPoint(x: x, y: y))
                    }
                    path.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height))
                    path.addLine(to: CGPoint(x: 0, y: geo.size.height))
                    path.closeSubpath()
                }
                .fill(color.opacity(0.15))
            }
        }
        .frame(height: height)
    }
}
