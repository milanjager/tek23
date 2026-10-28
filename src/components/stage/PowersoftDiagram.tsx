import type { PsModel } from "./PowersoftGuide";

/* ============================================================================
   PowersoftDiagram — názorná schémata zapojení pro jednotlivé modely.
   1) Zadní panel: rozmístění IN/OUT konektorů (AC, analog, digital, síť, SPK)
   2) Signálová smyčka: FOH → LINK/THRU řetěz mezi ampy
   3) Síťová smyčka: notebook → RJ45 daisy-chain
   4) Výstupní zapojení: NL4 piny → bedny (bi-amp / bridge)
   Vše čistě SVG, bez závislostí, čitelné i pro laika.
   ============================================================================ */

const C = {
  ac: "#dc2626",
  sig: "#059669",
  aes: "#7c3aed",
  net: "#0284c7",
  spk: "#1d4ed8",
  box: "#0f172a",
  muted: "#64748b",
};

function Port({
  x, y, w = 46, h = 15, label, color, dir,
}: { x: number; y: number; w?: number; h?: number; label: string; color: string; dir: "IN" | "OUT" | "I/O" }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={2} fill="white" stroke={color} strokeWidth={1.2} />
      <rect width={w} height={3} rx={1.5} fill={color} />
      <text x={w / 2} y={11.5} textAnchor="middle" fontSize={6.4} fontFamily="ui-monospace, monospace" fontWeight={700} fill={C.box}>
        {label}
      </text>
      <text x={w / 2} y={h + 6} textAnchor="middle" fontSize={5.4} fontFamily="ui-monospace, monospace" fill={color} fontWeight={700}>
        {dir}
      </text>
    </g>
  );
}

/** 1 — zadní panel modelu */
function RearPanel({ m }: { m: PsModel }) {
  const dante = m.audioIn.includes("Dante");
  const chs = Array.from({ length: m.ch }, (_, i) => i + 1);
  // NL4 výstupy: 4kanálové modely sdílí jeden NL4 na dvojici kanálů
  const spkPorts = m.ch === 4 ? ["NL4 CH1+2", "NL4 CH3+4"] : chs.map((c) => `NL4 CH${c}`);

  return (
    <svg viewBox="0 0 320 132" className="w-full">
      <rect x={4} y={4} width={312} height={124} rx={4} fill="#f1f5f9" stroke={C.box} strokeWidth={1.2} />
      <text x={12} y={16} fontSize={7} fontFamily="ui-monospace, monospace" fontWeight={800} fill={C.box}>
        ZADNÍ PANEL — {m.name.toUpperCase()}
      </text>
      <line x1={10} y1={20} x2={310} y2={20} stroke={C.muted} strokeWidth={0.6} />

      {/* AC */}
      <Port x={12} y={30} w={62} label="AC MAINS" color={C.ac} dir="IN" />
      <text x={12} y={62} fontSize={5.6} fontFamily="ui-monospace, monospace" fill={C.ac}>{m.ac}</text>

      {/* Analog in / link */}
      {Array.from({ length: Math.min(m.ch, 4) }, (_, i) => (
        <Port key={`in${i}`} x={86 + i * 34} y={30} w={30} label={`IN ${String.fromCharCode(65 + i)}`} color={C.sig} dir="IN" />
      ))}
      <text x={86} y={62} fontSize={5.6} fontFamily="ui-monospace, monospace" fill={C.sig}>XLR-F analog</text>

      {/* Digital */}
      <Port x={228} y={30} w={38} label={dante ? "DANTE" : "AES3"} color={C.aes} dir="IN" />
      <Port x={270} y={30} w={38} label={dante ? "SEC." : "THRU"} color={C.aes} dir="OUT" />

      {/* Link out (jen analogové modely s XLR link) */}
      {!dante && (
        <>
          <Port x={86} y={72} w={30} label="LNK A" color={C.sig} dir="OUT" />
          <Port x={120} y={72} w={30} label="LNK B" color={C.sig} dir="OUT" />
        </>
      )}

      {/* Network */}
      <Port x={dante ? 86 : 158} y={72} w={32} label="ETH 1" color={C.net} dir="I/O" />
      <Port x={dante ? 122 : 194} y={72} w={32} label="ETH 2" color={C.net} dir="I/O" />

      {/* Speakon */}
      {spkPorts.map((p, i) => (
        <Port key={p} x={228 + i * 42} y={72} w={38} label={p.replace("NL4 ", "")} color={C.spk} dir="OUT" />
      ))}
      <text x={228} y={104} fontSize={5.6} fontFamily="ui-monospace, monospace" fill={C.spk}>Speakon NL4</text>

      <text x={12} y={122} fontSize={5.6} fontFamily="ui-monospace, monospace" fill={C.muted}>
        {m.fuse}
      </text>
    </svg>
  );
}

