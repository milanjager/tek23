import { useMemo, useRef, useState, useEffect } from "react";
import { RotateCw, Trash2, X, ChevronUp, ChevronDown, Plus, Info } from "lucide-react";
import {
  DndContext,
  useDraggable,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { createSnapModifier } from "@dnd-kit/modifiers";

interface Placed {
  id: string;
  kind: string;
  pos: [number, number, number];
  rotY: number;
  groupId?: string;
  label?: string;
  variant?: "red" | "blue";
}

export interface ElevSpec {
  label: string;
  category: string;
  size: [number, number, number];
}

interface Props {
  items: Placed[];
  specs: Record<string, ElevSpec>;
  onUpdateItem: (id: string, patch: Partial<Placed>) => void;
  onDeleteItem: (id: string) => void;
  onAddDeviceAt?: (kind: string, x: number, z: number) => void;
}

const CAT_COLOR: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  sound:  { bg: "#f0fdf4", border: "#16a34a", text: "#14532d", accent: "#22c55e" },
  lights: { bg: "#fffbeb", border: "#d97706", text: "#78350f", accent: "#f59e0b" },
  infra:  { bg: "#eef2ff", border: "#4f46e5", text: "#312e81", accent: "#6366f1" },
};

const VIEW_W_M = 22;
const VIEW_H_M = 6;
const CELL_M = 0.5;
const PX_PER_M = 46;

const snap = (v: number) => Math.round(v / CELL_M) * CELL_M;

function overlapsXZ(
  a: { x: number; z: number; w: number; d: number },
  b: { x: number; z: number; w: number; d: number },
) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.01 &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 0.01
  );
}

function footprint(it: Placed, specs: Record<string, ElevSpec>) {
  const s = specs[it.kind]?.size ?? [1, 1, 1];
  const rotated = Math.abs(Math.sin(it.rotY)) > 0.5;
  const w = rotated ? s[2] : s[0];
  const d = rotated ? s[0] : s[2];
  return { x: it.pos[0], z: it.pos[2], w, d, h: s[1] };
}

// ─────────────────────────────────────────────────────────────
// Realistic front-view SVG per device kind.
// Detects category + name pattern and draws a schematic that a
// technician recognises at a glance (drivers, horn, rack ears, …).
// ─────────────────────────────────────────────────────────────
type Family =
  | "sub2" | "sub1" | "bin" | "top" | "linearray" | "monitor"
  | "amprack" | "mixer" | "cdj" | "korg" | "table" | "generator"
  | "mover" | "strobe" | "laser" | "par" | "truss"
  | "box";

