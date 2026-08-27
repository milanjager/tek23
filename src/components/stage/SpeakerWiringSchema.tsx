import { useMemo } from "react";

/* ============================================================================
   SpeakerWiringSchema — vygenerované schéma kabeláže pro vybrané bedny.
   Ukazuje NL4/Speakon linky (zesilovač → řetěz pasivních beden) a napájení
   z rozdělovače/agregátu pro aktivní boxy. Čistě prezentační komponenta —
   veškerá data přicházejí z editoru.
   ========================================================================== */

export interface WireNode {
  id: string;
  label: string;
  kind: string;
  /** "sound" | "lights" | "infra" */
  category: string;
  /** Aktivní bedna = má 230V IN + XLR IN. */
  active: boolean;
  role: "amp" | "distro" | "speaker" | "source" | "other";
  ohm?: number;
  powerW?: number;
}

export interface WireLink {
  id: string;
  from: string;
  to: string;
  type: "signal" | "speaker" | "power" | "dmx";
}

interface Props {
  nodes: WireNode[];
  links: WireLink[];
  scopeLabel: string;
  onClose: () => void;
}

const COLOR = {
  speaker: "#0284c7",
  power: "#dc2626",
  signal: "#059669",
};

/** Sériově-paralelní odhad: bedny v jednom NL4 řetězu jsou paralelně. */
function chainOhm(ohms: number[]): number | null {
  const valid = ohms.filter((o) => Number.isFinite(o) && o > 0);
  if (!valid.length) return null;
  const inv = valid.reduce((s, o) => s + 1 / o, 0);
  return Math.round((1 / inv) * 100) / 100;
}