/** 2 — signálová smyčka FOH → amp → amp */
function SignalLoop({ m }: { m: PsModel }) {
  const dante = m.audioIn.includes("Dante");
  const amps = [0, 1, 2];
  return (
    <svg viewBox="0 0 320 96" className="w-full">
      <text x={6} y={10} fontSize={7} fontFamily="ui-monospace, monospace" fontWeight={800} fill={C.box}>
        {dante ? "SMYČKA — DANTE PRIMARY (daisy-chain)" : "SMYČKA — ANALOG LINK / THRU"}
      </text>

      {/* FOH */}
      <rect x={6} y={26} width={54} height={30} rx={3} fill="white" stroke={C.box} strokeWidth={1.2} />
      <text x={33} y={40} textAnchor="middle" fontSize={6.6} fontFamily="ui-monospace, monospace" fontWeight={700} fill={C.box}>FOH / DSP</text>
      <text x={33} y={49} textAnchor="middle" fontSize={5.6} fontFamily="ui-monospace, monospace" fill={C.muted}>{dante ? "Dante OUT" : "XLR OUT"}</text>

      {amps.map((i) => {
        const x = 82 + i * 80;
        return (
          <g key={i}>
            <rect x={x} y={26} width={64} height={30} rx={3} fill="#ecfdf5" stroke={dante ? C.net : C.sig} strokeWidth={1.2} />
            <text x={x + 32} y={39} textAnchor="middle" fontSize={6.4} fontFamily="ui-monospace, monospace" fontWeight={700} fill={C.box}>
              AMP {i + 1}
            </text>
            <text x={x + 32} y={49} textAnchor="middle" fontSize={5.4} fontFamily="ui-monospace, monospace" fill={C.muted}>
              {dante ? "P → S" : "IN → LINK"}
            </text>
            <line
              x1={i === 0 ? 60 : x - 16}
              y1={41}
              x2={x - 2}
              y2={41}
              stroke={dante ? C.net : C.sig}
              strokeWidth={1.6}
              markerEnd="url(#ps-arrow)"
            />
          </g>
        );
      })}

      <defs>
        <marker id="ps-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill={C.muted} />
        </marker>
      </defs>

      <text x={6} y={74} fontSize={5.8} fontFamily="ui-monospace, monospace" fill={C.muted}>
        {dante
          ? "Primary → Secondary řetěz; poslední amp zpět do switche = redundance."
          : "Max. 4–5 ampů v řetězu. Delší řetěz → radši splitter/DSP výstup navíc."}
      </text>
      <text x={6} y={86} fontSize={5.8} fontFamily="ui-monospace, monospace" fill={C.ac}>
        Stínění na pin 1; při brumu ground-lift na straně ampu.
      </text>
    </svg>
  );
}

