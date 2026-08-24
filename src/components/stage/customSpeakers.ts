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

/* ============================================================
   Profily zesilovačů + kontrola kompatibility s impedancí
   ============================================================ */

export interface AmpProfile {
  id: string;
  name: string;
  channels: number;
  /** Minimální zátěž na kanál (Ω). */
  minOhm: number;
  /** Minimální zátěž v bridge módu (Ω), null = bridge nepodporuje. */
  bridgeMinOhm: number | null;
  /** Výkon na kanál při 4 Ω a 2 Ω (W RMS). */
  w4: number;
  w2: number;
  /** Podporuje 70/100 V linku. */
  hiZ?: boolean;
  outs: string;
  note?: string;
}

export const AMP_PROFILES: AmpProfile[] = [
  { id: "k20", name: "Powersoft K20 (2ch)", channels: 2, minOhm: 2, bridgeMinOhm: 4, w4: 4400, w2: 5200,
    outs: "2× Speakon NL4", note: "CEE 32 A, nikdy 2 kusy na jednu 16 A větev." },
  { id: "k10", name: "Powersoft K10 (2ch)", channels: 2, minOhm: 2, bridgeMinOhm: 4, w4: 2400, w2: 3000,
    outs: "2× Speakon NL4" },
  { id: "quattro4804", name: "Powersoft Quattrocanali 4804 (4ch)", channels: 4, minOhm: 2, bridgeMinOhm: 4, w4: 1200, w2: 1200,
    hiZ: true, outs: "2× NL4 (CH1+2, CH3+4)" },
  { id: "due4804", name: "Powersoft Duecanali 4804 (2ch)", channels: 2, minOhm: 2, bridgeMinOhm: 4, w4: 2400, w2: 2400,
    outs: "1× NL4 (CH1+CH2)" },
  { id: "generic4", name: "Obecný koncák — min. 4 Ω", channels: 2, minOhm: 4, bridgeMinOhm: 8, w4: 1000, w2: 0,
    outs: "Speakon NL4 / svorky", note: "Levnější ampy pod 4 Ω nejdou — hlídej paralelní řetěz." },
  { id: "generic8", name: "Instalační / 100V zesilovač", channels: 2, minOhm: 8, bridgeMinOhm: 16, w4: 0, w2: 0,
    hiZ: true, outs: "Svorkovnice", note: "Pro nízkoimpedanční PA bedny nevhodný." },
];

export type CompatLevel = "ok" | "warn" | "error";

export interface CompatIssue {
  level: CompatLevel;
  title: string;
  detail: string;
}

export interface CompatReport {
  amp: AmpProfile;
  count: number;
  loadOhm: number | null;
  issues: CompatIssue[];
  worst: CompatLevel;
}

