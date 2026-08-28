import { useEffect, useRef, useState } from "react";

export type PresetChoice = { id: string; title: string; desc: string };

/**
 * Thin project-start launcher shown on first arrival. Answers three questions
 * for a new visitor: what the tool does, how to begin, what the outcome is.
 */
export function StartLauncher({
  presets,
  hasSaved,
  onBlank,
  onPreset,
  onOpenSaved,
  onDemo,
  onClose,
}: {
  presets: PresetChoice[];
  hasSaved: boolean;
  onBlank: () => void;
  onPreset: (id: string) => void;
  onOpenSaved: () => void;
  onDemo?: () => void;
  onClose: () => void;
}) {
  const [showPresets, setShowPresets] = useState(false);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    console.log("[StartLauncher] mount");
    return () => {
      window.removeEventListener("keydown", onKey);
      console.log("[StartLauncher] unmount");
    };
  }, [onClose]);

  console.log("[StartLauncher] render");
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm"
      style={{ zIndex: 2000000000 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="launcher-title"

    >
      <div className="glass-strong max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5 sm:p-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-lime-600">Stage Rig</p>
        <h1 id="launcher-title" className="mt-1 text-2xl font-bold leading-tight text-neutral-900 sm:text-3xl">
          Navrhni stage, zapoj systém, vyexportuj plán.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-neutral-600">
          Začni s prázdnou scénou nebo uprav ověřený preset. Stage Rig ti pomůže rozložit aparát,
          navrhnout kabeláž a připravit podklady pro crew.
        </p>

        {!showPresets ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              ref={firstRef}
              onClick={onBlank}
              className="min-h-20 rounded-xl border-2 border-lime-500 bg-lime-100 p-4 text-left transition hover:bg-lime-200"
            >
              <div className="text-sm font-bold text-neutral-900">Začít nový rig</div>
              <div className="mt-1 text-[12px] text-neutral-600">Prázdná stage se základními vodítky</div>
            </button>
            <button
              onClick={() => setShowPresets(true)}
              className="min-h-20 rounded-xl border border-neutral-300 bg-white p-4 text-left transition hover:border-lime-500"
            >
              <div className="text-sm font-bold text-neutral-900">Vybrat preset</div>
              <div className="mt-1 text-[12px] text-neutral-600">Rychlý start podle typu akce a systému</div>
            </button>
            <button
              onClick={onDemo}
              className="min-h-20 rounded-xl border border-sky-300 bg-sky-50 p-4 text-left transition hover:border-sky-500 hover:bg-sky-100"
            >
              <div className="text-sm font-bold text-sky-900">🎓 Demo návod</div>
              <div className="mt-1 text-[12px] text-sky-800">Ukázkový rig a krátký průvodce ovládáním</div>
            </button>
            <button
              onClick={onOpenSaved}
              disabled={!hasSaved}
              className="min-h-20 rounded-xl border border-neutral-300 bg-white p-4 text-left transition hover:border-lime-500 disabled:opacity-45"
            >
              <div className="text-sm font-bold text-neutral-900">Otevřít uložený rig</div>
              <div className="mt-1 text-[12px] text-neutral-600">
                {hasSaved ? "Pokračuj v rozpracovaném projektu" : "Zatím nemáš uložený projekt"}
              </div>
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => onPreset(p.id)}
                className="block min-h-16 w-full rounded-xl border border-neutral-300 bg-white p-3 text-left transition hover:border-lime-500"
              >
                <div className="text-sm font-bold text-neutral-900">{p.title}</div>
                <div className="mt-0.5 text-[12px] text-neutral-600">{p.desc}</div>
              </button>
            ))}
            <button
              onClick={() => setShowPresets(false)}
              className="min-h-10 rounded-lg px-3 text-[12px] font-semibold text-neutral-600 hover:text-neutral-900"
            >
              ← Zpět na výběr startu
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/70 pt-3">
          <p className="text-[11px] text-neutral-500">
            Postup: <b>Stavět</b> → <b>Zapojit</b> → <b>Kontrola</b> → <b>Export</b>
          </p>
          <button
            onClick={onClose}
            className="min-h-10 rounded-lg px-3 text-[12px] font-semibold text-neutral-600 hover:text-neutral-900"
          >
            Přeskočit a otevřít workspace
          </button>
        </div>
      </div>
    </div>
  );
}
