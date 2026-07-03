import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Speaker,
  Cable,
  RotateCw,
  Trash2,
  Save,
  Eraser,
  Download,
  Plus,
  Move,
  Magnet,
  Volume2,
  Menu,
  X,
  Ruler,
  Sparkles,
  Layers,
  Radio,
  Grid3x3,
  Zap,

} from "lucide-react";


/* ---------- Types ---------- */

type ComponentKind =
  | "horn"
  | "mid"
  | "bass"
  | "sub"
  | "amp"
  | "mixer"
  | "dj"
  | "korg"
  | "turntable"
  | "custom"
  | "strobe"
  | "laser"
  | "movinghead"
  | "bar"
  | "generator"
  | "crowd";

type Category = "sound" | "lights" | "infra";
type ColorKey = "acid" | "magenta" | "cyan" | "amber";
type PortType = "audio" | "power" | "dmx";
type PortDir = "in" | "out";

interface Port {
  id: string;
  type: PortType;
  dir: PortDir;
  ox: number; // offset from item left
  oy: number; // offset from item top
}

interface Spec {
  kind: ComponentKind;
  label: string;
  category: Category;
  w: number;
  h: number;
  color: ColorKey;
  hint: string;
  ports: Port[];
}

interface Placed {
  id: string;
  kind: ComponentKind;
  x: number;
  y: number;
  rot: number;
  label?: string;
}

interface CableLink {
  id: string;
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
  type: PortType;
}

/* ---------- Port helpers ---------- */

const PORT_COLOR: Record<PortType, string> = {
  audio: "oklch(0.86 0.24 135)",
  power: "oklch(0.82 0.18 75)",
  dmx: "oklch(0.7 0.28 340)",
};

const PORT_LABEL: Record<PortType, string> = {
  audio: "AUDIO",
  power: "PWR",
  dmx: "DMX",
};

// helpers to build ports on box edges
const pLeft = (w: number, h: number, id: string, type: PortType, dir: PortDir, ratio = 0.5): Port => ({
  id, type, dir, ox: 0, oy: h * ratio,
});
const pRight = (w: number, h: number, id: string, type: PortType, dir: PortDir, ratio = 0.5): Port => ({
  id, type, dir, ox: w, oy: h * ratio,
});
const pTop = (w: number, h: number, id: string, type: PortType, dir: PortDir, ratio = 0.5): Port => ({
  id, type, dir, ox: w * ratio, oy: 0,
});
const pBottom = (w: number, h: number, id: string, type: PortType, dir: PortDir, ratio = 0.5): Port => ({
  id, type, dir, ox: w * ratio, oy: h,
});

/* ---------- Catalog ---------- */

const SPECS: Record<ComponentKind, Spec> = (() => {
  const mk = (
    kind: ComponentKind, label: string, category: Category, w: number, h: number, color: ColorKey, hint: string, ports: Port[],
  ): Spec => ({ kind, label, category, w, h, color, hint, ports });

  return {
    horn: mk("horn", "Horn", "sound", 96, 72, "acid", "Výškový horn", [
      pBottom(96, 72, "in", "audio", "in"),
    ]),
    mid: mk("mid", "Mid", "sound", 96, 96, "acid", "Střední pásmo", [
      pBottom(96, 96, "in", "audio", "in"),
    ]),
    bass: mk("bass", "Bass bin", "sound", 120, 96, "acid", "Basová bedna", [
      pTop(120, 96, "in", "audio", "in"),
    ]),
    sub: mk("sub", "Sub 2×18", "sound", 168, 120, "acid", "Sub-bass", [
      pTop(168, 120, "in", "audio", "in"),
    ]),
    amp: mk("amp", "Amp rack", "infra", 96, 72, "amber", "Zesilovače", [
      pLeft(96, 72, "pwr", "power", "in", 0.5),
      pLeft(96, 72, "audio_in", "audio", "in", 0.85),
      pRight(96, 72, "out_a", "audio", "out", 0.3),
      pRight(96, 72, "out_b", "audio", "out", 0.7),
    ]),
    mixer: mk("mixer", "Mixer FOH", "infra", 120, 72, "amber", "Mixážní pult", [
      pLeft(120, 72, "pwr", "power", "in"),
      pRight(120, 72, "audio_out", "audio", "out", 0.35),
      pRight(120, 72, "dmx_out", "dmx", "out", 0.75),
    ]),
    dj: mk("dj", "DJ booth", "infra", 144, 96, "amber", "DJ pult", [
      pLeft(144, 96, "pwr", "power", "in"),
      pRight(144, 96, "audio_out", "audio", "out", 0.35),
      pRight(144, 96, "dmx_out", "dmx", "out", 0.75),
    ]),
    korg: mk("korg", "Korg live", "infra", 120, 72, "cyan", "Korg groovebox pro live sety", [
      pLeft(120, 72, "pwr", "power", "in", 0.3),
      pLeft(120, 72, "midi_in", "dmx", "in", 0.75),
      pRight(120, 72, "audio_out_l", "audio", "out", 0.35),
      pRight(120, 72, "audio_out_r", "audio", "out", 0.7),
    ]),
    turntable: mk("turntable", "Gramofon", "infra", 96, 96, "amber", "Vinyl deck", [
      pLeft(96, 96, "pwr", "power", "in", 0.3),
      pRight(96, 96, "audio_out", "audio", "out", 0.55),
    ]),
    custom: mk("custom", "Vlastní", "infra", 96, 72, "cyan", "Vlastní zařízení uživatele", [
      pLeft(96, 72, "pwr", "power", "in", 0.3),
      pLeft(96, 72, "in", "audio", "in", 0.75),
      pRight(96, 72, "out", "audio", "out", 0.5),
    ]),
    strobe: mk("strobe", "Strobo", "lights", 72, 72, "cyan", "Stroboskop", [
      pLeft(72, 72, "pwr", "power", "in", 0.3),
      pLeft(72, 72, "dmx", "dmx", "in", 0.75),
    ]),
    laser: mk("laser", "Laser", "lights", 72, 72, "magenta", "Laser", [
      pLeft(72, 72, "pwr", "power", "in", 0.3),
      pLeft(72, 72, "dmx", "dmx", "in", 0.75),
    ]),
    movinghead: mk("movinghead", "Moving head", "lights", 72, 72, "magenta", "Otočná hlava", [
      pLeft(72, 72, "pwr", "power", "in", 0.3),
      pLeft(72, 72, "dmx", "dmx", "in", 0.75),
    ]),
    bar: mk("bar", "Bar", "infra", 216, 72, "amber", "Bar", [
      pLeft(216, 72, "pwr", "power", "in"),
    ]),
    generator: mk("generator", "Aggregát", "infra", 120, 96, "amber", "Diesel", [
      pRight(120, 96, "out1", "power", "out", 0.25),
      pRight(120, 96, "out2", "power", "out", 0.55),
      pRight(120, 96, "out3", "power", "out", 0.85),
    ]),
    crowd: mk("crowd", "Dancefloor", "infra", 240, 168, "magenta", "Prostor pro dav", []),
  };
})();


const CATEGORIES: { id: Category; label: string }[] = [
  { id: "sound", label: "Sound" },
  { id: "lights", label: "Lights" },
  { id: "infra", label: "Infra" },
];

/* ---------- Constants ---------- */

const GRID = 24;
const SNAP_THRESHOLD = 12;

const STORAGE = "stagerig:v3";
const PORT_SNAP = 28;
const PORT_R = 6;

// Depth (in px) for pseudo-3D extrusion — makes devices look like real cabinets.
const DEPTH: Record<ComponentKind, number> = {
  horn: 34,
  mid: 46,
  bass: 62,
  sub: 84,
  amp: 44,
  mixer: 26,
  dj: 30,
  korg: 22,
  turntable: 18,
  custom: 30,
  strobe: 28,
  laser: 26,
  movinghead: 38,
  bar: 40,
  generator: 70,
  crowd: 4,
};


/* ---------- Helpers ---------- */

const uid = () => Math.random().toString(36).slice(2, 10);

const COLOR_VAR: Record<ColorKey, string> = {
  acid: "var(--acid)",
  magenta: "var(--magenta)",
  cyan: "var(--cyan)",
  amber: "var(--amber)",
};

const colorClass = (c: ColorKey) => {
  switch (c) {
    case "acid":
      return { text: "text-[color:var(--acid)]", bg: "bg-[color:var(--acid)]/10", border: "border-[color:var(--acid)]/60", ring: "ring-[color:var(--acid)]" };
    case "magenta":
      return { text: "text-[color:var(--magenta)]", bg: "bg-[color:var(--magenta)]/10", border: "border-[color:var(--magenta)]/60", ring: "ring-[color:var(--magenta)]" };
    case "cyan":
      return { text: "text-[color:var(--cyan)]", bg: "bg-[color:var(--cyan)]/10", border: "border-[color:var(--cyan)]/60", ring: "ring-[color:var(--cyan)]" };
    case "amber":
      return { text: "text-[color:var(--amber)]", bg: "bg-[color:var(--amber)]/10", border: "border-[color:var(--amber)]/60", ring: "ring-[color:var(--amber)]" };
  }
};

