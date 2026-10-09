import Foundation

enum DiagnosticTemplates {
    static let all: [DiagnosticTemplate] = [
        coldStart, roughIdle, turboPower, egr, fuelSystem, absWarning, glowPlugs, dpfEmissions
    ]

    // MARK: 1 - Cold Start Issues
    static let coldStart = DiagnosticTemplate(
        name: "Cold Start Issues",
        sfSymbol: "thermometer.snowflake",
        description: "Diagnose hard starts, rough running, or white/blue smoke on a cold engine.",
        estimatedMinutes: 6,
        difficulty: .beginner,
        relevantCodes: ["P0115", "P0113", "P0380", "P0381", "P0171"],
        steps: [
            TemplateStep(number: 1,
                         instruction: "Connect OBD adapter and go to Live Data. Enable Coolant Temp and Intake Air Temp.",
                         lookFor: "Coolant temp should read close to ambient (e.g. 5–15 °C on a cold morning). If it reads 90 °C immediately the coolant sensor (G62) is faulty."),
            TemplateStep(number: 2,
                         instruction: "On a TDI diesel: watch the Glow Plug Indicator. With ignition ON, the coil symbol should glow for 2–5 seconds.",
                         lookFor: "If the glow plug lamp doesn't light, scan for B/P0380–P0384. Failed glow plugs cause hard cold starts, especially below 5 °C."),
            TemplateStep(number: 3,
                         instruction: "Start the engine cold. Watch Short Term Fuel Trim (STFT) in Live Data.",
                         lookFor: "STFT should be within ±10 % at idle. Values more positive than +15 % indicate a vacuum leak or failed MAF (lean). More negative than −15 % indicates a rich condition."),
            TemplateStep(number: 4,
                         instruction: "Watch the coolant temp gauge while the engine warms. It should rise steadily.",
                         lookFor: "Temperature should reach 87–95 °C within 5–10 minutes. If it stays low and the cabin heater is cold, the thermostat is stuck open (very common on T5)."),
            TemplateStep(number: 5,
                         instruction: "Scan for fault codes after warm-up.",
                         lookFor: "Codes P0115 (coolant sensor), P0113 (IAT high), P0380 (glow plug) confirm the components identified above."),
        ]
    )

    // MARK: 2 - Rough Idle / Misfire
    static let roughIdle = DiagnosticTemplate(
        name: "Rough Idle / Misfire",
        sfSymbol: "waveform.path.ecg.rectangle",
        description: "Identify cylinder misfires, rough running, and engine vibration at idle.",
        estimatedMinutes: 8,
        difficulty: .beginner,
        relevantCodes: ["P0300", "P0301", "P0302", "P0303", "P0304", "P0305"],
        steps: [
            TemplateStep(number: 1,
                         instruction: "Scan fault codes first. Note any P030X misfire codes.",
                         lookFor: "P0301–P0305 tells you which cylinder is misfiring. P0300 (random misfire) means multiple cylinders or a shared fault like low fuel pressure."),
            TemplateStep(number: 2,
                         instruction: "In Live Data, watch Engine RPM at idle. Note if it is stable or hunting.",
                         lookFor: "Idle should be 700–850 rpm and stable. Hunting/fluctuating idle (±100 rpm) often points to a vacuum leak or a sticking throttle body (petrol engines)."),
            TemplateStep(number: 3,
                         instruction: "Watch the MAF reading at idle in g/s.",
                         lookFor: "For a T5 2.0 TDI at warm idle: ~4–6 g/s. For the 2.5 TDI: ~6–9 g/s. A very low reading (<3 g/s) suggests a dirty/failed MAF or blocked air filter."),
            TemplateStep(number: 4,
                         instruction: "Petrol T5 only: On a warm engine, pull each ignition coil connector briefly one at a time (engine running) to identify a dead cylinder.",
                         lookFor: "A healthy cylinder will cause RPM to drop noticeably when its coil is disconnected. No RPM change = that cylinder is already misfiring."),
            TemplateStep(number: 5,
                         instruction: "Check Throttle Position at idle.",
                         lookFor: "Throttle should read 14–17 % at idle. Values outside this range or a P1545 code indicate the throttle body needs cleaning and adaptation."),
            TemplateStep(number: 6,
                         instruction: "Clear codes and test drive. Return and re-scan.",
                         lookFor: "Recurring P030X codes after a test drive confirm the misfire is active. Single P0300 that doesn't return may have been a temporary fault."),
        ]
    )

