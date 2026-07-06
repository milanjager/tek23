import { useMemo, useRef, useState, useEffect } from "react";
import { RotateCw, Trash2, X, ChevronUp, ChevronDown, Plus } from "lucide-react";

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
  size: [number, number, number]; // w, h, d
}

interface Props {
  items: Placed[];
  specs: Record<string, ElevSpec>;
  onUpdateItem: (id: string, patch: Partial<Placed>) => void;
  onDeleteItem: (id: string) => void;
  onAddDeviceAt?: (kind: string, x: number, z: number) => void;
}

const CAT_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  sound:  { bg: "#dcfce7", border: "#16a34a", text: "#166534" },
  lights: { bg: "#fef3c7", border: "#d97706", text: "#92400e" },
  infra:  { bg: "#e0e7ff", border: "#4f46e5", text: "#3730a3" },
};

const VIEW_W_M = 22;   // horizontal (X) span shown
const VIEW_H_M = 6;    // vertical (Y) span shown
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

export default function ElevationView({
  items, specs, onUpdateItem, onDeleteItem, onAddDeviceAt,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [addAt, setAddAt] = useState<{ x: number; z: number; clientX: number; clientY: number } | null>(null);
  // Which "depth slice" to focus (Z coordinate). "all" = show everything, with
  // items further from the viewer drawn faded.
  const [depthFilter, setDepthFilter] = useState<"all" | number>("all");

  const px = PX_PER_M * zoom;
  const canvasW = VIEW_W_M * px + 200;
  const canvasH = VIEW_H_M * px + 140;
  const originX = canvasW / 2;          // world X = 0
  const groundY = canvasH - 60;         // world Y = 0 (floor)

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  // Group items by their footprint so we can compute stack levels the same way
  // as the top-down planner.
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

  // Depth options: unique Z coordinates rounded to 0.5m, sorted from crowd side
  // (positive Z) to backstage (negative Z).
  const depthOptions = useMemo(() => {
    const set = new Set<number>();
    for (const it of items) set.add(snap(it.pos[2]));
    return Array.from(set).sort((a, b) => b - a);
  }, [items]);

  const visibleItems = useMemo(() => {
    if (depthFilter === "all") {
      // Sort back-to-front so nearer items overlap further ones.
      return [...items].sort((a, b) => a.pos[2] - b.pos[2]);
    }
    return items.filter((i) => snap(i.pos[2]) === depthFilter);
  }, [items, depthFilter]);

  const dragRef = useRef<{
    id: string;
    startX: number;
    grabDX: number;
    startLevel: number;
    startClientY: number;
  } | null>(null);

  const worldXFromClient = (clientX: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return (clientX - rect.left - originX) / px;
  };

  const onItemPointerDown = (e: React.PointerEvent, it: Placed) => {
    e.stopPropagation();
    setSelectedId(it.id);
    const stack = stacksByItem.get(it.id);
    dragRef.current = {
      id: it.id,
      startX: it.pos[0],
      grabDX: worldXFromClient(e.clientX) - it.pos[0],
      startLevel: stack?.level ?? 0,
      startClientY: e.clientY,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onItemPointerMove = (e: React.PointerEvent) => {
    const dr = dragRef.current;
    if (!dr) return;
    const it = items.find((i) => i.id === dr.id);
    if (!it) return;
    // Horizontal → move X.
    const nx = snap(worldXFromClient(e.clientX) - dr.grabDX);
    if (nx !== it.pos[0]) {
      // Recompute Y for the new column (may join another stack or land on floor).
      const y = computeStackY(items, specs, it.kind, nx, it.pos[2], it.rotY, it.id);
      onUpdateItem(it.id, { pos: [nx, y, it.pos[2]] });
    }
  };

  const onItemPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
  }, [selected, items, specs, onUpdateItem, onDeleteItem]);

  // Restack: for the selected item's column, reorder items by desired level.
  const moveInStack = (dir: -1 | 1) => {
    if (!selected) return;
    const fa = footprint(selected, specs);
    const column = items
      .filter((o) => overlapsXZ(fa, footprint(o, specs)))
      .sort((a, b) => a.pos[1] - b.pos[1]);
    const idx = column.findIndex((c) => c.id === selected.id);
    const swap = idx + dir;
    if (swap < 0 || swap >= column.length) return;
    // Rebuild Y values in new order.
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
        <span className="hidden text-neutral-500 md:inline">· Táhni bednu vlevo/vpravo · <b>R</b> = rotace · <b>Del</b> = smazat</span>
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

      {/* Scrollable canvas */}
      <div className="absolute inset-0 overflow-auto pt-12">
        <div
          ref={canvasRef}
          className="relative mx-auto"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-elev-item]")) return;
            if ((e.target as HTMLElement).closest("[data-add-popover]")) return;
            setSelectedId(null);
            if (!onAddDeviceAt) return;
            const rect = canvasRef.current!.getBoundingClientRect();
            const x = snap((e.clientX - rect.left - originX) / px);
            const z = depthFilter === "all" ? 0 : (depthFilter as number);
            setAddAt({ x, z, clientX: e.clientX - rect.left, clientY: e.clientY - rect.top });
          }}
          style={{ width: canvasW, height: canvasH, background: "linear-gradient(to bottom,#f5f5f4 0%,#f5f5f4 82%,#e7e5e4 100%)" }}
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

            {/* Height ruler (every 1m) */}
            {Array.from({ length: Math.floor(VIEW_H_M) + 1 }).map((_, i) => {
              const y = groundY - i * px;
              return (
                <g key={i}>
                  <line x1={0} y1={y} x2={canvasW} y2={y} stroke={i === 0 ? "#0a0a0a" : "#d6d3d1"} strokeWidth={i === 0 ? 2 : 1} />
                  <text x={6} y={y - 3} fontSize={10} fill="#57534e" fontFamily="ui-monospace,monospace">{i} m</text>
                </g>
              );
            })}

            {/* Center axis (X = 0) */}
            <line x1={originX} y1={0} x2={originX} y2={groundY} stroke="#a8a29e" strokeDasharray="2 4" />
            <text x={originX + 4} y={12} fontSize={10} fill="#57534e">X = 0</text>

            {/* Ground label */}
            <text x={canvasW / 2} y={groundY + 30} textAnchor="middle" fontSize={13} fontWeight={700} fill="#0a0a0a">
              ▬▬▬ ZEM (podlaha stage) ▬▬▬
            </text>
            <text x={canvasW / 2} y={groundY + 46} textAnchor="middle" fontSize={10} fill="#57534e">
              Pohled zepředu (od publika)  ·  osa X vodorovně, osa Y výška
            </text>
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
            // Depth-fade when showing all rows.
            const zFactor = depthFilter === "all"
              ? Math.max(0.35, 1 - Math.max(0, -it.pos[2]) * 0.12)
              : 1;
            const stack = stacksByItem.get(it.id);
            return (
              <div
                key={it.id}
                data-elev-item
                onPointerDown={(e) => onItemPointerDown(e, it)}
                onPointerMove={onItemPointerMove}
                onPointerUp={onItemPointerUp}
                className="absolute cursor-move select-none rounded border shadow-sm"
                style={{
                  left, top, width: wPx, height: hPx,
                  background: color.bg,
                  borderColor: isSel ? "#84cc16" : color.border,
                  borderWidth: isSel ? 3 : 2,
                  color: color.text,
                  opacity: zFactor,
                  zIndex: 10 + Math.round((10 - it.pos[2]) * 2) + (isSel ? 500 : 0),
                  boxShadow: isSel ? "0 6px 18px rgba(132,204,22,0.4)" : undefined,
                }}
                title={`${it.label ?? spec.label} · ${f.w.toFixed(2)} š × ${f.h.toFixed(2)} v × ${f.d.toFixed(2)} hl m · X ${f.x.toFixed(1)}, Y ${it.pos[1].toFixed(2)}, Z ${it.pos[2].toFixed(1)}`}
              >
                <div className="flex h-full w-full flex-col items-center justify-center overflow-hidden px-1 text-center leading-tight">
                  <div className="truncate text-[10px] font-bold">{it.label ?? spec.label}</div>
                  {hPx > 32 && wPx > 44 && (
                    <div className="truncate font-mono text-[9px] opacity-70">
                      {f.w.toFixed(1)}×{f.h.toFixed(1)} m
                    </div>
                  )}
                  {hPx > 60 && stack && stack.total > 1 && (
                    <div className="mt-0.5 rounded bg-white/80 px-1 font-mono text-[9px] font-bold">
                      patro {stack.level + 1}/{stack.total}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {items.length === 0 && (
            <div className="absolute inset-x-0 top-1/3 text-center text-sm text-neutral-500">
              Zatím nic k zobrazení. Přidej bedny v paletě vlevo nebo v režimu <b>Plán 2D</b>.
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="absolute bottom-2 left-2 right-2 z-20 rounded-lg border border-neutral-300 bg-white p-3 shadow-2xl md:left-auto md:right-2 md:w-80">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">{specs[selected.kind]?.category}</div>
              <div className="text-sm font-bold text-neutral-900">{selected.label ?? specs[selected.kind]?.label ?? selected.kind}</div>
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
              <button
                onClick={() => moveInStack(1)}
                title="Posunout ve stacku výš"
                className="px-2 py-0.5 hover:bg-neutral-100"
              >
                <ChevronUp size={12} />
              </button>
              <button
                onClick={() => moveInStack(-1)}
                title="Posunout ve stacku níž"
                className="border-l border-neutral-300 px-2 py-0.5 hover:bg-neutral-100"
              >
                <ChevronDown size={12} />
              </button>
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

// Stacked Y for an item at (x,z) — sits on top of anything overlapping.
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
