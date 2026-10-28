import { useMemo, useState, useRef, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import type { StageItem as Placed } from "@/types/stage";

export interface IsoSpec {
  label: string;
  category: string;
  size: [number, number, number];
}

interface Props {
  items: Placed[];
  specs: Record<string, IsoSpec>;
  selectedIds?: string[];
  onSelectItem?: (id: string | null, additive?: boolean) => void;
  onDeleteItem?: (id: string) => void;
}

// Isometric constants — standard 30° angles.
const COS30 = Math.cos(Math.PI / 6);   // ≈ 0.866
const SIN30 = Math.sin(Math.PI / 6);   // = 0.5

const CAT_COLOR: Record<string, {
  top: string; front: string; side: string; edge: string; text: string;
}> = {
  sound:  { top: "#bbf7d0", front: "#86efac", side: "#4ade80", edge: "#166534", text: "#052e16" },
  lights: { top: "#fde68a", front: "#fcd34d", side: "#f59e0b", edge: "#78350f", text: "#451a03" },
  infra:  { top: "#c7d2fe", front: "#a5b4fc", side: "#6366f1", edge: "#312e81", text: "#1e1b4b" },
};

/** World (x,y,z) → screen (sx,sy). Y is up in world, screen Y is down. */
function project(x: number, y: number, z: number, scale: number) {
  return {
    sx: (x - z) * COS30 * scale,
    sy: ((x + z) * SIN30 - y) * scale,
  };
}

export default function IsometricView({
  items, specs, selectedIds, onSelectItem, onDeleteItem,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 700 });
  const scale = 46 * zoom;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Painter's algorithm: farther-from-camera first. In our iso, larger (x+z-y)
  // ends up rendered on top of smaller.
  const sorted = useMemo(() => {
    return [...items]
      .map((it) => {
        const s = specs[it.kind]?.size ?? [1, 1, 1];
        // Depth key = center of box along the camera axis (x + z), minus its y bottom.
        const key = it.pos[0] + it.pos[2] - it.pos[1] * 0.001; // y almost tie-breaker
        // Lower items (foundation) first, higher items on top.
        const yKey = it.pos[1];
        return { it, spec: specs[it.kind], size: s, key, yKey };
      })
      .filter((r) => r.spec)
      .sort((a, b) => {
        // Sort by depth (back → front), then by y (bottom → top).
        if (Math.abs(a.key - b.key) > 0.001) return b.key - a.key;
        return a.yKey - b.yKey;
      });
  }, [items, specs]);

  // World bounds → auto-center on first layout.
  const bounds = useMemo(() => {
    if (items.length === 0) return { minSx: -8, maxSx: 8, minSy: -6, maxSy: 6 };
    let minSx = Infinity, maxSx = -Infinity, minSy = Infinity, maxSy = -Infinity;
    for (const it of items) {
      const s = specs[it.kind]?.size ?? [1, 1, 1];
      for (const dx of [-s[0] / 2, s[0] / 2]) {
        for (const dz of [-s[2] / 2, s[2] / 2]) {
          for (const dy of [0, s[1]]) {
            const p = project(it.pos[0] + dx, it.pos[1] + dy, it.pos[2] + dz, 1);
            if (p.sx < minSx) minSx = p.sx;
            if (p.sx > maxSx) maxSx = p.sx;
            if (p.sy < minSy) minSy = p.sy;
            if (p.sy > maxSy) maxSy = p.sy;
          }
        }
      }
    }
    return { minSx, maxSx, minSy, maxSy };
  }, [items, specs]);

  const originX = size.w / 2 + pan.x - ((bounds.minSx + bounds.maxSx) / 2) * scale;
  const originY = size.h * 0.6 + pan.y - ((bounds.minSy + bounds.maxSy) / 2) * scale;

  const isSel = (id: string) => selectedIds?.includes(id) ?? false;

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-iso-item]")) return;
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
    setZoom((z) => Math.max(0.3, Math.min(3, z * dz)));
  };

  const selectedItem = useMemo(
    () => items.find((i) => selectedIds?.includes(i.id)),
    [items, selectedIds],
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-neutral-100" ref={wrapRef}>
      {/* Toolbar */}
      <div className="absolute left-2 top-2 z-10 flex items-center gap-2 rounded-md bg-white/95 px-2 py-1 text-[11px] text-neutral-700 shadow">
        <span className="font-semibold text-neutral-900">ISOMETRICKÝ POHLED</span>
        <span className="hidden text-neutral-500 md:inline">· táhni pro posun · kolečko = zoom · klik na bednu = výběr</span>
        <span className="mx-1 h-3 w-px bg-neutral-300" />
        <button className="rounded px-1.5 py-0.5 hover:bg-neutral-200" onClick={() => setZoom((z) => Math.max(0.3, z / 1.15))}>−</button>
        <span className="w-9 text-center font-mono">{Math.round(zoom * 100)}%</span>
        <button className="rounded px-1.5 py-0.5 hover:bg-neutral-200" onClick={() => setZoom((z) => Math.min(3, z * 1.15))}>+</button>
        <button className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] hover:bg-neutral-300" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset</button>
      </div>

      {/* Legend */}
      <div className="absolute right-2 top-2 z-10 rounded-md bg-white/95 px-2 py-1.5 text-[10px] text-neutral-600 shadow">
        <div className="mb-0.5 font-semibold text-neutral-800">Kategorie</div>
        {Object.entries(CAT_COLOR).map(([k, c]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ background: c.front, borderColor: c.edge }} />
            <span className="capitalize">{k}</span>
          </div>
        ))}
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
        style={{ display: "block", background: "linear-gradient(to bottom,#fafaf9,#e7e5e4)" }}
      >
        {/* Ground grid (iso) */}
        <g transform={`translate(${originX} ${originY})`}>
          <IsoGround scale={scale} size={20} />

          {sorted.map(({ it, spec, size: s }) => {
            const cat = CAT_COLOR[spec.category] ?? CAT_COLOR.infra;
            const selected = isSel(it.id);
            return (
              <IsoBox
                key={it.id}
                x={it.pos[0]}
                y={it.pos[1]}
                z={it.pos[2]}
                w={s[0]}
                h={s[1]}
                d={s[2]}
                scale={scale}
                color={cat}
                label={it.label ?? spec.label}
                selected={selected}
                onClick={(additive) => onSelectItem?.(it.id, additive)}
              />
            );
          })}
        </g>

        {items.length === 0 && (
          <text x={size.w / 2} y={size.h / 2} textAnchor="middle" fontSize={14} fill="#78716c">
            Zatím nic k zobrazení. Přidej bedny v jiném pohledu.
          </text>
        )}
      </svg>

      {selectedItem && (
        <div className="absolute bottom-2 left-2 right-2 z-20 rounded-lg border border-neutral-300 bg-white p-3 shadow-2xl md:left-auto md:right-2 md:w-80">
          <div className="mb-2 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-neutral-500">
                {specs[selectedItem.kind]?.category}
              </div>
              <div className="truncate text-sm font-bold text-neutral-900">
                {selectedItem.label ?? specs[selectedItem.kind]?.label ?? selectedItem.kind}
              </div>
              <div className="font-mono text-[10px] text-neutral-500">
                {specs[selectedItem.kind]?.size[0].toFixed(2)} š × {specs[selectedItem.kind]?.size[1].toFixed(2)} v × {specs[selectedItem.kind]?.size[2].toFixed(2)} h m
              </div>
            </div>
            <button onClick={() => onSelectItem?.(null)} className="rounded p-1 text-neutral-500 hover:bg-neutral-100"><X size={14} /></button>
          </div>
          <div className="mb-2 rounded bg-neutral-50 p-2 font-mono text-[10px] text-neutral-700">
            X: {selectedItem.pos[0].toFixed(2)} m &nbsp; Y: {selectedItem.pos[1].toFixed(2)} m &nbsp; Z: {selectedItem.pos[2].toFixed(2)} m
          </div>
          {onDeleteItem && (
            <button
              onClick={() => { onDeleteItem(selectedItem.id); onSelectItem?.(null); }}
              className="ml-auto flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
            >
              <Trash2 size={12} /> Smazat
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function IsoGround({ scale, size }: { scale: number; size: number }) {
  const lines: React.ReactNode[] = [];
  for (let i = -size; i <= size; i += 1) {
    const a = project(i, 0, -size, scale);
    const b = project(i, 0, size, scale);
    lines.push(<line key={`x${i}`} x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={i === 0 ? "#57534e" : "#e7e5e4"} strokeWidth={i === 0 ? 1.2 : 0.6} />);
    const c = project(-size, 0, i, scale);
    const d = project(size, 0, i, scale);
    lines.push(<line key={`z${i}`} x1={c.sx} y1={c.sy} x2={d.sx} y2={d.sy} stroke={i === 0 ? "#57534e" : "#e7e5e4"} strokeWidth={i === 0 ? 1.2 : 0.6} />);
  }
  return <g opacity={0.9}>{lines}</g>;
}

function IsoBox({
  x, y, z, w, h, d, scale, color, label, selected, onClick,
}: {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  scale: number;
  color: { top: string; front: string; side: string; edge: string; text: string };
  label: string;
  selected: boolean;
  onClick: (additive: boolean) => void;
}) {
  // 8 corners (bottom + top).
  const hw = w / 2, hd = d / 2;
  const corners = {
    // bottom
    bLF: project(x - hw, y,     z + hd, scale),
    bRF: project(x + hw, y,     z + hd, scale),
    bRB: project(x + hw, y,     z - hd, scale),
    bLB: project(x - hw, y,     z - hd, scale),
    // top
    tLF: project(x - hw, y + h, z + hd, scale),
    tRF: project(x + hw, y + h, z + hd, scale),
    tRB: project(x + hw, y + h, z - hd, scale),
    tLB: project(x - hw, y + h, z - hd, scale),
  };

  const poly = (pts: { sx: number; sy: number }[]) =>
    pts.map((p) => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(" ");

  const edge = selected ? "#84cc16" : color.edge;
  const sw = selected ? 2 : 1;

  // Visible faces from our fixed iso camera: top, front (+z), right (+x).
  return (
    <g
      data-iso-item
      onClick={(e) => { e.stopPropagation(); onClick(e.shiftKey || e.metaKey || e.ctrlKey); }}
      style={{ cursor: "pointer" }}
      filter={selected ? "drop-shadow(0 4px 6px rgba(132,204,22,0.4))" : undefined}
    >
      {/* Right side */}
      <polygon
        points={poly([corners.bRF, corners.bRB, corners.tRB, corners.tRF])}
        fill={color.side}
        stroke={edge}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* Front */}
      <polygon
        points={poly([corners.bLF, corners.bRF, corners.tRF, corners.tLF])}
        fill={color.front}
        stroke={edge}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* Top */}
      <polygon
        points={poly([corners.tLF, corners.tRF, corners.tRB, corners.tLB])}
        fill={color.top}
        stroke={edge}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* Label on top face */}
      <text
        x={(corners.tLF.sx + corners.tRB.sx) / 2}
        y={(corners.tLF.sy + corners.tRB.sy) / 2 + 3}
        textAnchor="middle"
        fontSize={Math.max(8, Math.min(12, scale * 0.18))}
        fontWeight={700}
        fill={color.text}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {label}
      </text>
      {selected && (
        <polygon
          points={poly([corners.bLF, corners.bRF, corners.tRF, corners.tLF])}
          fill="none"
          stroke="#84cc16"
          strokeWidth={2.5}
          strokeDasharray="4 3"
        />
      )}
    </g>
  );
}
