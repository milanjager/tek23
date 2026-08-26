import { useMemo, useRef, useState, useEffect } from "react";
import { Trash2, ChevronUp, ChevronDown, Plus, X, Info } from "lucide-react";

// Loose local mirrors so we don't have to export types from the giant parent.
interface Placed {
  id: string;
  kind: string;
  pos: [number, number, number]; // x, y (stack), z
  rotY: number;
  groupId?: string;
  label?: string;
  variant?: "red" | "blue";
}

export interface GridSpec {
  label: string;
  category: string;
  size: [number, number, number]; // w, h, d
}

interface Props {
  items: Placed[];
  specs: Record<string, GridSpec>;
  onUpdateItem: (id: string, patch: Partial<Placed>) => void;
  onDeleteItem: (id: string) => void;
  onAddDeviceAt: (kind: string, x: number, z: number) => void;
  /** Controlled selection shared across views. */
  selectedIds?: string[];
  onSelectItem?: (id: string | null, additive?: boolean) => void;
}

// Category colors — same palette as SchematicView for consistency.
const CAT_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  sound:  { bg: "#dcfce7", border: "#16a34a", text: "#166534" },
  lights: { bg: "#fef3c7", border: "#d97706", text: "#92400e" },
  infra:  { bg: "#e0e7ff", border: "#4f46e5", text: "#3730a3" },
};

// Stage area shown in the grid, in meters. Items can move outside it, but the
// visible frame anchors the eye and provides "front of stage" orientation.
const STAGE_W_M = 20;
const STAGE_D_M = 14;
const CELL_M = 0.5;         // snap granularity
const PX_PER_M = 42;        // zoom factor

const snap = (v: number) => Math.round(v / CELL_M) * CELL_M;

// Do two footprints (top-down w × d rectangles) overlap?
function overlaps(
  a: { x: number; z: number; w: number; d: number },
  b: { x: number; z: number; w: number; d: number },
) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.01 &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 0.01
  );
}

// Rotated footprint: 90° swaps w/d.
function footprint(it: Placed, specs: Record<string, GridSpec>) {
  const s = specs[it.kind]?.size ?? [1, 1, 1];
  const rotated = Math.abs(Math.sin(it.rotY)) > 0.5;
  const w = rotated ? s[2] : s[0];
  const d = rotated ? s[0] : s[2];
  return { x: it.pos[0], z: it.pos[2], w, d, h: s[1] };
}