export default function SpeakerWiringSchema({ nodes, links, scopeLabel, onClose }: Props) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  /** NL4 řetězy: z každého zesilovače projdeme graf speaker kabelů. */
  const spkChains = useMemo(() => {
    const out: { amp: WireNode; chains: { link: WireLink; node: WireNode }[][] }[] = [];
    const amps = nodes.filter((n) => n.role === "amp");
    for (const amp of amps) {
      const roots = links.filter((l) => l.type === "speaker" && l.from === amp.id);
      const chains = roots.map((root) => {
        const seq: { link: WireLink; node: WireNode }[] = [];
        let cur: WireLink | undefined = root;
        const seen = new Set<string>([amp.id]);
        while (cur) {
          const n = byId.get(cur.to);
          if (!n || seen.has(n.id)) break;
          seen.add(n.id);
          seq.push({ link: cur, node: n });
          cur = links.find((l) => l.type === "speaker" && l.from === n.id && !seen.has(l.to));
        }
        return seq;
      });
      out.push({ amp, chains: chains.filter((c) => c.length) });
    }
    return out.filter((a) => a.chains.length);
  }, [nodes, links, byId]);

  /** Aktivní bedny: napájení z distra + signál. */
  const activeBoxes = useMemo(() => {
    return nodes
      .filter((n) => n.category === "sound" && n.active)
      .map((n) => ({
        node: n,
        power: links.find((l) => l.type === "power" && l.to === n.id),
        signal: links.find((l) => l.type === "signal" && l.to === n.id),
      }));
  }, [nodes, links]);

  const orphanPassive = useMemo(() => {
    const wired = new Set<string>();
    for (const l of links) if (l.type === "speaker") { wired.add(l.to); }
    return nodes.filter((n) => n.category === "sound" && !n.active && !wired.has(n.id));
  }, [nodes, links]);

  const asText = useMemo(() => {
    const L: string[] = [`SCHÉMA KABELÁŽE — ${scopeLabel}`, ""];
    L.push("NL4 / SPEAKON:");
    if (!spkChains.length) L.push("  (žádné speakon linky — spusť Zapojit vše)");
    for (const { amp, chains } of spkChains) {
      chains.forEach((chain, i) => {
        const ohm = chainOhm(chain.map((c) => c.node.ohm ?? 8));
        L.push(
          `  ${amp.label} · kanál ${String.fromCharCode(65 + i)} → ` +
            chain.map((c) => c.node.label).join(" → LINK → ") +
            (ohm ? `   [${chain.length}× paralelně ≈ ${ohm} Ω]` : ""),
        );
      });
    }
    L.push("", "NAPÁJENÍ AKTIVNÍCH BEDEN:");
    if (!activeBoxes.length) L.push("  (žádné aktivní bedny)");
    for (const a of activeBoxes) {
      const src = a.power ? byId.get(a.power.from)?.label ?? "?" : "NEZAPOJENO";
      const sig = a.signal ? byId.get(a.signal.from)?.label ?? "?" : "NEZAPOJENO";
      L.push(`  ${a.node.label}: 230V ← ${src} · XLR ← ${sig}${a.node.powerW ? ` · ${a.node.powerW} W` : ""}`);
    }
    if (orphanPassive.length) {
      L.push("", "NEZAPOJENÉ PASIVNÍ BEDNY:");
      for (const n of orphanPassive) L.push(`  ${n.label}`);
    }
    return L.join("\n");
  }, [spkChains, activeBoxes, orphanPassive, byId, scopeLabel]);

  const download = () => {
    const blob = new Blob([asText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schema-kabelaze.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-neutral-950/60 p-2 backdrop-blur-sm animate-in fade-in duration-150"
      style={{ zIndex: 1000000005 }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
          <div>
            <div className="text-[13px] font-bold text-neutral-900">Schéma kabeláže — NL4 / SPEAKON + napájení</div>
            <div className="text-[10px] text-neutral-500">{scopeLabel}</div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={download} className="rounded-lg bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-700 hover:bg-neutral-200">Export .txt</button>
            <button onClick={onClose} className="rounded-lg bg-neutral-900 px-2 py-1 text-[11px] font-bold text-white hover:bg-neutral-700">Zavřít</button>
          </div>
        </header>

        <div className="overflow-y-auto px-4 py-3">
          {/* ── SPEAKON řetězy ─────────────────────────────────────── */}
          <section className="mb-4">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: COLOR.speaker }}>
              NL4 / Speakon linky
            </h3>
            {!spkChains.length && (
              <p className="rounded-lg bg-neutral-100 px-3 py-2 text-[11px] text-neutral-600">
                Žádné speakon spoje. Ve „Zapojit“ klikni na <b>Zapojit vše</b>.
              </p>
            )}
            {spkChains.map(({ amp, chains }) => (
              <div key={amp.id} className="mb-3 rounded-xl border border-sky-200 bg-sky-50/50 p-2">
                <div className="mb-2 text-[12px] font-bold text-sky-900">{amp.label}</div>
                {chains.map((chain, i) => {
                  const ohm = chainOhm(chain.map((c) => c.node.ohm ?? 8));
                  const low = ohm !== null && ohm < 2;
                  return (
                    <div key={i} className="mb-2 last:mb-0">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded bg-sky-700 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
                          KANÁL {String.fromCharCode(65 + i)}
                        </span>
                        <span className={`font-mono text-[10px] font-bold ${low ? "text-red-600" : "text-sky-800"}`}>
                          {chain.length}× · ≈ {ohm ?? "?"} Ω {low && "⚠ pod 2 Ω!"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {chain.map((c, idx) => (
                          <span key={c.node.id} className="flex items-center gap-1">
                            {idx > 0 && <span className="font-mono text-[9px] text-sky-600">—LINK→</span>}
                            <span className="rounded-lg border border-sky-300 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-800">
                              {c.node.label}
                              <span className="ml-1 font-mono text-[9px] text-neutral-500">{c.node.ohm ?? 8} Ω</span>
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>

          {/* ── Napájení aktivních beden ───────────────────────────── */}
          <section className="mb-4">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: COLOR.power }}>
              Napájení aktivních beden (z rozdělovače)
            </h3>
            {!activeBoxes.length && (
              <p className="rounded-lg bg-neutral-100 px-3 py-2 text-[11px] text-neutral-600">
                Ve výběru nejsou aktivní (self-powered) bedny.
              </p>
            )}
            {activeBoxes.map((a) => {
              const src = a.power ? byId.get(a.power.from)?.label ?? "?" : null;
              const sig = a.signal ? byId.get(a.signal.from)?.label ?? "?" : null;
              return (
                <div key={a.node.id} className="mb-1.5 flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50/50 px-2 py-1.5">
                  <span className="text-[11px] font-bold text-neutral-900">{a.node.label}</span>
                  <span className="font-mono text-[10px]" style={{ color: COLOR.power }}>
                    230V ← {src ?? "⚠ nezapojeno"}
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: COLOR.signal }}>
                    XLR ← {sig ?? "⚠ nezapojeno"}
                  </span>
                  {a.node.powerW ? <span className="font-mono text-[10px] text-neutral-500">{a.node.powerW} W</span> : null}
                </div>
              );
            })}
          </section>

          {orphanPassive.length > 0 && (
            <section className="mb-3">
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-700">Nezapojené pasivní bedny</h3>
              <div className="flex flex-wrap gap-1">
                {orphanPassive.map((n) => (
                  <span key={n.id} className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">{n.label}</span>
                ))}
              </div>
            </section>
          )}

          <details className="rounded-xl bg-neutral-100 px-3 py-2">
            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-neutral-600">Textová verze pro technika</summary>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] text-neutral-700">{asText}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}
