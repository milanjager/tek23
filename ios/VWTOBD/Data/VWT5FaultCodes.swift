import Foundation

// 40+ VW T5-specific fault codes with detailed descriptions

enum VWT5FaultCodes {

    static let all: [FaultCode] = engine + transmission + abs + airbag + hvac + emissions

    // MARK: - Demo set (6 codes shown on first scan)
    static let demoCodes: [FaultCode] = [
        engine[4],   // P0299 - Turbo underboost
        engine[12],  // P0171 - Lean mixture
        engine[20],  // P0380 - Glow plug circuit
        abs[0],      // C0031 - Right front WSS
        emissions[1],// P2002 - DPF efficiency
        engine[8],   // P0401 - EGR flow
    ]

    // MARK: - Engine
    static let engine: [FaultCode] = [
        FaultCode(code: "P0101",
                  system: .engine, severity: .warning,
                  shortDesc: "MAF sensor range/performance",
                  fullDesc: "The Mass Air Flow sensor signal is outside the expected range for current engine operating conditions on the T5 2.5 TDI/2.0 TDI.",
                  probableCause: "Dirty or contaminated MAF sensor element, air leak between MAF and throttle body, blocked air filter.",
                  fixHint: "Clean the MAF sensor with MAF cleaner spray. Check all intake hoses for cracks. Replace air filter if overdue."),

        FaultCode(code: "P0102",
                  system: .engine, severity: .warning,
                  shortDesc: "MAF sensor circuit – low input",
                  fullDesc: "MAF sensor is reporting below minimum expected voltage. Signal wire may be open or sensor has failed.",
                  probableCause: "Wiring fault, corroded connector at MAF, or failed MAF sensor.",
                  fixHint: "Check 5 V reference and ground at MAF connector. Inspect wiring loom along the air intake."),

        FaultCode(code: "P0103",
                  system: .engine, severity: .warning,
                  shortDesc: "MAF sensor circuit – high input",
                  fullDesc: "MAF sensor signal exceeds maximum expected voltage. Short to voltage in signal wire.",
                  probableCause: "Short circuit in sensor wiring or internal sensor failure.",
                  fixHint: "Inspect the MAF harness for chafing near the engine mount. Replace MAF if wiring checks out."),

        FaultCode(code: "P0115",
                  system: .engine, severity: .warning,
                  shortDesc: "Coolant temp sensor circuit fault",
                  fullDesc: "ECU detects an implausible or out-of-range signal from the engine coolant temperature sensor (G62).",
                  probableCause: "Failing coolant temperature sensor, corroded 2-pin connector, or open wiring.",
                  fixHint: "Measure resistance of G62: 2.2 kΩ at 20 °C, ~300 Ω at 80 °C. Replace sensor if out of spec."),

        FaultCode(code: "P0299",
                  system: .engine, severity: .critical,
                  shortDesc: "Turbocharger underboost – T5 2.5 TDI",
                  fullDesc: "Measured boost pressure is significantly below the target set by the N75 solenoid valve. Common failure point on the BNZ/AXD engines.",
                  probableCause: "Cracked intercooler hose, sticking variable-geometry vanes (VNT), faulty N75 boost control solenoid, or worn turbo.",
                  fixHint: "Smoke-test the intercooler circuit for leaks. Actuate N75 solenoid via VCDS. Check VNT actuator rod length."),

        FaultCode(code: "P0234",
                  system: .engine, severity: .critical,
                  shortDesc: "Turbocharger overboost condition",
                  fullDesc: "Measured boost pressure exceeds the upper safety limit. The ECU may cut fuel as protection.",
                  probableCause: "Stuck-open VNT vanes, faulty N75 solenoid, boost pressure sensor offset.",
                  fixHint: "Check N75 solenoid duty cycle at full load. Inspect boost sensor (G31) calibration."),

        FaultCode(code: "P0235",
                  system: .engine, severity: .warning,
                  shortDesc: "Turbocharger boost sensor A circuit",
                  fullDesc: "Boost/MAP sensor (G31) signal circuit fault. ECU cannot monitor boost pressure accurately.",
                  probableCause: "Cracked vacuum line to sensor, failed sensor, or wiring fault.",
                  fixHint: "Check vacuum hose from intake manifold to G31. Verify 5 V supply and ground."),

        FaultCode(code: "P0300",
                  system: .engine, severity: .critical,
                  shortDesc: "Multiple cylinder misfire detected",
                  fullDesc: "Engine misfires detected across more than one cylinder. On T5 petrol engines check ignition system first.",
                  probableCause: "Worn spark plugs, failing ignition coil(s), injector fault, or low compression.",
                  fixHint: "Check spark plugs (replace if >60 000 km). Measure coil primary resistance ~0.5 Ω."),

        FaultCode(code: "P0401",
                  system: .engine, severity: .warning,
                  shortDesc: "EGR flow insufficient – detected",
                  fullDesc: "Exhaust Gas Recirculation valve not flowing enough exhaust gas. Very common on T5 TDI engines with high mileage.",
                  probableCause: "Carbon-clogged EGR valve (N18), blocked EGR cooler, or vacuum leak to EGR actuator.",
                  fixHint: "Remove and clean EGR valve with carb cleaner. Check vacuum line from pump to EGR."),

        FaultCode(code: "P0402",
                  system: .engine, severity: .warning,
                  shortDesc: "EGR flow excessive – detected",
                  fullDesc: "More EGR gas flow than commanded. EGR valve stuck open or faulty position sensor.",
                  probableCause: "Stuck-open EGR valve, failed EGR position sensor.",
                  fixHint: "Verify EGR valve closes fully. Replace EGR if valve seat is worn."),

        FaultCode(code: "P0404",
                  system: .engine, severity: .warning,
                  shortDesc: "EGR control circuit range/performance",
                  fullDesc: "EGR valve position sensor (G212) feedback does not match commanded position.",
                  probableCause: "Failed EGR position sensor, carbon build-up preventing valve movement.",
                  fixHint: "Clean EGR valve thoroughly. If sensor is integral, replace the EGR assembly."),

        FaultCode(code: "P0171",
                  system: .fuel, severity: .warning,
                  shortDesc: "System too lean – Bank 1 (petrol)",
                  fullDesc: "Long-term fuel trim has reached positive limit to compensate for lean mixture on T5 petrol engines (AXA/BRR).",
                  probableCause: "Vacuum leak, weak fuel pressure, clogged fuel injectors, failing MAF sensor.",
                  fixHint: "Smoke-test intake system. Check fuel pressure at idle (~3.5 bar). Check MAF sensor reading."),

        FaultCode(code: "P0172",
                  system: .fuel, severity: .warning,
                  shortDesc: "System too rich – Bank 1 (petrol)",
                  fullDesc: "Long-term fuel trim at negative limit. ECU adding less fuel but mixture still rich.",
                  probableCause: "Leaking fuel injectors, failing MAF sensor reading high, rich running O2 sensor.",
                  fixHint: "Check injector leak-down. Clean or replace MAF. Inspect O2 sensor signal."),

        FaultCode(code: "P1545",
                  system: .engine, severity: .critical,
                  shortDesc: "Throttle valve control – position error (VAG)",
                  fullDesc: "VW/Audi proprietary code. Throttle body (J338) position sensor disagrees between both tracks. T5 2.0 petrol engines.",
                  probableCause: "Carbon-clogged throttle body, failed throttle position sensor (G88/G187), throttle body actuator.",
                  fixHint: "Clean throttle body. Perform basic throttle body adaptation via VCDS (04 → Adaptation → Channel 060)."),

        FaultCode(code: "P0500",
                  system: .engine, severity: .info,
                  shortDesc: "Vehicle speed sensor malfunction",
                  fullDesc: "ECU not receiving a valid vehicle speed signal from the ABS/instrument cluster.",
                  probableCause: "Wiring fault between ABS module and ECU, failed wheel speed sensor.",
                  fixHint: "Check for ABS fault codes first. Inspect wiring from ABS ECU to engine ECU pin."),

        FaultCode(code: "P0191",
                  system: .fuel, severity: .warning,
                  shortDesc: "Fuel rail pressure sensor – range/perf",
                  fullDesc: "Fuel rail pressure sensor (G247) signal plausibility error on TDI common-rail engines (CAAB/CFCA).",
                  probableCause: "Failing high-pressure fuel pump (HPFP), failing pressure sensor, fuel filter blocked.",
                  fixHint: "Log fuel rail pressure. At idle it should be ~250 bar. Check fuel filter (replace every 40 000 km)."),

        FaultCode(code: "P0380",
                  system: .engine, severity: .warning,
                  shortDesc: "Glow plug circuit A – fault",
                  fullDesc: "Glow plug control module (J179) detected a fault in glow plug circuit, cylinder bank A. T5 TDI diesel.",
                  probableCause: "Failed glow plug(s), wiring fault to glow plug relay/module, failed J179 module.",
                  fixHint: "Measure resistance of each glow plug (~1 Ω when cold). Replace any that are open circuit."),

        FaultCode(code: "P0381",
                  system: .engine, severity: .info,
                  shortDesc: "Glow plug indicator lamp – circuit fault",
                  fullDesc: "The glow plug warning lamp circuit is faulty. Cold starts may still work but driver feedback is lost.",
                  probableCause: "Blown instrument cluster bulb (older clusters), CAN bus fault, or J179 issue.",
                  fixHint: "Check cluster and CAN-bus comms with J179 module."),

        FaultCode(code: "P0420",
                  system: .emissions, severity: .warning,
                  shortDesc: "Catalyst efficiency below threshold",
                  fullDesc: "Post-cat O2 sensor (G130) is oscillating similarly to pre-cat sensor, indicating reduced catalyst conversion efficiency. T5 petrol.",
                  probableCause: "Aged catalytic converter, engine running rich, oil contamination of cat.",
                  fixHint: "Check for P0172 first. If fuel system is good, catalytic converter likely needs replacement."),

        FaultCode(code: "P0471",
                  system: .emissions, severity: .info,
                  shortDesc: "Exhaust back-pressure sensor – range/perf",
                  fullDesc: "DPF differential pressure sensor (G450) signal is implausible. Used on T5 TDI with DPF (post-2007).",
                  probableCause: "Blocked pressure pipes to sensor, failed sensor, or DPF full of soot.",
                  fixHint: "Check the two thin pipes from the DPF to G450 for blockage. Clean if necessary."),

        FaultCode(code: "P0113",
                  system: .engine, severity: .info,
                  shortDesc: "Intake air temp sensor – high input",
                  fullDesc: "Intake Air Temperature sensor (G42) signal is above expected range. ECU may use substitute value.",
                  probableCause: "Open circuit in IAT sensor wiring, failed sensor.",
                  fixHint: "IAT is often integrated into the MAF sensor on T5. Check MAF connector first."),
    ]