/** Kontrola: sedí zvolená impedance a typ zapojení bedny k danému zesilovači? */
export function checkAmpCompatibility(d: CustomSpeaker, amp: AmpProfile, count: number): CompatReport {
  const issues: CompatIssue[] = [];
  const load = d.connection === "active" ? null : r2(d.ohm / count);

  if (d.connection === "active") {
    issues.push({
      level: "error",
      title: "Aktivní bedna se do zesilovače nepřipojuje",
      detail: `${d.name} má vlastní koncový stupeň — potřebuje 230 V z rozdělovače a XLR signál, ne výstup z ${amp.name}.`,
    });
    return { amp, count, loadOhm: null, issues, worst: "error" };
  }

  if (load !== null) {
    if (load < amp.minOhm) {
      issues.push({
        level: "error",
        title: `Podtížení: ${load} Ω < min. ${amp.minOhm} Ω`,
        detail: `${count}× ${d.ohm} Ω paralelně dá ${load} Ω na kanál. ${amp.name} to nezvládne — zapoj sériově/sérioparalelně nebo rozděl bedny na víc kanálů.`,
      });
    } else if (load < amp.minOhm * 1.25) {
      issues.push({
        level: "warn",
        title: `Na hraně minima (${load} Ω)`,
        detail: `Zesilovač je specifikován od ${amp.minOhm} Ω. Při dlouhých kabelech a hlubokých basech hrozí zásah ochran — hlídej teploty a délku vedení (min. 2,5 mm²).`,
      });
    } else {
      issues.push({
        level: "ok",
        title: `Impedance sedí: ${load} Ω na kanál`,
        detail: `${amp.name} má minimum ${amp.minOhm} Ω, zátěž je bezpečná.`,
      });
    }
  }

  // Výkonová shoda
  const perCh = load !== null && load <= 2.5 ? amp.w2 : amp.w4;
  const need = d.powerW * count;
  if (perCh > 0 && need > 0) {
    if (perCh > need * 2) {
      issues.push({
        level: "warn",
        title: "Zesilovač je výrazně předimenzovaný",
        detail: `${perCh} W na kanál vs. ${need} W zátěže (${count}× ${d.powerW} W). Nastav limiter v DSP, jinak snadno spálíš drivery.`,
      });
    } else if (perCh < need * 0.5) {
      issues.push({
        level: "warn",
        title: "Zesilovač je poddimenzovaný",
        detail: `${perCh} W na kanál vs. ${need} W zátěže. Hrozí clipping a zničení výškových driverů.`,
      });
    }
  } else if (amp.w4 === 0 && amp.w2 === 0) {
    issues.push({
      level: "error",
      title: "Nekompatibilní typ výstupu",
      detail: `${amp.name} je určen pro 70/100V linku, ne pro nízkoimpedanční bedny (${d.ohm} Ω).`,
    });
  }

  // Typ konektoru / topologie
  if (d.connection === "nl4_biamp") {
    const needCh = count * 2;
    issues.push({
      level: needCh > amp.channels ? "warn" : "ok",
      title: `Bi-amp potřebuje ${needCh} kanálů`,
      detail: needCh > amp.channels
        ? `${amp.name} má jen ${amp.channels} kanály — buď paralel LF sekcí, nebo přidej druhý zesilovač.`
        : `${amp.name} má ${amp.channels} kanálů, LF i MF/HF vyjdou samostatně (${amp.outs}).`,
    });
  }
  if (d.connection === "binding" || d.connection === "jack") {
    issues.push({
      level: "warn",
      title: "Konektory nesedí k výstupům zesilovače",
      detail: `Bedna má ${CONNECTION_LABELS[d.connection]}, zesilovač má ${amp.outs}. Potřebuješ redukci NL4 → ${d.connection === "jack" ? "jack" : "svorky"}; pro velké výkony to není profi řešení.`,
    });
  }
  if (d.connection === "nl4_link" && count > 2 && load !== null && load >= amp.minOhm) {
    issues.push({
      level: "warn",
      title: "Dlouhý daisy-chain",
      detail: `${count}× průchozí LINK OUT na jednom kabelu zvyšuje ztráty. Nad 2 bedny veď z ampu samostatné linky nebo použij 4mm² kabel.`,
    });
  }
  if (amp.note) issues.push({ level: "ok", title: "Poznámka k zesilovači", detail: amp.note });

  const worst: CompatLevel = issues.some((i) => i.level === "error")
    ? "error"
    : issues.some((i) => i.level === "warn")
      ? "warn"
      : "ok";

  return { amp, count, loadOhm: load, issues, worst };
}

/* ============================================================
   Barevné zvýraznění kompatibility (sdílené builderem i scénou)
   ============================================================ */

const AMP_PREF_KEY = "stage.customSpeakers.ampProfile";

export function getPreferredAmp(): AmpProfile {
  let id = "k10";
  try {
    id = localStorage.getItem(AMP_PREF_KEY) || id;
  } catch { /* SSR / private mode */ }
  return AMP_PROFILES.find((a) => a.id === id) ?? AMP_PROFILES[0]!;
}

export function setPreferredAmp(id: string) {
  try { localStorage.setItem(AMP_PREF_KEY, id); } catch { /* ignore */ }
}

export interface CompatBadge {
  level: CompatLevel;
  icon: string;
  short: string;
  /** Třídy pro chip (pozadí + text + rámeček). */
  chip: string;
  /** Třídy pro rámeček inputu / řádku. */
  ring: string;
  /** Barva tečky. */
  dot: string;
  title: string;
}

