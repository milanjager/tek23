import { useMemo, useState } from "react";
import {
  Speaker,
  Volume2,
  Sparkles,
  Radio,
  Music,
  Sliders,
  Zap,
  Disc3,
  Piano,
  Lightbulb,
  Fuel,
  Grid3x3,
} from "lucide-react";

// Local mirrors of the shapes we need (kept loose on purpose so we don't have
// to export types from the giant StageBuilder3D module).
type CableType = "signal" | "speaker" | "power" | "dmx";
interface Placed {
  id: string;
  kind: string;
  pos: [number, number, number];
  rotY: number;
  groupId?: string;
  label?: string;
  variant?: "red" | "blue";
}
interface Cable {
  id: string;
  from: string;
  to: string;
  type: CableType;
}

const CABLE_META: Record<CableType, { label: string; short: string; color: string; laymanLabel: string }> = {
  signal:  { label: "Signál (XLR / jack)",   short: "SIG", color: "#65a30d", laymanLabel: "Zvukový signál (tichý – jde do mixu/ampu)" },
  speaker: { label: "Repro (Speakon)",        short: "SPK", color: "#0891b2", laymanLabel: "Reproduktorový kabel (hlasitý – z ampu do bedny)" },
  power:   { label: "Silový (230V)",          short: "PWR", color: "#dc2626", laymanLabel: "Napájení 230V (ze zásuvky / aggregátu)" },
  dmx:     { label: "DMX / světla",           short: "DMX", color: "#d97706", laymanLabel: "Ovládání světel (řídící signál)" },
};

// Column bucket used to lay devices out left-to-right in signal-flow order.
type Column = "source" | "mixer" | "amp" | "speaker" | "light" | "infra";

const COLUMN_META: { id: Column; label: string; sub: string; color: string }[] = [
  { id: "source",  label: "1. ZDROJE ZVUKU",      sub: "Odkud jde hudba",            color: "#8b5cf6" },
  { id: "mixer",   label: "2. MIX / EFEKTY",      sub: "Míchání signálu",            color: "#0ea5e9" },
  { id: "amp",     label: "3. ZESILOVAČE",        sub: "Zesílí signál pro bedny",    color: "#f59e0b" },
  { id: "speaker", label: "4. REPRODUKTORY",      sub: "Zvuk pro publikum",          color: "#10b981" },
  { id: "light",   label: "5. SVĚTLA",            sub: "Ovládáno DMX + 230V",        color: "#eab308" },
  { id: "infra",   label: "6. NAPÁJENÍ / OSTATNÍ", sub: "Aggregát, bar, dancefloor", color: "#64748b" },
];

function columnFor(kind: string): Column {
  if (["generator"].includes(kind)) return "infra";
  if (["dj", "cdj", "turntable", "korg", "korg_red", "korg_blue"].includes(kind)) return "source";
  if (kind === "mixer") return "mixer";
  if (["amp", "powersoft"].includes(kind)) return "amp";
  if (["horn", "mid", "bass", "sub", "linearray", "monitor",
       "badtekk_sub", "badtekk_bass", "badtekk_top"].includes(kind)) return "speaker";
  if (["strobe", "laser", "movinghead"].includes(kind)) return "light";
  return "infra";
}

function iconFor(kind: string) {
  if (["horn", "mid", "bass", "sub", "linearray", "monitor",
       "badtekk_sub", "badtekk_bass", "badtekk_top"].includes(kind)) return Speaker;
  if (["amp", "powersoft"].includes(kind)) return Volume2;
  if (kind === "mixer") return Sliders;
  if (kind === "dj") return Music;
  if (["cdj", "turntable"].includes(kind)) return Disc3;
  if (["korg", "korg_red", "korg_blue"].includes(kind)) return Piano;
  if (kind === "generator") return Fuel;
  if (["strobe", "laser", "movinghead"].includes(kind)) return Lightbulb;
  if (kind === "crowd") return Grid3x3;
  return Radio;
}

