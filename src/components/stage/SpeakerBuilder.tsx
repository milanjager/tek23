import { useEffect, useState } from "react";
import { X, Trash2, Plus, Pencil } from "lucide-react";
import {
  type CustomSpeaker,
  type CustomShape,
  type CustomConnection,
  CONNECTION_LABELS,
  SHAPE_LABELS,
  newCustomSpeaker,
  customHint,
  chainImpedance,
  recommendWiring,
} from "./customSpeakers";

/* ============================================================
   Speaker Builder — create / edit custom PA cabinets
   ============================================================ */

const num = (v: string, fallback: number) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[10px] text-neutral-500">{hint}</span>}
    </label>
  );
}

const inputCls =
  "min-h-9 w-full rounded-lg border border-neutral-300 bg-white px-2 text-[12px] text-neutral-900 focus:border-lime-500 focus:outline-none";

export default function SpeakerBuilder({
  open,
  defs,
  editId,
  onClose,
  onSave,
  onDelete,
  onEdit,
  onPlace,
}: {
  open: boolean;
  defs: CustomSpeaker[];
  editId?: string | null;
  onClose: () => void;
  onSave: (def: CustomSpeaker) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string | null) => void;
  onPlace: (id: string) => void;
}) {
  const [draft, setDraft] = useState<CustomSpeaker>(() => newCustomSpeaker());
  const [ampMinOhm, setAmpMinOhm] = useState(4);

  useEffect(() => {
    if (!open) return;
    const existing = editId ? defs.find((d) => d.id === editId) : undefined;
    setDraft(existing ? { ...existing } : newCustomSpeaker());
  }, [open, editId, defs]);

  if (!open) return null;

  const set = <K extends keyof CustomSpeaker>(k: K, v: CustomSpeaker[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  const setSize = (i: 0 | 1 | 2, v: number) =>
    setDraft((d) => {
      const size = [...d.size] as [number, number, number];
      size[i] = Math.max(0.1, Math.min(4, v));
      return { ...d, size };
    });

  const isNew = !defs.some((d) => d.id === draft.id);
  const parallel2 = chainImpedance(draft.ohm, 2);
  const parallel4 = chainImpedance(draft.ohm, 4);

  return (
    <div
      className="fixed inset-0 z-[1000000050] flex items-end justify-center bg-neutral-950/50 p-0 backdrop-blur-sm md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Builder vlastního repra"
      onClick={onClose}
    >
      <div
        className="glass max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-neutral-200/70 shadow-2xl md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200/60 bg-white/80 px-3 py-2 backdrop-blur">
          <h2 className="text-sm font-bold text-neutral-900">
            🔧 Builder repro — {isNew ? "nová bedna" : "úprava"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Zavřít builder"
            className="rounded-full p-2 text-neutral-500 hover:bg-neutral-200/50 hover:text-neutral-900"
          >
            <X size={15} />
          </button>
        </div>

        <div className="grid gap-3 p-3 md:grid-cols-[1.4fr_1fr]">
          {/* --- Form --- */}
          <div className="space-y-2.5">
            <Field label="Název">
              <input className={inputCls} value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Typ skříně">
                <select
                  className={inputCls}
                  value={draft.shape}
                  onChange={(e) => set("shape", e.target.value as CustomShape)}
                >
                  {(Object.keys(SHAPE_LABELS) as CustomShape[]).map((s) => (
                    <option key={s} value={s}>{SHAPE_LABELS[s]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Osazení (drivery)" hint='např. 2×18" + 1×1,4"'>
                <input className={inputCls} value={draft.drivers} onChange={(e) => set("drivers", e.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Field label="Šířka (m)">
                <input className={inputCls} type="number" step="0.05" value={draft.size[0]}
                  onChange={(e) => setSize(0, num(e.target.value, draft.size[0]))} />
              </Field>
              <Field label="Výška (m)">
                <input className={inputCls} type="number" step="0.05" value={draft.size[1]}
                  onChange={(e) => setSize(1, num(e.target.value, draft.size[1]))} />
              </Field>
              <Field label="Hloubka (m)">
                <input className={inputCls} type="number" step="0.05" value={draft.size[2]}
                  onChange={(e) => setSize(2, num(e.target.value, draft.size[2]))} />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Field label="Výkon (W RMS)">
                <input className={inputCls} type="number" step="50" value={draft.powerW}
                  onChange={(e) => set("powerW", Math.max(0, num(e.target.value, draft.powerW)))} />
              </Field>
              <Field label="Impedance (Ω)">
                <select className={inputCls} value={draft.ohm}
                  onChange={(e) => set("ohm", num(e.target.value, draft.ohm))}>
                  {[2, 4, 8, 16].map((o) => <option key={o} value={o}>{o} Ω</option>)}
                </select>
              </Field>
              <Field label="SPL max (dB)">
                <input className={inputCls} type="number" step="1" value={draft.spl ?? ""}
                  onChange={(e) => set("spl", e.target.value === "" ? undefined : num(e.target.value, 0))} />
              </Field>
            </div>

            <Field label="Typ zapojení" hint="Určuje, jaké konektory bedna dostane a jak ji zapojí automat.">
              <select
                className={inputCls}
                value={draft.connection}
                onChange={(e) => set("connection", e.target.value as CustomConnection)}
              >
                {(Object.keys(CONNECTION_LABELS) as CustomConnection[]).map((c) => (
                  <option key={c} value={c}>{CONNECTION_LABELS[c]}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Hmotnost (kg)" hint="Nepovinné — jinak se odhadne z objemu.">
                <input className={inputCls} type="number" step="1" value={draft.weightKg ?? ""}
                  onChange={(e) => set("weightKg", e.target.value === "" ? undefined : num(e.target.value, 0))} />
              </Field>
              <Field label="Poznámka pro techniku">
                <input className={inputCls} value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>

            <div className="rounded-lg border border-lime-500/40 bg-lime-500/10 p-2 text-[11px] leading-relaxed text-neutral-700">
              <b>Zatížení zesilovače:</b> 1× = {draft.ohm} Ω · 2× paralelně = {parallel2} Ω · 4× paralelně = {parallel4} Ω.
              {parallel4 < 2 && " ⚠️ 4× paralelně jde pod 2 Ω — většina ampů to nedá."}
              {draft.connection === "active" && " Aktivní bedna se nezapojuje do zesilovače — jen 230V + XLR."}
            </div>

            {/* --- Doporučené zapojení stacku --- */}
            <div className="rounded-lg border border-neutral-300/70 bg-white/70 p-2">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <b className="text-[11px] text-neutral-900">🔌 Doporučené zapojení stacku</b>
                <label className="flex items-center gap-1 text-[10px] font-semibold text-neutral-600">
                  Zesilovač
                  <select
                    className="max-w-[190px] rounded border border-neutral-300 bg-white px-1.5 py-1 text-[10px] text-neutral-900"
                    value={amp.id}
                    onChange={(e) => setAmpId(e.target.value)}
                  >
                    {AMP_PROFILES.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} · min {a.minOhm} Ω</option>
                    ))}
                  </select>
                </label>

              </div>

              <div className="space-y-2">
                {[2, 4].map((n) => {
                  const rec = recommendWiring(draft, n, ampMinOhm);
                  return (
                    <div key={n} className="rounded-md border border-neutral-200 bg-white/80 p-1.5">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-neutral-900">{n}× stack</span>
                        <span className={`text-[10px] font-semibold ${rec.best ? "text-lime-700" : "text-red-600"}`}>
                          {rec.best ? `${rec.best.label} · ${rec.best.loadOhm ?? "—"} Ω` : "bez vhodné varianty"}
                        </span>
                      </div>
                      <table className="w-full text-left text-[10px] text-neutral-700">
                        <tbody>
                          {rec.options.map((o) => (
                            <tr
                              key={o.topology}
                              className={o === rec.best ? "bg-lime-500/15 font-semibold text-neutral-900" : ""}
                            >
                              <td className="py-0.5 pr-2 align-top">{o.ok ? "✅" : "⛔"}</td>
                              <td className="py-0.5 pr-2 align-top">{o.label}</td>
                              <td className="py-0.5 pr-2 align-top whitespace-nowrap">
                                {o.loadOhm === null ? "—" : `${o.loadOhm} Ω`}
                                {o.channels > 1 && ` / ${o.channels} kan.`}
                              </td>
                              <td className="py-0.5 align-top text-neutral-500">{o.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-1 text-[10px] text-neutral-600">{rec.summary}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* --- Kontrola kompatibility Ω × zesilovač --- */}
            <div
              className={`rounded-lg border p-2 ${
                compatWorst === "error"
                  ? "border-red-500/50 bg-red-500/10"
                  : compatWorst === "warn"
                    ? "border-amber-500/50 bg-amber-500/10"
                    : "border-emerald-500/40 bg-emerald-500/10"
              }`}
            >
              <div className="mb-1.5 text-[11px] font-bold text-neutral-900">
                {compatWorst === "error" ? "⛔ Nekompatibilní kombinace" : compatWorst === "warn" ? "⚠️ Kompatibilita s výhradami" : "✅ Kompatibilita v pořádku"}
                <span className="ml-1 font-medium text-neutral-600">— {draft.ohm} Ω / {CONNECTION_LABELS[draft.connection]} × {amp.name}</span>
              </div>
              <div className="space-y-1.5">
                {compat.map((rep) => (
                  <div key={rep.count} className="rounded-md border border-neutral-200/70 bg-white/70 p-1.5">
                    <div className="mb-0.5 text-[10px] font-bold text-neutral-900">
                      {rep.count}× stack paralelně → {rep.loadOhm === null ? "—" : `${rep.loadOhm} Ω`} na kanál
                    </div>
                    <ul className="space-y-0.5">
                      {rep.issues.map((iss, i) => (
                        <li key={i} className="text-[10px] leading-snug text-neutral-700">
                          <span>{iss.level === "error" ? "⛔" : iss.level === "warn" ? "⚠️" : "✅"} </span>
                          <b className="text-neutral-900">{iss.title}:</b> {iss.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>




            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => { onSave(draft); onClose(); }}
                className="min-h-10 rounded-lg bg-lime-500 px-3 text-[12px] font-bold text-neutral-950 hover:bg-lime-400"
              >
                {isNew ? "Vytvořit a přidat do palety" : "Uložit změny"}
              </button>
              <button
                onClick={() => { onSave(draft); onPlace(draft.id); onClose(); }}
                className="min-h-10 rounded-lg border border-neutral-300 bg-white px-3 text-[12px] font-semibold text-neutral-800 hover:border-lime-500"
              >
                Uložit a postavit na scénu
              </button>
              {!isNew && (
                <button
                  onClick={() => { onDelete(draft.id); onEdit(null); }}
                  className="min-h-10 rounded-lg border border-rose-300 bg-white px-3 text-[12px] font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={12} className="mr-1 inline" /> Smazat
                </button>
              )}
            </div>
          </div>

          {/* --- Saved list --- */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Moje bedny ({defs.length})</span>
              <button
                onClick={() => onEdit(null)}
                className="glass-chip rounded-full px-2 py-1 text-[10px] font-semibold text-neutral-700 hover:text-lime-600"
              >
                <Plus size={11} className="mr-0.5 inline" /> Nová
              </button>
            </div>
            {!defs.length && (
              <p className="rounded-lg border border-dashed border-neutral-300 p-3 text-[11px] text-neutral-500">
                Zatím žádné vlastní bedny. Vyplň parametry vlevo a ulož — objeví se v paletě v kategorii Zvuk.
              </p>
            )}
            {defs.map((d) => (
              <div
                key={d.id}
                className={`rounded-lg border p-2 ${d.id === draft.id ? "border-lime-500 bg-lime-500/10" : "border-neutral-200 bg-white/70"}`}
              >
                <div className="truncate text-[12px] font-bold text-neutral-900">{d.name}</div>
                <div className="truncate text-[10px] text-neutral-500">{customHint(d)}</div>
                <div className="text-[10px] text-neutral-500">
                  {d.size.map((v) => v.toFixed(2)).join(" × ")} m · {CONNECTION_LABELS[d.connection]}
                </div>
                <div className="mt-1 flex gap-1">
                  <button
                    onClick={() => onEdit(d.id)}
                    className="rounded border border-neutral-300 px-2 py-1 text-[10px] font-semibold text-neutral-700 hover:border-lime-500"
                  >
                    <Pencil size={10} className="mr-0.5 inline" /> Upravit
                  </button>
                  <button
                    onClick={() => { onPlace(d.id); onClose(); }}
                    className="rounded bg-neutral-900 px-2 py-1 text-[10px] font-semibold text-lime-300 hover:bg-neutral-800"
                  >
                    Postavit
                  </button>
                  <button
                    onClick={() => onDelete(d.id)}
                    aria-label={`Smazat ${d.name}`}
                    className="rounded border border-rose-300 px-2 py-1 text-[10px] text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