function classify(kind: string, category: string): Family {
  const k = kind.toLowerCase();
  if (/truss/.test(k)) return "truss";
  if (/mover|moving|beam|wash|spot|head/.test(k)) return "mover";
  if (/strobe|blinder/.test(k)) return "strobe";
  if (/laser/.test(k)) return "laser";
  if (/par|led.?bar|bar/.test(k) && category === "lights") return "par";
  if (/amp|rack|powersoft|lab.?grup|crown|k20|k10/.test(k)) return "amprack";
  if (/mixer|djm|xone|console/.test(k)) return "mixer";
  if (/cdj|xdj|player|turntable|technics/.test(k)) return "cdj";
  if (/korg|synth|controller|drum|kaoss/.test(k)) return "korg";
  if (/table|booth|desk/.test(k)) return "table";
  if (/gen|power|distro|current/.test(k) && category === "infra") return "generator";
  if (/monitor|wedge|floor/.test(k)) return "monitor";
  if (/line.?array|array|k[12]|kara|kiva/.test(k)) return "linearray";
  if (/jb218|2x18/.test(k)) return "sub2";
  if (/jb181|4x18/.test(k)) return "bin";
  if (/sub|ks28|18["\-]?$|21|dbh/.test(k)) return "sub1";
  if (/top|picus.*top|x15|k2$/.test(k)) return "top";
  return "box";
}

function DeviceGraphic({
  fam, w, h, border, accent, bg, variant,
}: {
  fam: Family; w: number; h: number;
  border: string; accent: string; bg: string;
  variant?: "red" | "blue";
}) {
  // Common paddings
  const pad = Math.max(2, Math.min(w, h) * 0.06);
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  const cx = w / 2;

  const stroke = border;
  const sw = Math.max(0.6, Math.min(w, h) * 0.02);

  // Speaker cone helper
  const cone = (x: number, y: number, r: number, key: string) => (
    <g key={key}>
      <circle cx={x} cy={y} r={r} fill="#1c1917" stroke={stroke} strokeWidth={sw} />
      <circle cx={x} cy={y} r={r * 0.62} fill="none" stroke="#3f3f46" strokeWidth={sw * 0.6} />
      <circle cx={x} cy={y} r={r * 0.28} fill="#0a0a0a" stroke="#525252" strokeWidth={sw * 0.5} />
      <circle cx={x} cy={y} r={r * 0.08} fill="#71717a" />
    </g>
  );

  const horn = (x: number, y: number, hw: number, hh: number, key: string) => (
    <g key={key}>
      <rect x={x - hw / 2} y={y - hh / 2} width={hw} height={hh} rx={hh * 0.15} fill="#0a0a0a" stroke={stroke} strokeWidth={sw} />
      <line x1={x - hw / 2 + hw * 0.1} y1={y} x2={x + hw / 2 - hw * 0.1} y2={y} stroke="#52525b" strokeWidth={sw * 0.6} />
    </g>
  );

  const handle = (x: number, y: number, hw: number, hh: number, key: string) => (
    <rect key={key} x={x - hw / 2} y={y - hh / 2} width={hw} height={hh} rx={hh / 2} fill="none" stroke={stroke} strokeWidth={sw} />
  );

  switch (fam) {
    case "sub2": {
      // JB218 style: two 18" drivers side by side
      const r = Math.min(iw * 0.22, ih * 0.42);
      return (
        <>
          <rect x={pad} y={pad} width={iw} height={ih} rx={pad * 0.4} fill={bg} stroke={stroke} strokeWidth={sw} />
          {/* Yellow X cross-brace signature */}
          <line x1={pad + iw * 0.1} y1={pad + ih * 0.1} x2={pad + iw * 0.9} y2={pad + ih * 0.9} stroke="#eab308" strokeWidth={sw * 2.2} />
          <line x1={pad + iw * 0.9} y1={pad + ih * 0.1} x2={pad + iw * 0.1} y2={pad + ih * 0.9} stroke="#eab308" strokeWidth={sw * 2.2} />
          {cone(pad + iw * 0.28, h / 2, r, "L")}
          {cone(pad + iw * 0.72, h / 2, r, "R")}
          {handle(pad + iw * 0.12, h / 2, iw * 0.06, ih * 0.28, "hL")}
          {handle(w - pad - iw * 0.06, h / 2, iw * 0.06, ih * 0.28, "hR")}
        </>
      );
    }
    case "bin": {
      // JB181 style: 4×18 in 2×2 grid
      const r = Math.min(iw * 0.19, ih * 0.22);
      return (
        <>
          <rect x={pad} y={pad} width={iw} height={ih} rx={pad * 0.4} fill={bg} stroke={stroke} strokeWidth={sw} />
          <line x1={pad + iw * 0.08} y1={pad + ih * 0.08} x2={pad + iw * 0.92} y2={pad + ih * 0.92} stroke="#eab308" strokeWidth={sw * 2} />
          <line x1={pad + iw * 0.92} y1={pad + ih * 0.08} x2={pad + iw * 0.08} y2={pad + ih * 0.92} stroke="#eab308" strokeWidth={sw * 2} />
          {cone(pad + iw * 0.28, pad + ih * 0.3, r, "TL")}
          {cone(pad + iw * 0.72, pad + ih * 0.3, r, "TR")}
          {cone(pad + iw * 0.28, pad + ih * 0.7, r, "BL")}
          {cone(pad + iw * 0.72, pad + ih * 0.7, r, "BR")}
        </>
      );
    }
    case "sub1": {
      // Single 18/21 driver + bass reflex port
      const r = Math.min(iw * 0.35, ih * 0.4);
      return (
        <>
          <rect x={pad} y={pad} width={iw} height={ih} rx={pad * 0.4} fill={bg} stroke={stroke} strokeWidth={sw} />
          {cone(cx, pad + ih * 0.42, r, "drv")}
          {/* Bass reflex slot bottom */}
          <rect x={pad + iw * 0.15} y={h - pad - ih * 0.14} width={iw * 0.7} height={ih * 0.09} rx={ih * 0.03} fill="#0a0a0a" stroke={stroke} strokeWidth={sw * 0.7} />
          {handle(pad + iw * 0.08, pad + ih * 0.15, iw * 0.06, ih * 0.12, "hL")}
          {handle(w - pad - iw * 0.06, pad + ih * 0.15, iw * 0.06, ih * 0.12, "hR")}
        </>
      );
    }
    case "top": {
      // Top box: mid driver + HF horn
      const r = Math.min(iw * 0.28, ih * 0.36);
      return (
        <>
          <rect x={pad} y={pad} width={iw} height={ih} rx={pad * 0.5} fill={bg} stroke={stroke} strokeWidth={sw} />
          {cone(cx, pad + ih * 0.36, r, "mid")}
          {horn(cx, h - pad - ih * 0.25, iw * 0.55, ih * 0.22, "hf")}
        </>
      );
    }
    case "linearray": {
      // Trapezoid element with HF slit
      const topInset = iw * 0.08;
      const bottomInset = iw * 0.02;
      return (
        <>
          <polygon
            points={`
              ${pad + topInset},${pad}
              ${w - pad - topInset},${pad}
              ${w - pad - bottomInset},${h - pad}
              ${pad + bottomInset},${h - pad}
            `}
            fill={bg} stroke={stroke} strokeWidth={sw}
          />
          {/* HF waveguide */}
          <rect x={cx - iw * 0.35} y={pad + ih * 0.15} width={iw * 0.7} height={ih * 0.18} rx={ih * 0.04} fill="#0a0a0a" stroke={stroke} strokeWidth={sw * 0.7} />
          {/* Two LF cones */}
          {cone(cx - iw * 0.22, pad + ih * 0.65, Math.min(iw * 0.16, ih * 0.22), "L")}
          {cone(cx + iw * 0.22, pad + ih * 0.65, Math.min(iw * 0.16, ih * 0.22), "R")}
          {/* rigging bars top */}
          <line x1={pad + topInset + iw * 0.1} y1={pad + ih * 0.04} x2={w - pad - topInset - iw * 0.1} y2={pad + ih * 0.04} stroke={accent} strokeWidth={sw * 1.2} />
        </>
      );
    }
    case "monitor": {
      // Wedge shape (angled top-right)
      return (
        <>
          <polygon
            points={`${pad},${h - pad} ${w - pad},${h - pad} ${w - pad},${pad + ih * 0.5} ${pad},${pad}`}
            fill={bg} stroke={stroke} strokeWidth={sw}
          />
          {cone(cx, pad + ih * 0.55, Math.min(iw * 0.3, ih * 0.35), "mid")}
          {horn(pad + iw * 0.32, h - pad - ih * 0.18, iw * 0.25, ih * 0.12, "hf")}
        </>
      );
    }
    case "amprack": {
      // Rack case with 4-6 rack units
      const units = Math.max(3, Math.round(ih / (h * 0.18)));
      const uh = (ih - pad) / units;
      return (
        <>
          <rect x={pad} y={pad} width={iw} height={ih} rx={pad * 0.3} fill="#1e293b" stroke={stroke} strokeWidth={sw} />
          {/* rack ears */}
          <rect x={pad} y={pad} width={iw * 0.06} height={ih} fill="#334155" />
          <rect x={w - pad - iw * 0.06} y={pad} width={iw * 0.06} height={ih} fill="#334155" />
          {Array.from({ length: units }).map((_, i) => (
            <g key={i}>
              <rect x={pad + iw * 0.08} y={pad + uh * 0.3 + i * uh} width={iw * 0.84} height={uh * 0.7} rx={2} fill="#0f172a" stroke="#475569" strokeWidth={sw * 0.5} />
              <circle cx={pad + iw * 0.14} cy={pad + uh * 0.3 + i * uh + uh * 0.35} r={Math.min(uh * 0.12, 2)} fill={accent} />
              <rect x={pad + iw * 0.6} y={pad + uh * 0.3 + i * uh + uh * 0.2} width={iw * 0.25} height={uh * 0.3} rx={1} fill="#1e293b" stroke="#475569" strokeWidth={sw * 0.4} />
            </g>
          ))}
        </>
      );
    }
    case "mixer": {
      return (
        <>
          <rect x={pad} y={pad} width={iw} height={ih} rx={pad * 0.4} fill="#0f172a" stroke={stroke} strokeWidth={sw} />
          {/* Faders */}
          {Array.from({ length: 6 }).map((_, i) => {
            const fx = pad + iw * (0.12 + i * 0.13);
            return (
              <g key={i}>
                <line x1={fx} y1={pad + ih * 0.35} x2={fx} y2={pad + ih * 0.9} stroke="#475569" strokeWidth={sw * 0.8} />
                <rect x={fx - iw * 0.03} y={pad + ih * (0.5 + i * 0.05)} width={iw * 0.06} height={ih * 0.08} fill={accent} />
              </g>
            );
          })}
          {/* Knobs row */}
          {Array.from({ length: 6 }).map((_, i) => (
            <circle key={i} cx={pad + iw * (0.12 + i * 0.13)} cy={pad + ih * 0.2} r={Math.min(iw * 0.03, ih * 0.08)} fill="#64748b" stroke="#94a3b8" strokeWidth={sw * 0.4} />
          ))}
        </>
      );
    }
    case "cdj": {
      return (
        <>
          <rect x={pad} y={pad} width={iw} height={ih} rx={pad * 0.4} fill="#111827" stroke={stroke} strokeWidth={sw} />
          <circle cx={cx} cy={pad + ih * 0.55} r={Math.min(iw * 0.32, ih * 0.36)} fill="#1f2937" stroke="#4b5563" strokeWidth={sw} />
          <circle cx={cx} cy={pad + ih * 0.55} r={Math.min(iw * 0.06, ih * 0.08)} fill={accent} />
          <rect x={cx - iw * 0.25} y={pad + ih * 0.08} width={iw * 0.5} height={ih * 0.14} rx={2} fill="#0f172a" stroke="#4b5563" strokeWidth={sw * 0.5} />
        </>
      );
    }
    case "korg": {
      const pads = variant === "red" ? "#dc2626" : "#2563eb";
      return (
        <>
          <rect x={pad} y={pad} width={iw} height={ih} rx={pad * 0.4} fill="#0f172a" stroke={stroke} strokeWidth={sw} />
          {/* 4×4 pad grid */}
          {Array.from({ length: 4 }).map((_, r) =>
            Array.from({ length: 4 }).map((_, c) => (
              <rect
                key={`${r}-${c}`}
                x={pad + iw * (0.12 + c * 0.19)}
                y={pad + ih * (0.15 + r * 0.19)}
                width={iw * 0.14}
                height={ih * 0.14}
                rx={2}
                fill={pads}
                opacity={0.85}
              />
            )),
          )}
        </>
      );
    }
    case "table": {
      return (
        <>
          {/* Table top */}
          <rect x={pad} y={pad + ih * 0.15} width={iw} height={ih * 0.15} rx={2} fill="#111827" stroke={stroke} strokeWidth={sw} />
          {/* Legs */}
          <rect x={pad + iw * 0.05} y={pad + ih * 0.3} width={iw * 0.05} height={ih * 0.7} fill="#374151" />
          <rect x={w - pad - iw * 0.1} y={pad + ih * 0.3} width={iw * 0.05} height={ih * 0.7} fill="#374151" />
          {/* Scrim */}
          <rect x={pad + iw * 0.1} y={pad + ih * 0.3} width={iw * 0.8} height={ih * 0.65} fill="#1f2937" opacity={0.6} stroke={stroke} strokeWidth={sw * 0.5} strokeDasharray="2 2" />
          {/* LED strip */}
          <rect x={pad} y={pad + ih * 0.28} width={iw} height={ih * 0.03} fill={accent} />
        </>
      );
    }
    case "generator": {
      return (
        <>
          <rect x={pad} y={pad} width={iw} height={ih} rx={pad * 0.4} fill="#fbbf24" stroke={stroke} strokeWidth={sw} />
          {/* Vent grille */}
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={i} x1={pad + iw * 0.15} y1={pad + ih * (0.2 + i * 0.08)} x2={pad + iw * 0.55} y2={pad + ih * (0.2 + i * 0.08)} stroke="#78350f" strokeWidth={sw * 0.8} />
          ))}
          {/* Control panel */}
          <rect x={pad + iw * 0.62} y={pad + ih * 0.18} width={iw * 0.32} height={ih * 0.5} rx={2} fill="#0f172a" stroke="#78350f" strokeWidth={sw * 0.6} />
          <circle cx={pad + iw * 0.78} cy={pad + ih * 0.35} r={Math.min(iw * 0.05, ih * 0.07)} fill="#ef4444" />
          <text x={pad + iw * 0.5} y={pad + ih * 0.9} textAnchor="middle" fontSize={Math.min(iw * 0.16, ih * 0.22)} fontWeight={900} fill="#78350f">⚡</text>
        </>
      );
    }
    case "mover": {
      return (
        <>
          {/* Base */}
          <rect x={pad + iw * 0.2} y={h - pad - ih * 0.25} width={iw * 0.6} height={ih * 0.25} rx={2} fill="#111827" stroke={stroke} strokeWidth={sw} />
          {/* Yoke */}
          <path d={`M ${pad + iw * 0.28} ${h - pad - ih * 0.25} L ${pad + iw * 0.28} ${pad + ih * 0.35} M ${w - pad - iw * 0.28} ${h - pad - ih * 0.25} L ${w - pad - iw * 0.28} ${pad + ih * 0.35}`} stroke="#374151" strokeWidth={sw * 1.5} fill="none" />
          {/* Head */}
          <ellipse cx={cx} cy={pad + ih * 0.3} rx={iw * 0.28} ry={ih * 0.22} fill="#0f172a" stroke={stroke} strokeWidth={sw} />
          <circle cx={cx} cy={pad + ih * 0.3} r={Math.min(iw * 0.14, ih * 0.14)} fill={accent} opacity={0.9} />
          {/* Beam */}
          <path d={`M ${cx - iw * 0.14} ${pad + ih * 0.3} L ${cx - iw * 0.02} ${pad} L ${cx + iw * 0.02} ${pad} L ${cx + iw * 0.14} ${pad + ih * 0.3} Z`} fill={accent} opacity={0.25} />
        </>
      );
    }
    case "strobe": {
      return (
        <>
          <rect x={pad} y={pad} width={iw} height={ih} rx={2} fill="#0f172a" stroke={stroke} strokeWidth={sw} />
          {Array.from({ length: 4 }).map((_, r) =>
            Array.from({ length: 8 }).map((_, c) => (
              <rect
                key={`${r}-${c}`}
                x={pad + iw * (0.05 + c * 0.115)}
                y={pad + ih * (0.15 + r * 0.2)}
                width={iw * 0.09}
                height={ih * 0.15}
                fill="#fef3c7"
                opacity={0.9}
              />
            )),
          )}
        </>
      );
    }
    case "laser": {
      return (
        <>
          <rect x={pad} y={pad + ih * 0.25} width={iw} height={ih * 0.5} rx={2} fill="#0f172a" stroke={stroke} strokeWidth={sw} />
          <circle cx={cx} cy={pad + ih * 0.5} r={Math.min(iw * 0.1, ih * 0.15)} fill="#22c55e" />
          <line x1={cx} y1={pad + ih * 0.5} x2={cx - iw * 0.3} y2={pad} stroke="#22c55e" strokeWidth={sw * 0.8} opacity={0.7} />
          <line x1={cx} y1={pad + ih * 0.5} x2={cx + iw * 0.3} y2={pad} stroke="#22c55e" strokeWidth={sw * 0.8} opacity={0.7} />
        </>
      );
    }
    case "par": {
      return (
        <>
          <rect x={pad} y={pad + ih * 0.3} width={iw} height={ih * 0.4} rx={2} fill="#0f172a" stroke={stroke} strokeWidth={sw} />
          {Array.from({ length: 8 }).map((_, i) => (
            <circle key={i} cx={pad + iw * (0.08 + i * 0.12)} cy={pad + ih * 0.5} r={Math.min(iw * 0.04, ih * 0.08)} fill={accent} />
          ))}
        </>
      );
    }
    case "truss": {
      return (
        <>
          <rect x={pad} y={pad + ih * 0.15} width={iw} height={ih * 0.7} fill="none" stroke={stroke} strokeWidth={sw} />
          <line x1={pad} y1={pad + ih * 0.15} x2={w - pad} y2={pad + ih * 0.15} stroke={stroke} strokeWidth={sw} />
          <line x1={pad} y1={pad + ih * 0.85} x2={w - pad} y2={pad + ih * 0.85} stroke={stroke} strokeWidth={sw} />
          {/* diagonal lattice */}
          {Array.from({ length: Math.max(4, Math.round(iw / (ih * 0.6))) }).map((_, i, arr) => {
            const step = iw / arr.length;
            return (
              <g key={i}>
                <line x1={pad + i * step} y1={pad + ih * 0.15} x2={pad + (i + 1) * step} y2={pad + ih * 0.85} stroke={stroke} strokeWidth={sw * 0.7} />
                <line x1={pad + (i + 1) * step} y1={pad + ih * 0.15} x2={pad + i * step} y2={pad + ih * 0.85} stroke={stroke} strokeWidth={sw * 0.7} />
              </g>
            );
          })}
        </>
      );
    }
    default:
      return (
        <rect x={pad} y={pad} width={iw} height={ih} rx={pad * 0.4} fill={bg} stroke={stroke} strokeWidth={sw} />
      );
  }
}