    // MARK: - Transmission
    static let transmission: [FaultCode] = [
        FaultCode(code: "P0700",
                  system: .transmission, severity: .warning,
                  shortDesc: "Transmission control system malfunction",
                  fullDesc: "General fault in the automatic gearbox (09G DSG or 09G Tiptronic). Check for specific gearbox codes in module 02.",
                  probableCause: "Mechatronic unit fault, solenoid fault, hydraulic issue.",
                  fixHint: "Scan gearbox module (02) for specific fault codes. Check ATF level and condition."),

        FaultCode(code: "P0715",
                  system: .transmission, severity: .warning,
                  shortDesc: "Input turbine speed sensor circuit",
                  fullDesc: "Transmission input shaft speed sensor malfunction. Shifts may be erratic or gearbox may go into limp mode.",
                  probableCause: "Failed speed sensor, wiring fault, metallic contamination on sensor.",
                  fixHint: "Drop ATF sump and inspect the turbine speed sensor for damage. Check ATF for metal particles."),

        FaultCode(code: "P0730",
                  system: .transmission, severity: .critical,
                  shortDesc: "Incorrect gear ratio detected",
                  fullDesc: "Actual gear ratio calculated from input and output sensors does not match commanded gear. Gearbox is in limp mode.",
                  probableCause: "Worn clutch pack, failed solenoid, mechatronic fault.",
                  fixHint: "Requires ATF change and gearbox inspection. Check mechatronic solenoid resistance."),

        FaultCode(code: "P0741",
                  system: .transmission, severity: .warning,
                  shortDesc: "Torque converter clutch – performance",
                  fullDesc: "Torque converter lock-up clutch slipping more than allowed. Affects fuel economy and may cause shudder.",
                  probableCause: "Worn torque converter, contaminated ATF.",
                  fixHint: "Replace ATF first (use VW G 052 025 A2). If shudder persists, torque converter replacement needed."),

        FaultCode(code: "P0750",
                  system: .transmission, severity: .warning,
                  shortDesc: "Shift solenoid A – malfunction",
                  fullDesc: "Solenoid 1 in the mechatronic unit is not operating correctly.",
                  probableCause: "Failed solenoid, blocked hydraulic circuit, wiring fault.",
                  fixHint: "Mechatronic unit often requires replacement as assembly. Ensure correct ATF spec (G 055 025)."),
    ]

