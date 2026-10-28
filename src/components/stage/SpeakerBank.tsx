import { useMemo, useRef, useState } from "react";
import { X, Plus, Copy, Trash2, Pencil, Download, Upload } from "lucide-react";
import { type CustomSpeaker, customHint, SHAPE_LABELS } from "./customSpeakers";

/* ============================================================
   Banka beden — uložené vlastní modely.
   Nahraj jednou, používej pořád: vkládání do scény, duplikace,
   export/import celé banky do JSON.
   ============================================================ */

export default function SpeakerBank({
  open,
  defs,
  onClose,
  onPlace,
  onEdit,
  onDelete,
  onSave,
  onNew,
}: {
  open: boolean;
  defs: CustomSpeaker[];
  onClose: () => void;
  onPlace: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** Uloží / přepíše definici (používá se pro duplikaci a import). */
  onSave: (def: CustomSpeaker) => void;
  onNew: () => void;
}) {
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return defs;
    return defs.filter((d) =>
      [d.name, d.manufacturer, d.model, d.drivers, SHAPE_LABELS[d.shape]]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [defs, q]);

  if (!open) return null;

  const duplicate = (d: CustomSpeaker) => {
    onSave({ ...d, id: `custom_${Math.random().toString(36).slice(2, 9)}`, name: `${d.name} (kopie)` });
    setMsg(`Zkopírováno: ${d.name}`);
  };

  const exportBank = () => {
    const blob = new Blob([JSON.stringify(defs, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "banka-beden.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importBank = async (file: File) => {
    try {
      const arr = JSON.parse(await file.text());
      if (!Array.isArray(arr)) throw new Error("Neplatný soubor.");
      let n = 0;
      for (const d of arr) {
        if (d && typeof d.id === "string" && Array.isArray(d.size)) {
          onSave({ ...d, id: defs.some((x) => x.id === d.id) ? `custom_${Math.random().toString(36).slice(2, 9)}` : d.id });
          n++;
        }
      }
      setMsg(`Naimportováno ${n} beden.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Import selhal.");
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white/90 shadow-2xl backdrop-blur-xl dark:bg-neutral-900/90">
        <header className="flex items-center justify-between gap-2 border-b border-black/10 px-3 py-2 dark:border-white/10">
          <b className="text-[13px] text-neutral-900 dark:text-neutral-100">🎛️ Banka beden ({defs.length})</b>
          <div className="flex items-center gap-1">
            <button onClick={onNew} className="flex items-center gap-1 rounded-lg bg-lime-500 px-2 py-1 text-[11px] font-bold text-black">
              <Plus size={12} /> Nová
            </button>
            <button onClick={exportBank} title="Export banky" className="rounded-lg border border-black/10 px-2 py-1 text-[11px] dark:border-white/15 dark:text-neutral-200">
              <Download size={12} />
            </button>
            <button onClick={() => fileRef.current?.click()} title="Import banky" className="rounded-lg border border-black/10 px-2 py-1 text-[11px] dark:border-white/15 dark:text-neutral-200">
              <Upload size={12} />
            </button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void importBank(f); e.target.value = ""; }} />
            <button onClick={onClose} className="rounded-lg border border-black/10 px-2 py-1 dark:border-white/15 dark:text-neutral-200"><X size={13} /></button>
          </div>
        </header>

        <div className="border-b border-black/10 px-3 py-2 dark:border-white/10">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hledat podle názvu, výrobce nebo driverů…"
            className="min-h-8 w-full rounded-lg border border-neutral-300 bg-white px-2 text-[12px] text-neutral-900 focus:border-lime-500 focus:outline-none dark:border-white/15 dark:bg-neutral-800 dark:text-neutral-100"
          />
          {msg && <div className="mt-1 text-[10px] text-lime-700 dark:text-lime-400">{msg}</div>}
        </div>

        <div className="grid flex-1 gap-2 overflow-auto p-3 sm:grid-cols-2">
          {list.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-black/15 p-6 text-center text-[12px] text-neutral-500 dark:border-white/15">
              Zatím tu nic není. Vytvoř bednu tlačítkem <b>Nová</b> — uloží se sem a půjde vkládat opakovaně.
            </div>
          )}
          {list.map((d) => (
            <div key={d.id} className="flex gap-2 rounded-xl border border-black/10 bg-white/70 p-2 dark:border-white/10 dark:bg-white/5">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-black/10 bg-neutral-900 dark:border-white/10">
                {d.textures?.front ? (
                  <img src={d.textures.front} alt={d.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">{SHAPE_LABELS[d.shape]}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-bold text-neutral-900 dark:text-neutral-100">{d.name}</div>
                <div className="truncate text-[10px] text-neutral-500 dark:text-neutral-400">{customHint(d)}</div>
                <div className="truncate text-[10px] text-neutral-500 dark:text-neutral-400">
                  {[d.manufacturer, d.model, d.year].filter(Boolean).join(" · ") || "bez evidence"}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button onClick={() => onPlace(d.id)} className="rounded-md bg-lime-500 px-2 py-0.5 text-[10px] font-bold text-black">Vložit</button>
                  <button onClick={() => onEdit(d.id)} className="rounded-md border border-black/10 px-2 py-0.5 text-[10px] dark:border-white/15 dark:text-neutral-200"><Pencil size={10} /></button>
                  <button onClick={() => duplicate(d)} className="rounded-md border border-black/10 px-2 py-0.5 text-[10px] dark:border-white/15 dark:text-neutral-200"><Copy size={10} /></button>
                  <button onClick={() => onDelete(d.id)} className="rounded-md border border-red-300 px-2 py-0.5 text-[10px] text-red-600"><Trash2 size={10} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