// ─────────────────────────────────────────────────────────────
// Draggable device (dnd-kit) — pointer + snap-to-grid modifier
// ─────────────────────────────────────────────────────────────
function DraggableDevice({
  it, spec, wPx, hPx, left, top, isSel, color, stack, zFactor, onSelect,
}: {
  it: Placed;
  spec: ElevSpec;
  wPx: number; hPx: number; left: number; top: number;
  isSel: boolean;
  color: { bg: string; border: string; text: string; accent: string };
  stack?: { level: number; total: number };
  zFactor: number;
  onSelect: () => void;
}) {
  const fam = classify(it.kind, spec.category);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: it.id,
    data: { it },
  });
  const label = it.label ?? spec.label;
  const dims = `${spec.size[0].toFixed(1)}š × ${spec.size[1].toFixed(1)}v × ${spec.size[2].toFixed(1)}h m`;

  return (
    <div
      ref={setNodeRef}
      data-elev-item
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className="absolute cursor-grab select-none touch-none active:cursor-grabbing"
      style={{
        left, top, width: wPx, height: hPx,
        opacity: zFactor * (isDragging ? 0.75 : 1),
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: 10 + Math.round((10 - it.pos[2]) * 2) + (isSel ? 500 : 0) + (isDragging ? 900 : 0),
        filter: isSel ? "drop-shadow(0 6px 12px rgba(132,204,22,0.45))" : undefined,
      }}
      title={`${label}\n${dims}\nX ${it.pos[0].toFixed(1)}  Y ${it.pos[1].toFixed(2)}  Z ${it.pos[2].toFixed(1)}`}
    >
      {/* Realistic front-view graphic */}
      <svg width={wPx} height={hPx} className="block" style={{ overflow: "visible" }}>
        <DeviceGraphic
          fam={fam}
          w={wPx}
          h={hPx}
          border={isSel ? "#65a30d" : color.border}
          accent={color.accent}
          bg={color.bg}
          variant={it.variant}
        />
        {/* Selection outline */}
        {isSel && (
          <rect x={1} y={1} width={wPx - 2} height={hPx - 2} rx={4} fill="none" stroke="#84cc16" strokeWidth={2} strokeDasharray="4 3" />
        )}
      </svg>

      {/* Label chip (always readable, doesn't stretch the graphic) */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded border bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold leading-tight shadow-sm"
        style={{
          bottom: -18,
          borderColor: color.border,
          color: color.text,
          maxWidth: Math.max(wPx + 40, 120),
        }}
      >
        <span className="mr-1">{label}</span>
        <span className="font-mono text-[8px] opacity-60">
          {spec.size[0].toFixed(1)}×{spec.size[1].toFixed(1)}m
        </span>
        {stack && stack.total > 1 && (
          <span className="ml-1 rounded bg-neutral-900 px-1 text-[8px] text-white">
            {stack.level + 1}/{stack.total}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ElevationView({
  items, specs, onUpdateItem, onDeleteItem, onAddDeviceAt,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [addAt, setAddAt] = useState<{ x: number; z: number; clientX: number; clientY: number } | null>(null);
  const [placing, setPlacing] = useState<{ kind: string; x: number; z: number } | null>(null);
  const [depthFilter, setDepthFilter] = useState<"all" | number>("all");
  const [dragPreviewX, setDragPreviewX] = useState<{ id: string; x: number } | null>(null);

  const px = PX_PER_M * zoom;
  const snapPx = CELL_M * px;
  const canvasW = VIEW_W_M * px + 200;
  const canvasH = VIEW_H_M * px + 140;
  const originX = canvasW / 2;
  const groundY = canvasH - 60;

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  const stacksByItem = useMemo(() => {
    const map = new Map<string, { level: number; total: number }>();
    const seen = new Set<string>();
    for (const it of items) {
      if (seen.has(it.id)) continue;
      const fa = footprint(it, specs);
      const group = items.filter((o) => {
        if (o.id === it.id) return true;
        const fb = footprint(o, specs);
        return overlapsXZ(fa, fb);
      }).sort((a, b) => a.pos[1] - b.pos[1]);
      group.forEach((g, i) => {
        seen.add(g.id);
        map.set(g.id, { level: i, total: group.length });
      });
    }
    return map;
  }, [items, specs]);

  const depthOptions = useMemo(() => {
    const set = new Set<number>();
    for (const it of items) set.add(snap(it.pos[2]));
    return Array.from(set).sort((a, b) => b - a);
  }, [items]);

  const kindsByCategory = useMemo(() => {
    const map: Record<string, { kind: string; label: string }[]> = {};
    for (const [k, s] of Object.entries(specs)) {
      (map[s.category] ??= []).push({ kind: k, label: s.label });
    }
    for (const c of Object.keys(map)) map[c].sort((a, b) => a.label.localeCompare(b.label));
    return map;
  }, [specs]);

  const visibleItems = useMemo(() => {
    if (depthFilter === "all") {
      return [...items].sort((a, b) => a.pos[2] - b.pos[2]);
    }
    return items.filter((i) => snap(i.pos[2]) === depthFilter);
  }, [items, depthFilter]);

  // ── dnd-kit setup ─────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const snapModifier = useMemo(() => createSnapModifier(snapPx), [snapPx]);

  const onDragMove = (e: DragMoveEvent) => {
    const it = e.active.data.current?.it as Placed | undefined;
    if (!it) return;
    const dx = e.delta.x / px;
    const nx = snap(it.pos[0] + dx);
    setDragPreviewX({ id: it.id, x: nx });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const it = e.active.data.current?.it as Placed | undefined;
    setDragPreviewX(null);
    if (!it) return;
    const dx = e.delta.x / px;
    const nx = snap(it.pos[0] + dx);
    if (nx === it.pos[0]) return;
    const y = computeStackY(items, specs, it.kind, nx, it.pos[2], it.rotY, it.id);
    onUpdateItem(it.id, { pos: [nx, y, it.pos[2]] });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (placing) setPlacing(null);
        if (addAt) setAddAt(null);
        return;
      }
      if (!selected) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        onDeleteItem(selected.id);
        setSelectedId(null);
      } else if (e.key === "r" || e.key === "R") {
        const nrot = selected.rotY === 0 ? Math.PI / 2 : 0;
        const y = computeStackY(items, specs, selected.kind, selected.pos[0], selected.pos[2], nrot, selected.id);
        onUpdateItem(selected.id, { rotY: nrot, pos: [selected.pos[0], y, selected.pos[2]] });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, items, specs, onUpdateItem, onDeleteItem, placing, addAt]);

  const moveInStack = (dir: -1 | 1) => {
    if (!selected) return;
    const fa = footprint(selected, specs);
    const column = items
      .filter((o) => overlapsXZ(fa, footprint(o, specs)))
      .sort((a, b) => a.pos[1] - b.pos[1]);
    const idx = column.findIndex((c) => c.id === selected.id);
    const swap = idx + dir;
    if (swap < 0 || swap >= column.length) return;
    const newOrder = [...column];
    [newOrder[idx], newOrder[swap]] = [newOrder[swap], newOrder[idx]];
    let y = 0;
    for (const it of newOrder) {
      const h = specs[it.kind]?.size[1] ?? 1;
      onUpdateItem(it.id, { pos: [it.pos[0], y, it.pos[2]] });
      y += h;
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-neutral-100">
      {/* Toolbar */}
      <div className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-2 rounded-md bg-white/95 px-2 py-1 text-[11px] text-neutral-700 shadow">
        <span className="font-semibold text-neutral-900">NÁRYS (pohled zepředu)</span>
        <span className="hidden text-neutral-500 md:inline">· Táhni bednu vlevo/vpravo (snap 0.5 m) · <b>R</b> rotace · <b>Del</b> smazat</span>
        <span className="mx-1 h-3 w-px bg-neutral-300" />
        <label className="flex items-center gap-1 text-[10px] text-neutral-600">
          <span>Řada:</span>
          <select
            value={depthFilter === "all" ? "all" : String(depthFilter)}
            onChange={(e) => setDepthFilter(e.target.value === "all" ? "all" : parseFloat(e.target.value))}
            className="rounded border border-neutral-300 bg-white px-1 py-0.5 text-[10px]"
          >
            <option value="all">Všechny (překryvem)</option>
            {depthOptions.map((z) => (
              <option key={z} value={z}>Z = {z.toFixed(1)} m {z > 0 ? "(vpředu)" : z < 0 ? "(vzadu)" : "(střed)"}</option>
            ))}
          </select>
        </label>
        <span className="mx-1 h-3 w-px bg-neutral-300" />
        <button className="rounded px-1.5 py-0.5 hover:bg-neutral-200" onClick={() => setZoom((z) => Math.max(0.4, z / 1.15))}>−</button>
        <span className="w-9 text-center font-mono">{Math.round(zoom * 100)}%</span>
        <button className="rounded px-1.5 py-0.5 hover:bg-neutral-200" onClick={() => setZoom((z) => Math.min(2.5, z * 1.15))}>+</button>
        <button className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] hover:bg-neutral-300" onClick={() => setZoom(1)}>Reset</button>
      </div>

      {/* Legend */}
      <div className="absolute right-2 top-2 z-10 rounded-md bg-white/95 px-2 py-1.5 text-[10px] text-neutral-600 shadow">
        <div className="mb-0.5 font-semibold text-neutral-800">Kategorie</div>
        {Object.entries(CAT_COLOR).map(([k, c]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ background: c.bg, borderColor: c.border }} />
            <span className="capitalize">{k}</span>
          </div>
        ))}
      </div>

      <DndContext sensors={sensors} modifiers={[snapModifier]} onDragMove={onDragMove} onDragEnd={onDragEnd}>
        <div className="absolute inset-0 overflow-auto pt-12">
          <div
            ref={canvasRef}
            className="relative mx-auto"
            style={{
              width: canvasW,
              height: canvasH,
              background: "linear-gradient(to bottom,#f5f5f4 0%,#f5f5f4 82%,#e7e5e4 100%)",
              cursor: placing ? "crosshair" : undefined,
            }}
            onMouseMove={(e) => {
              if (!placing) return;
              const rect = canvasRef.current!.getBoundingClientRect();
              const nx = snap((e.clientX - rect.left - originX) / px);
              if (nx !== placing.x) setPlacing({ ...placing, x: nx });
            }}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("[data-elev-item]")) return;
              if ((e.target as HTMLElement).closest("[data-add-popover]")) return;
              if (placing && onAddDeviceAt) {
                onAddDeviceAt(placing.kind, placing.x, placing.z);
                setPlacing(null);
                return;
              }
              setSelectedId(null);
              if (!onAddDeviceAt) return;
              const rect = canvasRef.current!.getBoundingClientRect();
              const x = snap((e.clientX - rect.left - originX) / px);
              const z = depthFilter === "all" ? 0 : (depthFilter as number);
              setAddAt({ x, z, clientX: e.clientX - rect.left, clientY: e.clientY - rect.top });
            }}
          >
            {/* Grid + rulers */}
            <svg className="pointer-events-none absolute inset-0" width={canvasW} height={canvasH}>
              <defs>
                <pattern id="elev-minor" width={CELL_M * px} height={CELL_M * px} patternUnits="userSpaceOnUse">
                  <path d={`M ${CELL_M * px} 0 L 0 0 0 ${CELL_M * px}`} fill="none" stroke="#e7e5e4" strokeWidth={1} />
                </pattern>
                <pattern id="elev-major" width={px} height={px} patternUnits="userSpaceOnUse">
                  <path d={`M ${px} 0 L 0 0 0 ${px}`} fill="none" stroke="#d6d3d1" strokeWidth={1} />
                </pattern>
              </defs>
              <rect y={0} width={canvasW} height={groundY} fill="url(#elev-minor)" />
              <rect y={0} width={canvasW} height={groundY} fill="url(#elev-major)" />

              {Array.from({ length: Math.floor(VIEW_H_M) + 1 }).map((_, i) => {
                const y = groundY - i * px;
                return (
                  <g key={i}>
                    <line x1={0} y1={y} x2={canvasW} y2={y} stroke={i === 0 ? "#0a0a0a" : "#d6d3d1"} strokeWidth={i === 0 ? 2 : 1} />
                    <text x={6} y={y - 3} fontSize={10} fill="#57534e" fontFamily="ui-monospace,monospace">{i} m</text>
                  </g>
                );
              })}

              <line x1={originX} y1={0} x2={originX} y2={groundY} stroke="#a8a29e" strokeDasharray="2 4" />
              <text x={originX + 4} y={12} fontSize={10} fill="#57534e">X = 0</text>

              <text x={canvasW / 2} y={groundY + 30} textAnchor="middle" fontSize={13} fontWeight={700} fill="#0a0a0a">
                ▬▬▬ ZEM (podlaha stage) ▬▬▬
              </text>
              <text x={canvasW / 2} y={groundY + 46} textAnchor="middle" fontSize={10} fill="#57534e">
                Pohled zepředu (od publika)  ·  osa X vodorovně, osa Y výška
              </text>

              {/* Drag preview vertical guide (with collision detection) */}
              {dragPreviewX && (() => {
                const dragged = items.find((i) => i.id === dragPreviewX.id);
                if (!dragged) return null;
                const f = footprint(dragged, specs);
                const testFp = { x: dragPreviewX.x, z: f.z, w: f.w, d: f.d };
                let overlap = false, near = false;
                for (const o of items) {
                  if (o.id === dragged.id) continue;
                  const of = footprint(o, specs);
                  if (overlapsXZ(testFp, of)) { overlap = true; break; }
                  if (Math.abs(of.x - testFp.x) < (of.w + testFp.w) / 2 + 0.4 &&
                      Math.abs(of.z - testFp.z) < (of.d + testFp.d) / 2 + 0.4) near = true;
                }
                const color = overlap ? "#dc2626" : near ? "#f59e0b" : "#84cc16";
                const textColor = overlap ? "#450a0a" : near ? "#78350f" : "#1a2e05";
                const msg = overlap ? "překryv → stack" : near ? "těsně vedle" : `X ${dragPreviewX.x.toFixed(1)}`;
                const boxW = overlap || near ? 96 : 48;
                return (
                  <>
                    <line
                      x1={originX + dragPreviewX.x * px}
                      y1={0}
                      x2={originX + dragPreviewX.x * px}
                      y2={groundY}
                      stroke={color}
                      strokeWidth={overlap ? 2 : 1}
                      strokeDasharray="3 3"
                    />
                    <rect x={originX + dragPreviewX.x * px - boxW / 2} y={groundY + 4} width={boxW} height={16} rx={3} fill={color} />
                    <text x={originX + dragPreviewX.x * px} y={groundY + 16} textAnchor="middle" fontSize={10} fontWeight={700} fill={textColor}>
                      {msg}
                    </text>
                  </>
                );
              })()}
            </svg>

            {/* Items */}
            {visibleItems.map((it) => {
              const spec = specs[it.kind];
              if (!spec) return null;
              const f = footprint(it, specs);
              const color = CAT_COLOR[spec.category] ?? CAT_COLOR.infra;
              const wPx = f.w * px;
              const hPx = f.h * px;
              const left = originX + f.x * px - wPx / 2;
              const top = groundY - (it.pos[1] + f.h) * px;
              const isSel = selectedId === it.id;
              const zFactor = depthFilter === "all"
                ? Math.max(0.4, 1 - Math.max(0, -it.pos[2]) * 0.12)
                : 1;
              const stack = stacksByItem.get(it.id);
              return (
                <DraggableDevice
                  key={it.id}
                  it={it}
                  spec={spec}
                  wPx={wPx}
                  hPx={hPx}
                  left={left}
                  top={top}
                  isSel={isSel}
                  color={color}
                  stack={stack}
                  zFactor={zFactor}
                  onSelect={() => setSelectedId(it.id)}
                />
              );
            })}

            {/* Ghost preview for placement */}
            {placing && specs[placing.kind] && (() => {
              const s = specs[placing.kind].size;
              const wPx = s[0] * px;
              const hPx = s[1] * px;
              const y = computeStackY(items, specs, placing.kind, placing.x, placing.z, 0);
              const left = originX + placing.x * px - wPx / 2;
              const top = groundY - (y + s[1]) * px;
              const color = CAT_COLOR[specs[placing.kind].category] ?? CAT_COLOR.infra;
              const fam = classify(placing.kind, specs[placing.kind].category);
              return (
                <div
                  className="pointer-events-none absolute rounded"
                  style={{
                    left, top, width: wPx, height: hPx,
                    opacity: 0.7,
                    zIndex: 9999,
                    filter: "drop-shadow(0 0 6px rgba(132,204,22,0.7))",
                  }}
                >
                  <svg width={wPx} height={hPx} style={{ overflow: "visible" }}>
                    <DeviceGraphic fam={fam} w={wPx} h={hPx} border={color.border} accent={color.accent} bg={color.bg} />
                    <rect x={1} y={1} width={wPx - 2} height={hPx - 2} rx={4} fill="none" stroke="#84cc16" strokeWidth={2} strokeDasharray="4 3" />
                  </svg>
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-900/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {specs[placing.kind].label} · X {placing.x.toFixed(1)} · Y {y.toFixed(1)}
                  </div>
                </div>
              );
            })()}

            {/* Placement hint bar */}
            {placing && (
              <div className="pointer-events-none sticky bottom-2 left-1/2 z-[10000] mx-auto w-fit -translate-x-1/2 rounded-full bg-neutral-900/90 px-3 py-1 text-[11px] text-white shadow-lg">
                Táhni myší po mřížce · <b>klik</b> potvrdí umístění · <b>Esc</b> zruší
              </div>
            )}

            {/* Empty state */}
            {items.length === 0 && !placing && (
              <div className="absolute inset-x-0 top-1/3 text-center text-sm text-neutral-500">
                Zatím nic k zobrazení. Klikni do plochy pro přidání nebo použij <b>Plán 2D</b>.
              </div>
            )}

            {/* Add popover */}
            {addAt && onAddDeviceAt && !placing && (
              <ElevAddPopover
                x={addAt.clientX}
                y={addAt.clientY}
                worldX={addAt.x}
                worldZ={addAt.z}
                kindsByCategory={kindsByCategory}
                specs={specs}
                onPick={(kind) => { setPlacing({ kind, x: addAt.x, z: addAt.z }); setAddAt(null); }}
                onClose={() => setAddAt(null)}
                onChangeZ={(z) => setAddAt((a) => a ? { ...a, z } : a)}
                depthOptions={depthOptions}
              />
            )}
          </div>
        </div>
      </DndContext>

      {selected && (
        <div className="absolute bottom-2 left-2 right-2 z-20 rounded-lg border border-neutral-300 bg-white p-3 shadow-2xl md:left-auto md:right-2 md:w-80">
          <div className="mb-2 flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
                <Info size={10} /> {specs[selected.kind]?.category}
              </div>
              <div className="truncate text-sm font-bold text-neutral-900">
                {selected.label ?? specs[selected.kind]?.label ?? selected.kind}
              </div>
              <div className="font-mono text-[10px] text-neutral-500">
                {specs[selected.kind]?.size[0].toFixed(2)} š × {specs[selected.kind]?.size[1].toFixed(2)} v × {specs[selected.kind]?.size[2].toFixed(2)} h m
              </div>
            </div>
            <button onClick={() => setSelectedId(null)} className="rounded p-1 text-neutral-500 hover:bg-neutral-100"><X size={14} /></button>
          </div>

          <div className="mb-2 rounded bg-neutral-50 p-2 font-mono text-[10px] text-neutral-700">
            X: {selected.pos[0].toFixed(2)} m &nbsp; Y (výška): {selected.pos[1].toFixed(2)} m &nbsp; Z: {selected.pos[2].toFixed(2)} m
          </div>

          <div className="mb-2 flex items-center gap-2 rounded bg-neutral-50 p-2 text-[11px]">
            <span className="font-semibold text-neutral-800">Patro:</span>
            <span className="font-mono">{(stacksByItem.get(selected.id)?.level ?? 0) + 1} / {stacksByItem.get(selected.id)?.total ?? 1}</span>
            <div className="ml-auto flex overflow-hidden rounded border border-neutral-300">
              <button onClick={() => moveInStack(1)} title="Výš" className="px-2 py-0.5 hover:bg-neutral-100"><ChevronUp size={12} /></button>
              <button onClick={() => moveInStack(-1)} title="Níž" className="border-l border-neutral-300 px-2 py-0.5 hover:bg-neutral-100"><ChevronDown size={12} /></button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => {
                const nrot = selected.rotY === 0 ? Math.PI / 2 : 0;
                const y = computeStackY(items, specs, selected.kind, selected.pos[0], selected.pos[2], nrot, selected.id);
                onUpdateItem(selected.id, { rotY: nrot, pos: [selected.pos[0], y, selected.pos[2]] });
              }}
              className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 text-xs hover:bg-neutral-200"
            >
              <RotateCw size={12} /> Otoč 90°
            </button>
            <button
              onClick={() => { onDeleteItem(selected.id); setSelectedId(null); }}
              className="ml-auto flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
            >
              <Trash2 size={12} /> Smazat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function computeStackY(
  items: Placed[],
  specs: Record<string, ElevSpec>,
  kind: string,
  x: number,
  z: number,
  rotY: number,
  excludeId?: string,
): number {
  const s = specs[kind]?.size ?? [1, 1, 1];
  const rotated = Math.abs(Math.sin(rotY)) > 0.5;
  const w = rotated ? s[2] : s[0];
  const d = rotated ? s[0] : s[2];
  const fa = { x, z, w, d };
  let top = 0;
  for (const o of items) {
    if (o.id === excludeId) continue;
    const os = specs[o.kind]?.size ?? [1, 1, 1];
    const orot = Math.abs(Math.sin(o.rotY)) > 0.5;
    const ow = orot ? os[2] : os[0];
    const od = orot ? os[0] : os[2];
    if (overlapsXZ(fa, { x: o.pos[0], z: o.pos[2], w: ow, d: od })) {
      top = Math.max(top, o.pos[1] + os[1]);
    }
  }
  return top;
}

function ElevAddPopover({
  x, y, worldX, worldZ, kindsByCategory, specs, onPick, onClose, onChangeZ, depthOptions,
}: {
  x: number; y: number;
  worldX: number; worldZ: number;
  kindsByCategory: Record<string, { kind: string; label: string }[]>;
  specs: Record<string, ElevSpec>;
  onPick: (kind: string) => void;
  onClose: () => void;
  onChangeZ: (z: number) => void;
  depthOptions: number[];
}) {
  const cats = Object.keys(kindsByCategory);
  const [cat, setCat] = useState<string>(cats[0] ?? "sound");
  return (
    <div
      data-add-popover
      className="absolute z-50 w-64 rounded-md border border-neutral-300 bg-white shadow-xl"
      style={{ left: Math.min(x + 8, 9999), top: y + 8 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-2 py-1">
        <div className="text-[11px] font-semibold text-neutral-800">Přidat bednu · X {worldX.toFixed(1)} m</div>
        <button onClick={onClose} className="rounded p-0.5 text-neutral-500 hover:bg-neutral-100"><X size={12} /></button>
      </div>
      <div className="flex items-center gap-1 border-b border-neutral-200 px-2 py-1 text-[10px] text-neutral-600">
        <span>Řada Z:</span>
        <select
          value={String(worldZ)}
          onChange={(e) => onChangeZ(parseFloat(e.target.value))}
          className="flex-1 rounded border border-neutral-300 px-1 py-0.5"
        >
          {[...new Set([0, worldZ, ...depthOptions])].sort((a, b) => b - a).map((z) => (
            <option key={z} value={z}>{z.toFixed(1)} m {z > 0 ? "(vpředu)" : z < 0 ? "(vzadu)" : "(střed)"}</option>
          ))}
        </select>
      </div>
      <div className="flex border-b border-neutral-200 text-[10px]">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`flex-1 px-2 py-1 capitalize ${cat === c ? "bg-neutral-900 font-semibold text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        {(kindsByCategory[cat] ?? []).map((k) => {
          const s = specs[k.kind]?.size;
          return (
            <button
              key={k.kind}
              onClick={() => onPick(k.kind)}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] text-neutral-800 hover:bg-lime-100"
            >
              <Plus size={11} className="text-lime-600" />
              <span className="flex-1 truncate">{k.label}</span>
              {s && <span className="shrink-0 font-mono text-[9px] text-neutral-500">{s[0].toFixed(1)}×{s[1].toFixed(1)}×{s[2].toFixed(1)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