    // MARK: - ABS
    static let abs: [FaultCode] = [
        FaultCode(code: "C0031",
                  system: .abs, severity: .warning,
                  shortDesc: "Right front wheel speed sensor – circuit",
                  fullDesc: "ABS module (J104) not receiving a valid signal from the right front wheel speed sensor (G45). ABS and ESP disabled.",
                  probableCause: "Failed wheel speed sensor, damaged tone ring, wiring damage from road debris.",
                  fixHint: "Clean sensor and tone ring. Measure sensor resistance (~1.0–1.5 kΩ for passive, 0 Ω for active). Check gap (<1 mm)."),

        FaultCode(code: "C0034",
                  system: .abs, severity: .warning,
                  shortDesc: "Left front wheel speed sensor – circuit",
                  fullDesc: "No valid signal from left front wheel speed sensor (G47). Same as C0031 but opposite side.",
                  probableCause: "Failed sensor, damaged wiring at wheel arch, corroded connector.",
                  fixHint: "Inspect sensor harness routing at steering knuckle for chafing."),

        FaultCode(code: "C0037",
                  system: .abs, severity: .warning,
                  shortDesc: "Right rear wheel speed sensor – circuit",
                  fullDesc: "Right rear wheel speed sensor (G44) signal fault. Traction control and ESP also affected.",
                  probableCause: "Failed sensor, cracked tone ring on rear hub, wiring under vehicle corroded.",
                  fixHint: "Check tone ring for cracks (remove hub to inspect). T5 rear hubs are prone to tone ring cracking."),

        FaultCode(code: "C0040",
                  system: .abs, severity: .warning,
                  shortDesc: "Left rear wheel speed sensor – circuit",
                  fullDesc: "Left rear wheel speed sensor (G46) signal fault.",
                  probableCause: "Same as C0037 on the opposite side.",
                  fixHint: "Inspect and replace sensor. Check tone ring integrity on rear hub."),

        FaultCode(code: "C0051",
                  system: .abs, severity: .warning,
                  shortDesc: "Wheel speed sensor – implausible signal",
                  fullDesc: "One or more wheel speed sensors producing an erratic or implausible signal pattern.",
                  probableCause: "Metallic contamination near sensor, partially damaged tone ring.",
                  fixHint: "Clean all sensors and tone rings. Compare live WSS values in ABS module at 10 km/h."),

        FaultCode(code: "C0044",
                  system: .abs, severity: .critical,
                  shortDesc: "ABS solenoid valve circuit fault",
                  fullDesc: "Fault in ABS hydraulic solenoid valve circuit inside the ABS pump/module (J104). ABS is fully disabled.",
                  probableCause: "Failed ABS pump unit, internal solenoid fault.",
                  fixHint: "Requires ABS/ESP hydraulic unit replacement or specialist rebuild. Do not drive at speed until resolved."),
    ]

