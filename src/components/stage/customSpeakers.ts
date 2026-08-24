/* ============================================================
   Custom speaker builder — user-defined PA cabinets
   ------------------------------------------------------------
   A custom speaker is stored as a plain definition (name, size,
   drivers, RMS power, impedance, connector type) and converted at
   runtime into a catalog Spec + connector list, so it behaves like
   any built-in cabinet (placement, stacking, wiring, exports).
   ============================================================ */

export type CustomShape = "sub" | "bass" | "mid" | "top" | "horn";

export type CustomConnection =
  | "nl4"        // Speakon NL4 IN (passive, single amp channel)
  | "nl4_link"   // Speakon NL4 IN + parallel LINK OUT (daisy chain)
  | "nl4_biamp"  // 2× Speakon (LF + MF/HF) — bi-amp cabinet
  | "binding"    // Screw terminals / binding posts
  | "jack"       // 6,3 mm jack IN
  | "active";    // Self-powered: 230V IN + XLR signal IN (+ link out)

export interface CustomSpeaker {
  /** Catalog id — always prefixed with "custom_". */
  id: string;
  name: string;
  shape: CustomShape;
  /** Meters (w, h, d). */
  size: [number, number, number];
  /** Driver description, e.g. `2×18" + 1×1,4" horn`. */
  drivers: string;
  /** RMS power handling (passive) or consumption (active), in Watts. */
  powerW: number;
  /** Nominal impedance in Ohms. */
  ohm: number;
  connection: CustomConnection;
  /** Optional sensitivity dB / SPL max etc. */
  spl?: number;
  weightKg?: number;
  notes?: string;
}

export const CONNECTION_LABELS: Record<CustomConnection, string> = {
  nl4: "Speakon NL4 IN (pasivní)",
  nl4_link: "Speakon NL4 IN + LINK OUT (průchod)",
  nl4_biamp: "2× Speakon — bi-amp (LF + MF/HF)",
  binding: "Šroubové svorky (binding post)",
  jack: "Jack 6,3 mm IN",
  active: "Aktivní: 230V IN + XLR signál IN",
};

export const SHAPE_LABELS: Record<CustomShape, string> = {
  sub: "Sub / scoop",
  bass: "Bass bin",
  mid: "Mid",
  top: "Top / 3-way",
  horn: "Horn",
};

const KEY = "stagerig3d:customSpeakers:v1";

export function loadCustomSpeakers(): CustomSpeaker[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((d): d is CustomSpeaker => !!d && typeof d.id === "string" && Array.isArray(d.size));
  } catch {
    return [];
  }
}

