export type System = "Engine" | "Transmission" | "ABS" | "Airbag" | "HVAC";
export type Severity = "Critical" | "Warning" | "Info";
export interface Dtc {
  code: string;
  system: System;
  severity: Severity;
  title: string;
  description: string;
  cause: string;
  fix: string;
}

const d = (code: string, system: System, severity: Severity, title: string, description: string, cause: string, fix: string): Dtc => ({ code, system, severity, title, description, cause, fix });

export const DTC_DB: Dtc[] = [
  d("P0300", "Engine", "Critical", "Random misfire detected", "ECU sees uneven crank speed across several cylinders on the T5 TDI / 3.2 V6.", "Worn injectors (PD/common-rail), low compression, air leak at intake manifold.", "Check injector balance rates (VCDS group 13), test compression, smoke-test intake."),
  d("P0301", "Engine", "Warning", "Cylinder 1 misfire", "Misfire counted on cylinder 1 (timing belt side on the 2.5 TDI R5).", "Injector 1 leak-off, glow plug 1 failed, cracked injector seal.", "Swap injector 1 with another cylinder; check if fault moves."),
  d("P0302", "Engine", "Warning", "Cylinder 2 misfire", "Misfire counted on cylinder 2.", "Injector 2 wear, low compression on cylinder 2.", "Run injector balance test; compression test cylinder 2."),
  d("P0303", "Engine", "Warning", "Cylinder 3 misfire", "Misfire counted on cylinder 3.", "Injector 3 loom damage under valve cover (common on BNZ/AXD).", "Inspect injector loom under rocker cover for chafing."),
  d("P0304", "Engine", "Warning", "Cylinder 4 misfire", "Misfire counted on cylinder 4.", "Injector 4 or glow plug 4.", "Swap injector, check glow plug resistance (<1.5 Ω)."),
  d("P0305", "Engine", "Warning", "Cylinder 5 misfire", "Misfire on cylinder 5 – only on 5-cylinder 2.5 TDI (AXD/AXE/BNZ).", "Injector 5, PD cam lobe wear on cylinder 5.", "Inspect camshaft lobe 5 and rocker roller for wear."),
  d("P0100", "Engine", "Warning", "MAF circuit malfunction", "Air-mass meter signal out of plausible range.", "Contaminated MAF (Bosch 074 906 461), damaged connector.", "Clean connector, compare MAF at idle (~280 mg/stroke), replace if low."),
  d("P0101", "Engine", "Warning", "MAF range/performance", "Measured air mass doesn't match expected at given RPM/boost.", "Dirty MAF, intake leak after MAF, sticking EGR.", "Smoke-test intake, check EGR closes, replace MAF if under spec."),
  d("P0102", "Engine", "Warning", "MAF signal low", "MAF reports too little air – typical limp-mode cause on T5.", "Failed MAF element, broken 5V supply.", "Check 5V reference at MAF plug pin 4; replace MAF."),
  d("P0110", "Engine", "Info", "Intake air temp circuit", "IAT sensor (in MAF or charge-pipe) out of range.", "Broken wire, corroded sensor.", "Check sensor resistance vs temperature chart."),
  d("P0115", "Engine", "Warning", "Coolant temp sensor circuit", "G62 coolant sensor signal implausible – very common on T5.", "Failed dual G62 sensor (blue/green), corroded pins.", "Replace G62 sensor and O-ring clip; bleed cooling system."),
  d("P0117", "Engine", "Warning", "Coolant temp sensor low", "G62 reads too hot / shorted to ground.", "Shorted sensor or wiring.", "Check wiring for short; replace G62."),
  d("P0128", "Engine", "Info", "Coolant below thermostat temp", "Engine takes too long to reach 80 °C.", "Thermostat stuck open (common after 100k km).", "Replace thermostat (87 °C) and seal."),
  d("P0171", "Engine", "Warning", "System too lean", "Fuel trims at maximum positive correction.", "Vacuum leak, weak fuel pump, dirty MAF.", "Smoke-test intake, check fuel pressure, clean MAF."),
  d("P0172", "Engine", "Warning", "System too rich", "Fuel trims at maximum negative correction.", "Leaking injector, faulty O2 sensor, MAF over-reading.", "Check injector leak-off, test O2 sensor switching."),
  d("P0234", "Engine", "Critical", "Turbo overboost", "Boost exceeded spec – ECU enters limp mode on T5 TDI.", "Sticking VNT vanes, faulty N75 valve, vacuum line misrouted.", "Test N75, free VNT linkage, check vacuum hoses."),
  d("P0235", "Engine", "Warning", "Boost pressure sensor circuit", "G31 MAP sensor signal fault.", "Oily or failed MAP sensor on intercooler pipe.", "Clean/replace G31, inspect plug."),
  d("P0299", "Engine", "Critical", "Turbo underboost", "Requested boost not reached – classic T5 'no power' fault.", "Split intercooler hose, VNT stuck, leaking EGR cooler.", "Pressure-test intake, check VNT movement, inspect intercooler pipes."),
  d("P0380", "Engine", "Warning", "Glow plug circuit A", "Glow plug control module J179 reports open circuit.", "Burnt glow plug, failed J179 relay.", "Measure each plug (<1.5 Ω), replace J179 if needed."),
  d("P0381", "Engine", "Info", "Glow plug indicator circuit", "Dash glow lamp circuit fault.", "Instrument cluster connection, bulb.", "Check cluster plug and lamp."),
  d("P0382", "Engine", "Warning", "Glow plug circuit B", "Glow plug bank B circuit fault.", "Failed glow plug 3–5.", "Test plugs individually."),
  d("P0383", "Engine", "Warning", "Glow plug module low", "J179 output shorted low.", "Short in glow plug loom.", "Inspect loom near cylinder head."),
  d("P0384", "Engine", "Warning", "Glow plug module high", "J179 output stuck high.", "Welded relay contacts in J179.", "Replace glow plug control unit J179."),
  d("P0400", "Engine", "Warning", "EGR flow malfunction", "EGR valve position doesn't match target.", "Soot-clogged EGR valve (very common on T5 2.5 TDI).", "Remove and clean EGR valve, check vacuum supply."),
  d("P0401", "Engine", "Warning", "EGR flow insufficient", "Too little EGR flow detected via MAF delta.", "Blocked EGR cooler or valve.", "Clean EGR valve and cooler passages."),
  d("P0402", "Engine", "Warning", "EGR flow excessive", "EGR stuck open – black smoke, low power.", "Sticking valve, faulty N18 solenoid.", "Check N18 solenoid, clean or replace EGR."),
  d("P0670", "Engine", "Warning", "Glow plug control module circuit", "Communication fault with J179.", "Power/ground fault at J179.", "Check fuse and ground at module."),
  d("P1545", "Engine", "Warning", "Throttle position control malfunction", "VW-specific: drive-by-wire throttle body J338 not following target.", "Dirty throttle body, failed adaptation.", "Clean throttle body, run basic setting (group 060)."),
  d("P1570", "Engine", "Critical", "Engine control module locked", "Immobilizer has blocked the ECU – engine starts then stalls.", "Key not adapted, faulty immo reader coil.", "Re-adapt key with dealer tool, check reader coil."),
  d("P2002", "Engine", "Warning", "DPF efficiency below threshold", "Diesel particulate filter not trapping soot properly (2010+ CR engines).", "Cracked DPF substrate.", "Check differential pressure, inspect DPF."),
  d("P242F", "Engine", "Critical", "DPF ash restriction", "DPF ash load at limit – regeneration can't clear it.", "End of DPF life, frequent short trips.", "Replace or professionally clean DPF; reset ash value."),
  d("P2463", "Engine", "Critical", "DPF soot accumulation", "Soot level too high for passive regen.", "Interrupted regenerations, failed pressure sensor.", "Drive 20 min at 2500+ rpm or force regen with scan tool."),
  d("P0471", "Engine", "Warning", "Exhaust pressure sensor range", "DPF differential pressure sensor G450 implausible.", "Blocked/cracked sensor hoses.", "Replace hoses, test G450."),
  d("P0700", "Transmission", "Warning", "Transmission control fault", "TCM (09K/09G auto) stored a fault – read TCM separately.", "Any TCM internal fault.", "Read transmission module for detailed code."),
  d("P0715", "Transmission", "Warning", "Input speed sensor", "Turbine speed sensor G182 signal missing (09G auto).", "Failed sensor, wiring.", "Check G182 resistance and loom."),
  d("P0730", "Transmission", "Critical", "Incorrect gear ratio", "Slipping detected in 09G automatic.", "Low ATF, worn clutches, valve body.", "Check ATF level at 35–45 °C, change ATF."),
  d("P0741", "Transmission", "Warning", "Torque converter clutch stuck off", "TCC lock-up not achieved.", "Worn TCC, old ATF.", "Change ATF and filter, retest."),
  d("P0562", "Engine", "Info", "System voltage low", "Battery voltage below 11 V while running.", "Weak alternator (140 A), poor ground strap.", "Test charging voltage (13.8–14.4 V)."),
  d("C0031", "ABS", "Warning", "Front left wheel speed sensor", "ABS module J104 sees no/erratic signal from FL sensor.", "Corroded sensor, damaged tone ring.", "Clean hub mounting, measure sensor, replace."),
  d("C0034", "ABS", "Warning", "Front right wheel speed sensor", "No/erratic signal from FR sensor.", "Corrosion in hub bore (typical T5).", "Remove, clean bore, fit new sensor."),
  d("C0037", "ABS", "Warning", "Rear left wheel speed sensor", "No/erratic signal from RL sensor.", "Cable damage at rear axle.", "Inspect cable path, replace sensor."),
  d("C0040", "ABS", "Warning", "Rear right wheel speed sensor", "No/erratic signal from RR sensor.", "Wheel bearing play affecting reluctor.", "Check bearing play, replace sensor."),
  d("C0051", "ABS", "Critical", "Steering angle sensor", "G85 steering angle sensor not calibrated / faulty – ESP disabled.", "Not adapted after alignment, faulty clock spring.", "Run G85 basic setting; replace if fault persists."),
  d("B1001", "Airbag", "Critical", "Driver airbag resistance too high", "Driver airbag squib circuit open – airbag light on.", "Failed clock spring (common on T5).", "Replace clock spring under steering wheel."),
  d("B1004", "Airbag", "Critical", "Passenger airbag circuit", "Passenger airbag circuit fault.", "Connector under dash loose.", "Reseat connector with battery disconnected."),
  d("B1010", "Airbag", "Warning", "Seat belt tensioner driver", "Pretensioner circuit resistance out of range.", "Under-seat connector corrosion.", "Clean/replace under-seat yellow connector."),
  d("B10A2", "Airbag", "Info", "Crash data stored", "Crash event recorded – module must be replaced.", "Previous collision.", "Replace airbag control unit."),
  d("B1100", "HVAC", "Info", "Rear heater flap motor", "Rear heater (Climatronic) flap motor position fault.", "Seized flap, failed motor.", "Run HVAC basic setting, replace motor."),
  d("B1101", "HVAC", "Warning", "A/C refrigerant pressure", "G65 pressure sender out of range – compressor disabled.", "Low refrigerant, failed sender.", "Check gas charge, test G65."),
  d("B1102", "HVAC", "Info", "Blower resistor fault", "Fresh-air blower series resistor failed – only speed 4 works.", "Burnt resistor pack (common).", "Replace blower resistor behind glovebox."),
];

export const DEMO_CODES = ["P0299", "P0401", "P1545", "C0034", "B1001", "P0380"];

export const findDtc = (code: string) => DTC_DB.find((x) => x.code === code);
