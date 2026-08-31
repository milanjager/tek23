import { X, RotateCcw } from "lucide-react";
import {
  type CabinetStyle,
  DEFAULT_CABINET_STYLE,
  STYLE_PRESETS,
  STYLE_FIELDS,
} from "./cabinetStyle";

/* ============================================================
   Styl beden — globální barvy skříně, mřížky a rails.
   Změna se okamžitě promítne do celé 3D scény.
   ============================================================ */

export default function CabinetStylePanel({
  open,
  style,
  onChange,
  onClose,
}: {
  open: boolean;
  style: CabinetStyle;
  onChange: (s: CabinetStyle) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/20 bg-white/90 shadow-2xl backdrop-blur-xl dark:bg-neutral-900/90">
        <header className="flex items-center justify-between border-b border-black/10 px-3 py-2 dark:border-white/10">
          <b className="text-[13px] text-neutral-900 dark:text-neutral-100">🎨 Styl beden</b>
          <div className="flex gap-1">
            <button
              onClick={() => onChange({ ...DEFAULT_CABINET_STYLE })}
              className="flex items-center gap-1 rounded-lg border border-black/10 px-2 py-1 text-[11px] dark:border-white/15 dark:text-neutral-200"
            >
              <RotateCcw size={11} /> Výchozí
            </button>
            <button onClick={onClose} className="rounded-lg border border-black/10 px-2 py-1 dark:border-white/15 dark:text-neutral-200">
              <X size={13} />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-auto p-3">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Přednastavené styly</div>
            <div className="grid grid-cols-1 gap-1.5">
              {STYLE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onChange({ ...p.style })}
                  className="flex items-center gap-2 rounded-lg border border-black/10 bg-white/70 px-2 py-1.5 text-left text-[11px] text-neutral-800 hover:border-lime-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200"
                >
                  <span className="flex gap-0.5">
                    {[p.style.cabinet, p.style.grille, p.style.rails, p.style.chrome].map((c, i) => (
                      <span key={i} className="h-4 w-4 rounded-sm border border-black/20" style={{ background: c }} />
                    ))}
                  </span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Vlastní barvy</div>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 rounded-lg border border-black/10 bg-white/70 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
                  <input
                    type="color"
                    value={style[f.key]}
                    onChange={(e) => onChange({ ...style, [f.key]: e.target.value })}
                    className="h-6 w-8 cursor-pointer rounded border border-black/10 bg-transparent p-0"
                  />
                  <span className="truncate text-[11px] text-neutral-700 dark:text-neutral-300">{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
            Styl platí pro všechny bedny ve scéně (kromě těch s vlastní nahranou fotkou) a ukládá se do prohlížeče.
          </p>
        </div>
      </div>
    </div>
  );
}
