/* Krok 3 „Spec“: vlevo co patří do dokumentu, uprostřed živý náhled A4, vpravo exporty. */
import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Image as ImageIcon, Table, Truck, Link2, Check, Printer } from "lucide-react";
import {
  FrontDrawing, PlanDrawing, SchemaDrawing, bomLines, svgToPng, downloadBlob, toCsv,
  type DrawItem, type DrawCable,
} from "./rigDrawings";

type SectionId = "front" | "plan" | "schema" | "bom" | "power" | "contact" | "logo";
const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "front", label: "Nárys" },
  { id: "plan", label: "Půdorys" },
  { id: "schema", label: "Schéma zapojení" },
  { id: "bom", label: "Soupiska" },
  { id: "power", label: "Příkon a jištění" },
  { id: "contact", label: "Kontakt" },
  { id: "logo", label: "Logo" },
];
const BRANCH_W = 3680;
const PREFS_KEY = "stage.spec.v1";
const fmtKw = (w: number) => (w / 1000).toFixed(1).replace(".", ",");

interface Props {
  rigName: string;
  items: DrawItem[];
  cables: DrawCable[];
  power: { loadW: number; capacityW: number };
  /** Vytvoří read-only odkaz (async — komprese). */
  makeShareUrl: () => Promise<string>;
}

