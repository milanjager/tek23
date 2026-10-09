import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { DEMO_CODES } from "./dtcs";

export type PidKey = "rpm" | "speed" | "coolant" | "load" | "maf" | "tps" | "iat" | "stft" | "ltft" | "o2s1" | "o2s2" | "oil" | "timing" | "boost" | "voltage";
export interface PidDef { key: PidKey; name: string; unit: string; base: number; amp: number; min: number; max: number; group: string; kind?: "temp" | "speed"; dec?: number }

export const PIDS: PidDef[] = [
  { key: "rpm", name: "Engine RPM", unit: "rpm", base: 820, amp: 40, min: 0, max: 5000, group: "Engine" },
  { key: "load", name: "Engine Load", unit: "%", base: 24, amp: 4, min: 0, max: 100, group: "Engine" },
  { key: "maf", name: "Mass Air Flow", unit: "g/s", base: 5.2, amp: 0.6, min: 0, max: 200, group: "Engine", dec: 1 },
  { key: "tps", name: "Throttle Position", unit: "%", base: 14, amp: 1.5, min: 0, max: 100, group: "Engine", dec: 1 },
  { key: "iat", name: "Intake Air Temp", unit: "°C", base: 28, amp: 1, min: -40, max: 120, group: "Engine", kind: "temp" },
  { key: "boost", name: "Boost Pressure", unit: "bar", base: 1.02, amp: 0.03, min: 0, max: 3, group: "Engine", dec: 2 },
  { key: "speed", name: "Vehicle Speed", unit: "km/h", base: 0, amp: 0, min: 0, max: 200, group: "Engine", kind: "speed" },
  { key: "stft", name: "Short Term Fuel Trim", unit: "%", base: 1.5, amp: 3, min: -25, max: 25, group: "Fuel", dec: 1 },
  { key: "ltft", name: "Long Term Fuel Trim", unit: "%", base: 3.1, amp: 0.4, min: -25, max: 25, group: "Fuel", dec: 1 },
  { key: "o2s1", name: "O2 Sensor B1S1", unit: "V", base: 0.5, amp: 0.38, min: 0, max: 1.1, group: "Fuel", dec: 2 },
  { key: "o2s2", name: "O2 Sensor B1S2", unit: "V", base: 0.68, amp: 0.05, min: 0, max: 1.1, group: "Fuel", dec: 2 },
  { key: "coolant", name: "Coolant Temp", unit: "°C", base: 88, amp: 1.2, min: -40, max: 130, group: "Cooling", kind: "temp" },
  { key: "oil", name: "Oil Temp", unit: "°C", base: 92, amp: 1, min: -40, max: 150, group: "Cooling", kind: "temp" },
  { key: "timing", name: "Timing Advance", unit: "°", base: 4.5, amp: 1.2, min: -10, max: 40, group: "Timing", dec: 1 },
  { key: "voltage", name: "Battery Voltage", unit: "V", base: 14.1, amp: 0.1, min: 0, max: 16, group: "Timing", dec: 1 },
];

export type Adapter = "bt" | "wifi";
export type Protocol = "auto" | "iso9141" | "iso14230" | "iso15765";
export interface Settings { adapter: Adapter; protocol: Protocol; speedUnit: "kmh" | "mph"; tempUnit: "C" | "F"; demo: boolean; refresh: 1 | 2 | 5; vin: string; enabled: Record<PidKey, boolean> }

const defaults: Settings = {
  adapter: "bt", protocol: "auto", speedUnit: "kmh", tempUnit: "C", demo: true, refresh: 1, vin: "",
  enabled: Object.fromEntries(PIDS.map((p) => [p.key, true])) as Record<PidKey, boolean>,
};

interface Ctx {
  settings: Settings;
  update: (s: Partial<Settings>) => void;
  values: Record<PidKey, number>;
  history: Record<PidKey, number[]>;
  connected: boolean;
  codes: string[];
  setCodes: (c: string[]) => void;
  scanned: boolean;
  setScanned: (b: boolean) => void;
}
const ObdCtx = createContext<Ctx | null>(null);

const initVals = () => Object.fromEntries(PIDS.map((p) => [p.key, p.base])) as Record<PidKey, number>;
const initHist = () => Object.fromEntries(PIDS.map((p) => [p.key, [] as number[]])) as Record<PidKey, number[]>;

export function ObdProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [values, setValues] = useState(initVals);
  const [history, setHistory] = useState(initHist);
  const [codes, setCodes] = useState<string[]>(DEMO_CODES);
  const [scanned, setScanned] = useState(false);
  const t = useRef(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("t5obd.settings");
      if (raw) setSettings({ ...defaults, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);

  const update = (s: Partial<Settings>) =>
    setSettings((prev) => {
      const next = { ...prev, ...s };
      localStorage.setItem("t5obd.settings", JSON.stringify(next));
      return next;
    });

  useEffect(() => {
    if (!settings.demo) return;
    const id = setInterval(() => {
      t.current += 1;
      const tt = t.current;
      // simulated drive cycle: idle -> accelerate -> cruise
      const phase = (Math.sin(tt / 12) + 1) / 2;
      setValues(() => {
        const v = {} as Record<PidKey, number>;
        for (const p of PIDS) {
          let x = p.base + (Math.random() - 0.5) * 2 * p.amp;
          if (p.key === "o2s1") x = 0.45 + Math.sin(tt * 1.7) * 0.38;
          if (p.key === "speed") x = phase * 80 + Math.random() * 2;
          if (p.key === "rpm") x = 820 + phase * 1600 + (Math.random() - 0.5) * 60;
          if (p.key === "load") x = 22 + phase * 35 + (Math.random() - 0.5) * 6;
          if (p.key === "maf") x = 5 + phase * 30 + Math.random();
          if (p.key === "boost") x = 1.0 + phase * 0.9 + Math.random() * 0.04;
          v[p.key] = Math.max(p.min, Math.min(p.max, x));
        }
        // in idle phase keep idle-ish numbers so templates can pass
        if (phase < 0.08) { v.rpm = 800 + Math.random() * 60; v.maf = 4 + Math.random() * 2; v.boost = 1.02; v.load = 24; }
        setHistory((h) => {
          const n = { ...h };
          for (const p of PIDS) n[p.key] = [...h[p.key].slice(-29), v[p.key]];
          return n;
        });
        return v;
      });
    }, settings.refresh * 1000);
    return () => clearInterval(id);
  }, [settings.demo, settings.refresh]);

  return (
    <ObdCtx.Provider value={{ settings, update, values, history, connected: settings.demo, codes, setCodes, scanned, setScanned }}>
      {children}
    </ObdCtx.Provider>
  );
}

export function useObd() {
  const c = useContext(ObdCtx);
  if (!c) throw new Error("useObd outside provider");
  return c;
}

export function fmt(p: PidDef, v: number, s: Settings) {
  let val = v, unit = p.unit;
  if (p.kind === "temp" && s.tempUnit === "F") { val = v * 9 / 5 + 32; unit = "°F"; }
  if (p.kind === "speed" && s.speedUnit === "mph") { val = v * 0.621; unit = "mph"; }
  return { text: val.toFixed(p.dec ?? 0), unit };
}
export const pid = (k: PidKey) => PIDS.find((p) => p.key === k)!;