/** 3 — výstupní zapojení NL4 → bedny */
function OutputWiring({ m }: { m: PsModel }) {
  const pairs = m.ch === 4 ? [["CH1", "CH2"], ["CH3", "CH4"]] : [["CH1", "CH2"]];
  return (
    <svg viewBox="0 0 320 130" className="w-full">
      <text x={6} y={10} fontSize={7} fontFamily="ui-monospace, monospace" fontWeight={800} fill={C.box}>
        VÝSTUPY NL4 → BEDNY
      </text>

      {pairs.map((p, i) => {
        const y = 20 + i * 44;
        return (
          <g key={i}>
            <rect x={6} y={y} width={70} height={34} rx={3} fill="#eff6ff" stroke={C.spk} strokeWidth={1.2} />
            <text x={41} y={y + 13} textAnchor="middle" fontSize={6.4} fontFamily="ui-monospace, monospace" fontWeight={700} fill={C.box}>
              NL4 {m.ch === 4 ? `${p[0]}+${p[1]}` : p[0]}
            </text>
            <text x={41} y={y + 23} textAnchor="middle" fontSize={5.4} fontFamily="ui-monospace, monospace" fill={C.muted}>1+/1− · 2+/2−</text>

            <line x1={76} y1={y + 10} x2={150} y2={y + 8} stroke={C.spk} strokeWidth={1.6} markerEnd="url(#ps-arrow)" />
            <line x1={76} y1={y + 24} x2={150} y2={y + 28} stroke={C.spk} strokeWidth={1.6} strokeDasharray="4 2" markerEnd="url(#ps-arrow)" />

            <rect x={152} y={y - 2} width={78} height={17} rx={2} fill="white" stroke={C.box} strokeWidth={1} />
            <text x={191} y={y + 9.5} textAnchor="middle" fontSize={5.8} fontFamily="ui-monospace, monospace" fill={C.box}>
              1+/1− → {p[0]} (LF/sub)
            </text>
            <rect x={152} y={y + 20} width={78} height={17} rx={2} fill="white" stroke={C.box} strokeWidth={1} />
            <text x={191} y={y + 31.5} textAnchor="middle" fontSize={5.8} fontFamily="ui-monospace, monospace" fill={C.box}>
              2+/2− → {p[1]} (MF/HF)
            </text>

            <rect x={240} y={y + 2} width={74} height={30} rx={3} fill="#f8fafc" stroke={C.muted} strokeWidth={1} />
            <text x={277} y={y + 14} textAnchor="middle" fontSize={5.8} fontFamily="ui-monospace, monospace" fontWeight={700} fill={C.box}>
              Bi-amp bedna
            </text>
            <text x={277} y={y + 24} textAnchor="middle" fontSize={5.4} fontFamily="ui-monospace, monospace" fill={C.muted}>
              nebo 2× pasiv
            </text>
          </g>
        );
      })}

      <text x={6} y={112} fontSize={5.8} fontFamily="ui-monospace, monospace" fill={C.box} fontWeight={700}>
        BRIDGE: NL4 CH1 piny 1+ / 2+ (CH2 nechat volný) — jen sub, {m.minLoad.replace("min. ", "min. 2× ")}
      </text>
      <text x={6} y={124} fontSize={5.8} fontFamily="ui-monospace, monospace" fill={C.ac}>
        Daisy-chain beden jen do vypočtené impedance ({m.minLoad}).
      </text>
    </svg>
  );
}

export default function PowersoftDiagram({ m }: { m: PsModel }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="rounded bg-white p-1"><RearPanel m={m} /></div>
      <div className="rounded bg-white p-1"><SignalLoop m={m} /></div>
      <div className="rounded bg-white p-1"><OutputWiring m={m} /></div>
      <div className="rounded bg-white px-1.5 py-1 text-[9px] leading-tight text-neutral-600">
        <b className="text-neutral-900">Legenda:</b>{" "}
        <span style={{ color: C.ac }}>■ AC 230 V</span>{" · "}
        <span style={{ color: C.sig }}>■ analog signál</span>{" · "}
        <span style={{ color: C.aes }}>■ digitál (AES3/Dante)</span>{" · "}
        <span style={{ color: C.net }}>■ síť / ovládání</span>{" · "}
        <span style={{ color: C.spk }}>■ repro NL4</span>
      </div>
    </div>
  );
}
