import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Speaker,
  Radio,
  Volume2,
  Zap,
  Lightbulb,
  Wine,
  Disc3,
  Sliders,
  Fuel,
  Users,
  Cable,
  RotateCw,
  Trash2,
  Save,
  Eraser,
  Download,
  Plus,
  Move,
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
  | "strobe"
  | "laser"
  | "movinghead"
  | "bar"
  | "generator"
  | "crowd";

type Category = "sound" | "lights" | "infra";

interface Spec {
  kind: ComponentKind;
  label: string;
  category: Category;
  w: number;
  h: number;
  color: "acid" | "magenta" | "cyan" | "amber";
  icon: typeof Speaker;
  hint: string;
}

interface Placed {
  id: string;
  kind: ComponentKind;
  x: number;
  y: number;
  rot: number;
  label?: string;
}

interface Cable {
  id: string;
  from: string;
  to: string;
}

/* ---------- Catalog ---------- */

const SPECS: Record<ComponentKind, Spec> = {
  horn: { kind: "horn", label: "Horn", category: "sound", w: 90, h: 70, color: "acid", icon: Radio, hint: "Výškový horn" },
  mid: { kind: "mid", label: "Mid", category: "sound", w: 90, h: 90, color: "acid", icon: Speaker, hint: "Střední pásmo" },
  bass: { kind: "bass", label: "Bass bin", category: "sound", w: 120, h: 100, color: "acid", icon: Volume2, hint: "Basová bedna" },
  sub: { kind: "sub", label: "Sub 2x18", category: "sound", w: 150, h: 110, color: "acid", icon: Volume2, hint: "Sub-bass" },
  amp: { kind: "amp", label: "Amp rack", category: "infra", w: 80, h: 70, color: "amber", icon: Sliders, hint: "Zesilovače" },
  mixer: { kind: "mixer", label: "Mixer FOH", category: "infra", w: 100, h: 70, color: "amber", icon: Sliders, hint: "Mixážní pult" },
  dj: { kind: "dj", label: "DJ booth", category: "infra", w: 130, h: 80, color: "amber", icon: Disc3, hint: "DJ pult" },
  strobe: { kind: "strobe", label: "Strobo", category: "lights", w: 70, h: 60, color: "cyan", icon: Zap, hint: "Stroboskop" },
  laser: { kind: "laser", label: "Laser", category: "lights", w: 70, h: 60, color: "magenta", icon: Zap, hint: "Laser" },
  movinghead: { kind: "movinghead", label: "Moving head", category: "lights", w: 70, h: 70, color: "magenta", icon: Lightbulb, hint: "Otočná hlava" },
  bar: { kind: "bar", label: "Bar", category: "infra", w: 200, h: 70, color: "amber", icon: Wine, hint: "Bar" },
  generator: { kind: "generator", label: "Aggregát", category: "infra", w: 110, h: 90, color: "amber", icon: Fuel, hint: "Diesel generátor" },
  crowd: { kind: "crowd", label: "Dancefloor", category: "infra", w: 220, h: 160, color: "magenta", icon: Users, hint: "Prostor pro dav" },
};

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "sound", label: "Sound" },
  { id: "lights", label: "Lights" },
  { id: "infra", label: "Infra" },
];

/* ---------- Helpers ---------- */

const uid = () => Math.random().toString(36).slice(2, 10);
const STORAGE = "stagerig:v1";

const colorClass = (c: Spec["color"]) => {
  switch (c) {
    case "acid": return { ring: "ring-[color:var(--acid)]", text: "text-[color:var(--acid)]", bg: "bg-[color:var(--acid)]/10", border: "border-[color:var(--acid)]/60" };
    case "magenta": return { ring: "ring-[color:var(--magenta)]", text: "text-[color:var(--magenta)]", bg: "bg-[color:var(--magenta)]/10", border: "border-[color:var(--magenta)]/60" };
    case "cyan": return { ring: "ring-[color:var(--cyan)]", text: "text-[color:var(--cyan)]", bg: "bg-[color:var(--cyan)]/10", border: "border-[color:var(--cyan)]/60" };
    case "amber": return { ring: "ring-[color:var(--amber)]", text: "text-[color:var(--amber)]", bg: "bg-[color:var(--amber)]/10", border: "border-[color:var(--amber)]/60" };
  }
};

