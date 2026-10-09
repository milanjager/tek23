import SwiftUI

// Minimal SVG-style side-profile silhouette of the VW T5 Transporter drawn with SwiftUI Canvas.
struct VWT5CarView: View {
    var body: some View {
        Canvas { ctx, size in
            let w = size.width
            let h = size.height

            // --- Body outline ---
            var body = Path()
            body.move(to:    CGPoint(x: w*0.06,  y: h*0.72))  // front lower
            body.addLine(to: CGPoint(x: w*0.02,  y: h*0.72))  // front bumper base
            body.addLine(to: CGPoint(x: w*0.01,  y: h*0.58))  // bumper rise
            body.addLine(to: CGPoint(x: w*0.02,  y: h*0.42))  // grille top
            body.addLine(to: CGPoint(x: w*0.06,  y: h*0.30))  // bonnet lip
            body.addLine(to: CGPoint(x: w*0.13,  y: h*0.14))  // A-pillar base
            body.addQuadCurve(to:     CGPoint(x: w*0.22, y: h*0.06),
                              control: CGPoint(x: w*0.14, y: h*0.08))  // windscreen slope
            body.addLine(to: CGPoint(x: w*0.78,  y: h*0.06))  // roofline
            body.addLine(to: CGPoint(x: w*0.84,  y: h*0.10))  // C-pillar top
            body.addLine(to: CGPoint(x: w*0.95,  y: h*0.35))  // rear upper
            body.addLine(to: CGPoint(x: w*0.97,  y: h*0.52))  // rear face
            body.addLine(to: CGPoint(x: w*0.96,  y: h*0.72))  // rear lower
            body.addLine(to: CGPoint(x: w*0.86,  y: h*0.72))  // sill before rear wheel
            // rear wheel arch
            body.addQuadCurve(to:     CGPoint(x: w*0.74,  y: h*0.72),
                              control: CGPoint(x: w*0.80,  y: h*0.93))
            body.addLine(to: CGPoint(x: w*0.28,  y: h*0.72))  // sill before front wheel
            // front wheel arch
            body.addQuadCurve(to:     CGPoint(x: w*0.16,  y: h*0.72),
                              control: CGPoint(x: w*0.22,  y: h*0.93))
            body.addLine(to: CGPoint(x: w*0.06,  y: h*0.72))
            body.closeSubpath()

            ctx.fill(body,   with: .color(Color(hex: "#1e3a6e").opacity(0.55)))
            ctx.stroke(body, with: .color(Color(hex: "#1e6fd9")), lineWidth: 1.8)

            // --- Windscreen ---
            var wind = Path()
            wind.move(to:    CGPoint(x: w*0.14,  y: h*0.27))
            wind.addLine(to: CGPoint(x: w*0.18,  y: h*0.12))
            wind.addLine(to: CGPoint(x: w*0.36,  y: h*0.10))
            wind.addLine(to: CGPoint(x: w*0.36,  y: h*0.27))
            wind.closeSubpath()
            ctx.fill(wind, with: .color(Color(hex: "#1e6fd9").opacity(0.25)))

            // --- Side windows (sliding door style) ---
            let wins: [CGRect] = [
                CGRect(x: w*0.38, y: h*0.10, width: w*0.14, height: h*0.17),
                CGRect(x: w*0.54, y: h*0.10, width: w*0.14, height: h*0.17),
                CGRect(x: w*0.70, y: h*0.10, width: w*0.10, height: h*0.15),
            ]
            for r in wins {
                var p = Path(roundedRect: r, cornerRadius: 3)
                ctx.fill(p,   with: .color(Color(hex: "#1e6fd9").opacity(0.22)))
                ctx.stroke(p, with: .color(Color(hex: "#1e6fd9").opacity(0.55)), lineWidth: 1)
            }

            // --- Wheels ---
            for cx in [CGFloat(w*0.20), CGFloat(w*0.80)] {
                let wr: CGFloat = w * 0.075
                let cy: CGFloat = h * 0.81
                let rim = CGRect(x: cx - wr, y: cy - wr, width: wr*2, height: wr*2)
                var tire = Path(ellipseIn: rim.insetBy(dx: -wr*0.18, dy: -wr*0.18))
                ctx.fill(tire, with: .color(Color(hex: "#1a1a24")))
                ctx.stroke(Path(ellipseIn: rim.insetBy(dx: -wr*0.18, dy: -wr*0.18)),
                           with: .color(Color(hex: "#8888a0")), lineWidth: 1.2)
                ctx.stroke(Path(ellipseIn: rim),
                           with: .color(Color(hex: "#1e6fd9")), lineWidth: 1.5)
                // Hub dot
                let hub = CGRect(x: cx - wr*0.25, y: cy - wr*0.25, width: wr*0.5, height: wr*0.5)
                ctx.fill(Path(ellipseIn: hub), with: .color(Color(hex: "#1e6fd9")))
            }

            // --- VW emblem placeholder (circle + V shape) ---
            let ex: CGFloat = w*0.88, ey: CGFloat = h*0.55, er: CGFloat = w*0.025
            ctx.stroke(Path(ellipseIn: CGRect(x: ex-er, y: ey-er, width: er*2, height: er*2)),
                       with: .color(Color(hex: "#1e6fd9")), lineWidth: 1.2)
        }
        .aspectRatio(2.6, contentMode: .fit)
    }
}

#Preview {
    VWT5CarView()
        .padding(24)
        .background(Color.appBackground)
}