    // MARK: 3 - Turbo / No Power
    static let turboPower = DiagnosticTemplate(
        name: "No Power / Turbo Issues",
        sfSymbol: "bolt.circle",
        description: "Diagnose loss of power, lack of boost, or turbo-related faults on T5 TDI engines.",
        estimatedMinutes: 7,
        difficulty: .intermediate,
        relevantCodes: ["P0299", "P0234", "P0235", "P0101"],
        steps: [
            TemplateStep(number: 1,
                         instruction: "Scan for fault codes. Note any turbo or boost-related codes.",
                         lookFor: "P0299 (underboost) is most common. P0234 (overboost) is rarer but can cause the ECU to cut power as protection."),
            TemplateStep(number: 2,
                         instruction: "In Live Data, watch Boost Pressure Sensor (if available) during a gentle acceleration.",
                         lookFor: "At light throttle: 1.0–1.3 bar absolute. At full throttle: T5 2.5 TDI should reach ~2.0–2.3 bar. Low values confirm underboost."),
            TemplateStep(number: 3,
                         instruction: "Inspect the intercooler hoses. Squeeze each hose by hand with the engine OFF.",
                         lookFor: "Any hose that collapses easily or shows cracks/splits needs replacing. T5 top intercooler hose (from intercooler to throttle body) is a common failure point."),
            TemplateStep(number: 4,
                         instruction: "Check the N75 boost control solenoid (located near the battery in the engine bay).",
                         lookFor: "With the engine running, the solenoid should click audibly when vacuum is applied/released. No click = solenoid likely failed. Resistance should be ~26 Ω."),
            TemplateStep(number: 5,
                         instruction: "Check the VNT actuator on the turbo. It is connected via a vacuum hose to the N75 solenoid.",
                         lookFor: "The actuator rod should move freely over its full range (about 10–15 mm). A seized actuator means the variable vanes are stuck — a very common T5 TDI fault."),
        ]
    )

    // MARK: 4 - EGR System
    static let egr = DiagnosticTemplate(
        name: "EGR System Check",
        sfSymbol: "arrow.triangle.2.circlepath",
        description: "Check the EGR valve and cooler for carbon build-up and mechanical faults.",
        estimatedMinutes: 5,
        difficulty: .beginner,
        relevantCodes: ["P0400", "P0401", "P0402", "P0404"],
        steps: [
            TemplateStep(number: 1,
                         instruction: "Scan for EGR fault codes (P0400–P0404).",
                         lookFor: "P0401 = insufficient flow (blocked/stuck closed). P0402 = excessive flow (stuck open). P0404 = position sensor disagreement."),
            TemplateStep(number: 2,
                         instruction: "In Live Data, look for EGR Position (if available) or watch idle stability.",
                         lookFor: "A stuck-open EGR at idle causes a very rough, lumpy idle on diesel. A stuck-closed EGR won't affect idle but causes emissions test failure and excess NOx."),
            TemplateStep(number: 3,
                         instruction: "With engine OFF, locate the EGR valve (on the intake manifold near the firewall on T5 TDI). Try to move the valve plate by hand through the inlet.",
                         lookFor: "The valve plate should move freely. If it is seized solid with carbon, cleaning or replacement is needed."),
            TemplateStep(number: 4,
                         instruction: "Check the coolant level and look for signs of coolant loss (especially on 2.5 TDI with EGR cooler).",
                         lookFor: "A cracked EGR cooler on the 2.5 TDI loses coolant into the inlet manifold. White steam from the exhaust and dropping coolant level are the telltale signs."),
        ]
    )

