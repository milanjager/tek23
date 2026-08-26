import { useMemo, useRef, useState, useEffect } from "react";

/* ============================================================================
   TechnicalView — top-down engineering-style blueprint of the entire stage
   setup. Renders items as scaled polygons (footprint + rotation), stacks as
   an overlaid "+N" badge, and cables as orthogonal (Manhattan) routes color
   coded per signal type. Ideal for print-out / documentation.
   ============================================================================ */

import type { StageItem as Placed, StageCable as Cable } from "@/types/stage";

export interface TechSpec {
  label: string;
  category: string;
  size: [number, number, number];
}

interface Props {
  items: Placed[];
  cables: Cable[];
  specs: Record<string, TechSpec>;
  selectedIds?: string[];
  onSelectItem?: (id: string | null, additive?: boolean) => void;
}

/** Muted architectural palette — kept close to a real technical drawing. */
const CAT_STYLE: Record<string, { fill: string; stroke: string; text: string; tag: string }> = {
  sound:  { fill: "#e0f2fe", stroke: "#0369a1", text: "#0c4a6e", tag: "PA" },
  lights: { fill: "#fef3c7", stroke: "#b45309", text: "#78350f", tag: "LX" },
  infra:  { fill: "#e5e7eb", stroke: "#334155", text: "#1e293b", tag: "IN" },
};

const CABLE_STYLE: Record<Cable["type"], { color: string; short: string; label: string; dash?: string }> = {
  power:   { color: "#dc2626", short: "PWR", label: "230 V" },
  signal:  { color: "#059669", short: "SIG", label: "Line/AES", dash: "6 3" },
  speaker: { color: "#1d4ed8", short: "SPK", label: "Speakon" },
  dmx:     { color: "#7c3aed", short: "DMX", label: "DMX 512",  dash: "2 3" },
};

