/* Read-only stránka sdíleného rigu: 3D / Půdorys / Nárys / Schéma, bez editace. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { decodeRig, type SharedRig } from "./shareLink";
import { PlanDrawing, SchemaDrawing, FrontDrawing, bomLines, CABLE_COLORS, CABLE_SHORT } from "./rigDrawings";
import { SharedScene3D, toDrawItems } from "./StageBuilder3D";

type Tab = "3d" | "plan" | "front" | "schema";
const TABS: { id: Tab; label: string }[] = [
  { id: "3d", label: "3D" }, { id: "plan", label: "Půdorys" }, { id: "front", label: "Nárys" }, { id: "schema", label: "Schéma" },
];

export default function SharedViewer() {
  const [rig, setRig] = useState<SharedRig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("3d");

  useEffect(() => {
    const code = new URLSearchParams(window.location.hash.slice(1)).get("r");
    if (!code) { setError("Odkaz neobsahuje žádný rig."); return; }
    decodeRig(code).then(setRig).catch(() => setError("Odkaz je poškozený nebo neúplný."));
  }, []);

  const items = useMemo(() => (rig?.items ?? []).map((it, i) => ({ id: String(i), kind: it.kind, pos: it.pos, label: it.label })), [rig]);
  const cables = useMemo(() => (rig?.cables ?? []).map((c) => ({ from: String(c.from), to: String(c.to), type: c.type })), [rig]);
  const draw = useMemo(() => toDrawItems(items), [items]);
  const bom = useMemo(() => bomLines(draw), [draw]);

  if (error) return (
    <main className="grid h-dvh place-items-center bg-neutral-100 p-6 text-center">
      <div><h1 className="text-xl font-black text-neutral-900">{error}</h1>
        <Link to="/" className="mt-3 inline-block rounded-xl bg-lime-500 px-4 py-2 font-bold text-neutral-950">Otevřít Stage Rig</Link></div>
    </main>
  );
  if (!rig) return <div className="grid h-dvh place-items-center bg-neutral-100 text-neutral-600">Načítám rig…</div>;

  return (
    <main className="flex h-dvh flex-col bg-neutral-100 text-neutral-900">
      <header className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2">
        <h1 className="mr-auto text-[15px] font-black">{rig.name || "Sdílený rig"}</h1>
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-600"><Eye size={12} /> Jen pro čtení</span>
        <nav role="tablist" aria-label="Pohled" className="flex gap-0.5 rounded-full bg-neutral-100 p-1">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`min-h-9 rounded-full px-3 text-[12px] font-bold ${tab === t.id ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-200"}`}>{t.label}</button>
          ))}
        </nav>
      </header>
      <div className="relative min-h-0 flex-1">
        {tab === "3d" && <SharedScene3D items={items} cables={cables} />}
        {tab === "plan" && <div className="h-full overflow-auto bg-white p-3"><PlanDrawing items={draw} cables={cables} className="h-full min-h-[400px] w-full" /></div>}
        {tab === "front" && <div className="h-full overflow-auto bg-white p-3"><FrontDrawing items={draw} className="h-full min-h-[300px] w-full" /></div>}
        {tab === "schema" && <div className="h-full overflow-auto bg-white p-3"><SchemaDrawing items={draw} cables={cables} className="w-full" /></div>}
        <div className="pointer-events-none absolute bottom-3 left-3 flex gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold shadow">
          {(Object.keys(CABLE_COLORS) as (keyof typeof CABLE_COLORS)[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ background: CABLE_COLORS[k] }} />{CABLE_SHORT[k]}</span>
          ))}
        </div>
      </div>
      <footer className="border-t border-neutral-200 bg-white px-3 py-2 text-[12px] text-neutral-600">
        {draw.length} prvků · {cables.length} kabelů · {Math.round(bom.reduce((s, l) => s + l.kg, 0))} kg
      </footer>
    </main>
  );
}