// Human-friendly names for kinds so the schematic reads like a stage plan.
const KIND_LABEL: Record<string, string> = {
  horn: "Horn (výšky)",
  mid: "Mid (středy)",
  bass: "Bass bin",
  sub: "Subwoofer 2×18\"",
  linearray: "Line array",
  monitor: "Monitor / odposlech",
  badtekk_sub: "Badtekk Sub",
  badtekk_bass: "Badtekk Bass",
  badtekk_top: "Badtekk Top",
  amp: "Amp rack",
  powersoft: "Powersoft K20",
  mixer: "Mixážní pult",
  dj: "DJ booth",
  dj_table: "DJ stůl",
  cdj: "CDJ přehrávač",
  korg: "Korg groovebox",
  korg_red: "Korg (červený)",
  korg_blue: "Korg (modrý)",
  turntable: "Gramofon",
  strobe: "Stroboskop",
  laser: "Laser",
  movinghead: "Moving head",
  bar: "Bar",
  generator: "Aggregát 230V",
  crowd: "Dancefloor",
};

// Which cable types can hit a given kind on each side of the card.
// IN pins on the left, OUT pins on the right — matches how any tech reads it.
function pinsFor(kind: string): { ins: CableType[]; outs: CableType[] } {
  const isSpeaker = ["horn","mid","bass","sub","linearray","monitor",
                     "badtekk_sub","badtekk_bass","badtekk_top"].includes(kind);
  if (isSpeaker)      return { ins: ["speaker"], outs: [] };
  if (kind === "amp" || kind === "powersoft") return { ins: ["signal","power"], outs: ["speaker"] };
  if (kind === "mixer") return { ins: ["signal","power"], outs: ["signal"] };
  if (kind === "dj")    return { ins: ["power"], outs: ["signal"] };
  if (["cdj","turntable","korg","korg_red","korg_blue"].includes(kind))
                        return { ins: ["power"], outs: ["signal"] };
  if (kind === "generator") return { ins: [], outs: ["power"] };
  if (kind === "movinghead") return { ins: ["dmx","power"], outs: [] };
  if (kind === "strobe" || kind === "laser") return { ins: ["dmx","power"], outs: [] };
  return { ins: [], outs: [] };
}

interface Props {
  items: Placed[];
  cables: Cable[];
  onClose?: () => void;
  // Building via schematic: add a new device of the given kind, and connect
  // two items with a cable. Parent (StageBuilder3D) owns the actual state.
  onAddDevice?: (kind: string) => void;
  onConnect?: (fromId: string, toId: string, type: CableType) => void;
  onRemoveCable?: (cableId: string) => void;
}

const CARD_W = 210;
const CARD_H = 90;
const COL_GAP = 90;
const ROW_GAP = 28;
const COL_HEADER_H = 46;

// Suggested "quick add" devices per column — one click builds the rig.
const COLUMN_ADDS: Record<Column, { kind: string; label: string }[]> = {
  source:  [
    { kind: "dj",         label: "DJ booth" },
    { kind: "cdj",        label: "CDJ" },
    { kind: "turntable",  label: "Gramofon" },
    { kind: "korg",       label: "Korg" },
  ],
  mixer:   [{ kind: "mixer", label: "Mixák" }],
  amp:     [
    { kind: "powersoft",  label: "Powersoft" },
    { kind: "amp",        label: "Amp rack" },
  ],
  speaker: [
    { kind: "sub",        label: "Sub" },
    { kind: "bass",       label: "Bass bin" },
    { kind: "mid",        label: "Mid" },
    { kind: "horn",       label: "Horn" },
    { kind: "monitor",    label: "Monitor" },
  ],
  light:   [
    { kind: "movinghead", label: "Moving head" },
    { kind: "strobe",     label: "Strobo" },
    { kind: "laser",      label: "Laser" },
  ],
  infra:   [
    { kind: "generator",  label: "Aggregát" },
    { kind: "bar",        label: "Bar" },
    { kind: "crowd",      label: "Dancefloor" },
  ],
};