/* ---------- Alignment ---------- */

interface Guide {
  axis: "x" | "y";
  pos: number;
  from: number; // min along the perpendicular axis
  to: number;   // max along the perpendicular axis
  kind: "start" | "center" | "end";
}

type Rect = { x: number; y: number; w: number; h: number };

function snapAndGuide(
  candidate: Rect,
  others: Rect[],
  useGrid: boolean,
): { x: number; y: number; guides: Guide[] } {
  // For X axis (vertical guide lines): candidate has 3 x-targets (start, center, end).
  const candXs = [
    { pos: candidate.x, kind: "start" as const },
    { pos: candidate.x + candidate.w / 2, kind: "center" as const },
    { pos: candidate.x + candidate.w, kind: "end" as const },
  ];
  const candYs = [
    { pos: candidate.y, kind: "start" as const },
    { pos: candidate.y + candidate.h / 2, kind: "center" as const },
    { pos: candidate.y + candidate.h, kind: "end" as const },
  ];

  let bestX: { delta: number; guide: number; kind: Guide["kind"]; target: Rect } | null = null;
  let bestY: { delta: number; guide: number; kind: Guide["kind"]; target: Rect } | null = null;

  for (const o of others) {
    const targetsX = [o.x, o.x + o.w / 2, o.x + o.w];
    const targetsY = [o.y, o.y + o.h / 2, o.y + o.h];
    for (const cx of candXs) {
      for (const t of targetsX) {
        const d = t - cx.pos;
        if (Math.abs(d) <= SNAP_THRESHOLD && (!bestX || Math.abs(d) < Math.abs(bestX.delta))) {
          bestX = { delta: d, guide: t, kind: cx.kind, target: o };
        }
      }
    }
    for (const cy of candYs) {
      for (const t of targetsY) {
        const d = t - cy.pos;
        if (Math.abs(d) <= SNAP_THRESHOLD && (!bestY || Math.abs(d) < Math.abs(bestY.delta))) {
          bestY = { delta: d, guide: t, kind: cy.kind, target: o };
        }
      }
    }
  }

  let nx = candidate.x;
  let ny = candidate.y;
  const guides: Guide[] = [];

  if (bestX) {
    nx = candidate.x + bestX.delta;
    const snapped = { ...candidate, x: nx };
    const from = Math.min(snapped.y, bestX.target.y);
    const to = Math.max(snapped.y + snapped.h, bestX.target.y + bestX.target.h);
    guides.push({ axis: "x", pos: bestX.guide, from, to, kind: bestX.kind });
  } else if (useGrid) {
    nx = Math.round(candidate.x / GRID) * GRID;
  }
  if (bestY) {
    ny = candidate.y + bestY.delta;
    const snapped = { ...candidate, y: ny };
    const from = Math.min(snapped.x, bestY.target.x);
    const to = Math.max(snapped.x + snapped.w, bestY.target.x + bestY.target.w);
    guides.push({ axis: "y", pos: bestY.guide, from, to, kind: bestY.kind });
  } else if (useGrid) {
    ny = Math.round(candidate.y / GRID) * GRID;
  }

  return { x: nx, y: ny, guides };
}


/* ---------- Visual glyphs ---------- */