/* ---------- Component ---------- */

export function StageBuilder() {
  const [items, setItems] = useState<Placed[]>([]);
  const [cables, setCables] = useState<Cable[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [cableMode, setCableMode] = useState(false);
  const [cableFrom, setCableFrom] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("sound");

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const paletteDrag = useRef<ComponentKind | null>(null);

  /* persistence */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const p = JSON.parse(raw);
        setItems(p.items ?? []);
        setCables(p.cables ?? []);
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify({ items, cables }));
  }, [items, cables]);

  /* palette → canvas */
  const onPaletteDragStart = (k: ComponentKind) => (e: React.DragEvent) => {
    paletteDrag.current = k;
    e.dataTransfer.effectAllowed = "copy";
  };
  const onCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const k = paletteDrag.current;
    if (!k || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const spec = SPECS[k];
    const x = e.clientX - rect.left - spec.w / 2;
    const y = e.clientY - rect.top - spec.h / 2;
    setItems((prev) => [...prev, { id: uid(), kind: k, x, y, rot: 0 }]);
    paletteDrag.current = null;
  };

  /* item drag inside canvas */
  const onItemMouseDown = (id: string) => (e: React.MouseEvent) => {
    if (cableMode) {
      if (!cableFrom) setCableFrom(id);
      else if (cableFrom !== id) {
        setCables((c) => [...c, { id: uid(), from: cableFrom, to: id }]);
        setCableFrom(null);
      } else {
        setCableFrom(null);
      }
      return;
    }
    e.stopPropagation();
    setSelected(id);
    const item = items.find((i) => i.id === id);
    if (!item || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    dragState.current = {
      id,
      dx: e.clientX - rect.left - item.x,
      dy: e.clientY - rect.top - item.y,
    };
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = dragState.current;
      if (!d || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const nx = e.clientX - rect.left - d.dx;
      const ny = e.clientY - rect.top - d.dy;
      setItems((prev) => prev.map((i) => (i.id === d.id ? { ...i, x: nx, y: ny } : i)));
    };
    const up = () => (dragState.current = null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

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

  const centerOf = useCallback(
    (id: string) => {
      const it = items.find((i) => i.id === id);
      if (!it) return null;
      const s = SPECS[it.kind];
      return { x: it.x + s.w / 2, y: it.y + s.h / 2 };
    },
    [items],
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border bg-card/50 px-5 py-3 backdrop-blur">
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
        <div className="flex items-center gap-2">
          <ToolbarBtn onClick={() => setCableMode((v) => { setCableFrom(null); return !v; })} active={cableMode} icon={Cable}>
            {cableMode ? (cableFrom ? "Vyber cíl…" : "Klikni zdroj") : "Kabel"}
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => selected && setItems((p) => p.map((i) => (i.id === selected ? { ...i, rot: (i.rot + 15) % 360 } : i)))}
            icon={RotateCw}
            disabled={!selected}
          >
            Otočit
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => selected && (setItems((p) => p.filter((i) => i.id !== selected)), setSelected(null))}
            icon={Trash2}
            disabled={!selected}
            danger
          >
            Smazat
          </ToolbarBtn>
          <div className="mx-2 h-6 w-px bg-border" />
          <ToolbarBtn onClick={exportJson} icon={Download}>Export</ToolbarBtn>
          <ToolbarBtn onClick={() => localStorage.setItem(STORAGE, JSON.stringify({ items, cables }))} icon={Save}>Uložit</ToolbarBtn>
          <ToolbarBtn onClick={clear} icon={Eraser} danger>Reset</ToolbarBtn>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Palette */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card/30">
          <div className="border-b border-border p-3">
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
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {Object.values(SPECS)
                .filter((s) => s.category === category)
                .map((s) => {
                  const cls = colorClass(s.color);
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.kind}
                      draggable
                      onDragStart={onPaletteDragStart(s.kind)}
                      className={`group cursor-grab rounded-md border ${cls.border} ${cls.bg} p-3 transition hover:scale-[1.02] active:cursor-grabbing`}
                    >
                      <div className="flex items-start justify-between">
                        <Icon className={`h-5 w-5 ${cls.text}`} />
                        <Move className="h-3 w-3 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                      </div>
                      <div className="mt-2 font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                        {s.label}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{s.hint}</div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Stats */}
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
          <div
            ref={canvasRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onCanvasDrop}
            onClick={() => {
              setSelected(null);
              if (cableMode) setCableFrom(null);
            }}
            className="bg-grid relative h-full w-full"
          >
            {/* Stage front marker */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
              <div className="mt-4 rounded-full border border-[color:var(--acid)]/40 bg-background/60 px-4 py-1 font-mono text-[10px] uppercase tracking-widest text-[color:var(--acid)] backdrop-blur">
                ▲ STAGE FRONT ▲
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
              <div className="mb-4 rounded-full border border-border bg-background/60 px-4 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur">
                ▼ CROWD ▼
              </div>
            </div>

            {items.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="max-w-sm rounded-lg border border-dashed border-border bg-card/40 px-6 py-5 text-center backdrop-blur">
                  <p className="font-mono text-xs uppercase tracking-widest text-[color:var(--acid)]">Přetáhni komponentu</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Postav horny nahoře, středy pod ně, basy dolů. Přidej stroboskopy, laser, DJ pult a bar.
                  </p>
                </div>
              </div>
            )}

            {/* Cables (SVG under items) */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              {cables.map((c) => {
                const a = centerOf(c.from);
                const b = centerOf(c.to);
                if (!a || !b) return null;
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2 + 40;
                return (
                  <g key={c.id}>
                    <path
                      d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                      stroke="oklch(0.82 0.18 75 / 0.7)"
                      strokeWidth={2}
                      fill="none"
                      strokeDasharray="4 4"
                    />
                    <circle cx={a.x} cy={a.y} r={3} fill="oklch(0.82 0.18 75)" />
                    <circle cx={b.x} cy={b.y} r={3} fill="oklch(0.82 0.18 75)" />
                  </g>
                );
              })}
              {cableMode && cableFrom && (() => {
                const a = centerOf(cableFrom);
                if (!a) return null;
                return <circle cx={a.x} cy={a.y} r={10} fill="none" stroke="oklch(0.86 0.24 135)" strokeWidth={2} className="animate-pulse" />;
              })()}
            </svg>

            {/* Items */}
            {items.map((it) => {
              const spec = SPECS[it.kind];
              const cls = colorClass(spec.color);
              const isSel = selected === it.id;
              const isCableSrc = cableFrom === it.id;
              const Icon = spec.icon;
              return (
                <div
                  key={it.id}
                  onMouseDown={onItemMouseDown(it.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    left: it.x,
                    top: it.y,
                    width: spec.w,
                    height: spec.h,
                    transform: `rotate(${it.rot}deg)`,
                  }}
                  className={`absolute flex cursor-move flex-col items-center justify-center rounded-md border-2 ${cls.border} ${cls.bg} backdrop-blur-sm transition ${
                    isSel ? "ring-2 ring-offset-2 ring-offset-background " + cls.ring + " glow-acid" : ""
                  } ${isCableSrc ? "ring-2 " + cls.ring : ""} ${cableMode ? "cursor-crosshair" : ""}`}
                >
                  <Icon className={`h-6 w-6 ${cls.text}`} />
                  <div className={`mt-1 font-mono text-[10px] font-bold uppercase tracking-wider ${cls.text}`}>
                    {spec.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status bar */}
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>{items.length} kusů · {cables.length} kabelů</span>
            <span>
              {selectedItem
                ? `${SPECS[selectedItem.kind].label} · ${Math.round(selectedItem.x)},${Math.round(selectedItem.y)} · ${selectedItem.rot}°  [R] rotace  [Del] smazat`
                : cableMode
                ? "Klikni na dva prvky pro propojení kabelem"
                : "Klikni prvek pro výběr · přetáhni pro pohyb"}
            </span>
          </div>
        </main>
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