const BADGE_STYLE: Record<CompatLevel, Pick<CompatBadge, "icon" | "short" | "chip" | "ring" | "dot">> = {
  ok: {
    icon: "✅", short: "OK",
    chip: "border-emerald-500/50 bg-emerald-500/15 text-emerald-700",
    ring: "border-emerald-500/60",
    dot: "bg-emerald-500",
  },
  warn: {
    icon: "⚠️", short: "Pozor",
    chip: "border-amber-500/50 bg-amber-500/15 text-amber-700",
    ring: "border-amber-500/70",
    dot: "bg-amber-500",
  },
  error: {
    icon: "⛔", short: "Nekompatibilní",
    chip: "border-red-500/50 bg-red-500/15 text-red-700",
    ring: "border-red-500/70",
    dot: "bg-red-500",
  },
};

export function badgeFor(level: CompatLevel, title: string): CompatBadge {
  return { level, title, ...BADGE_STYLE[level] };
}

/** Souhrnná kompatibilita bedny s daným (nebo preferovaným) zesilovačem pro 1×/2×/4× stack. */
export function compatBadge(d: CustomSpeaker, amp: AmpProfile = getPreferredAmp()): CompatBadge {
  if (d.connection === "active") {
    return badgeFor("ok", `Aktivní bedna — 230 V z rozdělovače + XLR signál, zesilovač se neřeší (${d.powerW} W).`);
  }
  const reports = [1, 2, 4].map((n) => checkAmpCompatibility(d, amp, n));
  const level: CompatLevel = reports[0]!.worst === "error"
    ? "error"
    : reports.some((r) => r.worst === "error")
      ? "warn"
      : reports.some((r) => r.worst === "warn")
        ? "warn"
        : "ok";
  const detail = reports
    .map((r) => `${r.count}×: ${r.loadOhm === null ? "aktivní" : `${r.loadOhm} Ω`} — ${r.issues[0]?.title ?? "OK"}`)
    .join(" · ");
  return badgeFor(level, `${d.ohm} Ω / ${CONNECTION_LABELS[d.connection]} × ${amp.name}\n${detail}`);
}

/** Kompatibilita samotné impedance (bez ohledu na počet beden). */
export function ohmBadge(d: CustomSpeaker, amp: AmpProfile = getPreferredAmp()): CompatBadge {
  if (d.connection === "active") return badgeFor("ok", "Aktivní bedna — impedance zesilovač neřeší.");
  if (d.ohm < amp.minOhm) return badgeFor("error", `${d.ohm} Ω je pod minimem ${amp.name} (${amp.minOhm} Ω).`);
  if (d.ohm / 2 < amp.minOhm) return badgeFor("warn", `${d.ohm} Ω projde sólo, ale 2× paralelně (${r2(d.ohm / 2)} Ω) už ne — min. ${amp.minOhm} Ω.`);
  return badgeFor("ok", `${d.ohm} Ω · i 2× paralelně (${r2(d.ohm / 2)} Ω) je nad minimem ${amp.minOhm} Ω.`);
}

/** Kompatibilita typu zapojení / konektorů s výstupy zesilovače. */
export function connectionBadge(d: CustomSpeaker, amp: AmpProfile = getPreferredAmp()): CompatBadge {
  switch (d.connection) {
    case "active":
      return badgeFor("error", `Aktivní bedna nepatří na výstup zesilovače (${amp.outs}) — potřebuje 230 V + XLR.`);
    case "binding":
    case "jack":
      return badgeFor("warn", `${CONNECTION_LABELS[d.connection]} vs. ${amp.outs} — nutná redukce, není to profi řešení.`);
    case "nl4_biamp":
      return amp.channels >= 4
        ? badgeFor("ok", `Bi-amp: ${amp.name} má ${amp.channels} kanálů, LF i MF/HF vyjdou samostatně.`)
        : badgeFor("warn", `Bi-amp potřebuje 2 kanály na bednu — ${amp.name} má jen ${amp.channels}.`);
    default:
      return badgeFor("ok", `${CONNECTION_LABELS[d.connection]} sedí na ${amp.outs}.`);
  }
}
