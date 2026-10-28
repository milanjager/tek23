import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronUp, Trophy, X } from "lucide-react";
import {
  QUESTS,
  evaluateQuests,
  levelOf,
  loadSeenQuests,
  saveSeenQuests,
  type QuestId,
  type QuestSignals,
} from "./quests";

/* ============================================================
   Cesta — herní vrstva nad workspace.
   Jedno tlačítko, jeden další krok, viditelný postup a odměny.
   ============================================================ */

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 6) * 60}ms`,
        hue: [141, 200, 45, 320][i % 4],
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute top-0 h-2 w-1.5 rounded-[1px] animate-[confetti_900ms_ease-out_forwards]"
          style={{
            left: b.left,
            animationDelay: b.delay,
            background: `hsl(${b.hue} 90% 55%)`,
          }}
        />
      ))}
    </div>
  );
}

export function JourneyPanel({
  signals,
  onQuestAction,
}: {
  signals: QuestSignals;
  onQuestAction: (id: QuestId) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reward, setReward] = useState<{ title: string; xp: number } | null>(null);
  const seenRef = useRef<QuestId[] | null>(null);

  const state = useMemo(() => evaluateQuests(signals), [signals]);
  const lvl = levelOf(state.xp);

  // Odměna se ukáže jen jednou pro každý splněný úkol.
  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = loadSeenQuests();
      // první průchod jen synchronizuje, neodměňuje zpětně
      const all = Array.from(state.doneIds);
      seenRef.current = Array.from(new Set([...seenRef.current, ...all]));
      saveSeenQuests(seenRef.current);
      return;
    }
    const fresh = QUESTS.find((q) => state.doneIds.has(q.id) && !seenRef.current!.includes(q.id));
    if (fresh) {
      seenRef.current = [...seenRef.current, fresh.id];
      saveSeenQuests(seenRef.current);
      setReward({ title: fresh.title, xp: fresh.reward });
      const t = setTimeout(() => setReward(null), 2600);
      return () => clearTimeout(t);
    }
  }, [state.doneIds]);

  return (
    <>
      {/* Odměna */}
      {reward && (
        <div
          className="pointer-events-none fixed left-1/2 top-4 z-[1200] w-[min(22rem,92vw)] -translate-x-1/2 animate-scale-in"
          role="status"
        >
          <div className="relative overflow-hidden rounded-2xl border border-lime-400/60 bg-neutral-900/95 p-3 text-center shadow-2xl">
            <Confetti />
            <div className="text-[13px] font-extrabold text-lime-300">🎉 Splněno!</div>
            <div className="mt-0.5 text-[13px] font-semibold text-white">{reward.title}</div>
            <div className="mt-1 inline-flex rounded-full bg-lime-400 px-2 py-0.5 text-[11px] font-black text-neutral-950">
              +{reward.xp} XP
            </div>
          </div>
        </div>
      )}

      {/* Sbalený pruh postupu — mobile-first, vždy dostupný */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="glass-strong fixed bottom-3 left-1/2 z-[1100] flex w-[min(26rem,94vw)] -translate-x-1/2 items-center gap-3 rounded-2xl px-3 py-2.5 text-left shadow-xl transition hover:scale-[1.01]"
          aria-label="Otevřít Cestu stavitele"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-neutral-950">
            <Trophy size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-bold text-neutral-900 dark:text-neutral-100">
              {state.next ? state.next.title : "Hotovo — rig je připravený!"}
            </span>
            <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-neutral-300/70 dark:bg-white/15">
              <span
                className="block h-full rounded-full bg-lime-500 transition-[width] duration-300"
                style={{ width: `${Math.round(state.ratio * 100)}%` }}
              />
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-[11px] font-black text-lime-600">{state.xp} XP</span>
            <ChevronUp size={14} className="ml-auto text-neutral-500" />
          </span>
        </button>
      )}

      {/* Rozbalená cesta */}
      {open && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="glass-strong max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-4 shadow-2xl animate-fade-in sm:rounded-3xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-600">
                  Level {lvl.index} · {lvl.name}
                </p>
                <h2 className="text-lg font-extrabold text-neutral-900 dark:text-neutral-50">Cesta stavitele</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="glass-chip flex h-9 w-9 items-center justify-center rounded-full"
                aria-label="Zavřít cestu"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-3 rounded-2xl bg-neutral-900/90 p-3 text-white">
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="font-bold text-lime-300">{state.xp} XP</span>
                <span className="text-neutral-400">
                  {state.completed}/{state.total} úkolů
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-lime-400 transition-[width] duration-300"
                  style={{ width: `${Math.round(state.ratio * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-neutral-400">
                {lvl.nextName ? `Ještě ${lvl.toNext} XP na ${lvl.nextName}` : "Nejvyšší úroveň dosažena"}
              </p>
            </div>

            <ul className="mt-3 space-y-2">
              {QUESTS.map((q, i) => {
                const done = state.doneIds.has(q.id);
                const isNext = state.next?.id === q.id;
                return (
                  <li
                    key={q.id}
                    className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                      done
                        ? "border-lime-500/50 bg-lime-500/10"
                        : isNext
                          ? "border-neutral-900/20 bg-white/80 shadow-md dark:border-white/20 dark:bg-white/10"
                          : "border-black/5 bg-white/40 opacity-60 dark:border-white/5 dark:bg-white/5"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[12px] font-black ${
                        done ? "bg-lime-500 text-neutral-950" : "bg-neutral-300 text-neutral-700 dark:bg-white/15 dark:text-neutral-200"
                      }`}
                    >
                      {done ? <Check size={15} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-neutral-900 dark:text-neutral-100">
                        {q.title}
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">+{q.reward} XP</span>
                    </span>
                    {!done && isNext && (
                      <button
                        onClick={() => {
                          onQuestAction(q.id);
                          setOpen(false);
                        }}
                        className="min-h-9 shrink-0 rounded-xl bg-lime-500 px-3 text-[12px] font-black text-neutral-950 transition hover:bg-lime-400"
                      >
                        {q.action}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
