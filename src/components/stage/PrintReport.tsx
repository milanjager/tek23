import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer } from "lucide-react";
import type { CustomSheet } from "./customSpeakers";

/* ============================================================
   Tisknutelný report: BOM + wiring checklist + doporučené nastavení.
   Overlay se `@media print` pravidly — „Tisk / PDF" volá window.print()
   a prohlížeč nabídne Uložit jako PDF.
   ============================================================ */

export interface BomRow {
  kind: string;
  label: string;
  category: string;
  count: number;
  size: string;
  kgEach: number;
  kgTotal: number;
  powerW: number;
}

export interface ChecklistRow {
  index: number;
  group: string;      // "Napájení" / "DMX" / ...
  color: string;
  cableId: string;
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
  load?: string;      // "1 850 W"
  warn?: string;      // "PŘETÍŽENO"
}

export interface PrintReportProps {
  title: string;
  items: number;
  stats: { kg: number; kw: number; speakers: number; cables: number };
  bom: BomRow[];
  checklist: ChecklistRow[];
  settings: { label: string; value: string }[];
  notes: { label: string; text: string }[];
  /** Technické listy vlastních beden použitých v návrhu. */
  sheets?: CustomSheet[];
  onClose: () => void;
}

const CAT_CS: Record<string, string> = {
  sound: "Zvuk",
  lights: "Světla",
  infra: "Infrastruktura",
};

