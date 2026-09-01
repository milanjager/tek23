import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Rocket, Sparkles } from "lucide-react";

export type PresetChoice = { id: string; title: string; desc: string };

/**
 * Startovní obrazovka jako začátek herní cesty:
 * jedna hlavní akce, jasná odměna, ostatní volby schované o úroveň níž.
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
  const [screen, setScreen] = useState<"home" | "presets">("home");
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      style={{ zIndex: 2000000000 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="launcher-title"
    >
      <div className="glass-strong max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 shadow-2xl animate-fade-in sm:rounded-3xl sm:p-7">
        {screen === "home" ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-400 px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-neutral-950">
              <Sparkles size={12} /> Level 1 · Nováček
            </span>
            <h1 id="launcher-title" className="mt-3 text-[26px] font-extrabold leading-tight text-neutral-900 sm:text-3xl">
              Postav si vlastní zvukovou stěnu.
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Šest úkolů. Od první bedny až po hotový plán pro crew. Postup vidíš pořád dole na obrazovce.
            </p>

            {/* Jediné hlavní CTA */}
            <button
              ref={firstRef}
              onClick={onDemo}
              className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-lime-500 p-4 text-left shadow-lg transition hover:scale-[1.01] hover:bg-lime-400"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-lime-400">
                <Rocket size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-black text-neutral-950">Začít cestu</span>
                <span className="block text-[12px] font-semibold text-neutral-800">
                  Provedu tě krok za krokem · +50 XP za první krok
                </span>
              </span>
            </button>

            <div className="mt-4 grid gap-2">
              <button
                onClick={onBlank}
                className="min-h-14 rounded-2xl border border-neutral-300 bg-white/80 px-4 text-left text-[13px] font-bold text-neutral-800 transition hover:border-lime-500"
              >
                Stavět od nuly
                <span className="block text-[11px] font-medium text-neutral-500">Prázdná scéna, plná volnost</span>
              </button>
              <button
                onClick={() => setScreen("presets")}
                className="min-h-14 rounded-2xl border border-neutral-300 bg-white/80 px-4 text-left text-[13px] font-bold text-neutral-800 transition hover:border-lime-500"
              >
                Načíst hotovou stage
                <span className="block text-[11px] font-medium text-neutral-500">Ověřené sestavy pro rychlý start</span>
              </button>
              {hasSaved && (
                <button
                  onClick={onOpenSaved}
                  className="min-h-14 rounded-2xl border border-neutral-300 bg-white/80 px-4 text-left text-[13px] font-bold text-neutral-800 transition hover:border-lime-500"
                >
                  Pokračovat v projektu
                  <span className="block text-[11px] font-medium text-neutral-500">Máš rozpracovaný rig</span>
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="mt-4 min-h-11 w-full rounded-xl text-[12px] font-semibold text-neutral-500 hover:text-neutral-900"
            >
              Přeskočit
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setScreen("home")}
              className="inline-flex min-h-9 items-center gap-1 text-[12px] font-bold text-neutral-600 hover:text-neutral-900"
            >
              <ChevronLeft size={14} /> Zpět
            </button>
            <h2 className="mt-2 text-xl font-extrabold text-neutral-900">Vyber sestavu</h2>
            <div className="mt-3 space-y-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPreset(p.id)}
                  className="block min-h-16 w-full rounded-2xl border border-neutral-300 bg-white/85 p-3 text-left transition hover:border-lime-500 hover:shadow-md"
                >
                  <div className="text-[13px] font-bold text-neutral-900">{p.title}</div>
                  <div className="mt-0.5 text-[11px] text-neutral-600">{p.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
