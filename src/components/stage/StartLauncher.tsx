import { useEffect, useRef } from "react";
import { FilePlus2, LayoutTemplate, History } from "lucide-react";

export type SilhouetteBox = { x: number; y: number; w: number; h: number };
export type PresetChoice = { id: string; title: string; desc: string; boxes: SilhouetteBox[] };
export type RecentRig = { id: string; name: string; updatedAt: number; count: number };

/** Malý čelní náhled presetu — obrysy beden zepředu. */
function Silhouette({ boxes }: { boxes: SilhouetteBox[] }) {
  if (!boxes.length) return <div className="h-16" />;
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  const pad = 0.2;
  return (
    <svg
      viewBox={`${minX - pad} ${-maxY - pad} ${maxX - minX + pad * 2} ${maxY + pad * 2}`}
      className="h-16 w-full text-neutral-700"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
    >
      <line x1={minX - pad} x2={maxX + pad} y1={0} y2={0} stroke="currentColor" strokeWidth={0.03} opacity={0.4} />
      {boxes.map((b, i) => (
        <rect key={i} x={b.x} y={-(b.y + b.h)} width={b.w} height={b.h} fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={0.035} />
      ))}
    </svg>
  );
}

const fmtDate = (t: number) =>
  new Date(t).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const beden = (n: number) => (n === 1 ? "1 bedna" : n >= 2 && n <= 4 ? `${n} bedny` : `${n} beden`);

/** Úvodní obrazovka: prázdná plocha, preset, nebo pokračování v uloženém rigu. */
export function StartLauncher({
  presets,
  recent,
  onBlank,
  onPreset,
  onContinue,
}: {
  presets: PresetChoice[];
  recent: RecentRig[];
  onBlank: () => void;
  onPreset: (id: string) => void;
  onContinue: (id: string) => void;
}) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);

  const section = "rounded-2xl border border-neutral-300 bg-white/80 p-4";
  const heading = "flex items-center gap-2 text-[13px] font-extrabold text-neutral-900";

  return (
    <div
      className="fixed inset-0 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      style={{ zIndex: 2000000000 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="launcher-title"
    >
      <div className="glass-strong max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl sm:p-7">
        <h1 id="launcher-title" className="text-[24px] font-extrabold leading-tight text-neutral-900 sm:text-[28px]">
          Co dnes postavíš?
        </h1>
        <p className="mt-1 text-sm text-neutral-600">Vyber, jak začít. Vše se průběžně ukládá do tohoto prohlížeče.</p>

        <div className="mt-5 grid gap-3">
          <button ref={firstRef} onClick={onBlank} className={`${section} text-left transition hover:border-lime-500`}>
            <span className={heading}><FilePlus2 size={16} className="text-lime-600" /> Prázdná plocha</span>
            <span className="mt-0.5 block text-[12px] text-neutral-600">Začni od nuly a přidávej bedny z palety.</span>
          </button>

          <section className={section} aria-labelledby="launcher-presets">
            <h2 id="launcher-presets" className={heading}><LayoutTemplate size={16} className="text-lime-600" /> Z presetu</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPreset(p.id)}
                  className="rounded-xl border border-neutral-200 bg-white p-2.5 text-left transition hover:border-lime-500 hover:shadow-md"
                >
                  <Silhouette boxes={p.boxes} />
                  <div className="mt-1.5 text-[13px] font-bold text-neutral-900">{p.title}</div>
                  <div className="text-[11px] leading-snug text-neutral-600">{p.desc}</div>
                </button>
              ))}
            </div>
          </section>

          <section className={section} aria-labelledby="launcher-recent">
            <h2 id="launcher-recent" className={heading}><History size={16} className="text-lime-600" /> Pokračovat</h2>
            {recent.length ? (
              <ul className="mt-2 divide-y divide-neutral-200">
                {recent.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => onContinue(r.id)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-neutral-100">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-neutral-900">{r.name}</span>
                      <span className="shrink-0 text-[11px] text-neutral-600">{beden(r.count)}</span>
                      <span className="shrink-0 text-[11px] text-neutral-500">{fmtDate(r.updatedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[12px] text-neutral-500">Zatím tu nic není — uložené rigy se objeví tady.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
