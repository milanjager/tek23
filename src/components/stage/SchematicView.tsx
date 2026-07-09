import { useMemo, useRef, useState } from "react";
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

const COLUMN_META: { id: Column; label: string; sub: string; role: string; color: string }[] = [
  { id: "source",  label: "1. ZDROJE ZVUKU",       sub: "CDJ, gramofony, mikrofony", role: "Vstupní signál", color: "#8b5cf6" },
  { id: "mixer",   label: "2. FOH MIXPULT",        sub: "hlavní mix, efekty, sendy", role: "Míchání + DSP",   color: "#0ea5e9" },
  { id: "amp",     label: "3. ZESILOVAČE",         sub: "výkonové koncové stupně",   role: "Zesílení signálu", color: "#f59e0b" },
  { id: "speaker", label: "4. REPRODUKTORY",       sub: "Subs · Tops · Monitory",    role: "Zvuk pro publikum", color: "#10b981" },
  { id: "light",   label: "5. SVĚTLA (DMX)",       sub: "movinghead, laser, strobo", role: "Ovládáno DMX + 230V", color: "#eab308" },
  { id: "infra",   label: "6. NAPÁJENÍ",           sub: "Aggregát → rozvaděč → jištění", role: "Zdroj el. energie", color: "#64748b" },
];