    // MARK: 5 - Fuel System
    static let fuelSystem = DiagnosticTemplate(
        name: "Fuel System Diagnosis",
        sfSymbol: "fuelpump.fill",
        description: "Analyse fuel trims, O2 sensor behaviour, and fuel pressure on petrol T5 engines.",
        estimatedMinutes: 8,
        difficulty: .intermediate,
        relevantCodes: ["P0171", "P0172", "P0191"],
        steps: [
            TemplateStep(number: 1,
                         instruction: "Warm the engine fully. Go to Live Data and enable Short Fuel Trim (STFT) and Long Fuel Trim (LTFT).",
                         lookFor: "Ideal values: STFT ±5 %, LTFT ±5 %. LTFT >+10 % = chronic lean condition. LTFT <−10 % = chronic rich condition."),
            TemplateStep(number: 2,
                         instruction: "Watch the O2 Sensor 1 (pre-cat, Bank 1) voltage while engine is at warm idle.",
                         lookFor: "The voltage should swing rapidly between 0.1–0.9 V, crossing 0.45 V more than once per second. A slow-moving or stuck sensor needs replacing."),
            TemplateStep(number: 3,
                         instruction: "Snap the throttle from idle to full and back. Watch O2 sensor and fuel trims.",
                         lookFor: "On snap acceleration, STFT should go negative (engine briefly rich). On deceleration cut, STFT should go very negative (−25 %). If trims don't respond, O2 sensor or ECU issue."),
            TemplateStep(number: 4,
                         instruction: "If LTFT is persistently lean (+10 to +25 %), check for vacuum leaks. Spray small amounts of water around intake manifold joints with the engine running.",
                         lookFor: "If idle speed briefly improves when you spray a joint, that area has a vacuum leak. Common T5 leak points: intake manifold gasket, brake servo hose, idle air bypass hose."),
            TemplateStep(number: 5,
                         instruction: "Scan and clear codes. Perform a 15-minute drive including some steady motorway speed.",
                         lookFor: "Check if P0171 or P0172 returns. If LTFT stabilises within ±5 % after the drive, the ECU has adapted and the fault may be resolved."),
        ]
    )

    // MARK: 6 - ABS / Brakes
    static let absWarning = DiagnosticTemplate(
        name: "ABS / Brake Warning",
        sfSymbol: "car.front.waves.down",
        description: "Identify ABS, ESP and traction control faults from wheel speed sensor issues.",
        estimatedMinutes: 5,
        difficulty: .beginner,
        relevantCodes: ["C0031", "C0034", "C0037", "C0040", "C0051"],
        steps: [
            TemplateStep(number: 1,
                         instruction: "Scan the ABS module (Module 03 in VCDS). Note all stored fault codes.",
                         lookFor: "C003X codes indicate a specific wheel speed sensor. C0051 = plausibility error across sensors. Note which corner is flagged."),
            TemplateStep(number: 2,
                         instruction: "Go to Live Data in the ABS module and drive slowly (~10 km/h). Watch all 4 wheel speed sensors.",
                         lookFor: "All 4 values should be the same at a constant speed. A sensor reading 0 or erratically is faulty."),
            TemplateStep(number: 3,
                         instruction: "Inspect the faulty corner's wheel speed sensor visually (wheel off if needed).",
                         lookFor: "Check the sensor tip for debris. On the rear wheels, inspect the tone ring on the hub — cracked or missing teeth are extremely common on T5 and cannot be repaired, only replaced."),
            TemplateStep(number: 4,
                         instruction: "Measure sensor resistance: passive sensors ~1.0–1.5 kΩ; active sensors near 0 Ω.",
                         lookFor: "An open circuit passive sensor measures OL (infinity). An active sensor that's open circuit will read OL or very high. Replace any out-of-spec sensor."),
        ]
    )