export default function GridPlannerView({
  items, specs, onUpdateItem, onDeleteItem, onAddDeviceAt,
  selectedIds, onSelectItem,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const controlled = selectedIds !== undefined;
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const selectedId = controlled ? (selectedIds?.[0] ?? null) : localSelectedId;
  const setSelectedId = (id: string | null, additive = false) => {
    if (controlled) onSelectItem?.(id, additive);
    else setLocalSelectedId(id);
  };
  const [addAt, setAddAt] = useState<{ x: number; z: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  const px = PX_PER_M * zoom;
  const canvasW = STAGE_W_M * px + 200; // margins for items placed outside
  const canvasH = STAGE_D_M * px + 200;
  const originX = canvasW / 2; // world x = 0 → canvas center
  const originZ = canvasH / 2;

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  // Stacks: group items whose footprints overlap. Order bottom→top by Y.
  const stacksByItem = useMemo(() => {
    const map = new Map<string, { level: number; total: number; ids: string[] }>();
    const seen = new Set<string>();
    for (const it of items) {
      if (seen.has(it.id)) continue;
      const fa = footprint(it, specs);
      const group = items.filter((o) => {
        if (o.id === it.id) return true;
        const fb = footprint(o, specs);
        return overlaps(fa, fb);
      }).sort((a, b) => a.pos[1] - b.pos[1]);
      group.forEach((g, i) => {
        seen.add(g.id);
        map.set(g.id, { level: i, total: group.length, ids: group.map((x) => x.id) });
      });
    }
    return map;
  }, [items, specs]);

  // Compute the Y (stack height) for a new/moved item at (x,z), given the
  // items already sharing that footprint. Excludes `excludeId`.
  function computeStackY(
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
      const fb = footprint(o, specs);
      if (overlaps(fa, fb)) top = Math.max(top, o.pos[1] + fb.h);
    }
    return top;
  }

  // Drag state.
  const dragRef = useRef<{
    id: string;
    startX: number; startZ: number;
    grabDX: number; grabDZ: number;
  } | null>(null);

  const worldFromClient = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - originX) / px,
      z: (clientY - rect.top - originZ) / px,
    };
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-grid-item]")) return;
    if ((e.target as HTMLElement).closest("[data-add-popover]")) return;
    setSelectedId(null);
    const { x, z } = worldFromClient(e.clientX, e.clientY);
    setAddAt({ x: snap(x), z: snap(z) });
  };

  const onItemPointerDown = (e: React.PointerEvent, it: Placed) => {
    e.stopPropagation();
    setSelectedId(it.id, e.shiftKey || e.metaKey || e.ctrlKey);
    setAddAt(null);
    const { x, z } = worldFromClient(e.clientX, e.clientY);
    dragRef.current = {
      id: it.id,
      startX: it.pos[0], startZ: it.pos[2],
      grabDX: x - it.pos[0], grabDZ: z - it.pos[2],
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onItemPointerMove = (e: React.PointerEvent) => {
    const dr = dragRef.current;
    if (!dr) return;
    const it = items.find((i) => i.id === dr.id);
    if (!it) return;
    const { x, z } = worldFromClient(e.clientX, e.clientY);
    const nx = snap(x - dr.grabDX);
    const nz = snap(z - dr.grabDZ);
    if (nx === it.pos[0] && nz === it.pos[2]) return;
    const y = computeStackY(it.kind, nx, nz, it.rotY, it.id);
    onUpdateItem(it.id, { pos: [nx, y, nz] });
  };

  const onItemPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  // Keyboard: Delete removes selected item.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        onDeleteItem(selected.id);
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onUpdateItem, onDeleteItem, items, specs]);

  // Grouped kinds for the "add" popover.
  const kindsByCategory = useMemo(() => {
    const map: Record<string, { kind: string; label: string }[]> = {};
    for (const [k, s] of Object.entries(specs)) {
      (map[s.category] ??= []).push({ kind: k, label: s.label });
    }
    for (const c of Object.keys(map)) map[c].sort((a, b) => a.label.localeCompare(b.label));
    return map;
  }, [specs]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-neutral-100">
      {/* Toolbar */}
      <div className="absolute left-2 top-2 z-10 flex items-center gap-2 rounded-md bg-white/95 px-2 py-1 text-[11px] text-neutral-700 shadow">
        <Info size={12} className="text-neutral-500" />
        <span className="hidden md:inline">Klikni na volné místo pro přidání · Táhni bednu pro posun · <b>R</b> = rotace 90° · <b>Del</b> = smazat</span>
        <span className="md:hidden">Tap = přidat · Táhni = posun</span>
        <span className="mx-1 h-3 w-px bg-neutral-300" />
        <button aria-label="Oddálit" className="rounded px-1.5 py-0.5 hover:bg-neutral-200" onClick={() => setZoom((z) => Math.max(0.4, z / 1.15))}>−</button>
        <span className="w-9 text-center font-mono">{Math.round(zoom * 100)}%</span>
        <button aria-label="Přiblížit" className="rounded px-1.5 py-0.5 hover:bg-neutral-200" onClick={() => setZoom((z) => Math.min(2.5, z * 1.15))}>+</button>
        <button aria-label="Resetovat přiblížení" className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] hover:bg-neutral-300" onClick={() => setZoom(1)}>Reset</button>
      </div>

      {/* Legend */}
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1 rounded-md bg-white/95 px-2 py-1.5 text-[10px] text-neutral-600 shadow">
        <div className="mb-0.5 font-semibold text-neutral-800">Kategorie</div>
        {Object.entries(CAT_COLOR).map(([k, c]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ background: c.bg, borderColor: c.border }} />
            <span className="capitalize">{k}</span>
          </div>
        ))}
        <div className="mt-1 border-t border-neutral-200 pt-1 text-neutral-500">
          Grid: {CELL_M} m
        </div>
      </div>

      {/* Scrollable canvas */}
      <div className="absolute inset-0 overflow-auto">
        <div
          ref={canvasRef}
          onClick={onCanvasClick}
          className="relative"
          style={{ width: canvasW, height: canvasH, background: "#f5f5f4" }}
        >
          {/* Grid + stage frame */}
          <svg
            className="pointer-events-none absolute inset-0"
            width={canvasW}
            height={canvasH}
          >
            {/* minor grid every 0.5m */}
            <defs>
              <pattern id="gp-minor" width={CELL_M * px} height={CELL_M * px} patternUnits="userSpaceOnUse">
                <path d={`M ${CELL_M * px} 0 L 0 0 0 ${CELL_M * px}`} fill="none" stroke="#e7e5e4" strokeWidth={1} />
              </pattern>
              <pattern id="gp-major" width={px} height={px} patternUnits="userSpaceOnUse">
                <path d={`M ${px} 0 L 0 0 0 ${px}`} fill="none" stroke="#d6d3d1" strokeWidth={1} />
              </pattern>
            </defs>
            <rect width={canvasW} height={canvasH} fill="url(#gp-minor)" />
            <rect width={canvasW} height={canvasH} fill="url(#gp-major)" />

            {/* stage frame */}
            <rect
              x={originX - (STAGE_W_M / 2) * px}
              y={originZ - (STAGE_D_M / 2) * px}
              width={STAGE_W_M * px}
              height={STAGE_D_M * px}
              fill="none"
              stroke="#0a0a0a"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
            {/* axes */}
            <line x1={0} y1={originZ} x2={canvasW} y2={originZ} stroke="#a8a29e" strokeDasharray="2 4" />
            <line x1={originX} y1={0} x2={originX} y2={canvasH} stroke="#a8a29e" strokeDasharray="2 4" />

            {/* front-of-stage label (positive Z = where speakers face the crowd) */}
            <text x={originX} y={originZ + (STAGE_D_M / 2) * px + 22} textAnchor="middle" fontSize={12} fill="#0a0a0a" fontWeight={700}>
              ▼ PŘEDNÍ STRANA PÓDIA (publikum) ▼
            </text>
            <text x={originX} y={originZ - (STAGE_D_M / 2) * px - 10} textAnchor="middle" fontSize={11} fill="#57534e">
              BACKSTAGE
            </text>
          </svg>

          {/* Items */}
          {items.map((it) => {
            const f = footprint(it, specs);
            const spec = specs[it.kind];
            if (!spec) return null;
            const cat = spec.category;
            const color = CAT_COLOR[cat] ?? CAT_COLOR.infra;
            const wPx = f.w * px;
            const dPx = f.d * px;
            const left = originX + f.x * px - wPx / 2;
            const top = originZ + f.z * px - dPx / 2;
            const isSel = selectedId === it.id;
            const stack = stacksByItem.get(it.id);
            const stackTotal = stack?.total ?? 1;
            const stackLevel = stack?.level ?? 0;
            const isTop = stackLevel === stackTotal - 1;
            // Non-top items shown with a subtle offset "under" the top one.
            const offset = stackTotal > 1 ? (stackLevel - (stackTotal - 1)) * 3 : 0;
            return (
              <div
                key={it.id}
                data-grid-item
                onPointerDown={(e) => onItemPointerDown(e, it)}
                onPointerMove={onItemPointerMove}
                onPointerUp={onItemPointerUp}
                className="absolute cursor-move select-none rounded border text-left shadow-sm transition-shadow"
                style={{
                  left: left + offset,
                  top: top + offset,
                  width: wPx,
                  height: dPx,
                  background: color.bg,
                  borderColor: isSel ? "#84cc16" : color.border,
                  borderWidth: isSel ? 3 : 2,
                  color: color.text,
                  transform: `rotate(0deg)`,
                  zIndex: 10 + stackLevel + (isSel ? 100 : 0),
                  opacity: stackTotal > 1 && !isTop ? 0.55 : 1,
                  boxShadow: isSel ? "0 6px 18px rgba(132,204,22,0.35)" : undefined,
                }}
                title={`${it.label ?? spec.label} · ${f.w.toFixed(2)}×${f.d.toFixed(2)} m · pozice X ${f.x.toFixed(1)}, Z ${f.z.toFixed(1)}, patro ${stackLevel + 1}/${stackTotal}`}
              >
                <div className="flex h-full w-full flex-col items-center justify-center overflow-hidden px-1 text-center leading-tight">
                  <div className="truncate text-[10px] font-bold">{it.label ?? spec.label}</div>
                  {wPx > 60 && dPx > 30 && (
                    <div className="truncate font-mono text-[9px] opacity-70">
                      {f.w.toFixed(1)}×{f.d.toFixed(1)}m
                    </div>
                  )}
                </div>
                {stackTotal > 1 && (
                  <div
                    className="absolute -right-1 -top-1 flex h-5 min-w-[26px] items-center justify-center rounded-full border border-neutral-900 bg-white px-1 text-[10px] font-bold text-neutral-900 shadow"
                    title={`Patro ${stackLevel + 1} z ${stackTotal} (spodní = 1)`}
                  >
                    {stackLevel + 1}/{stackTotal}
                  </div>
                )}
                {/* Orientation arrow removed — all speakers face the audience uniformly. */}
              </div>
            );
          })}

          {/* Add popover at clicked empty cell */}
          {addAt && (
            <AddPopover
              x={originX + addAt.x * px}
              z={originZ + addAt.z * px}
              kindsByCategory={kindsByCategory}
              onPick={(kind) => { onAddDeviceAt(kind, addAt.x, addAt.z); setAddAt(null); }}
              onClose={() => setAddAt(null)}
            />
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          item={selected}
          spec={specs[selected.kind]}
          stack={stacksByItem.get(selected.id)}
          onClose={() => setSelectedId(null)}
          onDelete={() => { onDeleteItem(selected.id); setSelectedId(null); }}
          onMove={(dx, dz) => {
            const nx = snap(selected.pos[0] + dx);
            const nz = snap(selected.pos[2] + dz);
            const y = computeStackY(selected.kind, nx, nz, selected.rotY, selected.id);
            onUpdateItem(selected.id, { pos: [nx, y, nz] });
          }}
          onSetPos={(x, z) => {
            const nx = snap(x);
            const nz = snap(z);
            const y = computeStackY(selected.kind, nx, nz, selected.rotY, selected.id);
            onUpdateItem(selected.id, { pos: [nx, y, nz] });
          }}
          onSetLabel={(label) => onUpdateItem(selected.id, { label: label || undefined })}
        />
      )}
    </div>
  );
}