export default function SchematicView({ items, cables, onAddDevice, onConnect, onRemoveCable }: Props) {
  const [highlight, setHighlight] = useState<null | { id: string; kind: "item" | "cable" }>(null);
  // Click-to-connect: user clicks a source OUT pin, then a target IN pin.
  const [pendingPin, setPendingPin] = useState<null | { itemId: string; type: CableType; role: "in" | "out" }>(null);
  const [connectError, setConnectError] = useState<string | null>(null);


  // Bucket items by column, keep original order within a column for stability.
  const layout = useMemo(() => {
    const cols: Record<Column, Placed[]> = {
      source: [], mixer: [], amp: [], speaker: [], light: [], infra: [],
    };
    for (const it of items) cols[columnFor(it.kind)].push(it);

    const positions = new Map<string, { x: number; y: number; col: Column; row: number }>();
    let maxRows = 0;
    COLUMN_META.forEach((col, colIdx) => {
      const arr = cols[col.id];
      maxRows = Math.max(maxRows, arr.length);
      arr.forEach((it, row) => {
        positions.set(it.id, {
          x: 24 + colIdx * (CARD_W + COL_GAP),
          y: COL_HEADER_H + 24 + row * (CARD_H + ROW_GAP),
          col: col.id,
          row,
        });
      });
    });
    const width  = 24 + COLUMN_META.length * (CARD_W + COL_GAP);
    const height = COL_HEADER_H + 48 + Math.max(1, maxRows) * (CARD_H + ROW_GAP);
    return { positions, width, height, cols };
  }, [items]);




  // Resolve source and target pin for each cable, then route it through a
  // vertical "lane" inside the gap between the two columns so parallel runs
  // don't stack. Lanes are assigned per (fromCol → toCol, cableType) group
  // and evenly spread inside the gap.
  const drawnCables = useMemo(() => {
    type Prep = {
      c: Cable;
      a: { x: number; y: number };
      b: { x: number; y: number };
      fromColIdx: number;
      toColIdx: number;
    };

    function anchorFor(id: string, type: CableType, role: "in" | "out") {
      const it = items.find((x) => x.id === id);
      const p = layout.positions.get(id);
      if (!it || !p) return null;
      const { ins, outs } = pinsFor(it.kind);
      const list = role === "in" ? ins : outs;
      const idx = list.indexOf(type);
      if (idx === -1) {
        return { x: role === "in" ? p.x : p.x + CARD_W, y: p.y + CARD_H / 2 };
      }
      const spacing = 22;
      const total = list.length;
      const startY = p.y + CARD_H / 2 - ((total - 1) * spacing) / 2;
      return { x: role === "in" ? p.x : p.x + CARD_W, y: startY + idx * spacing };
    }

    const prepped: Prep[] = [];
    for (const c of cables) {
      const fromIt = items.find((x) => x.id === c.from);
      const toIt = items.find((x) => x.id === c.to);
      if (!fromIt || !toIt) continue;
      const a = anchorFor(c.from, c.type, "out") ?? anchorFor(c.from, c.type, "in");
      const b = anchorFor(c.to, c.type, "in") ?? anchorFor(c.to, c.type, "out");
      if (!a || !b) continue;
      const fromColIdx = COLUMN_META.findIndex((cm) => cm.id === columnFor(fromIt.kind));
      const toColIdx   = COLUMN_META.findIndex((cm) => cm.id === columnFor(toIt.kind));
      prepped.push({ c, a, b, fromColIdx, toColIdx });
    }

    // Assign lane index per (leftCol, rightCol, cableType) so cables of same
    // type sharing a gap get parallel channels instead of stacking.
    const groupCounts = new Map<string, number>();
    const groupIdx = new Map<string, number>();
    for (const p of prepped) {
      const left = Math.min(p.fromColIdx, p.toColIdx);
      const right = Math.max(p.fromColIdx, p.toColIdx);
      const key = `${left}-${right}-${p.c.type}`;
      groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
    }

    return prepped.map((p) => {
      const { a, b, c, fromColIdx, toColIdx } = p;
      const left = Math.min(fromColIdx, toColIdx);
      const right = Math.max(fromColIdx, toColIdx);
      const key = `${left}-${right}-${c.type}`;
      const total = groupCounts.get(key) ?? 1;
      const idx = groupIdx.get(key) ?? 0;
      groupIdx.set(key, idx + 1);

      // Vertical lane sits inside the empty gap between the two columns.
      const gapLeftX  = 24 + (left + 1) * CARD_W + left * COL_GAP;
      const gapWidth  = COL_GAP;
      // Center lanes with a 15% padding so they don't hug card edges.
      const laneStep  = gapWidth * 0.7 / Math.max(1, total + 1);
      const laneX     = gapLeftX + gapWidth * 0.15 + laneStep * (idx + 1);

      // Path: from source pin → horizontal to lane → vertical to target y →
      // horizontal to target pin. Works whether target is left or right of
      // source (routing simply mirrors around the lane).
      const midX = (a.x < b.x) ? laneX : laneX;
      const path = `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`;
      const labelX = midX;
      const labelY = (a.y + b.y) / 2;
      return { c, path, a, b, labelX, labelY };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cables, layout, items]);


  return (
    <div className="flex h-full w-full flex-col bg-neutral-50">
      {/* Legend — reads like a technical drawing key */}
      <div className="flex flex-wrap items-center gap-4 border-b border-neutral-200 bg-white px-4 py-2 text-[11px]">
        <span className="font-bold uppercase tracking-wider text-neutral-700">Legenda kabelů:</span>
        {(Object.keys(CABLE_META) as CableType[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="inline-block h-1 w-8 rounded" style={{ backgroundColor: CABLE_META[t].color }} />
            <span className="font-bold" style={{ color: CABLE_META[t].color }}>{CABLE_META[t].short}</span>
            <span className="text-neutral-600">{CABLE_META[t].laymanLabel}</span>
          </span>
        ))}
        <span className="ml-auto flex items-center gap-3 text-neutral-600">
          <span className="flex items-center gap-1"><span className="rounded-sm bg-neutral-300 px-1.5 text-[10px] font-bold text-neutral-800">◀ IN</span> vstup</span>
          <span className="flex items-center gap-1"><span className="rounded-sm bg-neutral-300 px-1.5 text-[10px] font-bold text-neutral-800">OUT ▶</span> výstup</span>
        </span>
      </div>

      {/* Scrollable schematic surface */}
      <div className="flex-1 overflow-auto bg-[linear-gradient(#e5e7eb_1px,transparent_1px),linear-gradient(90deg,#e5e7eb_1px,transparent_1px)] bg-[size:24px_24px] bg-white">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-neutral-500">
            Zatím žádné komponenty. Přidej bedny v 3D pohledu a přepni sem — schéma se vygeneruje automaticky.
          </div>
        ) : (
          <svg
            width={layout.width}
            height={layout.height}
            style={{ minWidth: "100%", minHeight: "100%" }}
          >
            {/* Column headers — help a layman read the signal flow left→right */}
            {COLUMN_META.map((col, i) => (
              <g key={col.id} transform={`translate(${24 + i * (CARD_W + COL_GAP)}, 0)`}>
                <rect
                  x={0} y={4} width={CARD_W} height={COL_HEADER_H - 8}
                  rx={6}
                  fill={col.color} fillOpacity={0.08}
                  stroke={col.color} strokeOpacity={0.4}
                />
                <text x={CARD_W / 2} y={22} textAnchor="middle" fontSize={11} fontWeight={700} fill={col.color}>
                  {col.label}
                </text>
                <text x={CARD_W / 2} y={36} textAnchor="middle" fontSize={10} fill="#525252">
                  {col.sub}
                </text>
              </g>
            ))}

            {/* Signal flow arrows between column headers */}
            {COLUMN_META.slice(0, -1).map((_, i) => {
              const x = 24 + (i + 1) * CARD_W + i * COL_GAP + COL_GAP / 2;
              return (
                <g key={i}>
                  <line x1={x - 18} y1={COL_HEADER_H / 2} x2={x + 18} y2={COL_HEADER_H / 2}
                        stroke="#9ca3af" strokeWidth={1.5} />
                  <polygon points={`${x + 18},${COL_HEADER_H / 2} ${x + 12},${COL_HEADER_H / 2 - 5} ${x + 12},${COL_HEADER_H / 2 + 5}`}
                           fill="#9ca3af" />
                </g>
              );
            })}

            {/* Cables — white halo underneath for readability, colored line on top */}
            {drawnCables.map(({ c, path }) => {
              const isHi = highlight?.kind === "cable" && highlight.id === c.id;
              const dim = highlight && !isHi;
              return (
                <g key={`halo-${c.id}`} opacity={dim ? 0.2 : 1}>
                  <path
                    d={path}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={isHi ? 8 : 6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.9}
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke={CABLE_META[c.type].color}
                    strokeWidth={isHi ? 3.5 : 2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    onMouseEnter={() => setHighlight({ id: c.id, kind: "cable" })}
                    onMouseLeave={() => setHighlight(null)}
                    style={{ cursor: "pointer" }}
                  />
                </g>
              );
            })}

            {/* Small cable type labels at midpoint — SIG / SPK / PWR / DMX */}
            {drawnCables.map(({ c, labelX, labelY }) => {
              const isHi = highlight?.kind === "cable" && highlight.id === c.id;
              const dim = highlight && !isHi;
              const short = CABLE_META[c.type].short;
              const w = short.length * 6 + 8;
              return (
                <g
                  key={`lbl-${c.id}`}
                  transform={`translate(${labelX - w / 2}, ${labelY - 7})`}
                  opacity={dim ? 0.35 : 1}
                  style={{ pointerEvents: "none" }}
                >
                  <rect
                    width={w} height={14} rx={3}
                    fill="#ffffff"
                    stroke={CABLE_META[c.type].color}
                    strokeWidth={1}
                  />
                  <text
                    x={w / 2} y={10}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fontFamily="ui-monospace, monospace"
                    fill={CABLE_META[c.type].color}
                  >
                    {short}
                  </text>
                </g>
              );
            })}


            {/* Cards */}
            {items.map((it) => {
              const p = layout.positions.get(it.id);
              if (!p) return null;
              const pins = pinsFor(it.kind);
              const Icon = iconFor(it.kind);
              const col = COLUMN_META.find((c) => c.id === columnFor(it.kind))!;
              const isHi = highlight?.kind === "item" && highlight.id === it.id;
              const label = it.label || KIND_LABEL[it.kind] || it.kind;
              return (
                <g
                  key={it.id}
                  transform={`translate(${p.x}, ${p.y})`}
                  onMouseEnter={() => setHighlight({ id: it.id, kind: "item" })}
                  onMouseLeave={() => setHighlight(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Card body */}
                  <rect
                    width={CARD_W} height={CARD_H}
                    rx={8}
                    fill="#ffffff"
                    stroke={isHi ? col.color : "#d4d4d4"}
                    strokeWidth={isHi ? 2.5 : 1.5}
                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.08))"
                  />
                  {/* Column color strip on top */}
                  <rect width={CARD_W} height={5} rx={8} fill={col.color} />
                  {/* Icon */}
                  <g transform="translate(12, 22)">
                    <foreignObject width={28} height={28}>
                      <div style={{ color: col.color }}>
                        <Icon size={22} />
                      </div>
                    </foreignObject>
                  </g>
                  {/* Label + subtype */}
                  <text x={46} y={32} fontSize={13} fontWeight={700} fill="#171717">
                    {label.length > 22 ? label.slice(0, 21) + "…" : label}
                  </text>
                  <text x={46} y={48} fontSize={10} fill="#737373">
                    {KIND_LABEL[it.kind] || it.kind}
                  </text>
                  {/* Position hint (top-down x,z) */}
                  <text x={CARD_W - 8} y={CARD_H - 8} fontSize={9} textAnchor="end" fill="#a3a3a3" fontFamily="monospace">
                    {it.pos[0].toFixed(1)}, {it.pos[2].toFixed(1)} m
                  </text>

                  {/* IN pins on the left */}
                  {pins.ins.map((t, i) => {
                    const total = pins.ins.length;
                    const spacing = 22;
                    const y = CARD_H / 2 - ((total - 1) * spacing) / 2 + i * spacing;
                    return (
                      <g key={`in-${t}-${i}`} transform={`translate(0, ${y})`}>
                        <circle cx={0} cy={0} r={5} fill={CABLE_META[t].color} stroke="#fff" strokeWidth={1.5} />
                        <text x={10} y={3} fontSize={9} fontWeight={700} fill={CABLE_META[t].color}>
                          ◀ {CABLE_META[t].short}
                        </text>
                      </g>
                    );
                  })}
                  {/* OUT pins on the right */}
                  {pins.outs.map((t, i) => {
                    const total = pins.outs.length;
                    const spacing = 22;
                    const y = CARD_H / 2 - ((total - 1) * spacing) / 2 + i * spacing;
                    return (
                      <g key={`out-${t}-${i}`} transform={`translate(${CARD_W}, ${y})`}>
                        <circle cx={0} cy={0} r={5} fill={CABLE_META[t].color} stroke="#fff" strokeWidth={1.5} />
                        <text x={-10} y={3} fontSize={9} fontWeight={700} fill={CABLE_META[t].color} textAnchor="end">
                          {CABLE_META[t].short} ▶
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-1.5 text-[10px] text-neutral-500">
        Schéma je automaticky generováno z 3D scény. Bedny čti zleva doprava jako <b>signal flow</b>: zdroj → mix → zesilovač → repro. Barva kabelu = typ signálu.
      </div>
    </div>
  );
}