    // MARK: - Airbag
    static let airbag: [FaultCode] = [
        FaultCode(code: "B0001",
                  system: .airbag, severity: .critical,
                  shortDesc: "Driver front airbag squib – resistance low",
                  fullDesc: "Airbag control unit (J234) measuring squib resistance outside safe range on driver front airbag. Airbag system is armed but fault disables deployment safeguards.",
                  probableCause: "Clock spring (spiral cable, U5) worn, connector under seat dislodged, failed squib.",
                  fixHint: "Check the clock spring connector under the steering column first — this is the most common T5 airbag fault. Use dummy resistor when probing."),

        FaultCode(code: "B0010",
                  system: .airbag, severity: .critical,
                  shortDesc: "Passenger front airbag squib – resistance",
                  fullDesc: "Resistance fault detected on passenger front airbag circuit. This can occur if the passenger seat wiring harness is damaged or the passenger airbag connector is loose.",
                  probableCause: "Damaged harness under passenger seat, wet connector, failed squib.",
                  fixHint: "Check all connectors under the passenger seat. Never probe airbag connectors with a multimeter without a dummy resistor."),
    ]

    // MARK: - HVAC
    static let hvac: [FaultCode] = [
        FaultCode(code: "B1025",
                  system: .hvac, severity: .info,
                  shortDesc: "Blend door actuator – positioning fault",
                  fullDesc: "Climatronic (J255) cannot position the temperature blend door to the commanded position. Temperature regulation may be inaccurate.",
                  probableCause: "Failed blend door actuator motor, broken door linkage, or software mismatch after battery disconnect.",
                  fixHint: "Run Basic Settings (Adaptation channel 01) in Climatronic module to re-calibrate actuators."),

        FaultCode(code: "B1018",
                  system: .hvac, severity: .info,
                  shortDesc: "Interior temperature sensor – circuit",
                  fullDesc: "Interior air temperature sensor signal is out of range. Climatronic uses a substitute value.",
                  probableCause: "Blocked aspirator fan inside dash, failed sensor, wiring fault.",
                  fixHint: "Check the small aspirator fan behind the dash centre panel. Clean sensor aperture of dust/debris."),

        FaultCode(code: "B1200",
                  system: .hvac, severity: .info,
                  shortDesc: "Evaporator temperature sensor – circuit",
                  fullDesc: "Evaporator temperature sensor (G263) fault. A/C may not cool efficiently as anti-icing control is compromised.",
                  probableCause: "Failed sensor, wiring to sensor corroded, sensor dislodged from evaporator fins.",
                  fixHint: "Sensor is clipped to evaporator fins under dash. Check it is seated and connector is clean."),
    ]