function Glyph({ kind, selected, label }: { kind: ComponentKind; selected: boolean; label?: string }) {
  const spec = SPECS[kind];
  const c = COLOR_VAR[spec.color];
  const stroke = c;
  const fill = `color-mix(in oklch, ${c} 18%, transparent)`;
  const glow = selected ? `drop-shadow(0 0 8px ${c})` : undefined;

  const common = { style: { filter: glow } as React.CSSProperties };

  switch (kind) {
    case "horn":
      return (
        <svg viewBox="0 0 96 72" className="h-full w-full" {...common}>
          <rect x="6" y="10" width="24" height="52" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path d="M30 14 L88 4 L88 68 L30 58 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <line x1="88" y1="4" x2="88" y2="68" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case "mid":
      return (
        <svg viewBox="0 0 96 96" className="h-full w-full" {...common}>
          <rect x="6" y="6" width="84" height="84" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <circle cx="48" cy="36" r="16" fill="none" stroke={stroke} strokeWidth="1.5" />
          <circle cx="48" cy="36" r="6" fill={stroke} opacity="0.5" />
          <rect x="20" y="62" width="56" height="18" rx="2" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.7" />
        </svg>
      );
    case "bass":
      return (
        <svg viewBox="0 0 120 96" className="h-full w-full" {...common}>
          <rect x="4" y="4" width="112" height="88" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <circle cx="36" cy="48" r="22" fill="none" stroke={stroke} strokeWidth="1.5" />
          <circle cx="36" cy="48" r="8" fill={stroke} opacity="0.4" />
          <circle cx="84" cy="48" r="22" fill="none" stroke={stroke} strokeWidth="1.5" />
          <circle cx="84" cy="48" r="8" fill={stroke} opacity="0.4" />
        </svg>
      );
    case "sub":
      return (
        <svg viewBox="0 0 168 120" className="h-full w-full" {...common}>
          <rect x="4" y="4" width="160" height="112" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <line x1="84" y1="8" x2="84" y2="112" stroke={stroke} strokeWidth="1" opacity="0.4" />
          <circle cx="44" cy="60" r="34" fill="none" stroke={stroke} strokeWidth="1.5" />
          <circle cx="44" cy="60" r="12" fill={stroke} opacity="0.4" />
          <circle cx="124" cy="60" r="34" fill="none" stroke={stroke} strokeWidth="1.5" />
          <circle cx="124" cy="60" r="12" fill={stroke} opacity="0.4" />
        </svg>
      );
    case "amp":
      return (
        <svg viewBox="0 0 96 72" className="h-full w-full" {...common}>
          <rect x="4" y="4" width="88" height="64" rx="2" fill={fill} stroke={stroke} strokeWidth="1.5" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x="10" y={12 + i * 12} width="76" height="6" rx="1" fill="none" stroke={stroke} strokeWidth="1" opacity="0.7" />
          ))}
          <circle cx="82" cy="14" r="2" fill={stroke} />
        </svg>
      );
    case "mixer":
      return (
        <svg viewBox="0 0 120 72" className="h-full w-full" {...common}>
          <rect x="4" y="4" width="112" height="64" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
          {[16, 32, 48, 64, 80, 96].map((x) => (
            <g key={x}>
              <line x1={x} y1="14" x2={x} y2="58" stroke={stroke} strokeWidth="1" opacity="0.5" />
              <rect x={x - 3} y={20 + ((x % 24) / 3)} width="6" height="10" rx="1" fill={stroke} />
            </g>
          ))}
        </svg>
      );
    case "dj":
      return (
        <svg viewBox="0 0 144 96" className="h-full w-full" {...common}>
          <rect x="4" y="4" width="136" height="88" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <circle cx="34" cy="48" r="22" fill="none" stroke={stroke} strokeWidth="1.5" />
          <circle cx="34" cy="48" r="4" fill={stroke} />
          <circle cx="110" cy="48" r="22" fill="none" stroke={stroke} strokeWidth="1.5" />
          <circle cx="110" cy="48" r="4" fill={stroke} />
          <rect x="62" y="30" width="20" height="36" rx="1" fill="none" stroke={stroke} strokeWidth="1" />
          <line x1="72" y1="36" x2="72" y2="60" stroke={stroke} strokeWidth="1" opacity="0.6" />
        </svg>
      );
    case "korg":
      return (
        <svg viewBox="0 0 120 72" className="h-full w-full" {...common}>
          <rect x="4" y="4" width="112" height="64" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
          {/* pads 4x4 */}
          {Array.from({ length: 16 }).map((_, i) => {
            const c = i % 4;
            const r = Math.floor(i / 4);
            return (
              <rect key={i} x={12 + c * 12} y={16 + r * 9} width="9" height="6" rx="1"
                fill={stroke} opacity={0.35 + (i % 3) * 0.2} />
            );
          })}
          {/* knobs */}
          <circle cx="78" cy="22" r="6" fill="none" stroke={stroke} strokeWidth="1.2" />
          <circle cx="96" cy="22" r="6" fill="none" stroke={stroke} strokeWidth="1.2" />
          <line x1="78" y1="22" x2="82" y2="18" stroke={stroke} strokeWidth="1.2" />
          <line x1="96" y1="22" x2="100" y2="18" stroke={stroke} strokeWidth="1.2" />
          {/* screen */}
          <rect x="72" y="36" width="36" height="14" rx="1" fill={stroke} opacity="0.25" />
          <text x="90" y="46" textAnchor="middle" fontSize="7" fontFamily="ui-monospace, monospace" fill={stroke}>KORG</text>
          <text x="60" y="64" textAnchor="middle" fontSize="6" fontFamily="ui-monospace, monospace" fill={stroke} opacity="0.7">LIVE</text>
        </svg>
      );
    case "turntable":
      return (
        <svg viewBox="0 0 96 96" className="h-full w-full" {...common}>
          <rect x="4" y="4" width="88" height="88" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <circle cx="42" cy="48" r="30" fill="none" stroke={stroke} strokeWidth="1.5" />
          <circle cx="42" cy="48" r="22" fill={stroke} opacity="0.15" />
          <circle cx="42" cy="48" r="4" fill={stroke} />
          {/* concentric grooves */}
          <circle cx="42" cy="48" r="14" fill="none" stroke={stroke} strokeWidth="0.6" opacity="0.5" />
          <circle cx="42" cy="48" r="26" fill="none" stroke={stroke} strokeWidth="0.6" opacity="0.5" />
          {/* tonearm */}
          <line x1="78" y1="14" x2="52" y2="42" stroke={stroke} strokeWidth="2" />
          <circle cx="78" cy="14" r="3" fill={stroke} />
          <rect x="50" y="40" width="6" height="8" rx="1" fill={stroke} opacity="0.8" />
          {/* pitch fader */}
          <rect x="78" y="52" width="10" height="34" rx="1" fill="none" stroke={stroke} strokeWidth="1" opacity="0.7" />
          <rect x="79" y="66" width="8" height="4" rx="1" fill={stroke} />
        </svg>
      );
    case "custom":
      return (
        <svg viewBox="0 0 96 72" className="h-full w-full" {...common}>
          <rect x="4" y="4" width="88" height="64" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="48" y="30" textAnchor="middle" fontSize="10" fontFamily="ui-monospace, monospace" fill={stroke} style={{ letterSpacing: "0.15em" }}>
            USER
          </text>
          <text x="48" y="52" textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill={stroke} opacity="0.9">
            {(label ?? "?").slice(0, 12).toUpperCase()}
          </text>
        </svg>
      );
    case "strobe":
      return (
        <svg viewBox="0 0 72 72" className="h-full w-full" {...common}>
          <rect x="4" y="20" width="64" height="32" rx="2" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <rect x="10" y="26" width="52" height="20" rx="1" fill={stroke} opacity="0.85" />
          <path d="M36 4 L40 16 L52 12 L44 22 L56 26 L44 30 L48 42 L36 34 L24 42 L28 30 L16 26 L28 22 L20 12 L32 16 Z"
            fill={stroke} opacity="0.35" />
        </svg>
      );
    case "laser":
      return (
        <svg viewBox="0 0 72 72" className="h-full w-full" {...common}>
          <rect x="16" y="24" width="40" height="24" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <circle cx="36" cy="36" r="4" fill={stroke} />
          <line x1="36" y1="36" x2="4" y2="4" stroke={stroke} strokeWidth="1" opacity="0.5" />
          <line x1="36" y1="36" x2="68" y2="4" stroke={stroke} strokeWidth="1" opacity="0.5" />
          <line x1="36" y1="36" x2="4" y2="68" stroke={stroke} strokeWidth="1" opacity="0.5" />
          <line x1="36" y1="36" x2="68" y2="68" stroke={stroke} strokeWidth="1" opacity="0.5" />
        </svg>
      );
    case "movinghead":
      return (
        <svg viewBox="0 0 72 72" className="h-full w-full" {...common}>
          <rect x="20" y="52" width="32" height="14" rx="2" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <circle cx="36" cy="34" r="18" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <circle cx="36" cy="34" r="8" fill={stroke} opacity="0.6" />
          <path d="M18 34 L36 34 L18 20 Z" fill={stroke} opacity="0.25" />
          <path d="M54 34 L36 34 L54 20 Z" fill={stroke} opacity="0.25" />
        </svg>
      );
    case "bar":
      return (
        <svg viewBox="0 0 216 72" className="h-full w-full" {...common}>
          <rect x="4" y="14" width="208" height="44" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <line x1="4" y1="30" x2="212" y2="30" stroke={stroke} strokeWidth="1" opacity="0.5" />
          {[30, 60, 90, 120, 150, 180].map((x) => (
            <rect key={x} x={x} y="38" width="8" height="14" rx="1" fill={stroke} opacity="0.6" />
          ))}
        </svg>
      );
    case "generator":
      return (
        <svg viewBox="0 0 120 96" className="h-full w-full" {...common}>
          <rect x="4" y="10" width="112" height="76" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <circle cx="30" cy="48" r="14" fill="none" stroke={stroke} strokeWidth="1.2" />
          <rect x="54" y="30" width="52" height="14" rx="1" fill="none" stroke={stroke} strokeWidth="1" opacity="0.7" />
          <rect x="54" y="52" width="52" height="14" rx="1" fill="none" stroke={stroke} strokeWidth="1" opacity="0.7" />
          <text x="60" y="42" fontSize="10" fill={stroke} fontFamily="monospace">FUEL</text>
        </svg>
      );
    case "crowd":
      return (
        <svg viewBox="0 0 240 168" className="h-full w-full" {...common}>
          <rect x="4" y="4" width="232" height="160" rx="6" fill={fill} stroke={stroke} strokeWidth="1.5" strokeDasharray="6 4" />
          {Array.from({ length: 40 }).map((_, i) => {
            const cx = 20 + (i % 10) * 22 + ((Math.floor(i / 10) % 2) * 10);
            const cy = 24 + Math.floor(i / 10) * 34;
            return <circle key={i} cx={cx} cy={cy} r="6" fill={stroke} opacity="0.5" />;
          })}
        </svg>
      );
  }
}

/* ---------- Component ---------- */