export default function PrintReport({
  title, items, stats, bom, checklist, settings, notes, sheets, onClose,
}: PrintReportProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const today = new Date().toLocaleString("cs-CZ");

  if (typeof document === "undefined") return null;

  return createPortal(
    <div id="print-report-root" className="fixed inset-0 z-[300] overflow-auto bg-neutral-800/70 animate-in fade-in duration-150 print:static print:overflow-visible print:bg-white">
      <style>{`
        @page { size: A4 portrait; margin: 14mm 12mm; }
        @media print {
          /* Celou aplikaci z tisku úplně odstranit (display:none, ne jen
             visibility) — jinak její layout boxy vytvoří prázdné úvodní strany. */
          body > *:not(#print-report-root) { display: none !important; }
          html, body { position: static !important; height: auto !important; overflow: visible !important; }
          #print-report-root { position: static !important; inset: auto !important; overflow: visible !important; background: #fff !important; }
          #print-report { position: static !important; box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: none !important; overflow: visible !important; }
          .no-print { display: none !important; }
          .page-break { break-before: page; }
          tr, .avoid-break { break-inside: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>

      {/* Ovládání (netiskne se) */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 bg-neutral-900 px-4 py-2 text-white">
        <div className="text-sm font-semibold">Tiskový výstup — checklist zapojení a BOM</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded bg-lime-500 px-3 py-1.5 text-xs font-bold text-neutral-900 hover:bg-lime-400"
          >
            <Printer size={14} /> Tisk / uložit PDF
          </button>
          <button
            onClick={onClose}
            aria-label="Zavřít tiskový výstup"
            className="rounded bg-white/10 p-1.5 hover:bg-white/20"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div
        id="print-report"
        data-walkthrough="print-report"
        className="mx-auto my-6 max-w-[210mm] bg-white p-8 text-[11px] leading-snug text-neutral-900 shadow-2xl print:my-0 print:p-0 print:shadow-none"
      >
        {/* Hlavička */}
        <header className="avoid-break mb-4 border-b-2 border-neutral-900 pb-3">
          <h1 className="text-xl font-black tracking-tight">{title}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-neutral-600">
            <span>Vygenerováno: {today}</span>
            <span>Komponent: <b className="text-neutral-900">{items}</b></span>
            <span>Kabelů: <b className="text-neutral-900">{stats.cables}</b></span>
            <span>Reproboxů: <b className="text-neutral-900">{stats.speakers}</b></span>
            <span>Hmotnost: <b className="text-neutral-900">{Math.round(stats.kg)} kg</b></span>
            <span>Příkon: <b className="text-neutral-900">{stats.kw.toFixed(2)} kW</b></span>
          </div>
        </header>

        {/* BOM */}
        <section className="mb-5">
          <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wide">1 · Seznam komponent (BOM)</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-neutral-100 text-left text-[10px] uppercase tracking-wide text-neutral-600">
                <th className="border border-neutral-300 px-1.5 py-1 w-8">✓</th>
                <th className="border border-neutral-300 px-1.5 py-1">Komponenta</th>
                <th className="border border-neutral-300 px-1.5 py-1">Kategorie</th>
                <th className="border border-neutral-300 px-1.5 py-1 text-right">Ks</th>
                <th className="border border-neutral-300 px-1.5 py-1">Rozměr (m)</th>
                <th className="border border-neutral-300 px-1.5 py-1 text-right">kg/ks</th>
                <th className="border border-neutral-300 px-1.5 py-1 text-right">kg celkem</th>
                <th className="border border-neutral-300 px-1.5 py-1 text-right">Příkon W</th>
              </tr>
            </thead>
            <tbody>
              {bom.map((r) => (
                <tr key={r.kind}>
                  <td className="border border-neutral-300 px-1.5 py-1 text-center text-neutral-400">☐</td>
                  <td className="border border-neutral-300 px-1.5 py-1 font-semibold">{r.label}</td>
                  <td className="border border-neutral-300 px-1.5 py-1">{CAT_CS[r.category] ?? r.category}</td>
                  <td className="border border-neutral-300 px-1.5 py-1 text-right font-mono">{r.count}</td>
                  <td className="border border-neutral-300 px-1.5 py-1 font-mono text-[10px]">{r.size}</td>
                  <td className="border border-neutral-300 px-1.5 py-1 text-right font-mono">{r.kgEach}</td>
                  <td className="border border-neutral-300 px-1.5 py-1 text-right font-mono">{r.kgTotal}</td>
                  <td className="border border-neutral-300 px-1.5 py-1 text-right font-mono">{r.powerW || "—"}</td>
                </tr>
              ))}
              {bom.length === 0 && (
                <tr><td colSpan={8} className="border border-neutral-300 px-1.5 py-2 text-center text-neutral-500">Scéna je prázdná.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-100 font-bold">
                <td className="border border-neutral-300 px-1.5 py-1" />
                <td className="border border-neutral-300 px-1.5 py-1" colSpan={2}>Celkem</td>
                <td className="border border-neutral-300 px-1.5 py-1 text-right font-mono">{bom.reduce((s, r) => s + r.count, 0)}</td>
                <td className="border border-neutral-300 px-1.5 py-1" colSpan={2} />
                <td className="border border-neutral-300 px-1.5 py-1 text-right font-mono">{Math.round(stats.kg)}</td>
                <td className="border border-neutral-300 px-1.5 py-1 text-right font-mono">{Math.round(stats.kw * 1000)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Checklist zapojení */}
        <section className="mb-5">
          <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wide">2 · Checklist zapojení</h2>
          <p className="mb-1.5 text-[10px] text-neutral-600">
            Pořadí: napájení → DMX → signál → repro. Odškrtávej po fyzickém zapojení a zkoušce.
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-neutral-100 text-left text-[10px] uppercase tracking-wide text-neutral-600">
                <th className="border border-neutral-300 px-1.5 py-1 w-8">✓</th>
                <th className="border border-neutral-300 px-1.5 py-1 w-8">#</th>
                <th className="border border-neutral-300 px-1.5 py-1">Typ</th>
                <th className="border border-neutral-300 px-1.5 py-1">Z (OUT)</th>
                <th className="border border-neutral-300 px-1.5 py-1">Do (IN)</th>
                <th className="border border-neutral-300 px-1.5 py-1 text-right">Zátěž</th>
              </tr>
            </thead>
            <tbody>
              {checklist.map((r) => (
                <tr key={r.cableId} className={r.warn ? "bg-red-50" : undefined}>
                  <td className="border border-neutral-300 px-1.5 py-1 text-center text-neutral-400">☐</td>
                  <td className="border border-neutral-300 px-1.5 py-1 text-right font-mono">{r.index}</td>
                  <td className="border border-neutral-300 px-1.5 py-1">
                    <span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ background: r.color }} />{" "}
                    {r.group}
                  </td>
                  <td className="border border-neutral-300 px-1.5 py-1">
                    <b>{r.from}</b>
                    <div className="font-mono text-[9px] text-neutral-500">{r.fromPort}</div>
                  </td>
                  <td className="border border-neutral-300 px-1.5 py-1">
                    <b>{r.to}</b>
                    <div className="font-mono text-[9px] text-neutral-500">{r.toPort}</div>
                  </td>
                  <td className="border border-neutral-300 px-1.5 py-1 text-right font-mono">
                    {r.load ?? "—"}
                    {r.warn && <div className="text-[9px] font-bold text-red-600">⚠ {r.warn}</div>}
                  </td>
                </tr>
              ))}
              {checklist.length === 0 && (
                <tr><td colSpan={6} className="border border-neutral-300 px-1.5 py-2 text-center text-neutral-500">Žádné kabely — spusť automatické zapojení.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Doporučené nastavení */}
        <section className="avoid-break mb-5">
          <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wide">3 · Doporučené nastavení</h2>
          <table className="w-full border-collapse">
            <tbody>
              {settings.map((s) => (
                <tr key={s.label}>
                  <td className="w-1/3 border border-neutral-300 bg-neutral-50 px-1.5 py-1 font-semibold">{s.label}</td>
                  <td className="border border-neutral-300 px-1.5 py-1">{s.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Poznámky ke komponentám */}
        {notes.length > 0 && (
          <section className="avoid-break mb-4">
            <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wide">4 · Poznámky ke komponentám</h2>
            <ul className="space-y-0.5">
              {notes.map((n, i) => (
                <li key={i} className="border-l-2 border-neutral-300 pl-2">
                  <b>{n.label}:</b> {n.text}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Technické listy vlastních beden */}
        {sheets && sheets.length > 0 && (
          <section className="avoid-break mb-4">
            <h2 className="mb-1.5 text-sm font-bold uppercase tracking-wide">5 · Technické listy vlastních beden</h2>
            <div className="space-y-2">
              {sheets.map((s) => (
                <div key={s.id} className="avoid-break border border-neutral-300 p-2">
                  <div className="mb-1 font-bold">{s.name}</div>
                  <table className="w-full">
                    <tbody>
                      {[
                        ["Výrobce", s.manufacturer], ["Typ / model", s.model],
                        ["Rok", s.year], ["Sériové číslo", s.serial],
                        ["Osazení", s.drivers], ["Výkon", s.power],
                        ["Impedance", s.ohm], ["Zapojení", s.connection],
                        ["Rozměry (š×v×h)", s.size], ["Hmotnost", s.weight],
                      ].map(([k, v]) => (
                        <tr key={k} className="border-b border-neutral-200 last:border-0">
                          <td className="w-40 py-0.5 pr-2 text-neutral-500">{k}</td>
                          <td className="py-0.5">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {s.notes && <div className="mt-1 text-[9px] text-neutral-600">Poznámka: {s.notes}</div>}
                </div>
              ))}
            </div>
          </section>
        )}



        <footer className="mt-6 border-t border-neutral-300 pt-2 text-[9px] text-neutral-500">
          Vygenerováno ze Stage Rig návrhu · zkontroluj proudové jištění a impedanci před zapnutím zesilovačů.
        </footer>
      </div>
    </div>,
    document.body,
  );
}
