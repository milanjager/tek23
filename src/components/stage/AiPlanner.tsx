import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  LoaderCircle,
  Minus,
  Plus,
  Ruler,
  Sparkles,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { generateAiLayout } from "@/lib/aiPlanner.functions";
import type { AiCatalogEntry, AiPlan, AiPlannerInput } from "@/lib/aiPlanner";

const DEFAULT_COUNTS: Record<string, number> = {
  sub: 4,
  mid: 2,
  horn: 2,
  powersoft: 2,
  distro: 1,
  generator: 1,
  movinghead: 4,
  strobe: 2,
};

type Room = AiPlannerInput["room"];

function LayoutPreview({ plan, room, catalog }: { plan: AiPlan; room: Room; catalog: AiCatalogEntry[] }) {
  const byKind = useMemo(() => new Map(catalog.map((item) => [item.kind, item])), [catalog]);
  const width = room.width + 2;
  const depth = room.depth + 2;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-secondary/40">
      <svg
        viewBox={`${-width / 2} ${-depth / 2} ${width} ${depth}`}
        className="h-64 w-full sm:h-80"
        role="img"
        aria-label={`Půdorys AI návrhu pro prostor ${room.width} × ${room.depth} metrů`}
      >
        <rect x={-room.width / 2} y={-room.depth / 2} width={room.width} height={room.depth} rx={0.15} fill="var(--background)" stroke="var(--border)" strokeWidth={0.12} />
        <rect x={-room.width / 2} y={-room.depth / 2} width={room.width} height={Math.min(3, room.depth * 0.18)} fill="var(--muted)" />
        <text x={0} y={-room.depth / 2 + 0.8} textAnchor="middle" fill="var(--muted-foreground)" fontSize={0.45} fontWeight={700}>STAGE / SERVISNÍ ZÓNA</text>
        <path d={`M ${-room.width / 2 + 0.5} ${room.depth / 2 - 1} L ${room.width / 2 - 0.5} ${room.depth / 2 - 1}`} stroke="var(--primary)" strokeWidth={0.08} strokeDasharray="0.3 0.25" />
        <text x={0} y={room.depth / 2 - 0.45} textAnchor="middle" fill="var(--muted-foreground)" fontSize={0.4}>PUBLIKUM · {room.attendees} lidí</text>
        {plan.placements.map((placement, index) => {
          const component = byKind.get(placement.kind);
          if (!component) return null;
          const [w, , d] = component.size;
          const fill = component.category === "sound" ? "var(--primary)" : component.category === "lights" ? "var(--cyan)" : "var(--muted-foreground)";
          return (
            <g key={`${placement.kind}-${index}`} transform={`translate(${placement.x} ${placement.z}) rotate(${placement.rotationDeg})`}>
              <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.06} fill={fill} fillOpacity={0.82} stroke="var(--background)" strokeWidth={0.04}>
                <title>{placement.label} · x {placement.x} m · z {placement.z} m · výška {placement.y} m</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-primary" />Zvuk</span>
        <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-cyan" />Světla</span>
        <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-muted-foreground" />Technika</span>
        <span className="ml-auto font-mono">{room.width} × {room.depth} × {room.height} m</span>
      </div>
    </div>
  );
}

export default function AiPlanner({
  open,
  catalog,
  sceneItems,
  onClose,
  onApply,
}: {
  open: boolean;
  catalog: AiCatalogEntry[];
  sceneItems: { kind: string }[];
  onClose: () => void;
  onApply: (plan: AiPlan) => void;
}) {
  const requestLayout = useServerFn(generateAiLayout);
  const [room, setRoom] = useState<Room>({ width: 16, depth: 24, height: 6, attendees: 250, venue: "indoor" });
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [addKind, setAddKind] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<AiPlan | null>(null);

  useEffect(() => {
    if (!open) return;
    const counts: Record<string, number> = {};
    for (const item of sceneItems) counts[item.kind] = (counts[item.kind] ?? 0) + 1;
    if (!Object.keys(counts).length) {
      for (const [kind, quantity] of Object.entries(DEFAULT_COUNTS)) {
        if (catalog.some((item) => item.kind === kind)) counts[kind] = quantity;
      }
    }
    setInventory(counts);
    setPlan(null);
    setError("");
    setAddKind("");
  }, [open, sceneItems, catalog]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  const selected = useMemo(
    () => catalog.filter((item) => (inventory[item.kind] ?? 0) > 0),
    [catalog, inventory],
  );
  const availableToAdd = catalog.filter((item) => !(inventory[item.kind] > 0));
  const totalPieces = selected.reduce((sum, item) => sum + inventory[item.kind], 0);

  if (!open) return null;

  const patchRoom = <K extends keyof Room>(key: K, value: Room[K]) => {
    setRoom((current) => ({ ...current, [key]: value }));
    setPlan(null);
  };
  const setQuantity = (kind: string, quantity: number) => {
    setInventory((current) => ({ ...current, [kind]: Math.max(0, Math.min(99, quantity)) }));
    setPlan(null);
  };
  const generate = async () => {
    setError("");
    if (!selected.some((item) => item.category === "sound")) {
      setError("Přidej alespoň jednu reprobednu, aby šlo navrhnout soundsystém.");
      return;
    }
    const components = selected.map((item) => ({ ...item, quantity: inventory[item.kind] }));
    setLoading(true);
    try {
      const result = await requestLayout({ data: { room, components } });
      if (!result.ok) setError(result.error);
      else setPlan(result.plan);
    } catch {
      setError("Spojení s AI se nepodařilo. Zkontroluj připojení a zkus to znovu.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-[14px] font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-[1000000003] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="ai-planner-title">
      <div className="glass-strong flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl">
        <header className="flex items-start gap-3 border-b border-border px-4 py-4 sm:px-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><WandSparkles size={21} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="ai-planner-title" className="font-display text-xl font-bold text-foreground">AI návrh rozmístění</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Popiš prostor a techniku. Návrh nejdřív uvidíš, teprve pak ho vložíš.</p>
          </div>
          <button onClick={onClose} disabled={loading} aria-label="Zavřít AI návrh" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:opacity-40"><X size={19} /></button>
        </header>

        <div className="grid flex-1 overflow-y-auto lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:overflow-hidden">
          <section className="space-y-5 p-4 sm:p-6 lg:overflow-y-auto" aria-label="Zadání pro AI">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-muted-foreground"><Ruler size={15} /> 1. Prostor a publikum</div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["width", "Šířka", 3, 200],
                  ["depth", "Hloubka", 3, 300],
                  ["height", "Výška", 2.2, 40],
                ] as const).map(([key, label, min, max]) => (
                  <label key={key} className="text-[11px] text-muted-foreground">{label} (m)
                    <input type="number" inputMode="decimal" min={min} max={max} step={0.5} value={room[key]} onChange={(event) => patchRoom(key, Number(event.target.value))} className={`${inputClass} mt-1`} />
                  </label>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><Users size={12} /> Návštěvníků</span>
                  <input type="number" inputMode="numeric" min={1} max={100000} step={10} value={room.attendees} onChange={(event) => patchRoom("attendees", Number(event.target.value))} className={`${inputClass} mt-1`} />
                </label>
                <label className="text-[11px] text-muted-foreground">Prostředí
                  <select value={room.venue} onChange={(event) => patchRoom("venue", event.target.value as Room["venue"])} className={`${inputClass} mt-1`}>
                    <option value="indoor">Uvnitř</option>
                    <option value="outdoor">Venku</option>
                  </select>
                </label>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-muted-foreground"><Sparkles size={15} /> 2. Dostupná technika</div>
                <span className="rounded-full bg-secondary px-2 py-1 font-mono text-[10px] text-muted-foreground">{totalPieces} ks</span>
              </div>
              <div className="space-y-1.5">
                {selected.map((item) => (
                  <div key={item.kind} className="flex min-h-14 items-center gap-2 rounded-xl border border-border bg-card/60 p-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-bold text-card-foreground">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground">{item.category === "sound" ? "Zvuk" : item.category === "lights" ? "Světla" : "Technika"} · {item.size.map((v) => v.toFixed(2)).join(" × ")} m</div>
                    </div>
                    <button onClick={() => setQuantity(item.kind, inventory[item.kind] - 1)} aria-label={`Ubavit ${item.label}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><Minus size={15} /></button>
                    <input type="number" min={0} max={99} value={inventory[item.kind]} onChange={(event) => setQuantity(item.kind, Number(event.target.value))} aria-label={`Počet kusů ${item.label}`} className="h-11 w-12 rounded-lg border border-input bg-background text-center font-mono text-[13px] font-bold" />
                    <button onClick={() => setQuantity(item.kind, inventory[item.kind] + 1)} aria-label={`Přidat ${item.label}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><Plus size={15} /></button>
                  </div>
                ))}
              </div>
              {availableToAdd.length > 0 && (
                <div className="mt-2 flex gap-2">
                  <select value={addKind} onChange={(event) => setAddKind(event.target.value)} aria-label="Komponenta k přidání" className={inputClass}>
                    <option value="">Vyber další komponentu…</option>
                    {availableToAdd.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
                  </select>
                  <button onClick={() => { if (!addKind) return; setQuantity(addKind, 1); setAddKind(""); }} disabled={!addKind} aria-label="Přidat komponentu do dostupné techniky" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground disabled:opacity-40"><Plus size={17} /></button>
                </div>
              )}
            </div>
          </section>

          <section className="flex min-h-[28rem] flex-col border-t border-border bg-secondary/20 p-4 sm:p-6 lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Výsledek AI návrhu">
            {!plan && !loading && (
              <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-3xl border border-dashed border-border bg-background/60 text-muted-foreground"><WandSparkles size={27} /></span>
                <h3 className="mt-4 font-display text-lg font-bold">Návrh na míru tvému prostoru</h3>
                <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">AI rozmístí dostupné bedny a světla, vysvětlí pokrytí publika a upozorní na slabá místa sestavy.</p>
              </div>
            )}
            {loading && (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center" role="status">
                <LoaderCircle size={32} className="animate-spin text-primary" />
                <h3 className="mt-4 font-display text-lg font-bold">Navrhuji rozmístění…</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">Počítám se prostorem, publikem a dostupnými kusy.</p>
              </div>
            )}
            {plan && !loading && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary"><Check size={14} /> Návrh je připravený</div>
                  <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{plan.summary}</p>
                </div>
                <LayoutPreview plan={plan} room={room} catalog={catalog} />
                <div className="rounded-2xl border border-border bg-card/60 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pokrytí publika</div>
                  <p className="mt-1 text-[13px] leading-relaxed">{plan.coverage}</p>
                </div>
                {plan.recommendations.length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Doporučený postup</div>
                    <ul className="mt-2 space-y-2">{plan.recommendations.map((item, index) => <li key={index} className="flex gap-2 text-[12px] leading-relaxed"><Check size={15} className="mt-0.5 shrink-0 text-primary" />{item}</li>)}</ul>
                  </div>
                )}
                {plan.warnings.length > 0 && (
                  <div className="rounded-2xl border border-amber/40 bg-amber/10 p-3">
                    <div className="flex items-center gap-2 text-[12px] font-bold"><AlertTriangle size={15} className="text-amber" /> Na co si dát pozor</div>
                    <ul className="mt-2 space-y-1.5">{plan.warnings.map((item, index) => <li key={index} className="text-[12px] leading-relaxed text-muted-foreground">• {item}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <footer className="border-t border-border bg-background/80 p-3 sm:px-6">
          {error && <p role="alert" className="mb-2 rounded-xl bg-destructive/10 px-3 py-2 text-[12px] font-semibold text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <p className="hidden flex-1 text-[11px] leading-relaxed text-muted-foreground sm:block">AI návrh je výchozí bod. Před realizací ověř zatížení, rigging, krytí a bezpečnost na místě.</p>
            {!plan ? (
              <button onClick={generate} disabled={loading || !selected.length} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[14px] font-bold text-primary-foreground shadow-sm transition hover:brightness-105 disabled:opacity-50 sm:ml-auto sm:w-auto">
                {loading ? <LoaderCircle size={18} className="animate-spin" /> : <WandSparkles size={18} />}{loading ? "Pracuji na návrhu…" : "Navrhnout rozmístění"}
              </button>
            ) : (
              <>
                <button onClick={() => setPlan(null)} className="min-h-12 rounded-xl px-4 text-[13px] font-semibold text-muted-foreground hover:bg-secondary">Upravit zadání</button>
                <button onClick={() => onApply(plan)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[14px] font-bold text-primary-foreground shadow-sm hover:brightness-105 sm:flex-none">
                  Vložit {plan.placements.length} prvků do scény <ArrowRight size={18} />
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