export function saveCustomSpeakers(defs: CustomSpeaker[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(defs));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

export function newCustomSpeaker(): CustomSpeaker {
  return {
    id: `custom_${Math.random().toString(36).slice(2, 9)}`,
    name: "Vlastní repro",
    shape: "sub",
    size: [1.2, 0.8, 0.9],
    drivers: '2×18"',
    powerW: 1200,
    ohm: 4,
    connection: "nl4_link",
    spl: undefined,
    weightKg: undefined,
    notes: "",
  };
}

export function customHint(d: CustomSpeaker): string {
  const kindTxt = d.connection === "active" ? "aktivní" : "pasivní";
  return `${d.drivers || SHAPE_LABELS[d.shape]} · ${d.powerW} W · ${d.ohm} Ω · ${kindTxt}`;
}

export function customNotes(d: CustomSpeaker): string {
  const lines: string[] = [];
  lines.push(`Vlastní bedna: ${d.name} — ${d.drivers || SHAPE_LABELS[d.shape]}`);
  lines.push(`Výkon: ${d.powerW} W RMS · Impedance: ${d.ohm} Ω${d.spl ? ` · SPL max: ${d.spl} dB` : ""}`);
  lines.push(`Zapojení: ${CONNECTION_LABELS[d.connection]}`);
  if (d.connection === "nl4_biamp") lines.push("Pozor: bi-amp — LF a MF/HF z oddělených kanálů zesilovače, nikdy nespojovat.");
  if (d.connection === "nl4_link") lines.push("LINK OUT je paralelní — kontroluj celkovou impedanci řetězu vůči minimu zesilovače.");
  if (d.connection === "active") lines.push("Aktivní bedna — napájení 230V z rozdělovače, signál XLR z mixu/procesoru (bez zesilovače).");
  if (d.weightKg) lines.push(`Hmotnost: ${d.weightKg} kg`);
  if (d.notes?.trim()) lines.push(d.notes.trim());
  return lines.join("\n");
}

/** Minimum safe amp-side load when N of these are chained in parallel. */
export function chainImpedance(ohm: number, count: number): number {
  if (count <= 0) return ohm;
  return Math.round((ohm / count) * 100) / 100;
}

/* ============================================================
   Doporučení zapojení stacku (paralelně / sériově / bi-amp)
   ------------------------------------------------------------
   Pro N stejných beden spočítá výslednou zátěž zesilovače pro
   jednotlivé varianty a vybere tu nejvýhodnější, která ještě
   nejde pod minimální impedanci zesilovače.
   ============================================================ */

export type WiringTopology = "parallel" | "series" | "series_parallel" | "biamp" | "active";

export interface WiringOption {
  topology: WiringTopology;
  label: string;
  /** Zátěž na jeden kanál zesilovače (Ω). null = nedává smysl pro daný počet. */
  loadOhm: number | null;
  /** Kolik kanálů zesilovače varianta potřebuje. */
  channels: number;
  ok: boolean;
  note: string;
}

export interface WiringRecommendation {
  count: number;
  ampMinOhm: number;
  options: WiringOption[];
  best: WiringOption | null;
  summary: string;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function recommendWiring(d: CustomSpeaker, count: number, ampMinOhm: number): WiringRecommendation {
  const ohm = d.ohm;
  const options: WiringOption[] = [];

  if (d.connection === "active") {
    const opt: WiringOption = {
      topology: "active",
      label: "Aktivní (bez zesilovače)",
      loadOhm: null,
      channels: 0,
      ok: true,
      note: `${count}× 230V z rozdělovače (${count * d.powerW} W celkem) + XLR signál v průchozím řetězu.`,
    };
    return { count, ampMinOhm, options: [opt], best: opt, summary: opt.note };
  }

  if (d.connection === "nl4_biamp") {
    const par = r2(ohm / count);
    options.push({
      topology: "biamp",
      label: "Bi-amp (LF a MF/HF zvlášť)",
      loadOhm: par,
      channels: 2,
      ok: par >= ampMinOhm,
      note: `LF i MF/HF sekce zvlášť, každá ${count}× paralelně = ${par} Ω na kanál. Nikdy nespojovat sekce dohromady.`,
    });
  }

  const par = r2(ohm / count);
  options.push({
    topology: "parallel",
    label: `Paralelně (${count}× LINK OUT)`,
    loadOhm: par,
    channels: 1,
    ok: par >= ampMinOhm,
    note: par >= ampMinOhm
      ? `Nejvyšší výkon, vše z jednoho kanálu (${par} Ω).`
      : `${par} Ω je pod minimem zesilovače (${ampMinOhm} Ω) — hrozí ochrana nebo zničení koncáku.`,
  });

  const ser = r2(ohm * count);
  options.push({
    topology: "series",
    label: `Sériově (${count}× za sebou)`,
    loadOhm: ser,
    channels: 1,
    ok: ser >= ampMinOhm,
    note: `Bezpečná, ale nejnižší výkon (${ser} Ω). Vyžaduje speciální NL4 kabeláž (2+/2−).`,
  });

  if (count % 2 === 0 && count >= 4) {
    const sp = r2((ohm * 2) / (count / 2));
    options.push({
      topology: "series_parallel",
      label: `Sérioparalelně (${count / 2}× dvojice)`,
      loadOhm: sp,
      channels: 1,
      ok: sp >= ampMinOhm,
      note: `Dvojice sériově, pak paralelně = ${sp} Ω. Kompromis mezi výkonem a bezpečností.`,
    });
  }

  // Nejnižší (= nejvýkonnější) zátěž, která ještě splňuje minimum ampu.
  const viable = options.filter((o) => o.ok && o.loadOhm !== null);
  viable.sort((a, b) => (a.loadOhm! - b.loadOhm!));
  const best = viable[0] ?? null;

  const summary = best
    ? `Doporučeno: ${best.label} → ${best.loadOhm} Ω na kanál (min. ampu ${ampMinOhm} Ω).`
    : `Žádná varianta nevyhoví ${ampMinOhm} Ω — rozděl ${count} beden na víc kanálů zesilovače.`;

  return { count, ampMinOhm, options, best, summary };
}
