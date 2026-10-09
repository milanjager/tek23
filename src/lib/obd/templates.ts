import type { PidKey } from "./store";

export interface Step {
  title: string;
  instruction: string;
  lookFor: string;
  pid?: PidKey;
  range?: [number, number];
  codes?: string[];
}
export interface Template {
  id: string;
  name: string;
  icon: string;
  time: string;
  difficulty: "Beginner" | "Intermediate";
  summary: string;
  steps: Step[];
}

export const TEMPLATES: Template[] = [
  { id: "cold-start", name: "Cold Start Issues", icon: "Snowflake", time: "~5 min", difficulty: "Beginner", summary: "Coolant sensor, intake temp and fuel trims at cold start.", steps: [
    { title: "Check coolant sensor", instruction: "With engine cold, compare coolant temp to outside temp.", lookFor: "Reading should be close to ambient, then rise smoothly.", pid: "coolant", range: [-20, 110] },
    { title: "Check intake air temp", instruction: "Read IAT while idling.", lookFor: "Within ~10 °C of coolant on a cold engine.", pid: "iat", range: [-20, 60] },
    { title: "Fuel trims", instruction: "Watch short-term trim during first minute.", lookFor: "Should stay between -10% and +10%.", pid: "stft", range: [-10, 10] },
    { title: "Sensor fault codes", instruction: "Check for coolant / IAT circuit codes.", lookFor: "No P0115, P0117, P0110 or P0128.", codes: ["P0115", "P0117", "P0110", "P0128"] },
  ]},
  { id: "misfire", name: "Rough Idle / Misfire", icon: "Activity", time: "~7 min", difficulty: "Beginner", summary: "Misfire counters, MAF and throttle body.", steps: [
    { title: "Misfire codes", instruction: "Scan for misfire codes on all 5 cylinders.", lookFor: "No P0300–P0305 stored.", codes: ["P0300", "P0301", "P0302", "P0303", "P0304", "P0305"] },
    { title: "Idle RPM stability", instruction: "Let engine idle, watch RPM.", lookFor: "Steady 780–900 rpm on 2.5 TDI.", pid: "rpm", range: [700, 950] },
    { title: "MAF at idle", instruction: "Read air mass at idle.", lookFor: "Roughly 3–8 g/s at warm idle.", pid: "maf", range: [2, 9] },
    { title: "Throttle body", instruction: "Check throttle body codes.", lookFor: "No P1545.", codes: ["P1545"] },
  ]},
  { id: "turbo", name: "No Power / Turbo Issues", icon: "Gauge", time: "~8 min", difficulty: "Intermediate", summary: "Boost pressure and overboost/underboost codes.", steps: [
    { title: "Boost codes", instruction: "Scan engine for turbo faults.", lookFor: "No P0234, P0299, P0235.", codes: ["P0234", "P0299", "P0235"] },
    { title: "Boost at idle", instruction: "Read boost pressure at idle.", lookFor: "About 0.95–1.1 bar absolute.", pid: "boost", range: [0.9, 1.2] },
    { title: "Engine load", instruction: "Watch calculated load while idling.", lookFor: "15–35% at idle with no accessories.", pid: "load", range: [10, 40] },
    { title: "Hose inspection", instruction: "Visually inspect intercooler hoses for oil and splits.", lookFor: "No oily, split or loose hoses (mark pass manually)." },
  ]},
  { id: "egr", name: "EGR System Check", icon: "Wind", time: "~6 min", difficulty: "Intermediate", summary: "EGR flow and valve codes.", steps: [
    { title: "EGR codes", instruction: "Scan for EGR faults.", lookFor: "No P0400, P0401, P0402.", codes: ["P0400", "P0401", "P0402"] },
    { title: "MAF vs EGR", instruction: "At idle MAF drops when EGR opens.", lookFor: "MAF within 2–9 g/s.", pid: "maf", range: [2, 9] },
    { title: "Visual check", instruction: "Inspect EGR valve vacuum line.", lookFor: "Line intact and valve moves freely." },
  ]},
  { id: "fuel", name: "Fuel System Diagnosis", icon: "Fuel", time: "~6 min", difficulty: "Intermediate", summary: "Fuel trims and O2 sensor activity.", steps: [
    { title: "Short term trim", instruction: "Read STFT at warm idle.", lookFor: "-10% to +10%.", pid: "stft", range: [-10, 10] },
    { title: "Long term trim", instruction: "Read LTFT.", lookFor: "-10% to +10%.", pid: "ltft", range: [-10, 10] },
    { title: "O2 sensor activity", instruction: "Watch upstream O2 voltage switching.", lookFor: "Value moves between 0.1–0.9 V.", pid: "o2s1", range: [0.1, 0.9] },
    { title: "Mixture codes", instruction: "Check lean/rich codes.", lookFor: "No P0171 / P0172.", codes: ["P0171", "P0172"] },
  ]},
  { id: "abs", name: "ABS / Brake Warning", icon: "Disc", time: "~5 min", difficulty: "Beginner", summary: "Wheel speed sensor and steering angle faults.", steps: [
    { title: "Wheel sensor codes", instruction: "Read ABS module J104.", lookFor: "No C0031, C0034, C0037, C0040.", codes: ["C0031", "C0034", "C0037", "C0040"] },
    { title: "Steering angle", instruction: "Check steering angle sensor.", lookFor: "No C0051.", codes: ["C0051"] },
    { title: "Road test speed", instruction: "Drive slowly and confirm speed reading.", lookFor: "Speed matches speedometer (mark manually)." },
  ]},
  { id: "glow", name: "Glow Plug Check (Diesel)", icon: "Flame", time: "~4 min", difficulty: "Beginner", summary: "Glow plug circuit codes P0380–P0384.", steps: [
    { title: "Glow plug codes", instruction: "Scan engine module.", lookFor: "No P0380–P0384 or P0670.", codes: ["P0380", "P0381", "P0382", "P0383", "P0384", "P0670"] },
    { title: "Battery voltage", instruction: "Glow plugs need good voltage.", lookFor: "Voltage above 12 V.", pid: "voltage", range: [12, 14.8] },
    { title: "Resistance test", instruction: "Measure each plug with a multimeter.", lookFor: "Each under 1.5 Ω (mark manually)." },
  ]},
  { id: "dpf", name: "DPF / Emissions", icon: "Factory", time: "~8 min", difficulty: "Intermediate", summary: "DPF pressure and regeneration status.", steps: [
    { title: "DPF codes", instruction: "Scan for DPF faults.", lookFor: "No P2002, P242F, P2463, P0471.", codes: ["P2002", "P242F", "P2463", "P0471"] },
    { title: "Exhaust temp", instruction: "Watch coolant reaching operating temp (needed for regen).", lookFor: "80–100 °C.", pid: "coolant", range: [80, 105] },
    { title: "Regeneration drive", instruction: "If soot is high, drive 20 min at 2500+ rpm.", lookFor: "Fan running after stop indicates regen (mark manually)." },
  ]},
];