function AddPopover({
  x, z, kindsByCategory, onPick, onClose,
}: {
  x: number; z: number;
  kindsByCategory: Record<string, { kind: string; label: string }[]>;
  onPick: (kind: string) => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState<string>(Object.keys(kindsByCategory)[0] ?? "sound");
  return (
    <div
      data-add-popover
      className="absolute z-50 w-56 rounded-md border border-neutral-300 bg-white shadow-xl"
      style={{ left: x + 8, top: z + 8 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-2 py-1">
        <div className="text-[11px] font-semibold text-neutral-800">Přidat bednu zde</div>
        <button onClick={onClose} className="rounded p-0.5 text-neutral-500 hover:bg-neutral-100"><X size={12} /></button>
      </div>
      <div className="flex border-b border-neutral-200 text-[10px]">
        {Object.keys(kindsByCategory).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`flex-1 px-2 py-1 capitalize ${cat === c ? "bg-neutral-900 font-semibold text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="max-h-56 overflow-y-auto p-1">
        {(kindsByCategory[cat] ?? []).map((k) => (
          <button
            key={k.kind}
            onClick={() => onPick(k.kind)}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] text-neutral-800 hover:bg-lime-100"
          >
            <Plus size={11} className="text-lime-600" /> {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailPanel({
  item, spec, stack, onClose, onDelete, onMove, onSetPos, onSetLabel,
}: {
  item: Placed;
  spec?: GridSpec;
  stack?: { level: number; total: number; ids: string[] };
  onClose: () => void;
  onDelete: () => void;
  onMove: (dx: number, dz: number) => void;
  onSetPos: (x: number, z: number) => void;
  onSetLabel: (label: string) => void;
}) {
  return (
    <div className="absolute bottom-2 left-2 right-2 z-20 rounded-lg border border-neutral-300 bg-white p-3 shadow-2xl md:left-auto md:right-2 md:w-80">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">{spec?.category}</div>
          <div className="text-sm font-bold text-neutral-900">{item.label ?? spec?.label ?? item.kind}</div>
        </div>
        <button onClick={onClose} className="rounded p-1 text-neutral-500 hover:bg-neutral-100"><X size={14} /></button>
      </div>

      <label className="mb-2 block">
        <div className="mb-0.5 text-[10px] font-semibold text-neutral-500">Vlastní popisek (volitelné)</div>
        <input
          type="text"
          value={item.label ?? ""}
          onChange={(e) => onSetLabel(e.target.value)}
          placeholder={spec?.label ?? ""}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
        />
      </label>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <label>
          <div className="mb-0.5 text-[10px] font-semibold text-neutral-500">X (m, ← →)</div>
          <input
            type="number"
            step={0.5}
            value={item.pos[0]}
            onChange={(e) => onSetPos(parseFloat(e.target.value) || 0, item.pos[2])}
            className="w-full rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
          />
        </label>
        <label>
          <div className="mb-0.5 text-[10px] font-semibold text-neutral-500">Z (m, ↑ ↓)</div>
          <input
            type="number"
            step={0.5}
            value={item.pos[2]}
            onChange={(e) => onSetPos(item.pos[0], parseFloat(e.target.value) || 0)}
            className="w-full rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
          />
        </label>
      </div>

      <div className="mb-2 rounded bg-neutral-50 p-2 text-[11px] text-neutral-700">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Stack (patra na sobě)</span>
          <span className="font-mono">{(stack?.level ?? 0) + 1} / {stack?.total ?? 1}</span>
        </div>
        <div className="mt-0.5 text-[10px] text-neutral-500">
          Bedny se stackují automaticky, když je postavíš na stejné místo. Přesuň bednu jinam, aby se sundala z hromady.
        </div>
        <div className="mt-1 font-mono text-[10px] text-neutral-500">Výška Y: {item.pos[1].toFixed(2)} m</div>
      </div>

      <div className="flex flex-wrap gap-1">
        <div className="flex overflow-hidden rounded border border-neutral-300">
          <button onClick={() => onMove(-0.5, 0)} className="px-1.5 py-1 text-xs hover:bg-neutral-100">←</button>
          <button onClick={() => onMove(0, -0.5)} className="border-l border-neutral-300 px-1.5 py-1 text-xs hover:bg-neutral-100"><ChevronUp size={12} /></button>
          <button onClick={() => onMove(0, 0.5)} className="border-l border-neutral-300 px-1.5 py-1 text-xs hover:bg-neutral-100"><ChevronDown size={12} /></button>
          <button onClick={() => onMove(0.5, 0)} className="border-l border-neutral-300 px-1.5 py-1 text-xs hover:bg-neutral-100">→</button>
        </div>
        <button onClick={onDelete} className="ml-auto flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">
          <Trash2 size={12} /> Smazat
        </button>
      </div>
    </div>
  );
}