    // MARK: 7 - Glow Plugs
    static let glowPlugs = DiagnosticTemplate(
        name: "Glow Plug Check",
        sfSymbol: "flame.circle",
        description: "Test glow plug circuit health on T5 TDI diesel engines (BNZ, AXD, AXE, CAAB, CFCA).",
        estimatedMinutes: 6,
        difficulty: .beginner,
        relevantCodes: ["P0380", "P0381", "P0382", "P0383", "P0384"],
        steps: [
            TemplateStep(number: 1,
                         instruction: "Scan for glow plug codes (P0380–P0384). Each code maps to a specific cylinder: P0380=Bank A, P0382=Cylinder 1, P0383=Cylinder 2, P0384=Cylinder 3.",
                         lookFor: "Identify which glow plug(s) are flagged. Multiple codes often mean the glow plug control module (J179) has failed rather than multiple individual plugs."),
            TemplateStep(number: 2,
                         instruction: "Locate the glow plugs (one per cylinder, screwed into the cylinder head). Disconnect the glow plug wiring harness bus bar.",
                         lookFor: "The bus bar should come away cleanly. Corroded connections at the bus bar are a common cause of false glow plug codes on T5."),
            TemplateStep(number: 3,
                         instruction: "With a multimeter on resistance mode, measure each glow plug from its terminal to engine earth.",
                         lookFor: "A healthy glow plug reads 0.5–2 Ω when cold. An open circuit (OL) means the plug has failed internally. Note: on a hot engine resistance will be higher."),
            TemplateStep(number: 4,
                         instruction: "Replace all failed plugs. It is recommended to replace all plugs at once if more than one has failed.",
                         lookFor: "Use OEM-spec glow plugs (NGK, Beru, Bosch). Torque to 15 Nm. Anti-seize paste is recommended on the threads."),
            TemplateStep(number: 5,
                         instruction: "Clear codes. Start the engine cold and verify glow plug lamp operates correctly.",
                         lookFor: "Glow plug lamp should illuminate for 2–5 seconds with a cold engine and extinguish cleanly. No lamp = J179 module fault."),
        ]
    )

    // MARK: 8 - DPF / Emissions
    static let dpfEmissions = DiagnosticTemplate(
        name: "DPF & Emissions Check",
        sfSymbol: "aqi.medium",
        description: "Diagnose DPF soot load, regeneration status, and emissions system health on T5 TDI with DPF.",
        estimatedMinutes: 7,
        difficulty: .intermediate,
        relevantCodes: ["P2002", "P242F", "P0471", "P0400"],
        steps: [
            TemplateStep(number: 1,
                         instruction: "Scan for DPF-related codes (P2002, P242F, P0471).",
                         lookFor: "P2002 = soot load high, regeneration failing. P242F = ash accumulation (cannot be removed by regen). P0471 = pressure sensor fault."),
            TemplateStep(number: 2,
                         instruction: "In Live Data, look for DPF Soot Load % and DPF Differential Pressure if supported by your adapter.",
                         lookFor: "Soot load should ideally be below 60 %. Above 80 % the car will attempt forced regen. Above 100 % the DPF may be irreversibly blocked."),
            TemplateStep(number: 3,
                         instruction: "Check the last regeneration distance: how many km since the last completed DPF regen.",
                         lookFor: "Normal regen interval is every 400–600 km of mixed driving. If it has been >1000 km since last regen, the DPF is struggling. Short-journey driving prevents regeneration."),
            TemplateStep(number: 4,
                         instruction: "If soot load is <80 %: drive for 30+ minutes at motorway speed (100–120 km/h) to allow passive regeneration.",
                         lookFor: "Exhaust temperature should rise significantly during regen (>500 °C at the DPF). You may notice a slight fuel smell from the exhaust — this is normal post-injection for active regen."),
            TemplateStep(number: 5,
                         instruction: "If soot load is >80 %: use VCDS Basic Settings to force a stationary active regeneration (engine must be fully warm, oil level good).",
                         lookFor: "Active regen via VCDS runs at elevated idle for 20–30 minutes. RPM rises to ~1200 and exhaust gets very hot. Keep clear of bystanders."),
            TemplateStep(number: 6,
                         instruction: "After regen, clear codes and re-scan.",
                         lookFor: "P2002 should be gone. If P242F (ash) remains, the filter needs professional cleaning or replacement. Review engine oil specification — must be VW 507.00 / 506.01 Longlife spec."),
        ]
    )
}