export default function SpecStudio({ rigName, items, cables, power, makeShareUrl }: Props) {
  const [on, setOn] = useState<Record<SectionId, boolean>>({ front: true, plan: true, schema: true, bom: true, power: true, contact: false, logo: false });
  const [contact, setContact] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const planRef = useRef<SVGSVGElement>(null);
  const date = useMemo(() => new Date().toLocaleDateString("cs-CZ"), []);

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      if (p.on) setOn((o) => ({ ...o, ...p.on }));
      if (typeof p.contact === "string") setContact(p.contact);
      if (typeof p.logo === "string") setLogo(p.logo);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ on, contact, logo })); } catch { /* ignore */ }
  }, [on, contact, logo]);

  const bom = useMemo(() => bomLines(items), [items]);
  const totals = useMemo(() => ({
    boxes: items.filter((i) => i.category === "sound").length,
    kg: Math.round(items.reduce((s, i) => s + i.weightKg, 0)),
    w: items.reduce((s, i) => s + i.peakW, 0),
  }), [items]);
  const branches = Math.max(1, Math.ceil(power.loadW / BRANCH_W));
  const name = rigName || "Rig bez názvu";
  const slug = (name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "rig").slice(0, 40);

  const printPdf = () => {
    // Kopie listu přímo do <body>, aby tisk nebyl ořezaný rodičovskými kontejnery.
    const sheet = document.getElementById("techrider-sheet");
    if (!sheet) return;
    const clone = document.createElement("div");
    clone.id = "techrider-print-clone";
    clone.innerHTML = sheet.outerHTML.replace('id="techrider-sheet"', "");
    document.body.appendChild(clone);
    document.body.classList.add("print-techrider");
    const done = () => { document.body.classList.remove("print-techrider"); clone.remove(); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
  };
  const exportPng = async () => { if (planRef.current) downloadBlob(await svgToPng(planRef.current), `${slug}-pudorys.png`); };
  const exportBom = () => downloadBlob(new Blob([toCsv([
    ["Bedna", "Ks", "Kg", "W"],
    ...bom.map((l) => [l.name, l.count, Math.round(l.kg), Math.round(l.w)]),
    ["Celkem", items.length, totals.kg, Math.round(totals.w)],
  ])], { type: "text/csv;charset=utf-8" }), `${slug}-soupiska.csv`);
  const exportLoad = () => {
    // Nakládací list: nejtěžší kusy první (k přední stěně dodávky), průběžná hmotnost.
    let run = 0;
    const rows = bom.map((l, i) => { run += l.kg; return [i + 1, l.name, l.count, Math.round(l.kg / l.count), Math.round(l.kg), Math.round(run), ""]; });
    downloadBlob(new Blob([toCsv([
      [`Nakládací list — ${name} — ${date}`],
      ["Pořadí", "Položka", "Ks", "Kg/ks", "Kg celkem", "Kg průběžně", "Naloženo ✓"],
      ...rows,
      ["", "Celkem", items.length, "", totals.kg, "", ""],
    ])], { type: "text/csv;charset=utf-8" }), `${slug}-nakladaci-list.csv`);
  };
  const share = async () => {
    const url = shareUrl ?? await makeShareUrl();
    setShareUrl(url);
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* user can copy manually */ }
  };

  const btn = "flex min-h-11 w-full items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-left text-[13px] font-semibold text-neutral-900 hover:border-lime-500 hover:bg-lime-50 disabled:opacity-40";

  return (
    <div className="absolute inset-0 z-30 flex flex-col gap-3 overflow-y-auto bg-neutral-100 p-3 md:flex-row md:overflow-hidden">
      {/* Vlevo: obsah dokumentu */}
      <section aria-label="Obsah dokumentu" className="glass-strong shrink-0 rounded-2xl p-3 md:w-56 md:overflow-y-auto">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Do dokumentu</h2>
        <div className="space-y-1">
          {SECTIONS.map((s) => (
            <label key={s.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-1 text-[13px] text-neutral-800 hover:bg-white/60">
              <input type="checkbox" checked={on[s.id]} onChange={(e) => setOn((o) => ({ ...o, [s.id]: e.target.checked }))} className="h-4 w-4 accent-lime-500" />
              {s.label}
            </label>
          ))}
        </div>
        {on.contact && (
          <textarea value={contact} onChange={(e) => setContact(e.target.value)} rows={3} placeholder="Jméno, telefon, e-mail technika"
            className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-[12px] text-neutral-900" aria-label="Kontakt" />
        )}
        {on.logo && (
          <label className="mt-2 block text-[12px] text-neutral-700">
            <span className="mb-1 block font-semibold">Logo</span>
            <input type="file" accept="image/*" onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const r = new FileReader(); r.onload = () => setLogo(String(r.result)); r.readAsDataURL(f);
            }} className="w-full text-[11px]" />
          </label>
        )}
      </section>

      {/* Uprostřed: živý náhled A4 */}
      <section aria-label="Náhled A4" className="flex min-h-0 flex-1 justify-center md:overflow-y-auto">
        <article id="techrider-sheet" className="w-full max-w-[794px] bg-white p-8 text-neutral-900 shadow-xl" style={{ aspectRatio: "210 / 297", height: "auto", minHeight: 0, colorScheme: "light" }}>
          <header className="flex items-start justify-between border-b-2 border-neutral-900 pb-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Techrider</div>
              <h1 className="text-2xl font-black leading-tight">{name}</h1>
              <div className="text-[12px] text-neutral-600">{date}</div>
            </div>
            {on.logo && logo && <img src={logo} alt="Logo" className="max-h-14 max-w-32 object-contain" />}
          </header>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              ["Beden", String(totals.boxes)],
              ["Hmotnost", `${totals.kg} kg`],
              ["Příkon", `${fmtKw(power.loadW)} kW`],
              ["Kabelů", String(cables.length)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-neutral-300 p-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">{l}</div>
                <div className="text-lg font-black">{v}</div>
              </div>
            ))}
          </div>

          {(on.front || on.plan) && (
            <div className={`mt-3 grid gap-3 ${on.front && on.plan ? "grid-cols-2" : "grid-cols-1"}`}>
              {on.front && <figure className="break-inside-avoid"><figcaption className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Nárys</figcaption><FrontDrawing items={items} className="h-44 w-full border border-neutral-200" /></figure>}
              {on.plan && <figure className="break-inside-avoid"><figcaption className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Půdorys</figcaption><PlanDrawing items={items} cables={cables} className="h-44 w-full border border-neutral-200" /></figure>}
            </div>
          )}
          {on.schema && (
            <figure className="mt-3 break-inside-avoid">
              <figcaption className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Schéma zapojení</figcaption>
              <SchemaDrawing items={items} cables={cables} className="max-h-72 w-full border border-neutral-200" />
            </figure>
          )}
          {on.bom && (
            <table className="mt-3 w-full border-collapse text-[11px]">
              <thead><tr className="border-b-2 border-neutral-900 text-left"><th className="py-1">Bedna</th><th className="text-right">ks</th><th className="text-right">kg</th><th className="text-right">W</th></tr></thead>
              <tbody>
                {bom.map((l) => (
                  <tr key={l.name} className="break-inside-avoid border-b border-neutral-200"><td className="py-0.5">{l.name}</td><td className="text-right">{l.count}</td><td className="text-right">{Math.round(l.kg)}</td><td className="text-right">{Math.round(l.w)}</td></tr>
                ))}
                <tr className="border-t-2 border-neutral-900 font-bold"><td className="py-1">Celkem</td><td className="text-right">{items.length}</td><td className="text-right">{totals.kg}</td><td className="text-right">{Math.round(totals.w)}</td></tr>
              </tbody>
            </table>
          )}
          {on.power && (
            <div className="mt-3 break-inside-avoid rounded-lg border border-neutral-300 p-2 text-[11px]">
              <b>Příkon a jištění:</b> špička {fmtKw(power.loadW)} kW z {fmtKw(power.capacityW)} kW agregátu · min. {branches}× větev 16 A (230 V, {BRANCH_W} W) · každý zesilovač na vlastní jistič.
            </div>
          )}
          {on.contact && contact && (
            <div className="mt-3 whitespace-pre-line break-inside-avoid text-[11px]"><b>Kontakt:</b> {contact}</div>
          )}
        </article>
      </section>

      {/* Vpravo: exporty */}
      <section aria-label="Exporty" className="glass-strong shrink-0 space-y-2 rounded-2xl p-3 md:w-60 md:overflow-y-auto">
        <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Exporty</h2>
        <button onClick={printPdf} disabled={!items.length} className={`${btn} border-lime-500 bg-lime-500 hover:bg-lime-400`}><FileDown size={16} /> Techrider (PDF)</button>
        <p className="px-1 text-[11px] text-neutral-500">V tiskovém okně zvol „Uložit jako PDF“.</p>
        <button onClick={exportPng} disabled={!items.length} className={btn}><ImageIcon size={16} /> Půdorys (PNG)</button>
        <button onClick={exportBom} disabled={!items.length} className={btn}><Table size={16} /> Soupiska (CSV)</button>
        <button onClick={exportLoad} disabled={!items.length} className={btn}><Truck size={16} /> Nakládací list</button>
        <button onClick={printPdf} disabled={!items.length} className={btn}><Printer size={16} /> Tisk</button>

        <div className="border-t border-neutral-200 pt-2">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Sdílet s crew</h2>
          <button onClick={share} disabled={!items.length} className={btn}>{copied ? <Check size={16} className="text-lime-600" /> : <Link2 size={16} />} {copied ? "Odkaz zkopírován" : "Zkopírovat odkaz"}</button>
          {shareUrl && (
            <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Odkaz jen pro čtení" className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1 font-mono text-[10px] text-neutral-700" />
          )}
          <p className="mt-1 px-1 text-[11px] text-neutral-500">Crew uvidí 3D, půdorys i schéma, ale nemůže nic měnit.</p>
        </div>
      </section>

      {/* Skrytý velký půdorys pro PNG export */}
      <div aria-hidden className="pointer-events-none absolute -left-[9999px] top-0 h-[800px] w-[1200px]">
        <PlanDrawing ref={planRef} items={items} cables={cables} className="h-full w-full" />
      </div>
    </div>
  );
}