export function StageBuilder() {
  const [items, setItems] = useState<Placed[]>([]);
  const [cables, setCables] = useState<CableLink[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [cableMode, setCableMode] = useState(false);
  const [category, setCategory] = useState<Category>("sound");
  const [snap, setSnap] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [showHalo, setShowHalo] = useState(true);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [view, setView] = useState<"stage" | "backstage" | "speakers">("stage");
  const [zoom, setZoom] = useState(1);
  const [tilt, setTilt] = useState(0); // 0 = top-down, up to ~55deg = 3D perspective
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [highlightCables, setHighlightCables] = useState<Set<string>>(new Set());
  const [focusPulse, setFocusPulse] = useState<string | null>(null);

  const [ghost, setGhost] = useState<{ kind: ComponentKind; x: number; y: number } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pending, setPending] = useState<{
    itemId: string;
    portId: string;
    type: PortType;
    dir: PortDir;
    x: number;
    y: number;
    hover: { itemId: string; portId: string } | null;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ id: string; dx: number; dy: number; pointerId: number } | null>(null);
  const paletteDragRef = useRef<{ kind: ComponentKind; pointerId: number } | null>(null);
  const pendingPointer = useRef<number | null>(null);
  const lastSnapSig = useRef<string>("");
  const canvasPointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    dist: number;
    midScreen: { x: number; y: number };
    startZoom: number;
    startPan: { x: number; y: number };
  } | null>(null);
  const gestureActive = useRef(false);



  /* persistence */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const p = JSON.parse(raw);
        setItems(p.items ?? []);
        // migrate: only keep cables that have port info
        const valid: CableLink[] = (p.cables ?? []).filter(
          (c: Partial<CableLink>) => c && c.fromPort && c.toPort && c.type,
        );
        setCables(valid);
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify({ items, cables }));
  }, [items, cables]);


  /* palette pointer drag (works on touch + mouse) */
  const onPaletteItemPointerDown = (k: ComponentKind) => (e: React.PointerEvent) => {
    e.preventDefault();
    paletteDragRef.current = { kind: k, pointerId: e.pointerId };
    setGhost({ kind: k, x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const pd = paletteDragRef.current;
      if (!pd || pd.pointerId !== e.pointerId) return;
      setGhost({ kind: pd.kind, x: e.clientX, y: e.clientY });
    };
    const up = (e: PointerEvent) => {
      const pd = paletteDragRef.current;
      if (!pd || pd.pointerId !== e.pointerId) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const spec = SPECS[pd.kind];
        const lx = (e.clientX - rect.left - rect.width / 2 - pan.x) / zoom + rect.width / 2;
        const ly = (e.clientY - rect.top - rect.height / 2 - pan.y) / zoom + rect.height / 2;
        let x = lx - spec.w / 2;
        let y = ly - spec.h / 2;
        if (snap) {
          x = Math.round(x / GRID) * GRID;
          y = Math.round(y / GRID) * GRID;
        }
        const label = pd.kind === "custom" ? (prompt("Název zařízení:", "MůjStroj")?.trim() || "USER") : undefined;
        setItems((prev) => [...prev, { id: uid(), kind: pd.kind, x, y, rot: 0, label }]);
        setPaletteOpen(false);
      }
      paletteDragRef.current = null;
      setGhost(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [snap, zoom, pan]);

  /* tap-to-place fallback for mobile: single tap on palette item, then tap on canvas */
  const onPaletteItemClick = (k: ComponentKind) => () => {
    // Only used as a fallback if drag didn't fire (rare). Place near canvas center.
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const spec = SPECS[k];
    let x = rect.width / 2 - spec.w / 2;
    let y = rect.height / 2 - spec.h / 2;
    if (snap) {
      x = Math.round(x / GRID) * GRID;
      y = Math.round(y / GRID) * GRID;
    }
    const label = k === "custom" ? (prompt("Název zařízení:", "MůjStroj")?.trim() || "USER") : undefined;
    setItems((prev) => [...prev, { id: uid(), kind: k, x, y, rot: 0, label }]);
    setPaletteOpen(false);
  };

  /* item pointer drag */
  const onItemPointerDown = (id: string) => (e: React.PointerEvent) => {
    if (cableMode) return; // cable mode uses ports, not item body
    e.stopPropagation();
    setSelected(id);
    if (tilt > 0) return; // no dragging in 3D preview

    const item = items.find((i) => i.id === id);
    if (!item || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const lx = (e.clientX - rect.left - rect.width / 2 - pan.x) / zoom + rect.width / 2;
    const ly = (e.clientY - rect.top - rect.height / 2 - pan.y) / zoom + rect.height / 2;
    dragState.current = {
      id,
      dx: lx - item.x,
      dy: ly - item.y,
      pointerId: e.pointerId,
    };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragState.current;
      if (!d || d.pointerId !== e.pointerId || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const lx = (e.clientX - rect.left - rect.width / 2 - pan.x) / zoom + rect.width / 2;
      const ly = (e.clientY - rect.top - rect.height / 2 - pan.y) / zoom + rect.height / 2;
      const rawX = lx - d.dx;
      const rawY = ly - d.dy;
      const dragged = items.find((i) => i.id === d.id);
      if (!dragged) return;
      const spec = SPECS[dragged.kind];
      const others = items
        .filter((i) => i.id !== d.id)
        .map((i) => ({ x: i.x, y: i.y, w: SPECS[i.kind].w, h: SPECS[i.kind].h }));
      const res = snap
        ? snapAndGuide({ x: rawX, y: rawY, w: spec.w, h: spec.h }, others, true)
        : { x: rawX, y: rawY, guides: [] as Guide[] };
      setItems((prev) => prev.map((i) => (i.id === d.id ? { ...i, x: res.x, y: res.y } : i)));
      // haptic feedback whenever the snap-guide signature changes
      const sig = res.guides.map((g) => `${g.axis}:${g.pos}`).join("|");
      if (sig !== lastSnapSig.current) {
        lastSnapSig.current = sig;
        if (sig && typeof navigator !== "undefined" && "vibrate" in navigator) {
          try { (navigator as Navigator).vibrate?.(12); } catch {}
        }
      }
      setGuides(res.guides);

    };
    const up = (e: PointerEvent) => {
      const d = dragState.current;
      if (!d || d.pointerId !== e.pointerId) return;
      dragState.current = null;
      lastSnapSig.current = "";
      setGuides([]);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [items, snap, zoom, pan]);

  /* keyboard */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!selected) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        setItems((p) => p.filter((i) => i.id !== selected));
        setCables((c) => c.filter((cb) => cb.from !== selected && cb.to !== selected));
        setSelected(null);
      }
      if (e.key === "r" || e.key === "R") {
        setItems((p) => p.map((i) => (i.id === selected ? { ...i, rot: (i.rot + 15) % 360 } : i)));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selected]);

  const selectedItem = items.find((i) => i.id === selected);

  const counts = useMemo(() => {
    const c: Partial<Record<ComponentKind, number>> = {};
    items.forEach((i) => (c[i.kind] = (c[i.kind] ?? 0) + 1));
    return c;
  }, [items]);

  const clear = () => {
    if (!confirm("Smazat celý stage?")) return;
    setItems([]);
    setCables([]);
    setSelected(null);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ items, cables }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stage-rig.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* base preset — two stacks (L/R) + amps + mixer + generator, fully wired */
  const loadBasePreset = () => {
    if (items.length > 0 && !confirm("Nahradit aktuální stage základním presetem?")) return;
    const mk = (kind: ComponentKind, x: number, y: number, rot = 0): Placed =>
      ({ id: uid(), kind, x, y, rot });
    // Stage front is at top; speakers face up (audience).
    // Left stack column center ≈ 220, right ≈ 620
    const LX = 172; // bass 120 wide → x=172 puts center at 232
    const RX = 548; // bass at 548 → center 608
    // Vertical: horn top, mid below, bass bottom
    const hornL = mk("horn", LX + 12, 48);   // 96 wide, indent 12 to center over mid
    const midL  = mk("mid",  LX + 12, 120);  // 96 wide
    const bassL = mk("bass", LX,      216);  // 120 wide
    const hornR = mk("horn", RX + 12, 48);
    const midR  = mk("mid",  RX + 12, 120);
    const bassR = mk("bass", RX,      216);
    // Amps behind each stack
    const ampL = mk("amp", LX - 12, 336);    // 96 wide
    const ampR = mk("amp", RX + 24, 336);
    // Mixer center-back (FOH)
    const mixer = mk("mixer", 340, 432);     // 120 wide, center ≈ 400
    // Generator further back
    const gen = mk("generator", 340, 552);   // 120 wide

    const newItems: Placed[] = [hornL, midL, bassL, hornR, midR, bassR, ampL, ampR, mixer, gen];

    const link = (
      from: string, fromPort: string,
      to: string, toPort: string,
      type: PortType,
    ): CableLink => ({ id: uid(), from, to, fromPort, toPort, type });

    const newCables: CableLink[] = [
      // Audio: mixer → amps → speakers (bass + mid per side; horn passive)
      link(mixer.id, "audio_out", ampL.id, "audio_in", "audio"),
      link(mixer.id, "audio_out", ampR.id, "audio_in", "audio"),
      link(ampL.id, "out_a", bassL.id, "in", "audio"),
      link(ampL.id, "out_b", midL.id,  "in", "audio"),
      link(ampR.id, "out_a", bassR.id, "in", "audio"),
      link(ampR.id, "out_b", midR.id,  "in", "audio"),
      // Power: generator → mixer + amps
      link(gen.id, "out1", ampL.id,  "pwr", "power"),
      link(gen.id, "out2", ampR.id,  "pwr", "power"),
      link(gen.id, "out3", mixer.id, "pwr", "power"),
    ];

    setItems(newItems);
    setCables(newCables);
    setSelected(null);
    setHighlightCables(new Set());
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setTilt(0);
  };


  const centerOf = useCallback(
    (id: string) => {
      const it = items.find((i) => i.id === id);
      if (!it) return null;
      const s = SPECS[it.kind];
      return { x: it.x + s.w / 2, y: it.y + s.h / 2 };
    },
    [items],
  );

  /* absolute port position with rotation */
  const portPos = useCallback(
    (item: Placed, port: Port) => {
      const s = SPECS[item.kind];
      const cx = item.x + s.w / 2;
      const cy = item.y + s.h / 2;
      const lx = port.ox - s.w / 2;
      const ly = port.oy - s.h / 2;
      const a = (item.rot * Math.PI) / 180;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      return { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos };
    },
    [],
  );

  const findPort = (itemId: string, portId: string) => {
    const it = items.find((i) => i.id === itemId);
    if (!it) return null;
    const p = SPECS[it.kind].ports.find((pp) => pp.id === portId);
    if (!p) return null;
    return { item: it, port: p, pos: portPos(it, p) };
  };

  /* start cable from a port */
  const onPortPointerDown = (itemId: string, port: Port) => (e: React.PointerEvent) => {
    if (!cableMode) return;
    e.stopPropagation();
    e.preventDefault();
    const it = items.find((i) => i.id === itemId);
    if (!it || !canvasRef.current) return;
    const pos = portPos(it, port);
    pendingPointer.current = e.pointerId;
    try { (e.currentTarget as Element as SVGGraphicsElement).setPointerCapture?.(e.pointerId); } catch {}
    setPending({
      itemId,
      portId: port.id,
      type: port.type,
      dir: port.dir,
      x: pos.x,
      y: pos.y,
      hover: null,
    });
  };

  /* global pointer handlers for pending cable */
  useEffect(() => {
    if (!pending) return;
    const move = (e: PointerEvent) => {
      if (pendingPointer.current !== e.pointerId || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2 - pan.x) / zoom + rect.width / 2;
      const y = (e.clientY - rect.top - rect.height / 2 - pan.y) / zoom + rect.height / 2;

      // find nearest compatible port — snap radius grows when zoomed out so edges are easy to catch
      let hover: { itemId: string; portId: string } | null = null;
      let bestD = PORT_SNAP / Math.max(0.45, zoom);
      for (const it of items) {
        if (it.id === pending.itemId) continue;
        for (const p of SPECS[it.kind].ports) {
          if (p.type !== pending.type) continue;
          if (p.dir === pending.dir) continue;
          const pp = portPos(it, p);
          const d = Math.hypot(pp.x - x, pp.y - y);
          if (d < bestD) {
            bestD = d;
            hover = { itemId: it.id, portId: p.id };
          }
        }
      }
      let nx = x;
      let ny = y;
      if (hover) {
        const tp = findPort(hover.itemId, hover.portId);
        if (tp) { nx = tp.pos.x; ny = tp.pos.y; }
      }
      setPending((p) => (p ? { ...p, x: nx, y: ny, hover } : p));
    };
    const up = (e: PointerEvent) => {
      if (pendingPointer.current !== e.pointerId) return;
      pendingPointer.current = null;
      setPending((p) => {
        if (p && p.hover) {
          const from = p.dir === "out" ? { i: p.itemId, port: p.portId } : { i: p.hover.itemId, port: p.hover.portId };
          const to = p.dir === "out" ? { i: p.hover.itemId, port: p.hover.portId } : { i: p.itemId, port: p.portId };
          setCables((prev) => [
            ...prev,
            { id: uid(), from: from.i, to: to.i, fromPort: from.port, toPort: to.port, type: p.type },
          ]);
        }
        return null;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, items, zoom, pan]);


  /* Wheel zoom (map-like, focal point at cursor) */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left - rect.width / 2;
      const sy = e.clientY - rect.top - rect.height / 2;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const newZoom = Math.max(0.3, Math.min(2, +(zoom * factor).toFixed(3)));
      const Lcx = (sx - pan.x) / zoom;
      const Lcy = (sy - pan.y) / zoom;
      setZoom(newZoom);
      setPan({ x: sx - Lcx * newZoom, y: sy - Lcy * newZoom });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, pan]);

  /* Two-finger pinch-zoom + pan (like maps) */
  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    canvasPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (canvasPointers.current.size === 2 && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const pts = Array.from(canvasPointers.current.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      pinchRef.current = {
        dist: Math.hypot(dx, dy) || 1,
        midScreen: {
          x: (pts[0].x + pts[1].x) / 2 - rect.left - rect.width / 2,
          y: (pts[0].y + pts[1].y) / 2 - rect.top - rect.height / 2,
        },
        startZoom: zoom,
        startPan: { ...pan },
      };
      gestureActive.current = true;
    }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!canvasPointers.current.has(e.pointerId)) return;
      canvasPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (canvasPointers.current.size >= 2 && pinchRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const pts = Array.from(canvasPointers.current.values()).slice(0, 2);
        const dx = pts[1].x - pts[0].x;
        const dy = pts[1].y - pts[0].y;
        const newDist = Math.hypot(dx, dy) || 1;
        const newMid = {
          x: (pts[0].x + pts[1].x) / 2 - rect.left - rect.width / 2,
          y: (pts[0].y + pts[1].y) / 2 - rect.top - rect.height / 2,
        };
        const scale = newDist / pinchRef.current.dist;
        const newZoom = Math.max(0.3, Math.min(2, pinchRef.current.startZoom * scale));
        // Logical point under the initial midpoint stays under the current midpoint.
        const Lcx = (pinchRef.current.midScreen.x - pinchRef.current.startPan.x) / pinchRef.current.startZoom;
        const Lcy = (pinchRef.current.midScreen.y - pinchRef.current.startPan.y) / pinchRef.current.startZoom;
        setZoom(newZoom);
        setPan({ x: newMid.x - Lcx * newZoom, y: newMid.y - Lcy * newZoom });
      }
    };
    const up = (e: PointerEvent) => {
      if (!canvasPointers.current.has(e.pointerId)) return;
      canvasPointers.current.delete(e.pointerId);
      if (canvasPointers.current.size < 2) {
        pinchRef.current = null;
        setTimeout(() => { gestureActive.current = false; }, 50);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  /* Animated focus on an item — center + zoom-in */
  const focusItem = useCallback((id: string, targetZoom = 1.5) => {
    const it = items.find((i) => i.id === id);
    if (!it || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const spec = SPECS[it.kind];
    const cx = it.x + spec.w / 2;
    const cy = it.y + spec.h / 2;
    const z = Math.max(0.5, Math.min(2, targetZoom));
    setZoom(z);
    setPan({
      x: -(cx - rect.width / 2) * z,
      y: -(cy - rect.height / 2) * z,
    });
    setFocusPulse(id);
    setTimeout(() => setFocusPulse((p) => (p === id ? null : p)), 1400);
  }, [items]);


  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top bar */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/50 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[color:var(--acid)]/15 ring-1 ring-[color:var(--acid)]/40">
            <Volume2 className="h-5 w-5 text-[color:var(--acid)]" />
          </div>
          <div>
            <h1 className="font-mono text-sm font-bold tracking-widest text-glow-acid">STAGE_RIG // TEKNO</h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              free party sound-system planner
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarBtn onClick={() => setSnap((v) => !v)} active={snap} icon={Magnet}>
            {snap ? "Snap ON" : "Snap OFF"}
          </ToolbarBtn>
          <ToolbarBtn onClick={() => setShowGuides((v) => !v)} active={showGuides} icon={Ruler}>
            {showGuides ? "Guides ON" : "Guides OFF"}
          </ToolbarBtn>
          <ToolbarBtn onClick={() => setShowHalo((v) => !v)} active={showHalo} icon={Sparkles}>
            {showHalo ? "Halo ON" : "Halo OFF"}
          </ToolbarBtn>

          <ToolbarBtn
            onClick={() => setCableMode((v) => { setPending(null); return !v; })}
            active={cableMode}
            icon={Cable}
          >
            {cableMode ? "Kabel: táhni port→port" : "Kabel"}
          </ToolbarBtn>

          <ToolbarBtn
            onClick={() => selected && setItems((p) => p.map((i) => (i.id === selected ? { ...i, rot: (i.rot + 15) % 360 } : i)))}
            icon={RotateCw}
            disabled={!selected}
          >
            Otočit
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => {
              if (!selected) return;
              setItems((p) => p.filter((i) => i.id !== selected));
              setCables((c) => c.filter((cb) => cb.from !== selected && cb.to !== selected));
              setSelected(null);
            }}
            icon={Trash2}
            disabled={!selected}
            danger
          >
            Smazat
          </ToolbarBtn>
          <div className="mx-2 h-6 w-px bg-border" />
          <ToolbarBtn onClick={loadBasePreset} icon={Zap}>Preset základ</ToolbarBtn>
          <ToolbarBtn onClick={exportJson} icon={Download}>Export</ToolbarBtn>
          <ToolbarBtn onClick={() => localStorage.setItem(STORAGE, JSON.stringify({ items, cables }))} icon={Save}>Uložit</ToolbarBtn>
          <ToolbarBtn onClick={clear} icon={Eraser} danger>Reset</ToolbarBtn>
        </div>
      </header>

      {/* View tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-card/30 px-3 py-2">
        {([
          { id: "stage", label: "Stage", icon: Grid3x3 },
          { id: "backstage", label: "Backstage", icon: Layers },
          { id: "speakers", label: "Reproduktory", icon: Radio },
        ] as const).map((v) => {
          const Icon = v.icon;
          const active = view === v.id;
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
                active
                  ? "border-[color:var(--acid)] bg-[color:var(--acid)]/15 text-[color:var(--acid)] glow-acid"
                  : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {v.label}
            </button>
          );
        })}

        {view === "stage" && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Zoom */}
            <div className="flex items-center gap-1 rounded-sm border border-border bg-background/40 px-2 py-1">
              <button
                onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))}
                className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
                aria-label="Oddálit"
              >−</button>
              <span className="w-10 text-center font-mono text-[10px] uppercase tracking-widest text-[color:var(--acid)]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
                className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
                aria-label="Přiblížit"
              >+</button>
              <button
                onClick={() => { setZoom(1); setTilt(0); setPan({ x: 0, y: 0 }); }}
                className="ml-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                aria-label="Reset zoom"
              >Fit</button>
            </div>
            {/* Tilt (3D) */}
            <div className="flex items-center gap-1 rounded-sm border border-border bg-background/40 px-2 py-1">
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">3D</span>
              <input
                type="range"
                min={0}
                max={55}
                step={1}
                value={tilt}
                onChange={(e) => setTilt(Number(e.target.value))}
                className="h-1 w-20 accent-[color:var(--acid)]"
                aria-label="Náklon pohledu"
              />
              <span className="w-8 text-center font-mono text-[10px] text-[color:var(--acid)]">{tilt}°</span>
            </div>
          </div>
        )}
      </div>




      <div className="relative flex flex-1 overflow-hidden">
        {/* Mobile palette toggle */}
        <button
          onClick={() => setPaletteOpen((v) => !v)}
          className="absolute left-3 top-3 z-40 flex items-center gap-1.5 rounded-sm border border-[color:var(--acid)]/60 bg-background/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[color:var(--acid)] backdrop-blur md:hidden"
        >
          {paletteOpen ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
          {paletteOpen ? "Zavřít" : "Komponenty"}
        </button>

        {/* Palette backdrop on mobile */}
        {paletteOpen && (
          <div
            className="absolute inset-0 z-20 bg-background/50 backdrop-blur-sm md:hidden"
            onClick={() => setPaletteOpen(false)}
          />
        )}

        {/* Palette */}
        <aside
          className={`absolute inset-y-0 left-0 z-30 flex w-72 max-w-[85vw] shrink-0 flex-col border-r border-border bg-card/95 backdrop-blur transition-transform md:static md:z-0 md:bg-card/30 md:backdrop-blur-none ${
            paletteOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div className="border-b border-border p-3 pt-14 md:pt-3">
            <div className="mb-2 flex items-center gap-2">
              <Plus className="h-3.5 w-3.5 text-[color:var(--acid)]" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Komponenty</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`rounded-sm border px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
                    category === c.id
                      ? "border-[color:var(--acid)] bg-[color:var(--acid)]/10 text-[color:var(--acid)]"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70 md:hidden">
              Podrž a přetáhni na plochu →
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {Object.values(SPECS)
                .filter((s) => s.category === category)
                .map((s) => {
                  const cls = colorClass(s.color);
                  return (
                    <div
                      key={s.kind}
                      onPointerDown={onPaletteItemPointerDown(s.kind)}
                      onDoubleClick={onPaletteItemClick(s.kind)}
                      style={{ touchAction: "none" }}
                      className={`group cursor-grab select-none rounded-md border ${cls.border} ${cls.bg} p-2 transition hover:scale-[1.02] active:cursor-grabbing active:scale-95`}
                    >
                      <div className="flex h-16 items-center justify-center">
                        <div className="h-14 w-full">
                          <Glyph kind={s.kind} selected={false} />
                        </div>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <div className={`font-mono text-[10px] font-bold uppercase tracking-wider ${cls.text}`}>
                          {s.label}
                        </div>
                        <Move className="h-3 w-3 text-muted-foreground opacity-60" />
                      </div>
                      <div className="text-[9px] text-muted-foreground">{s.hint}</div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Rig sheet */}
          <div className="border-t border-border p-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Rig sheet</div>
            {Object.keys(counts).length === 0 ? (
              <div className="font-mono text-[10px] text-muted-foreground/60">— stage prázdný —</div>
            ) : (
              <div className="space-y-1">
                {Object.entries(counts).map(([k, n]) => (
                  <div key={k} className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-muted-foreground">{SPECS[k as ComponentKind].label}</span>
                    <span className={colorClass(SPECS[k as ComponentKind].color).text}>×{n}</span>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 font-mono text-[11px]">
                  <span className="text-muted-foreground">Kabely</span>
                  <span className="text-[color:var(--amber)]">×{cables.length}</span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Canvas */}
        <main className="relative flex-1 overflow-hidden">
          {view !== "stage" && (
            <BackstagePanel
              view={view}
              items={items}
              cables={cables}
              onClose={() => { setHighlightCables(new Set()); setView("stage"); }}
              onSelect={(id) => {
                setSelected(id);
                // highlight all cables touching this item, then switch to stage
                const ids = new Set(
                  cables.filter((c) => c.from === id || c.to === id).map((c) => c.id),
                );
                setHighlightCables(ids);
                setView("stage");
                // wait for view to mount, then animate focus
                requestAnimationFrame(() => requestAnimationFrame(() => focusItem(id, 1.4)));
              }}
              onHighlightCables={(ids) => setHighlightCables(new Set(ids))}
              onFocusCable={(cableId, targetId) => {
                setHighlightCables(new Set([cableId]));
                setSelected(targetId);
                setView("stage");
                requestAnimationFrame(() => requestAnimationFrame(() => focusItem(targetId, 1.6)));
              }}
            />
          )}


          <div
            ref={canvasRef}
            onPointerDown={onCanvasPointerDown}
            onClick={() => {
              if (gestureActive.current) return;
              setSelected(null);
              setHighlightCables(new Set());
            }}
            style={{ touchAction: "none", perspective: `${1400 - tilt * 8}px`, perspectiveOrigin: "50% 65%" }}
            className="bg-grid relative h-full w-full"
          >
            {/* Stage markers */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
              <div className="mt-4 rounded-full border border-[color:var(--acid)]/40 bg-background/60 px-4 py-1 font-mono text-[10px] uppercase tracking-widest text-[color:var(--acid)] backdrop-blur">
                ▲ STAGE FRONT ▲
              </div>
            </div>
            {showGuides && (
              <div className="pointer-events-none absolute right-3 top-14 z-10 rounded-md border border-[oklch(0.75_0.3_340)]/40 bg-background/80 px-3 py-2 backdrop-blur">
                <div className="mb-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: "oklch(0.75 0.3 340)" }}>
                  Legenda vodítek
                </div>
                <div className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 text-center rounded px-1 text-[9px]" style={{ background: "oklch(0.14 0.02 280)", color: "oklch(0.75 0.3 340)", border: "1px solid oklch(0.75 0.3 340)" }}>LEFT</span>
                    <span>levý okraj</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 text-center rounded px-1 text-[9px]" style={{ background: "oklch(0.14 0.02 280)", color: "oklch(0.75 0.3 340)", border: "1px solid oklch(0.75 0.3 340)" }}>MID</span>
                    <span>střed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 text-center rounded px-1 text-[9px]" style={{ background: "oklch(0.14 0.02 280)", color: "oklch(0.75 0.3 340)", border: "1px solid oklch(0.75 0.3 340)" }}>RIGHT</span>
                    <span>pravý okraj</span>
                  </div>
                  <div className="my-1 h-px bg-border/60" />
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 text-center rounded px-1 text-[9px]" style={{ background: "oklch(0.14 0.02 280)", color: "oklch(0.75 0.3 340)", border: "1px solid oklch(0.75 0.3 340)" }}>TOP</span>
                    <span>horní okraj</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 text-center rounded px-1 text-[9px]" style={{ background: "oklch(0.14 0.02 280)", color: "oklch(0.75 0.3 340)", border: "1px solid oklch(0.75 0.3 340)" }}>MID</span>
                    <span>střed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 text-center rounded px-1 text-[9px]" style={{ background: "oklch(0.14 0.02 280)", color: "oklch(0.75 0.3 340)", border: "1px solid oklch(0.75 0.3 340)" }}>BOT</span>
                    <span>spodní okraj</span>
                  </div>
                </div>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
              <div className="mb-8 rounded-full border border-border bg-background/60 px-4 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur">
                ▼ CROWD ▼
              </div>
            </div>

            {/* 3D / zoom / pan transform layer — contains all interactive world content */}
            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotateX(${tilt}deg)`,
                transformOrigin: "50% 50%",
                transformStyle: "preserve-3d",
                transition: dragState.current || pinchRef.current ? "none" : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
                willChange: "transform",
              }}
            >
              {/* Ground / horizon fog — visible in 3D tilt */}
              {tilt > 0 && (
                <>
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, oklch(0.86 0.24 135 / 0.06) 0%, transparent 30%, oklch(0.14 0.02 280 / 0.9) 100%)",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px"
                    style={{
                      background: "linear-gradient(to right, transparent, oklch(0.86 0.24 135 / 0.6), transparent)",
                      boxShadow: "0 0 24px oklch(0.86 0.24 135 / 0.4)",
                    }}
                  />
                </>
              )}

            {items.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
                <div className="max-w-sm rounded-lg border border-dashed border-border bg-card/40 px-6 py-5 text-center backdrop-blur">
                  <p className="font-mono text-xs uppercase tracking-widest text-[color:var(--acid)]">Přetáhni komponentu</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Horny nahoře, středy pod ně, basy dolů. Přidej stroboskopy, laser, DJ pult a bar.
                  </p>
                </div>
              </div>
            )}

            {/* Cables + guides layer (non-interactive) */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: "visible" }}>

              {cables.map((c) => {
                const f = findPort(c.from, c.fromPort);
                const t = findPort(c.to, c.toPort);
                if (!f || !t) return null;
                const a = f.pos;
                const b = t.pos;
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2 + 40;
                const col = PORT_COLOR[c.type];
                const hl = highlightCables.has(c.id);
                const anyHl = highlightCables.size > 0;
                return (
                  <g key={c.id} opacity={anyHl && !hl ? 0.18 : 1}>
                    {hl && (
                      <path
                        d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                        stroke={col}
                        strokeOpacity={0.35}
                        strokeWidth={10}
                        fill="none"
                        strokeLinecap="round"
                      />
                    )}
                    <path
                      d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                      stroke={col}
                      strokeOpacity={hl ? 1 : 0.75}
                      strokeWidth={hl ? 4 : 2.5}
                      fill="none"
                      strokeDasharray={hl ? "10 6" : undefined}
                    >
                      {hl && (
                        <animate attributeName="stroke-dashoffset" from="0" to="32" dur="0.8s" repeatCount="indefinite" />
                      )}
                    </path>
                    <circle cx={a.x} cy={a.y} r={hl ? 5 : 3.5} fill={col} />
                    <circle cx={b.x} cy={b.y} r={hl ? 5 : 3.5} fill={col} />
                  </g>
                );
              })}

              {/* Pending cable */}
              {pending && (() => {
                const f = findPort(pending.itemId, pending.portId);
                if (!f) return null;
                const a = f.pos;
                const b = { x: pending.x, y: pending.y };
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2 + 30;
                const col = PORT_COLOR[pending.type];
                return (
                  <path
                    d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                    stroke={col}
                    strokeWidth={2.5}
                    fill="none"
                    strokeDasharray={pending.hover ? "0" : "6 4"}
                    strokeOpacity={pending.hover ? 1 : 0.7}
                  />
                );
              })()}

              {/* Alignment guides — bright magenta with glow, capped, range-limited */}
              <defs>
                <filter id="snap-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {showGuides && guides.map((g, i) => {
                const col = "oklch(0.75 0.3 340)";
                const pad = 40;
                const from = g.from - pad;
                const to = g.to + pad;
                if (g.axis === "x") {
                  return (
                    <g key={i} filter="url(#snap-glow)">
                      {/* faint full-canvas line */}
                      <line x1={g.pos} y1={0} x2={g.pos} y2="100%" stroke={col} strokeOpacity={0.25} strokeWidth={1} strokeDasharray="2 4" />
                      {/* bright bounded line */}
                      <line x1={g.pos} y1={from} x2={g.pos} y2={to} stroke={col} strokeWidth={2} strokeDasharray="6 4">
                        <animate attributeName="stroke-dashoffset" from="0" to="20" dur="0.6s" repeatCount="indefinite" />
                      </line>
                      {/* end caps */}
                      <line x1={g.pos - 8} y1={from} x2={g.pos + 8} y2={from} stroke={col} strokeWidth={2} />
                      <line x1={g.pos - 8} y1={to} x2={g.pos + 8} y2={to} stroke={col} strokeWidth={2} />
                      {/* SNAP badge */}
                      <g transform={`translate(${g.pos + 10}, ${(from + to) / 2 - 8})`}>
                        <rect width="46" height="14" rx="2" fill="oklch(0.14 0.02 280)" stroke={col} strokeWidth={1} />
                        <text x="23" y="10" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="9" fill={col} style={{ letterSpacing: "0.15em" }}>
                          {g.kind === "center" ? "MID" : g.kind === "start" ? "LEFT" : "RIGHT"}
                        </text>
                      </g>
                    </g>
                  );
                }
                return (
                  <g key={i} filter="url(#snap-glow)">
                    <line x1={0} y1={g.pos} x2="100%" y2={g.pos} stroke={col} strokeOpacity={0.25} strokeWidth={1} strokeDasharray="2 4" />
                    <line x1={from} y1={g.pos} x2={to} y2={g.pos} stroke={col} strokeWidth={2} strokeDasharray="6 4">
                      <animate attributeName="stroke-dashoffset" from="0" to="20" dur="0.6s" repeatCount="indefinite" />
                    </line>
                    <line x1={from} y1={g.pos - 8} x2={from} y2={g.pos + 8} stroke={col} strokeWidth={2} />
                    <line x1={to} y1={g.pos - 8} x2={to} y2={g.pos + 8} stroke={col} strokeWidth={2} />
                    <g transform={`translate(${(from + to) / 2 - 20}, ${g.pos + 6})`}>
                      <rect width="40" height="14" rx="2" fill="oklch(0.14 0.02 280)" stroke={col} strokeWidth={1} />
                      <text x="20" y="10" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="9" fill={col} style={{ letterSpacing: "0.15em" }}>
                        {g.kind === "center" ? "MID" : g.kind === "start" ? "TOP" : "BOT"}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>


            {/* Items */}
            {items.map((it) => {
              const spec = SPECS[it.kind];
              const cls = colorClass(spec.color);
              const isSel = selected === it.id;
              const isDragging = dragState.current?.id === it.id;
              const isSnapped = isDragging && guides.length > 0 && showHalo;
              const isFocus = focusPulse === it.id;
              const shadow =
                tilt > 0
                  ? `drop-shadow(0 ${Math.max(2, tilt * 0.35)}px ${Math.max(4, tilt * 0.6)}px rgba(0,0,0,0.55))`
                  : undefined;
              return (
                <div
                  key={it.id}
                  onPointerDown={onItemPointerDown(it.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    left: it.x,
                    top: it.y,
                    width: spec.w,
                    height: spec.h,
                    transform: `rotate(${it.rot}deg)`,
                    touchAction: "none",
                    filter: shadow,
                  }}
                  className={`absolute select-none ${cableMode ? "cursor-default" : "cursor-move"} ${
                    isSel ? "z-20" : "z-10"
                  }`}
                >
                  {isSnapped && (
                    <div
                      className="pointer-events-none absolute -inset-1.5 rounded-md border-2 animate-pulse"
                      style={{
                        borderColor: "oklch(0.75 0.3 340)",
                        boxShadow: "0 0 24px oklch(0.75 0.3 340 / 0.6), inset 0 0 12px oklch(0.75 0.3 340 / 0.4)",
                      }}
                    />
                  )}
                  {isFocus && (
                    <div
                      className="pointer-events-none absolute -inset-3 rounded-lg border-2 animate-ping"
                      style={{
                        borderColor: "var(--acid)",
                        boxShadow: "0 0 40px oklch(0.86 0.24 135 / 0.7)",
                      }}
                    />
                  )}
                  <div
                    className={`relative h-full w-full rounded-md border ${cls.border} ${cls.bg} backdrop-blur-sm transition ${
                      isSel ? "ring-2 " + cls.ring : ""
                    }`}
                  >
                    <Glyph kind={it.kind} selected={isSel} label={it.label} />
                    {isSel && (
                      <div className={`absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm border ${cls.border} bg-background/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${cls.text}`}>
                        {spec.label}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}


            {/* Ports overlay — small markers always visible; interactive in cable mode */}
            <svg
              className="absolute inset-0 h-full w-full"
              style={{ pointerEvents: cableMode ? "auto" : "none", overflow: "visible" }}
            >
              {items.flatMap((it) =>
                SPECS[it.kind].ports.map((p) => {
                  const pos = portPos(it, p);
                  const col = PORT_COLOR[p.type];
                  if (!cableMode) {
                    // small always-visible marker so the user can see IN/OUT on every device
                    return (
                      <g key={`v:${it.id}:${p.id}`}>
                        <circle cx={pos.x} cy={pos.y} r={4} fill="oklch(0.14 0.02 280)" stroke={col} strokeWidth={1.25} />
                        <circle cx={pos.x} cy={pos.y} r={1.8} fill={col} />
                        {p.dir === "in" ? (
                          <circle cx={pos.x} cy={pos.y} r={6} fill="none" stroke={col} strokeWidth={0.7} opacity={0.6} />
                        ) : (
                          <path
                            d={`M ${pos.x - 6} ${pos.y} L ${pos.x + 6} ${pos.y} M ${pos.x + 3} ${pos.y - 3} L ${pos.x + 6} ${pos.y} L ${pos.x + 3} ${pos.y + 3}`}
                            stroke={col}
                            strokeWidth={0.9}
                            fill="none"
                            opacity={0.75}
                          />
                        )}
                      </g>
                    );
                  }
                  const isHover =
                    pending?.hover?.itemId === it.id && pending?.hover?.portId === p.id;
                  const isSource =
                    pending?.itemId === it.id && pending?.portId === p.id;
                  const compat =
                    !pending ||
                    isSource ||
                    (p.type === pending.type && p.dir !== pending.dir && it.id !== pending.itemId);
                  const r = isHover ? PORT_R * 1.7 : isSource ? PORT_R * 1.3 : PORT_R;
                  const op = compat ? 1 : 0.2;
                  const hitR = Math.max(18, (r + 6) / Math.max(0.5, zoom));
                  return (
                    <g
                      key={`${it.id}:${p.id}`}
                      style={{ cursor: compat ? "crosshair" : "not-allowed", touchAction: "none" }}
                      opacity={op}
                      onPointerDown={compat ? onPortPointerDown(it.id, p) : undefined}
                    >
                      {/* invisible large hit area for touch */}
                      <circle cx={pos.x} cy={pos.y} r={hitR} fill="transparent" />
                      {(isHover || isSource) && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={r + 6}
                          fill={col}
                          opacity={0.25}
                        />
                      )}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={r + 2}
                        fill="oklch(0.14 0.02 280)"
                        stroke={col}
                        strokeWidth={isHover || isSource ? 2 : 1.5}
                      />
                      <circle cx={pos.x} cy={pos.y} r={r - 2} fill={col} />
                      {(isHover || isSource) && (
                        <text
                          x={pos.x}
                          y={pos.y - r - 8}
                          textAnchor="middle"
                          fontSize="9"
                          fontFamily="ui-monospace, monospace"
                          fill={col}
                          style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
                        >
                          {PORT_LABEL[p.type]} {p.dir}
                        </text>
                      )}
                    </g>
                  );
                }),
              )}
            </svg>
            </div>
          </div>


          {/* Status bar */}
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="hidden sm:inline">{items.length} kusů · {cables.length} kabelů · grid {GRID}px</span>
            <span className="sm:hidden">{items.length}× · {cables.length} kab.</span>
            <span className="truncate text-right">
              {selectedItem
                ? `${SPECS[selectedItem.kind].label} · ${Math.round(selectedItem.x)},${Math.round(selectedItem.y)} · ${selectedItem.rot}°`
                : cableMode
                ? "Táhni z portu na kompatibilní port (audio/power/dmx)"
                : "Podrž komponentu a přetáhni"}
            </span>
          </div>
        </main>

        {/* Drag ghost */}
        {ghost && (
          <div
            className="pointer-events-none fixed z-50 opacity-80"
            style={{
              left: ghost.x - SPECS[ghost.kind].w / 2,
              top: ghost.y - SPECS[ghost.kind].h / 2,
              width: SPECS[ghost.kind].w,
              height: SPECS[ghost.kind].h,
            }}
          >
            <div className={`h-full w-full rounded-md border ${colorClass(SPECS[ghost.kind].color).border} ${colorClass(SPECS[ghost.kind].color).bg} backdrop-blur-sm`}>
              <Glyph kind={ghost.kind} selected />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ---------- Toolbar btn ---------- */

function ToolbarBtn({
  children,
  onClick,
  icon: Icon,
  active,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: typeof Speaker;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition disabled:opacity-30 ${
        active
          ? "border-[color:var(--acid)] bg-[color:var(--acid)]/15 text-[color:var(--acid)] glow-acid"
          : danger
          ? "border-border text-muted-foreground hover:border-destructive hover:text-destructive"
          : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}


/* ---------- Backstage / Speakers panel ---------- */

function BackstagePanel({
  view,
  items,
  cables,
  onClose,
  onSelect,
  onHighlightCables,
  onFocusCable,
}: {
  view: "backstage" | "speakers";
  items: Placed[];
  cables: CableLink[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onHighlightCables: (ids: string[]) => void;
  onFocusCable: (cableId: string, targetId: string) => void;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = view === "speakers"
    ? items.filter((i) => SPECS[i.kind].category === "sound")
    : items;

  const grouped = useMemo(() => {
    const g: Record<string, Placed[]> = {};
    filtered.forEach((it) => {
      const cat = SPECS[it.kind].category;
      (g[cat] ??= []).push(it);
    });
    return g;
  }, [filtered]);

  const cablesFor = (id: string) => cables.filter((c) => c.from === id || c.to === id);

  const CAT_LABEL: Record<Category, string> = {
    sound: "Zvuk / Reproduktory",
    lights: "Světla",
    infra: "Infra & technika",
  };

  const openDetail = (id: string) => {
    setDetailId(id);
    onHighlightCables(cablesFor(id).map((c) => c.id));
  };
  const closeDetail = () => {
    setDetailId(null);
    onHighlightCables([]);
  };

  const detail = detailId ? items.find((i) => i.id === detailId) : null;
  const detailSpec = detail ? SPECS[detail.kind] : null;
  const detailCables = detail ? cablesFor(detail.id) : [];

  const itemLabel = (id: string) => {
    const it = items.find((i) => i.id === id);
    if (!it) return "?";
    return it.label ?? SPECS[it.kind].label;
  };
  const portLabel = (itemId: string, portId: string) => {
    const it = items.find((i) => i.id === itemId);
    if (!it) return portId;
    const p = SPECS[it.kind].ports.find((pp) => pp.id === portId);
    return p ? `${portId} · ${p.dir.toUpperCase()}` : portId;
  };

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-4xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-[color:var(--acid)] text-glow-acid">
              {view === "speakers" ? "// Pohled — REPRODUKTORY" : "// Pohled — BACKSTAGE"}
            </h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {view === "speakers"
                ? `${filtered.length} reprosoustav na stagi`
                : `${filtered.length} kusů techniky · ${cables.length} kabelů`}
            </p>
          </div>
          <button
            onClick={() => { closeDetail(); onClose(); }}
            className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:border-foreground/50 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Zavřít
          </button>
        </div>

        {/* Detail card */}
        {detail && detailSpec && (
          <div className={`mb-5 rounded-md border ${colorClass(detailSpec.color).border} ${colorClass(detailSpec.color).bg} p-4`}>
            <div className="flex items-start gap-4">
              <div className="h-20 w-28 shrink-0">
                <Glyph kind={detail.kind} selected label={detail.label} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className={`font-mono text-sm font-bold uppercase tracking-wider ${colorClass(detailSpec.color).text}`}>
                      {detail.label ?? detailSpec.label}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {detailSpec.hint} · pos {Math.round(detail.x)},{Math.round(detail.y)} · {detail.rot}°
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { onSelect(detail.id); /* also switches to stage */ }}
                      className="rounded-sm border border-[color:var(--acid)]/60 bg-[color:var(--acid)]/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-[color:var(--acid)] hover:bg-[color:var(--acid)]/20"
                    >
                      Ukaž na stagi
                    </button>
                    <button
                      onClick={closeDetail}
                      className="rounded-sm border border-border px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:border-foreground/50 hover:text-foreground"
                    >
                      Zpět
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    Kabelové spoje · {detailCables.length}
                  </div>
                  {detailCables.length === 0 ? (
                    <div className="rounded-sm border border-dashed border-border/60 p-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                      — bez zapojení —
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {detailCables.map((c) => {
                        const isOut = c.from === detail.id;
                        const otherId = isOut ? c.to : c.from;
                        const myPort = isOut ? c.fromPort : c.toPort;
                        const otherPort = isOut ? c.toPort : c.fromPort;
                        const col = PORT_COLOR[c.type];
                        return (
                          <li
                            key={c.id}
                            onMouseEnter={() => onHighlightCables([c.id])}
                            onMouseLeave={() => onHighlightCables(detailCables.map((cc) => cc.id))}
                            onClick={() => onFocusCable(c.id, otherId)}
                            title="Klikni pro přiblížení a zvýraznění trasy"
                            className="flex cursor-pointer items-center gap-2 rounded-sm border border-border/60 bg-background/50 px-2 py-1.5 font-mono text-[10px] transition hover:border-[color:var(--acid)]/60 hover:bg-background/80"
                          >
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ background: col, boxShadow: `0 0 6px ${col}` }}
                            />
                            <span className="uppercase tracking-widest" style={{ color: col }}>
                              {PORT_LABEL[c.type]}
                            </span>
                            <span className="text-muted-foreground">
                              {portLabel(detail.id, myPort)}
                            </span>
                            <span className="text-[color:var(--acid)]">
                              {isOut ? "→" : "←"}
                            </span>
                            <span className="truncate text-foreground">
                              {itemLabel(otherId)}
                            </span>
                            <span className="text-muted-foreground">
                              · {portLabel(otherId, otherPort)}
                            </span>
                            <span className="ml-auto rounded-sm border border-[color:var(--acid)]/40 px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-[color:var(--acid)]">
                              zoom
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-card/40 p-8 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {view === "speakers" ? "— Zatím žádné reproduktory —" : "— Backstage prázdný —"}
          </div>
        ) : (
          <div className="space-y-6">
            {(Object.keys(grouped) as Category[]).map((cat) => (
              <section key={cat}>
                <div className="mb-2 flex items-center gap-2 border-b border-border/60 pb-1">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--acid)]">
                    {CAT_LABEL[cat]}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">×{grouped[cat].length}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {grouped[cat].map((it) => {
                    const spec = SPECS[it.kind];
                    const cls = colorClass(spec.color);
                    const nCab = cablesFor(it.id).length;
                    const active = detailId === it.id;
                    return (
                      <button
                        key={it.id}
                        onClick={() => (active ? closeDetail() : openDetail(it.id))}
                        className={`group rounded-md border ${cls.border} ${cls.bg} p-3 text-left transition hover:scale-[1.02] ${
                          active ? "ring-2 " + cls.ring : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-20 shrink-0">
                            <Glyph kind={it.kind} selected={active} label={it.label} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`truncate font-mono text-[11px] font-bold uppercase tracking-wider ${cls.text}`}>
                              {it.label ?? spec.label}
                            </div>
                            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                              {spec.hint}
                            </div>
                            <div className="mt-1 flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/80">
                              <span>{Math.round(it.x)},{Math.round(it.y)}</span>
                              <span>·</span>
                              <span>{it.rot}°</span>
                              <span>·</span>
                              <span className="text-[color:var(--amber)]">
                                {nCab} kab.
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