// Descriptive separators between columns — explain what happens between stages.
const FLOW_SEPARATORS: { fromCol: number; label: string; sub: string }[] = [
  { fromCol: 0, label: "audio kabely",  sub: "XLR / jack, mic level → line level" },
  { fromCol: 1, label: "DSP → amp",     sub: "crossover, limiter, EQ" },
  { fromCol: 2, label: "výkonový okruh", sub: "Speakon, vysoký proud" },
  { fromCol: 3, label: "sálem",         sub: "zvuková vlna k publiku" },
  { fromCol: 4, label: "světelný pult", sub: "DMX 512 řízení" },
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

export interface SchematicKindOption {
  value: string;
  label: string;
  category: string;
  supportsVariant?: boolean;
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
  // Editing a device from the schematic — opens a detail modal on card click.
  kindOptions?: SchematicKindOption[];
  onUpdateItem?: (id: string, patch: Partial<Placed>) => void;
  onDeleteItem?: (id: string) => void;
  /** Controlled selection shared across views. */
  selectedIds?: string[];
  onSelectItem?: (id: string | null, additive?: boolean) => void;
}

const CARD_W = 210;
const CARD_H = 90;
const COL_GAP = 90;
const ROW_GAP = 28;
const COL_HEADER_H = 72;

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

export default function SchematicView({ items, cables, onAddDevice, onConnect, onRemoveCable, kindOptions, onUpdateItem, onDeleteItem }: Props) {
  const [highlight, setHighlight] = useState<null | { id: string; kind: "item" | "cable" }>(null);
  const [pendingPin, setPendingPin] = useState<null | { itemId: string; type: CableType; role: "in" | "out" }>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId ? items.find((x) => x.id === editingId) ?? null : null;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const panState = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);


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

      {/* Scrollable + pannable schematic surface */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-auto bg-[linear-gradient(#e5e7eb_1px,transparent_1px),linear-gradient(90deg,#e5e7eb_1px,transparent_1px)] bg-[size:24px_24px] bg-white ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={(e) => {
          // Pan only when dragging on empty background (not on a card/pin/button).
          const target = e.target as HTMLElement | SVGElement;
          const isInteractive =
            (target as HTMLElement).closest?.("button, input, select, [data-schema-card], [data-schema-pin]");
          // Middle-mouse always pans; left click pans only on empty area.
          if (e.button !== 0 && e.button !== 1) return;
          if (e.button === 0 && isInteractive) return;
          e.preventDefault();
          const el = scrollRef.current;
          if (!el) return;
          panState.current = { x: e.clientX, y: e.clientY, sx: el.scrollLeft, sy: el.scrollTop };
          setIsPanning(true);
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const s = panState.current;
          const el = scrollRef.current;
          if (!s || !el) return;
          el.scrollLeft = s.sx - (e.clientX - s.x);
          el.scrollTop  = s.sy - (e.clientY - s.y);
        }}
        onPointerUp={(e) => {
          panState.current = null;
          setIsPanning(false);
          try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        }}
        onWheel={(e) => {
          if (!(e.ctrlKey || e.metaKey)) return;
          e.preventDefault();
          setZoom((z) => Math.max(0.4, Math.min(2.5, z * (e.deltaY < 0 ? 1.1 : 0.9))));
        }}
      >
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-neutral-500">
            Zatím žádné komponenty. Přidej bedny v 3D pohledu a přepni sem — schéma se vygeneruje automaticky.
          </div>
        ) : (
          <svg
            width={layout.width * zoom}
            height={layout.height * zoom}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            style={{ display: "block" }}
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
                <text x={CARD_W / 2} y={20} textAnchor="middle" fontSize={11} fontWeight={700} fill={col.color}>
                  {col.label}
                </text>
                <text x={CARD_W / 2} y={34} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="#171717">
                  {col.sub}
                </text>
                <text x={CARD_W / 2} y={46} textAnchor="middle" fontSize={9} fill="#737373" fontStyle="italic">
                  {col.role}
                </text>
              </g>
            ))}

            {/* Descriptive signal-flow separators between columns */}
            {FLOW_SEPARATORS.map((sep, i) => {
              const x = 24 + (i + 1) * CARD_W + i * COL_GAP + COL_GAP / 2;
              const midY = COL_HEADER_H / 2;
              return (
                <g key={i}>
                  {/* arrow */}
                  <line x1={x - 22} y1={midY - 6} x2={x + 22} y2={midY - 6}
                        stroke="#9ca3af" strokeWidth={1.5} />
                  <polygon points={`${x + 22},${midY - 6} ${x + 15},${midY - 10} ${x + 15},${midY - 2}`}
                           fill="#9ca3af" />
                  {/* descriptive label pill */}
                  <rect x={x - 46} y={midY + 2} width={92} height={26} rx={4}
                        fill="#fafafa" stroke="#e5e5e5" strokeWidth={1} />
                  <text x={x} y={midY + 12} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#404040">
                    {sep.label}
                  </text>
                  <text x={x} y={midY + 23} textAnchor="middle" fontSize={7.5} fill="#737373">
                    {sep.sub}
                  </text>
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
                    onClick={() => {
                      if (onRemoveCable && confirm(`Smazat kabel ${CABLE_META[c.type].short}?`)) {
                        onRemoveCable(c.id);
                      }
                    }}
                    style={{ cursor: onRemoveCable ? "pointer" : "default" }}
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
                  data-schema-card=""
                  transform={`translate(${p.x}, ${p.y})`}
                  onMouseEnter={() => setHighlight({ id: it.id, kind: "item" })}
                  onMouseLeave={() => setHighlight(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onUpdateItem) setEditingId(it.id);
                  }}
                  style={{ cursor: onUpdateItem ? "pointer" : "default" }}
                >
                  {/* invisible full-card hit target so clicks on empty card area still open editor */}
                  <rect width={CARD_W} height={CARD_H} fill="transparent" />

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

                  {/* IN pins on the left — clickable for build-mode wiring */}
                  {pins.ins.map((t, i) => {
                    const total = pins.ins.length;
                    const spacing = 22;
                    const y = CARD_H / 2 - ((total - 1) * spacing) / 2 + i * spacing;
                    const isPending = pendingPin?.itemId === it.id && pendingPin.type === t && pendingPin.role === "in";
                    return (
                      <g
                        key={`in-${t}-${i}`}
                        data-schema-pin=""
                        transform={`translate(0, ${y})`}
                        style={{ cursor: onConnect ? "crosshair" : "default" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!onConnect) return;
                          if (pendingPin && pendingPin.type === t && pendingPin.role === "out" && pendingPin.itemId !== it.id) {
                            onConnect(pendingPin.itemId, it.id, t);
                            setPendingPin(null);
                            setConnectError(null);
                          } else if (pendingPin) {
                            setConnectError(pendingPin.role === "in"
                              ? "Klikni na výstup (OUT) jiné bedny, ne na další vstup."
                              : `Typ nesedí — čekám ${CABLE_META[pendingPin.type].short} OUT.`);
                          } else {
                            setPendingPin({ itemId: it.id, type: t, role: "in" });
                            setConnectError(null);
                          }
                        }}
                      >
                        <circle cx={0} cy={0} r={isPending ? 7 : 5}
                                fill={CABLE_META[t].color}
                                stroke={isPending ? "#000" : "#fff"} strokeWidth={isPending ? 2 : 1.5} />
                        <text x={10} y={3} fontSize={9} fontWeight={700} fill={CABLE_META[t].color}>
                          ◀ {CABLE_META[t].short}
                        </text>
                      </g>
                    );
                  })}
                  {/* OUT pins on the right — clickable */}
                  {pins.outs.map((t, i) => {
                    const total = pins.outs.length;
                    const spacing = 22;
                    const y = CARD_H / 2 - ((total - 1) * spacing) / 2 + i * spacing;
                    const isPending = pendingPin?.itemId === it.id && pendingPin.type === t && pendingPin.role === "out";
                    return (
                      <g
                        key={`out-${t}-${i}`}
                        data-schema-pin=""
                        transform={`translate(${CARD_W}, ${y})`}
                        style={{ cursor: onConnect ? "crosshair" : "default" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!onConnect) return;
                          if (pendingPin && pendingPin.type === t && pendingPin.role === "in" && pendingPin.itemId !== it.id) {
                            onConnect(it.id, pendingPin.itemId, t);
                            setPendingPin(null);
                            setConnectError(null);
                          } else if (pendingPin) {
                            setConnectError(pendingPin.role === "out"
                              ? "Klikni na vstup (IN) jiné bedny, ne na další výstup."
                              : `Typ nesedí — čekám ${CABLE_META[pendingPin.type].short} IN.`);
                          } else {
                            setPendingPin({ itemId: it.id, type: t, role: "out" });
                            setConnectError(null);
                          }
                        }}
                      >
                        <circle cx={0} cy={0} r={isPending ? 7 : 5}
                                fill={CABLE_META[t].color}
                                stroke={isPending ? "#000" : "#fff"} strokeWidth={isPending ? 2 : 1.5} />
                        <text x={-10} y={3} fontSize={9} fontWeight={700} fill={CABLE_META[t].color} textAnchor="end">
                          {CABLE_META[t].short} ▶
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* Per-column "+ Přidat" quick-add buttons at the bottom of each column */}
            {onAddDevice && COLUMN_META.map((col, colIdx) => {
              const colX = 24 + colIdx * (CARD_W + COL_GAP);
              const colItems = layout.cols[col.id];
              const y = COL_HEADER_H + 24 + colItems.length * (CARD_H + ROW_GAP) - 4;
              const adds = COLUMN_ADDS[col.id];
              return (
                <g key={`add-${col.id}`} transform={`translate(${colX}, ${y})`}>
                  <foreignObject width={CARD_W} height={90}>
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: 4, padding: 4,
                      borderRadius: 8, border: `1.5px dashed ${col.color}55`,
                      background: `${col.color}0A`,
                    }}>
                      {adds.map((a) => (
                        <button
                          key={a.kind}
                          onClick={() => onAddDevice(a.kind)}
                          style={{
                            fontSize: 10, fontWeight: 600,
                            padding: "3px 7px", borderRadius: 4,
                            border: `1px solid ${col.color}55`,
                            background: "#fff",
                            color: col.color,
                            cursor: "pointer",
                          }}
                        >
                          + {a.label}
                        </button>
                      ))}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Device detail / edit modal — opens on card click */}
      {editing && onUpdateItem && (() => {
        const it = editing;
        const isKorg = it.kind === "korg" || it.kind === "korg_red" || it.kind === "korg_blue";
        const grouped = new Map<string, SchematicKindOption[]>();
        (kindOptions ?? []).forEach((o) => {
          if (!grouped.has(o.category)) grouped.set(o.category, []);
          grouped.get(o.category)!.push(o);
        });
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setEditingId(null)}
          >
            <div
              className="w-full max-w-md rounded-lg bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Detail zařízení</div>
                  <div className="text-sm font-bold text-neutral-900">{it.label || KIND_LABEL[it.kind] || it.kind}</div>
                </div>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded px-2 py-1 text-lg text-neutral-500 hover:bg-neutral-100"
                  aria-label="Zavřít"
                >×</button>
              </div>

              <div className="space-y-3 px-4 py-4 text-[12px]">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">ID / Vlastní štítek</span>
                  <input
                    type="text"
                    value={it.label ?? ""}
                    placeholder={KIND_LABEL[it.kind] || it.kind}
                    onChange={(e) => onUpdateItem(it.id, { label: e.target.value || undefined })}
                    className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-[12px] text-lime-700 focus:border-lime-500 focus:outline-none"
                  />
                  <span className="mt-1 block font-mono text-[10px] text-neutral-400">id: {it.id}</span>
                </label>

                {kindOptions && kindOptions.length > 0 && (
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Typ bedny / model</span>
                    <select
                      value={it.kind}
                      onChange={(e) => onUpdateItem(it.id, { kind: e.target.value })}
                      className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-[12px] focus:border-lime-500 focus:outline-none"
                    >
                      {[...grouped.entries()].map(([cat, opts]) => (
                        <optgroup key={cat} label={cat}>
                          {opts.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Stack skupina</span>
                    <input
                      type="text"
                      value={it.groupId ?? ""}
                      placeholder="např. sub-left"
                      onChange={(e) => onUpdateItem(it.id, { groupId: e.target.value || undefined })}
                      className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-[11px] focus:border-lime-500 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Výška ve stacku (Y, m)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={it.pos[1]}
                      onChange={(e) => {
                        const y = parseFloat(e.target.value);
                        if (!Number.isNaN(y)) onUpdateItem(it.id, { pos: [it.pos[0], y, it.pos[2]] });
                      }}
                      className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-[11px] focus:border-lime-500 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Pozice X (m)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={it.pos[0]}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isNaN(v)) onUpdateItem(it.id, { pos: [v, it.pos[1], it.pos[2]] });
                      }}
                      className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-[11px] focus:border-lime-500 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Pozice Z (m)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={it.pos[2]}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isNaN(v)) onUpdateItem(it.id, { pos: [it.pos[0], it.pos[1], v] });
                      }}
                      className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-[11px] focus:border-lime-500 focus:outline-none"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Rotace (°)</span>
                  <input
                    type="number"
                    step="15"
                    value={Math.round((it.rotY * 180) / Math.PI)}
                    onChange={(e) => {
                      const deg = parseFloat(e.target.value);
                      if (!Number.isNaN(deg)) onUpdateItem(it.id, { rotY: (deg * Math.PI) / 180 });
                    }}
                    className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-[11px] focus:border-lime-500 focus:outline-none"
                  />
                </label>

                {isKorg && (
                  <div>
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Barva Korgu</span>
                    <div className="flex gap-2">
                      {(["red", "blue"] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => onUpdateItem(it.id, { variant: v })}
                          className={`h-7 w-7 rounded border-2 ${it.variant === v ? "border-lime-500" : "border-neutral-300"}`}
                          style={{ backgroundColor: v === "red" ? "#c81e2a" : "#1e5ec8" }}
                          title={v === "red" ? "Červený" : "Modrý"}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3">
                {onDeleteItem ? (
                  <button
                    onClick={() => {
                      if (confirm("Smazat toto zařízení?")) {
                        onDeleteItem(it.id);
                        setEditingId(null);
                      }
                    }}
                    className="rounded bg-red-100 px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-200"
                  >
                    Smazat zařízení
                  </button>
                ) : <span />}
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded bg-neutral-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-neutral-700"
                >
                  Hotovo
                </button>
              </div>
            </div>
          </div>
        );
      })()}



      {/* Build-mode status bar — shown when a pin is armed or on error */}
      {(pendingPin || connectError) && (
        <div className={`border-t px-4 py-2 text-[11px] ${connectError ? "border-red-300 bg-red-50 text-red-700" : "border-lime-300 bg-lime-50 text-lime-800"}`}>
          {connectError ? (
            <span>⚠ {connectError} <button onClick={() => { setPendingPin(null); setConnectError(null); }} className="ml-2 rounded bg-red-200 px-2 py-0.5 text-red-800">Zrušit</button></span>
          ) : pendingPin ? (
            <span>
              🔌 Vybráno: <b>{CABLE_META[pendingPin.type].short} {pendingPin.role.toUpperCase()}</b> — klikni na
              {" "}<b>{pendingPin.role === "out" ? "vstup (IN)" : "výstup (OUT)"}</b> jiné bedny stejného typu, nebo
              <button onClick={() => setPendingPin(null)} className="ml-2 rounded bg-neutral-200 px-2 py-0.5 text-neutral-700">Zrušit</button>
            </span>
          ) : null}
        </div>
      )}


      {/* Footer hint */}
      <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-1.5 text-[10px] text-neutral-500">
        Táhni myší = posun · <b>Ctrl/⌘ + kolečko</b> = zoom ({Math.round(zoom * 100)}%) · <button onClick={() => setZoom(1)} className="ml-1 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] hover:bg-neutral-300">Reset</button> · Schéma se generuje z 3D scény zleva doprava jako signal flow.
      </div>
    </div>
  );
}
