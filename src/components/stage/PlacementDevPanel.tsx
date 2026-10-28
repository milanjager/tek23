import { useEffect, useState } from "react";
import {
  PLACEMENT_TUNING,
  DEFAULT_TUNING,
  setPlacementTuning,
  resetPlacementTuning,
  type PlacementTuning,
} from "./placement";

const FIELDS: Array<{
  key: keyof PlacementTuning;
  label: string;
  min: number;
  max: number;
  step: number;
  help: string;
}> = [
  { key: "gridStep", label: "Grid step", min: 0.01, max: 0.5, step: 0.01, help: "XZ snap krok (m)" },
  { key: "stackOverlapMin", label: "Stack overlap min", min: 0, max: 0.2, step: 0.005, help: "min. překryv pro sednutí na vrch (m)" },
  { key: "stackTopTolerance", label: "Stack top tol.", min: 0, max: 0.2, step: 0.005, help: "tolerance rozdílu top (m)" },
  { key: "stackCenterFactor", label: "Stack center f.", min: 0, max: 1.5, step: 0.05, help: "poměr half-footprintu pro centering" },
  { key: "collisionXZMin", label: "Coll. XZ min", min: 0, max: 0.3, step: 0.005, help: "min. XZ překryv pro kolizi (m)" },
  { key: "collisionVerticalMin", label: "Coll. Y min", min: 0, max: 0.3, step: 0.005, help: "min. svislý překryv pro kolizi (m)" },
  { key: "stackSnapRadiusFactor", label: "Snap radius f.", min: 0, max: 1.5, step: 0.05, help: "magnet. poloměr (poměr half)" },
  { key: "stackSnapLiftFactor", label: "Snap lift f.", min: 0, max: 1, step: 0.05, help: "kolik zvednout (poměr výšky)" },
  { key: "stackSnapTopTie", label: "Snap top tie", min: 0, max: 0.1, step: 0.005, help: "tolerance shodných topů (m)" },
  { key: "buriedY", label: "Buried Y", min: -0.5, max: 0.1, step: 0.01, help: "Y pod = zahrabaná (m)" },
];

export function PlacementDevPanel() {
  const [open, setOpen] = useState(false);
  // Bump to force re-render of the input values (PLACEMENT_TUNING is mutable).
  const [, tick] = useState(0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Placement dev panel (Ctrl+Shift+D)"
        className="fixed bottom-3 right-3 z-[60] rounded-full bg-neutral-900/80 px-3 py-1.5 text-[11px] font-mono text-cyan-300 shadow-lg backdrop-blur hover:bg-neutral-900"
      >
        ⚙ dev
      </button>
    );
  }

  const update = (k: keyof PlacementTuning, v: number) => {
    setPlacementTuning({ [k]: v } as Partial<PlacementTuning>);
    tick((n) => n + 1);
  };

  return (
    <div className="fixed bottom-3 right-3 z-[60] w-[300px] rounded-lg border border-cyan-500/30 bg-neutral-950/90 p-3 text-[11px] text-neutral-100 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-mono text-cyan-300">⚙ Placement tuning</div>
        <div className="flex gap-1">
          <button
            onClick={() => { resetPlacementTuning(); tick((n) => n + 1); }}
            className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-neutral-700"
          >
            reset
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-neutral-700"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="mb-2 text-[10px] text-neutral-500">Ctrl+Shift+D · živě, bez reloadu</div>
      <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
        {FIELDS.map((f) => {
          const val = PLACEMENT_TUNING[f.key] as number;
          const isDefault = val === DEFAULT_TUNING[f.key];
          return (
            <div key={f.key}>
              <div className="flex items-baseline justify-between">
                <label className="font-mono text-[10px] text-neutral-300" title={f.help}>
                  {f.label}
                </label>
                <span className={`font-mono text-[10px] ${isDefault ? "text-neutral-500" : "text-cyan-300"}`}>
                  {val.toFixed(3)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={val}
                  onChange={(e) => update(f.key, parseFloat(e.target.value))}
                  className="flex-1 accent-cyan-400"
                />
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={val}
                  onChange={(e) => update(f.key, parseFloat(e.target.value) || 0)}
                  className="w-16 rounded bg-neutral-800 px-1 py-0.5 font-mono text-[10px] text-neutral-100"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
