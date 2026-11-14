/* Čisté SVG výkresy rigu (nárys, půdorys, schéma) — sdílené krokem Spec,
   PDF techriderem a read-only odkazem. Bez závislosti na 3D scéně. */
import { forwardRef } from "react";

export interface DrawItem {
  id: string; kind: string; name: string; category: string;
  x: number; y: number; z: number; w: number; h: number; d: number;
  weightKg: number; peakW: number;
}
export interface DrawCable { from: string; to: string; type: "signal" | "speaker" | "power" | "dmx" }

export const CABLE_COLORS: Record<DrawCable["type"], string> = {
  signal: "#65a30d", speaker: "#0891b2", power: "#dc2626", dmx: "#d97706",
};
export const CABLE_SHORT: Record<DrawCable["type"], string> = { signal: "SIG", speaker: "SPK", power: "PWR", dmx: "DMX" };
const CAT_FILL: Record<string, string> = { sound: "#e5e7eb", lights: "#fef3c7", infra: "#dbeafe", fun: "#fce7f3" };

function bounds(items: DrawItem[], axis: "front" | "plan") {
  let minX = Infinity, maxX = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const it of items) {
    minX = Math.min(minX, it.x - it.w / 2); maxX = Math.max(maxX, it.x + it.w / 2);
    if (axis === "front") { minV = Math.min(minV, it.y); maxV = Math.max(maxV, it.y + it.h); }
    else { minV = Math.min(minV, it.z - it.d / 2); maxV = Math.max(maxV, it.z + it.d / 2); }
  }
  if (!items.length) return { minX: -4, maxX: 4, minV: 0, maxV: 3 };
  return { minX: minX - 0.5, maxX: maxX + 0.5, minV: axis === "front" ? 0 : minV - 0.5, maxV: maxV + 0.5 };
}

type SvgProps = { items: DrawItem[]; className?: string; labels?: boolean };

/** Nárys: pohled zepředu, osa X × výška. */
export const FrontDrawing = forwardRef<SVGSVGElement, SvgProps>(function FrontDrawing({ items, className, labels = true }, ref) {
  const b = bounds(items, "front");
  const W = b.maxX - b.minX, H = b.maxV - b.minV;
  const sorted = [...items].sort((a, c) => c.z - a.z); // zadní napřed
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`${b.minX} ${-b.maxV} ${W} ${H + 0.3}`} className={className} preserveAspectRatio="xMidYMid meet">
      <rect x={b.minX} y={-b.maxV} width={W} height={H + 0.3} fill="#ffffff" />
      <line x1={b.minX} x2={b.maxX} y1={0} y2={0} stroke="#111" strokeWidth={0.03} />
      {sorted.map((it) => (
        <g key={it.id}>
          <rect x={it.x - it.w / 2} y={-(it.y + it.h)} width={it.w} height={it.h} fill={CAT_FILL[it.category] ?? "#eee"} stroke="#111" strokeWidth={0.015} />
          {labels && it.w > 0.35 && it.h > 0.25 && (
            <text x={it.x} y={-(it.y + it.h / 2)} fontSize={Math.min(0.14, it.w / 6)} textAnchor="middle" dominantBaseline="middle" fill="#111" fontFamily="sans-serif">{it.name.slice(0, 14)}</text>
          )}
        </g>
      ))}
      <text x={b.minX + 0.1} y={0.22} fontSize={0.16} fill="#555" fontFamily="sans-serif">šířka {W.toFixed(1)} m · výška {(b.maxV - 0.5).toFixed(1)} m</text>
    </svg>
  );
});

/** Půdorys: pohled shora, X × Z (dole = publikum). */
/** Popisky půdorysu: písmo se vejde do šířky bedny, překrývající se popisky se vynechají. */
function planLabels(items: DrawItem[]) {
  const out: { id: string; x: number; z: number; fs: number; text: string; w: number }[] = [];
  for (const it of [...items].sort((a, b) => b.w - a.w)) {
    if (it.w < 0.3) continue;
    const text = it.name.slice(0, 12);
    const fs = Math.min(0.13, (it.w * 0.9) / (text.length * 0.55), it.d * 0.6);
    if (fs < 0.05) continue;
    const w = text.length * fs * 0.55;
    if (out.some((o) => Math.abs(o.x - it.x) < (o.w + w) / 2 && Math.abs(o.z - it.z) < (o.fs + fs) / 2 + 0.02)) continue;
    out.push({ id: it.id, x: it.x, z: it.z, fs, text, w });
  }
  return out;
}

