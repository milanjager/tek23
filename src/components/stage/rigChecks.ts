/* Pravidla kontroly rigu — čisté funkce bez Reactu, testované v rigChecks.test.ts.
   Vstupy jsou obecné (kind = string), specifika typu dodává volající přes `info`. */

export interface CheckItem { id: string; kind: string; label?: string }
export interface CheckCable { id: string; from: string; to: string; type: "signal" | "speaker" | "power" | "dmx" }
export interface KindInfo {
  name: string;
  category: string;
  /** Špičkový odběr ze sítě (W). */
  peakW: number;
  /** Potřebuje napájení 230 V (má PWR vstup). */
  needsPower: boolean;
  /** Pasivní bedna napájená ze zesilovače (má SPK vstup). */
  passiveSpeaker: boolean;
  /** Počet reproduktorových kanálů (jen zesilovače). */
  ampChannels: number;
  /** Jmenovitá impedance bedny (Ω). */
  ohm: number;
  /** Výkon zdroje (W) — jen agregát. */
  capacityW: number;
  isDistro: boolean;
}

export type IssueKind = "unwired" | "power" | "impedance" | "count" | "channels";
export interface RigIssue {
  id: string;
  kind: IssueKind;
  severity: "error" | "warn";
  title: string;
  detail: string;
  itemId?: string;
  /** Nabízená oprava — volající ji umí provést. */
  fix?: { kind: "wire-to-distro"; label: string };
}

export const MIN_CHANNEL_OHM = 4;
export const MAX_BOXES_PER_CHANNEL = 4;
export const GENERATOR_CAPACITY_W = 15000;

/** Paralelní impedance n stejných beden. */
export const parallelOhm = (ohm: number, n: number) => (n > 0 ? ohm / n : Infinity);

export interface AmpChannel { cableId: string; ampId: string; boxIds: string[]; ohm: number }

/** Každý kabel SPK ze zesilovače = jeden obsazený kanál; bedny za ním přes LINK se počítají paralelně. */
export function ampChannels(items: CheckItem[], cables: CheckCable[], info: (k: string) => KindInfo): AmpChannel[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const spk = cables.filter((c) => c.type === "speaker" && byId.has(c.from) && byId.has(c.to));
  const out: AmpChannel[] = [];
  for (const c of spk) {
    const amp = byId.get(c.from)!;
    if (info(amp.kind).ampChannels <= 0) continue;
    const boxes: string[] = [];
    const queue = [c.to];
    const seen = new Set<string>();
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const it = byId.get(id);
      if (!it || !info(it.kind).passiveSpeaker) continue;
      boxes.push(id);
      for (const n of spk) if (n.from === id) queue.push(n.to);
    }
    // Bedny různé impedance: 1/Z = Σ 1/Zi
    const inv = boxes.reduce((s, id) => s + 1 / info(byId.get(id)!.kind).ohm, 0);
    out.push({ cableId: c.id, ampId: amp.id, boxIds: boxes, ohm: inv > 0 ? 1 / inv : Infinity });
  }
  return out;
}

export function powerBudget(items: CheckItem[], info: (k: string) => KindInfo) {
  const loadW = items.reduce((s, i) => s + info(i.kind).peakW, 0);
  const capacityW = items.reduce((s, i) => s + info(i.kind).capacityW, 0);
  return { loadW, capacityW };
}

export function checkRig(items: CheckItem[], cables: CheckCable[], info: (k: string) => KindInfo): RigIssue[] {
  const out: RigIssue[] = [];
  if (!items.length) return out;
  const name = (i: CheckItem) => i.label || info(i.kind).name;
  const hasDistro = items.some((i) => info(i.kind).isDistro);
  const ids = new Set(items.map((i) => i.id));
  const live = cables.filter((c) => ids.has(c.from) && ids.has(c.to));

  for (const it of items) {
    const k = info(it.kind);
    if (k.passiveSpeaker && !live.some((c) => c.type === "speaker" && c.to === it.id)) {
      out.push({ id: `unwired-spk-${it.id}`, kind: "unwired", severity: "error", itemId: it.id,
        title: `${name(it)} není zapojená`, detail: "Bedna nemá reproduktorový kabel ze zesilovače." });
    } else if (k.needsPower && k.capacityW === 0 && !live.some((c) => c.type === "power" && c.to === it.id)) {
      const light = k.category === "lights";
      out.push({ id: `unwired-pwr-${it.id}`, kind: "unwired", severity: "error", itemId: it.id,
        title: `${name(it)} nemá napájení`, detail: light ? "Světlo není zapojené do 230 V." : "Prvek není zapojený do 230 V.",
        ...(hasDistro && !k.isDistro ? { fix: { kind: "wire-to-distro" as const, label: "Zapojit do rozdělovače" } } : {}) });
    }
  }

  const { loadW, capacityW } = powerBudget(items, info);
  if (loadW > 0 && capacityW === 0) {
    out.push({ id: "power-nosource", kind: "power", severity: "error", title: "Chybí agregát",
      detail: `Rig potřebuje ${(loadW / 1000).toFixed(1)} kW, ale není tu žádný zdroj.` });
  } else if (loadW > capacityW) {
    out.push({ id: "power-over", kind: "power", severity: "error", title: "Agregát nestačí",
      detail: `Příkon ${(loadW / 1000).toFixed(1)} kW překračuje kapacitu ${(capacityW / 1000).toFixed(1)} kW.`,
      itemId: items.find((i) => info(i.kind).capacityW > 0)?.id });
  }

  const chans = ampChannels(items, live, info);
  for (const ch of chans) {
    const amp = items.find((i) => i.id === ch.ampId)!;
    if (ch.boxIds.length > MAX_BOXES_PER_CHANNEL) {
      out.push({ id: `count-${ch.cableId}`, kind: "count", severity: "error", itemId: amp.id,
        title: `${ch.boxIds.length} beden na jednom kanálu`, detail: `${name(amp)}: max. ${MAX_BOXES_PER_CHANNEL} bedny na kanál.` });
    }
    if (ch.ohm < MIN_CHANNEL_OHM) {
      out.push({ id: `ohm-${ch.cableId}`, kind: "impedance", severity: "warn", itemId: amp.id,
        title: `Impedance ${ch.ohm.toFixed(1).replace(".", ",")} Ω`, detail: `${name(amp)}: kanál pod ${MIN_CHANNEL_OHM} Ω (${ch.boxIds.length} bedny paralelně).` });
    }
  }
  for (const amp of items) {
    const n = info(amp.kind).ampChannels;
    if (n <= 0) continue;
    const used = chans.filter((c) => c.ampId === amp.id).length;
    if (used > n) out.push({ id: `chan-${amp.id}`, kind: "channels", severity: "error", itemId: amp.id,
      title: `${name(amp)}: ${used} linek, ${n} kanály`, detail: "Víc reproduktorových linek než výstupních kanálů." });
  }
  return out;
}