    // MARK: - Emissions
    static let emissions: [FaultCode] = [
        FaultCode(code: "P2002",
                  system: .emissions, severity: .warning,
                  shortDesc: "DPF efficiency below threshold – T5 TDI",
                  fullDesc: "Diesel Particulate Filter (DPF) is not regenerating effectively. Soot load is above the regeneration trigger point and passive/active regen has failed to clear it. T5 2.0 TDI / 2.5 TDI with DPF.",
                  probableCause: "Frequent short journeys preventing regen, failed glow plugs, blocked DPF pressure sensor lines, failed DPF injector (active regen).",
                  fixHint: "If soot load <80%: drive at 70+ km/h for 30 min to trigger passive regen. If >80%: force active regen via VCDS (Engine → Basic Settings → DPF Regeneration)."),

        FaultCode(code: "P242F",
                  system: .emissions, severity: .warning,
                  shortDesc: "DPF restriction – ash accumulation",
                  fullDesc: "DPF is restricted by accumulated ash from oil combustion. Unlike soot, ash cannot be burned off and requires physical cleaning or filter replacement.",
                  probableCause: "High mileage (>200 000 km), wrong engine oil spec (must use 506.01 or 507.00 longlife oil), oil burning engine.",
                  fixHint: "DPF must be cleaned professionally or replaced. Always use VW-approved longlife oil to minimise ash build-up."),

        FaultCode(code: "P0400",
                  system: .emissions, severity: .warning,
                  shortDesc: "EGR flow malfunction – general",
                  fullDesc: "EGR system flow outside expected range. Can be either insufficient or excessive depending on operating condition.",
                  probableCause: "Blocked EGR valve, cracked EGR cooler, vacuum leak.",
                  fixHint: "Check EGR valve operation and cooler for cracks. Coolant loss alongside this code suggests a cracked EGR cooler — a common T5 2.5 TDI issue."),
    ]
}