export const PlanDrawing = forwardRef<SVGSVGElement, SvgProps & { cables?: DrawCable[] }>(function PlanDrawing({ items, className, labels = true, cables = [] }, ref) {
  const b = bounds(items, "plan");
  const W = b.maxX - b.minX, H = b.maxV - b.minV;
  const byId = new Map(items.map((i) => [i.id, i]));
  // Jen nejvyšší kus každé věže dostane popisek.
  const top = new Map<string, DrawItem>();
  for (const it of items) { const k = `${it.x.toFixed(2)}:${it.z.toFixed(2)}`; const o = top.get(k); if (!o || o.y < it.y) top.set(k, it); }
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`${b.minX} ${b.minV} ${W} ${H + 0.4}`} className={className} preserveAspectRatio="xMidYMid meet">
      <rect x={b.minX} y={b.minV} width={W} height={H + 0.4} fill="#ffffff" />
      {Array.from({ length: Math.ceil(W) + 1 }, (_, i) => <line key={`gx${i}`} x1={Math.floor(b.minX) + i} x2={Math.floor(b.minX) + i} y1={b.minV} y2={b.maxV} stroke="#eee" strokeWidth={0.01} />)}
      {Array.from({ length: Math.ceil(H) + 1 }, (_, i) => <line key={`gz${i}`} y1={Math.floor(b.minV) + i} y2={Math.floor(b.minV) + i} x1={b.minX} x2={b.maxX} stroke="#eee" strokeWidth={0.01} />)}
      {cables.map((c, i) => {
        const a = byId.get(c.from), z = byId.get(c.to);
        if (!a || !z) return null;
        return <polyline key={i} points={`${a.x},${a.z} ${a.x},${(a.z + z.z) / 2} ${z.x},${(a.z + z.z) / 2} ${z.x},${z.z}`} fill="none" stroke={CABLE_COLORS[c.type]} strokeWidth={0.025} opacity={0.7} />;
      })}
      {items.map((it) => (
        <rect key={it.id} x={it.x - it.w / 2} y={it.z - it.d / 2} width={it.w} height={it.d} fill={CAT_FILL[it.category] ?? "#eee"} fillOpacity={0.85} stroke="#111" strokeWidth={0.015} />
      ))}
      {labels && planLabels([...top.values()]).map((l) => (
        <text key={`t${l.id}`} x={l.x} y={l.z} fontSize={l.fs} textAnchor="middle" dominantBaseline="middle" fill="#111" fontFamily="sans-serif">{l.text}</text>
      ))}
      <text x={(b.minX + b.maxX) / 2} y={b.maxV + 0.25} fontSize={0.18} textAnchor="middle" fill="#111" fontWeight={700} fontFamily="sans-serif">▼ PUBLIKUM ▼</text>
    </svg>
  );
});

const COLS: { id: string; label: string; test: (i: DrawItem) => boolean }[] = [
  { id: "pwr", label: "Napájení", test: (i) => /generator|distro/.test(i.kind) },
  { id: "src", label: "Zdroje", test: (i) => /dj|cdj|turntable|korg/.test(i.kind) && i.kind !== "dj_table" },
  { id: "mix", label: "Mix", test: (i) => i.kind === "mixer" },
  { id: "amp", label: "Zesilovače", test: (i) => i.kind === "amp" || i.kind === "powersoft" },
  { id: "spk", label: "Bedny", test: (i) => i.category === "sound" },
  { id: "lt", label: "Světla", test: (i) => i.category === "lights" || i.category === "fun" },
];

/** Schéma zapojení: sloupce podle role, kabely jako pravoúhlé linky. */
export const SchemaDrawing = forwardRef<SVGSVGElement, SvgProps & { cables: DrawCable[] }>(function SchemaDrawing({ items, cables, className }, ref) {
  const colW = 150, rowH = 26, top = 30;
  const pos = new Map<string, { x: number; y: number }>();
  const placed = new Set<string>();
  const cols = COLS.map((c) => {
    const list = items.filter((i) => !placed.has(i.id) && c.test(i));
    list.forEach((i) => placed.add(i.id));
    return { ...c, list };
  }).filter((c) => c.list.length);
  let maxRows = 1;
  cols.forEach((c, ci) => {
    maxRows = Math.max(maxRows, c.list.length);
    c.list.forEach((it, ri) => pos.set(it.id, { x: 10 + ci * colW, y: top + ri * rowH }));
  });
  const W = Math.max(300, cols.length * colW + 10), H = top + maxRows * rowH + 10;
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="xMidYMin meet">
      <rect width={W} height={H} fill="#ffffff" />
      {cols.map((c, ci) => <text key={c.id} x={10 + ci * colW} y={16} fontSize={11} fontWeight={700} fill="#111" fontFamily="sans-serif">{c.label}</text>)}
      {cables.map((c, i) => {
        const a = pos.get(c.from), z = pos.get(c.to);
        if (!a || !z) return null;
        const ax = a.x + 112, ay = a.y + 9, zx = z.x, zy = z.y + 9;
        const mx = ax <= zx ? (ax + zx) / 2 : ax + 8;
        return <polyline key={i} points={`${ax},${ay} ${mx},${ay} ${mx},${zy} ${zx},${zy}`} fill="none" stroke={CABLE_COLORS[c.type]} strokeWidth={1.2} opacity={0.85} />;
      })}
      {[...pos.entries()].map(([id, p]) => {
        const it = items.find((i) => i.id === id)!;
        return (
          <g key={id}>
            <rect x={p.x} y={p.y} width={112} height={18} rx={3} fill={CAT_FILL[it.category] ?? "#eee"} stroke="#111" strokeWidth={0.6} />
            <text x={p.x + 4} y={p.y + 12} fontSize={8.5} fill="#111" fontFamily="sans-serif">{it.name.slice(0, 22)}</text>
          </g>
        );
      })}
    </svg>
  );
});

export interface BomLine { name: string; count: number; kg: number; w: number }
export function bomLines(items: DrawItem[]): BomLine[] {
  const m = new Map<string, BomLine>();
  for (const it of items) {
    const key = it.kind + "|" + it.name;
    const l = m.get(key) ?? { name: it.name, count: 0, kg: 0, w: 0 };
    l.count++; l.kg += it.weightKg; l.w += it.peakW;
    m.set(key, l);
  }
  return [...m.values()].sort((a, b) => b.kg - a.kg);
}

/** SVG prvek → PNG blob (bílé pozadí). */
export async function svgToPng(svg: SVGSVGElement, width = 2000): Promise<Blob> {
  const vb = svg.viewBox.baseVal;
  const height = Math.round(width * (vb.height / vb.width));
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = width; c.height = height;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const csvCell = (v: string | number) => { const s = String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCsv = (rows: (string | number)[][]) => "\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\n");