export default function TechnicalView({ items, cables, specs, selectedIds, onSelectItem }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [showCables, setShowCables] = useState(true);
  const [showDims, setShowDims] = useState(true);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Auto-fit: 1 m = <scale> px, based on world bounds vs viewport.
  const bounds = useMemo(() => {
    if (!items.length) return { minX: -6, maxX: 6, minZ: -4, maxZ: 4 };
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const it of items) {
      const s = specs[it.kind]?.size ?? [1, 1, 1];
      const r = Math.max(s[0], s[2]) / 2 + 0.4;
      minX = Math.min(minX, it.pos[0] - r);
      maxX = Math.max(maxX, it.pos[0] + r);
      minZ = Math.min(minZ, it.pos[2] - r);
      maxZ = Math.max(maxZ, it.pos[2] + r);
    }
    return { minX, maxX, minZ, maxZ };
  }, [items, specs]);

  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxZ - bounds.minZ;
  const fit = Math.max(30, Math.min(size.w / Math.max(0.1, worldW + 2), size.h / Math.max(0.1, worldH + 2)));
  const scale = fit * zoom;

  const wx = (x: number) => (x - (bounds.minX + bounds.maxX) / 2) * scale + size.w / 2 + pan.x;
  const wy = (z: number) => (z - (bounds.minZ + bounds.maxZ) / 2) * scale + size.h / 2 + pan.y;

  // Group items by same (x,z) footprint to display stack markers.
  const stackMap = useMemo(() => {
    const m = new Map<string, Placed[]>();
    for (const it of items) {
      const k = `${it.pos[0].toFixed(2)}_${it.pos[2].toFixed(2)}`;
      const arr = m.get(k) ?? [];
      arr.push(it);
      m.set(k, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.pos[1] - b.pos[1]);
    return m;
  }, [items]);

  // Draw only the topmost item of each stack (footprint is identical),
  // then annotate with "×N" for count > 1.
  const drawSet = useMemo(() => {
    const out: { item: Placed; count: number; totalH: number }[] = [];
    const seen = new Set<string>();
    for (const it of items) {
      const k = `${it.pos[0].toFixed(2)}_${it.pos[2].toFixed(2)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const stack = stackMap.get(k) ?? [it];
      const totalH = stack.reduce((sum, s) => sum + (specs[s.kind]?.size[1] ?? 0), 0);
      out.push({ item: stack[stack.length - 1], count: stack.length, totalH });
    }
    return out;
  }, [items, stackMap, specs]);

  // Cable endpoint = center of the item's footprint.
  const routes = useMemo(() => {
    if (!showCables) return [];
    return cables.map((c) => {
      const a = items.find((i) => i.id === c.from);
      const b = items.find((i) => i.id === c.to);
      if (!a || !b) return null;
      return { c, a, b };
    }).filter(Boolean) as { c: Cable; a: Placed; b: Placed }[];
  }, [cables, items, showCables]);

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-tech-item]")) return;
    dragRef.current = { x: e.clientX, y: e.clientY, sx: pan.x, sy: pan.y };
    onSelectItem?.(null);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.sx + (e.clientX - dragRef.current.x),
      y: dragRef.current.sy + (e.clientY - dragRef.current.y),
    });
  };
  const stopDrag = () => { dragRef.current = null; };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const dz = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setZoom((z) => Math.max(0.3, Math.min(4, z * dz)));
  };

  // Category tally for the title block.
  const tally = useMemo(() => {
    const t: Record<string, number> = { sound: 0, lights: 0, infra: 0 };
    for (const it of items) {
      const c = specs[it.kind]?.category ?? "infra";
      t[c] = (t[c] ?? 0) + 1;
    }
    return t;
  }, [items, specs]);

  const cableTally = useMemo(() => {
    const t: Record<Cable["type"], number> = { power: 0, signal: 0, speaker: 0, dmx: 0 };
    for (const c of cables) t[c.type] = (t[c.type] ?? 0) + 1;
    return t;
  }, [cables]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-white" ref={wrapRef}>
      {/* Toolbar */}
      <div className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-2 rounded-md bg-white/95 px-2 py-1 text-[11px] text-neutral-700 shadow ring-1 ring-neutral-200">
        <span className="font-mono font-bold text-neutral-900">TECHNICKÝ VÝKRES</span>
        <span className="hidden text-neutral-500 md:inline">· pohled shora · SI jednotky · měřítko 1 m</span>
        <span className="mx-1 h-3 w-px bg-neutral-300" />
        <button onClick={() => setZoom((z) => Math.max(0.3, z / 1.2))} className="rounded px-1.5 py-0.5 hover:bg-neutral-200">−</button>
        <span className="w-9 text-center font-mono">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(4, z * 1.2))} className="rounded px-1.5 py-0.5 hover:bg-neutral-200">+</button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] hover:bg-neutral-300">Reset</button>
        <span className="mx-1 h-3 w-px bg-neutral-300" />
        <label className="flex items-center gap-1"><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> popisky</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={showCables} onChange={(e) => setShowCables(e.target.checked)} /> kabely</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={showDims} onChange={(e) => setShowDims(e.target.checked)} /> kóty</label>
      </div>

      <svg
        width={size.w}
        height={size.h}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onWheel={onWheel}
        className="cursor-grab active:cursor-grabbing"
      >
        <defs>
          <pattern id="tech-grid-minor" width={scale * 0.5} height={scale * 0.5} patternUnits="userSpaceOnUse">
            <path d={`M ${scale * 0.5} 0 L 0 0 0 ${scale * 0.5}`} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
          </pattern>
          <pattern id="tech-grid-major" width={scale} height={scale} patternUnits="userSpaceOnUse">
            <rect width={scale} height={scale} fill="url(#tech-grid-minor)" />
            <path d={`M ${scale} 0 L 0 0 0 ${scale}`} fill="none" stroke="#cbd5e1" strokeWidth="0.9" />
          </pattern>
          <marker id="tech-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#334155" />
          </marker>
        </defs>

        {/* Frame + grid */}
        <rect x={8} y={8} width={size.w - 16} height={size.h - 16} fill="url(#tech-grid-major)" stroke="#94a3b8" strokeWidth="1.2" />
        <rect x={8} y={8} width={size.w - 16} height={size.h - 16} fill="none" stroke="#0f172a" strokeWidth="0.6" />

        {/* Origin axes */}
        <line x1={wx(-100)} y1={wy(0)} x2={wx(100)} y2={wy(0)} stroke="#64748b" strokeDasharray="4 4" strokeWidth={0.8} />
        <line x1={wx(0)} y1={wy(-100)} x2={wx(0)} y2={wy(100)} stroke="#64748b" strokeDasharray="4 4" strokeWidth={0.8} />
        <text x={wx(0) + 4} y={wy(0) - 4} fontSize={10} fill="#64748b" fontFamily="ui-monospace, monospace">0,0</text>

        {/* Cable routes (Manhattan) — drawn under polygons */}
        {routes.map(({ c, a, b }) => {
          const style = CABLE_STYLE[c.type];
          const ax = wx(a.pos[0]);
          const ay = wy(a.pos[2]);
          const bx2 = wx(b.pos[0]);
          const by = wy(b.pos[2]);
          const midX = (ax + bx2) / 2;
          const d = `M ${ax} ${ay} L ${midX} ${ay} L ${midX} ${by} L ${bx2} ${by}`;
          return (
            <g key={c.id} style={{ pointerEvents: "none" }}>
              <path d={d} fill="none" stroke="white" strokeWidth={4} opacity={0.7} />
              <path d={d} fill="none" stroke={style.color} strokeWidth={2} strokeDasharray={style.dash} markerEnd="url(#tech-arrow)" />
              <g transform={`translate(${midX} ${(ay + by) / 2})`}>
                <rect x={-14} y={-8} width={28} height={14} rx={2} fill="white" stroke={style.color} strokeWidth={0.8} />
                <text x={0} y={2} fontSize={9} fontFamily="ui-monospace, monospace" fontWeight={700} fill={style.color} textAnchor="middle">{style.short}</text>
              </g>
            </g>
          );
        })}

        {/* Items */}
        {drawSet.map(({ item, count, totalH }) => {
          const spec = specs[item.kind];
          if (!spec) return null;
          const s = spec.size;
          const style = CAT_STYLE[spec.category] ?? CAT_STYLE.infra;
          const cx = wx(item.pos[0]);
          const cy = wy(item.pos[2]);
          const hw = (s[0] / 2) * scale;
          const hd = (s[2] / 2) * scale;
          const rot = (item.rotY * 180) / Math.PI;
          const selected = selectedIds?.includes(item.id);
          return (
            <g
              key={item.id}
              data-tech-item
              transform={`translate(${cx} ${cy}) rotate(${rot})`}
              onClick={(e) => { e.stopPropagation(); onSelectItem?.(item.id, e.shiftKey || e.metaKey || e.ctrlKey); }}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={-hw}
                y={-hd}
                width={hw * 2}
                height={hd * 2}
                fill={style.fill}
                stroke={selected ? "#84cc16" : style.stroke}
                strokeWidth={selected ? 2.4 : 1.2}
              />
              {/* Front-face indicator (world +Z after rotation = local +hd) */}
              <line x1={-hw} y1={hd} x2={hw} y2={hd} stroke={style.stroke} strokeWidth={2} />
              {/* Diagonal to show orientation like a technical block symbol */}
              <line x1={-hw} y1={-hd} x2={hw} y2={hd} stroke={style.stroke} strokeWidth={0.4} opacity={0.35} />
              <line x1={-hw} y1={hd} x2={hw} y2={-hd} stroke={style.stroke} strokeWidth={0.4} opacity={0.35} />

              {/* Category tag */}
              <g transform={`translate(${-hw + 2} ${-hd + 2})`}>
                <rect x={0} y={0} width={16} height={9} fill={style.stroke} />
                <text x={8} y={7} fontSize={7} fontFamily="ui-monospace, monospace" fill="white" textAnchor="middle" fontWeight={700}>{style.tag}</text>
              </g>
              {/* Stack "×N" */}
              {count > 1 && (
                <g transform={`translate(${hw - 18} ${-hd + 2})`}>
                  <rect x={0} y={0} width={16} height={9} fill="#0f172a" />
                  <text x={8} y={7} fontSize={7} fontFamily="ui-monospace, monospace" fill="white" textAnchor="middle" fontWeight={700}>×{count}</text>
                </g>
              )}
              {/* Label */}
              {showLabels && (
                <g transform={`rotate(${-rot})`}>
                  <text x={0} y={-2} fontSize={Math.max(8, Math.min(12, scale * 0.15))} textAnchor="middle" fontWeight={700} fill={style.text} style={{ pointerEvents: "none", userSelect: "none" }}>
                    {item.label ?? spec.label}
                  </text>
                  <text x={0} y={10} fontSize={Math.max(7, Math.min(10, scale * 0.11))} textAnchor="middle" fill={style.text} fontFamily="ui-monospace, monospace" opacity={0.75} style={{ pointerEvents: "none", userSelect: "none" }}>
                    {spec.label}
                  </text>
                  {showDims && (
                    <text x={0} y={22} fontSize={Math.max(6, Math.min(9, scale * 0.09))} textAnchor="middle" fill={style.text} fontFamily="ui-monospace, monospace" opacity={0.55} style={{ pointerEvents: "none", userSelect: "none" }}>
                      {s[0].toFixed(2)}×{s[2].toFixed(2)} m · h {totalH.toFixed(2)} m
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Scale bar */}
        <g transform={`translate(24 ${size.h - 40})`}>
          <line x1={0} y1={0} x2={scale * 2} y2={0} stroke="#0f172a" strokeWidth={2} />
          <line x1={0} y1={-4} x2={0} y2={4} stroke="#0f172a" strokeWidth={2} />
          <line x1={scale} y1={-3} x2={scale} y2={3} stroke="#0f172a" strokeWidth={1.4} />
          <line x1={scale * 2} y1={-4} x2={scale * 2} y2={4} stroke="#0f172a" strokeWidth={2} />
          <text x={0} y={16} fontSize={9} fontFamily="ui-monospace, monospace" fill="#0f172a">0</text>
          <text x={scale} y={16} fontSize={9} fontFamily="ui-monospace, monospace" fill="#0f172a" textAnchor="middle">1 m</text>
          <text x={scale * 2} y={16} fontSize={9} fontFamily="ui-monospace, monospace" fill="#0f172a" textAnchor="middle">2 m</text>
        </g>

        {/* North indicator */}
        <g transform={`translate(${size.w - 60} 44)`}>
          <circle r={22} fill="white" stroke="#0f172a" strokeWidth={1} />
          <polygon points="0,-18 6,10 0,4 -6,10" fill="#0f172a" />
          <text y={-24} fontSize={9} fontFamily="ui-monospace, monospace" textAnchor="middle" fill="#0f172a" fontWeight={700}>–Z</text>
          <text y={32} fontSize={8} fontFamily="ui-monospace, monospace" textAnchor="middle" fill="#64748b">publikum ↓</text>
        </g>

        {/* Title / legend block bottom-right */}
        <g transform={`translate(${size.w - 260} ${size.h - 176})`}>
          <rect x={0} y={0} width={244} height={160} fill="white" stroke="#0f172a" strokeWidth={1} />
          <line x1={0} y1={22} x2={244} y2={22} stroke="#0f172a" />
          <text x={8} y={16} fontSize={11} fontFamily="ui-monospace, monospace" fontWeight={800} fill="#0f172a">STAGE — TECHNICKÝ NÁKRES</text>
          <text x={8} y={38} fontSize={9} fontFamily="ui-monospace, monospace" fill="#0f172a" fontWeight={700}>KOMPONENTY</text>
          {(["sound","lights","infra"] as const).map((c, i) => {
            const st = CAT_STYLE[c];
            return (
              <g key={c} transform={`translate(8 ${46 + i * 12})`}>
                <rect width={10} height={8} fill={st.fill} stroke={st.stroke} />
                <text x={16} y={7} fontSize={9} fontFamily="ui-monospace, monospace" fill="#0f172a">{st.tag} · {c === "sound" ? "Zvuk" : c === "lights" ? "Světla" : "Infrastruktura"}</text>
                <text x={225} y={7} fontSize={9} fontFamily="ui-monospace, monospace" fill="#0f172a" textAnchor="end" fontWeight={700}>{tally[c] ?? 0}×</text>
              </g>
            );
          })}
          <line x1={8} y1={86} x2={236} y2={86} stroke="#cbd5e1" />
          <text x={8} y={98} fontSize={9} fontFamily="ui-monospace, monospace" fill="#0f172a" fontWeight={700}>KABELÁŽ</text>
          {(Object.entries(CABLE_STYLE) as [Cable["type"], typeof CABLE_STYLE.power][]).map(([k, st], i) => (
            <g key={k} transform={`translate(8 ${106 + i * 12})`}>
              <line x1={0} y1={4} x2={12} y2={4} stroke={st.color} strokeWidth={2} strokeDasharray={st.dash} />
              <text x={18} y={7} fontSize={9} fontFamily="ui-monospace, monospace" fill="#0f172a">{st.short} · {st.label}</text>
              <text x={225} y={7} fontSize={9} fontFamily="ui-monospace, monospace" fill={st.color} textAnchor="end" fontWeight={700}>{cableTally[k] ?? 0}×</text>
            </g>
          ))}
        </g>

        {items.length === 0 && (
          <text x={size.w / 2} y={size.h / 2} textAnchor="middle" fontSize={14} fill="#94a3b8" fontFamily="ui-monospace, monospace">
            Zatím prázdný výkres. Přidej bedny v jiném pohledu.
          </text>
        )}
      </svg>
    </div>
  );
}
