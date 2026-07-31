import { useState } from "react";
import PowersoftDiagram from "./PowersoftDiagram";

/* ============================================================================
   PowersoftGuide — detailní návod na zapojení a nastavení Powersoft zesilovačů.
   Zobrazuje se v panelu "Detail výběru", když je vybraný Powersoft amp.
   Obsahuje: mapu konektorů (IN/OUT), krok-za-krokem hardware zapojení
   a kompletní software setup v Armonía Plus.
   ============================================================================ */

export interface PsModel {
  id: string;
  name: string;
  ch: number;
  powerNote: string;
  ac: string;
  fuse: string;
  outs: string;
  audioIn: string;
  net: string;
  minLoad: string;
}

export const PS_MODELS: PsModel[] = [
  {
    id: "k20",
    name: "K20 DSP+AESOP",
    ch: 2,
    powerNote: "2× 4 400 W @ 4 Ω / 2× 5 200 W @ 2 Ω (bridge 10 kW)",
    ac: "CEE 32 A / 1× fáze 230 V (špička až 26 A)",
    fuse: "vlastní jistič C32 — NIKDY 2 K20 na jednu 16 A větev",
    outs: "2× Speakon NL4 (CH1 = 1+/1−, CH2 = 2+/2−), bridge na NL4 CH1",
    audioIn: "2× XLR analog IN + 2× XLR LINK OUT, 1× AES3 (XLR digital) IN + THRU",
    net: "2× RJ45 (AESOP / Armonía) — daisy-chain mezi ampy",
    minLoad: "min. 2 Ω na kanál, 4 Ω v bridge",
  },
  {
    id: "k10",
    name: "K10 DSP+AESOP",
    ch: 2,
    powerNote: "2× 2 400 W @ 4 Ω / 2× 3 000 W @ 2 Ω",
    ac: "CEE 16 A / 230 V (dedikovaná větev)",
    fuse: "jistič C16, jeden K10 na větev",
    outs: "2× Speakon NL4 (CH1, CH2), bridge na NL4 CH1",
    audioIn: "2× XLR analog IN + LINK OUT, AES3 IN/THRU",
    net: "2× RJ45 (AESOP / Armonía)",
    minLoad: "min. 2 Ω na kanál",
  },
  {
    id: "quattrocanali",
    name: "Quattrocanali 4804 DSP+D",
    ch: 4,
    powerNote: "4× 1 200 W @ 4 Ω, lo-Z i 70/100 V",
    ac: "powerCON TRUE1 / Schuko 16 A",
    fuse: "jistič C16 — 2 kusy na větev jen při nízkém průměrném výkonu",
    outs: "1× Speakon NL4 (CH1+CH2) + 1× NL4 (CH3+CH4), nebo svorkovnice",
    audioIn: "4× XLR analog IN, Dante/AES67 (verze D)",
    net: "2× RJ45 Dante (primary/secondary) + RJ45 control",
    minLoad: "min. 2 Ω na kanál",
  },
  {
    id: "duecanali",
    name: "Duecanali 4804 DSP+D",
    ch: 2,
    powerNote: "2× 2 400 W @ 4 Ω",
    ac: "powerCON TRUE1 / Schuko 16 A",
    fuse: "jistič C16",
    outs: "1× Speakon NL4 (CH1 = 1+/1−, CH2 = 2+/2−)",
    audioIn: "2× XLR analog IN, Dante/AES67 (verze D)",
    net: "2× RJ45 Dante + control",
    minLoad: "min. 2 Ω na kanál",
  },
];

interface Row { port: string; dir: "IN" | "OUT" | "IN/OUT"; conn: string; note: string; }

function portMap(m: PsModel): Row[] {
  const rows: Row[] = [
    { port: "AC MAINS", dir: "IN", conn: m.ac, note: `Samostatná větev, ${m.fuse}. Fáze/N/PE ověřit před zapnutím.` },
    { port: "ANALOG IN A/B", dir: "IN", conn: "XLR-F (bal. line, +4 dBu)", note: "Z FOH / procesoru. Gain na pultu nechat pod 0 dBFS." },
    { port: "LINK / THRU", dir: "OUT", conn: "XLR-M", note: "Průchozí signál na další amp (max 4–5 ampů v řetězu)." },
    { port: "AES3 / Dante", dir: "IN", conn: m.audioIn.includes("Dante") ? "RJ45 Dante primary" : "XLR AES3 (110 Ω kabel!)", note: "Digitální cesta má přednost — nastav fallback na analog." },
    { port: "NETWORK", dir: "IN/OUT", conn: m.net, note: "Daisy-chain nebo switch. Statická IP v rozsahu notebooku (Armonía)." },
  ];
  for (let i = 1; i <= m.ch; i++) {
    rows.push({
      port: `OUT CH${i}`,
      dir: "OUT",
      conn: `Speakon NL4 ${i % 2 === 1 ? "1+/1−" : "2+/2−"}`,
      note: `Do bedny. Zátěž ${m.minLoad}. Kabel min. 2,5 mm² do 25 m, 4 mm² nad 25 m.`,
    });
  }
  rows.push({ port: "BRIDGE", dir: "OUT", conn: "NL4 CH1: 1+ / 2+", note: "Jen pro sub. Zátěž nesmí klesnout pod dvojnásobek min. impedance." });
  return rows;
}

const HW_STEPS = (m: PsModel) => [
  { t: "Rack a chlazení", d: `Amp do racku s min. 1 U mezerou nad/pod, sání zepředu → výfuk dozadu. Rack nesmí stát zádí ke stěně blíž než 30 cm.` },
  { t: "Zem a jištění", d: `Zkontroluj PE, otoč fázi/N jen přes odbornou kontrolu. ${m.fuse}. Distro → amp krátkým silovým kabelem, ne přes prodlužku na buben.` },
  { t: "Reproduktory (nejdřív!)", d: `Zapoj Speakon do ${m.outs}. Ověř polaritu 1+/1− u každé bedny, u bi-ampu LF na CH1, MF/HF na CH2. Zkontroluj celkovou impedanci větve (${m.minLoad}).` },
  { t: "Signál", d: `Analog XLR z FOH do IN A/B, případně AES3/Dante. Stínění na pinu 1, u zemní smyčky rozpojit stínění na straně ampu (ground lift).` },
  { t: "Síť / ovládání", d: `${m.net}. Notebook s Armonía Plus přímo do prvního ampu nebo do switche. Statická IP (např. 192.168.1.10 / 255.255.255.0).` },
  { t: "Pořadí zapínání", d: `1) distro → 2) pult a zdroje → 3) procesor → 4) ampy jako poslední. Vypínání přesně obráceně, jinak lupne do beden.` },
  { t: "Kontrola před zvukem", d: `Ampy na minimální gain, pusť růžový šum na nízké úrovni, poslechni každou bednu zvlášť (solo kanál) a ověř, že hraje ta správná.` },
];

const SW_STEPS = [
  { t: "1. Instalace Armonía Plus", d: "Nainstaluj Armonía Plus (Windows) ve verzi ≥ té ve firmwaru ampu. Vypni firewall/VPN na síťové kartě, kterou používáš pro ampy." },
  { t: "2. Síť a discovery", d: "Notebook nastav na statickou IP ve stejném rozsahu jako ampy. V Armonía → Design → Add Entities → Scan → objeví se všechny nalezené ampy podle sériového čísla." },
  { t: "3. Firmware", d: "Zkontroluj shodu firmwaru u všech ampů (Maintenance → Firmware). Rozdílné verze = nekonzistentní chování presetů. Aktualizuj před akcí, nikdy ne 10 minut před show." },
  { t: "4. Design systému", d: "V záložce Design vytvoř Zones/Groups: Subs, Tops, Fills, Monitors. Přiřaď kanály ampů do skupin — pak se dá měnit gain/delay/mute pro celou linii najednou." },
  { t: "5. Speaker preset", d: "Ke každému výstupu přiřaď preset bedny (Way Assign / Speaker Library). Preset nese crossover, EQ, limitery a doporučenou konfiguraci — nikdy nepouštěj HF driver bez presetu." },
  { t: "6. Crossover a routing", d: "Pasivní bedna = full-range výstup. Bi-amp = LF na CH1 (např. LR24 @ 100 Hz LPF), MF/HF na CH2 (HPF). Subs: LPF 90–100 Hz, tops HPF stejný bod." },
  { t: "7. Limitery a ochrana", d: "Nastav peak limiter podle datasheetu bedny, RMS/TruePower limiter podle AES výkonu, clip limiter ON. Nechej limitery z presetu, pokud výrobce dodal ověřený." },
  { t: "8. Gain struktura", d: "Vstupní citlivost nastav jednotně (např. +4 dBu / 32 dB gain). Amp gain neškrtej dolů kvůli hluku — sniž úroveň v pultu. Cíl: pult −6 dBFS = amp těsně pod limiterem." },
  { t: "9. Delay a alignment", d: "Změř vzdálenosti: sub → top delay (typicky 3–10 ms), delay linky podle 343 m/s. Zadej v Armonía jako Output Delay v ms nebo v metrech." },
  { t: "10. Polarita a fáze", d: "Ověř polaritu subů vs. tops (poslech v crossover oblasti, hledej maximum). Případně invertuj polaritu subu v software, ne přepojováním kabelu." },
  { t: "11. Monitoring a alarmy", d: "Zapni Live/Monitor view: teplota, proud, impedance zátěže, stav limiterů. Nastav alarmy na load impedance — okamžitě odhalí odpojenou nebo spálenou bednu." },
  { t: "12. Uložení a záloha", d: "Ulož Armonía workspace (.dsp/.arm) a zálohuj na USB. Ulož také presety do ampů jako Power-on preset, aby systém po výpadku nabootoval správně nastavený." },
  { t: "13. Zamknutí", d: "Zamkni front panel (Panel Lock) a nastav heslo, aby nikdo nepřepnul preset během akce. Zkontroluj, že Standby/Auto Power funguje podle potřeby." },
];

export default function PowersoftGuide({ label }: { label?: string }) {
  const [modelId, setModelId] = useState(PS_MODELS[0].id);
  const [tab, setTab] = useState<"ports" | "diag" | "hw" | "sw">("ports");
  const [open, setOpen] = useState(true);
  const m = PS_MODELS.find((x) => x.id === modelId) ?? PS_MODELS[0];

  const exportTxt = () => {
    const L: string[] = [];
    L.push(`# Powersoft ${m.name} — zapojení a nastavení${label ? ` (${label})` : ""}`);
    L.push(`Výkon: ${m.powerNote}`);
    L.push(`Napájení: ${m.ac} · ${m.fuse}`);
    L.push("", "## Konektory");
    for (const r of portMap(m)) L.push(`- [${r.dir}] ${r.port} — ${r.conn}\n  ${r.note}`);
    L.push("", "## Hardware krok za krokem");
    HW_STEPS(m).forEach((s, i) => L.push(`${i + 1}. ${s.t}\n   ${s.d}`));
    L.push("", "## Software (Armonía Plus)");
    SW_STEPS.forEach((s) => L.push(`${s.t}\n   ${s.d}`));
    const blob = new Blob([L.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `powersoft-${m.id}-setup.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mb-2 rounded border border-cyan-400/60 bg-cyan-50/70 px-2 py-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-[9px] font-bold uppercase tracking-wider text-cyan-800"
      >
        <span>⚡ Powersoft — zapojení &amp; setup</span>
        <span className="font-mono">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-1.5">
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="mb-1.5 w-full rounded border border-cyan-300 bg-white px-1.5 py-1 text-[10px] font-semibold text-neutral-800"
          >
            {PS_MODELS.map((x) => (
              <option key={x.id} value={x.id}>{x.name} · {x.ch} kanály</option>
            ))}
          </select>

          <div className="mb-1.5 rounded bg-white px-2 py-1 font-mono text-[9.5px] leading-tight text-neutral-700">
            <div><b>Výkon:</b> {m.powerNote}</div>
            <div><b>AC:</b> {m.ac}</div>
            <div className="text-red-700"><b>Jištění:</b> {m.fuse}</div>
            <div><b>Zátěž:</b> {m.minLoad}</div>
          </div>

          <div className="mb-1.5 flex gap-1">
            {([["ports", "Konektory"], ["hw", "Zapojení"], ["sw", "Software"]] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 rounded px-1 py-1 text-[9.5px] font-bold ${tab === k ? "bg-cyan-700 text-white" : "bg-white text-cyan-800 hover:bg-cyan-100"}`}
              >
                {l}
              </button>
            ))}
          </div>

          {tab === "ports" && (
            <div className="flex flex-col gap-0.5">
              {portMap(m).map((r) => (
                <div key={r.port} className="rounded bg-white px-1.5 py-1 text-[9.5px] leading-tight">
                  <div className="flex items-center gap-1">
                    <span className={`rounded px-1 font-mono text-[8.5px] font-bold text-white ${r.dir === "IN" ? "bg-emerald-600" : r.dir === "OUT" ? "bg-blue-700" : "bg-neutral-600"}`}>
                      {r.dir}
                    </span>
                    <span className="font-mono font-bold text-neutral-900">{r.port}</span>
                  </div>
                  <div className="font-mono text-neutral-700">{r.conn}</div>
                  <div className="text-neutral-500">{r.note}</div>
                </div>
              ))}
            </div>
          )}

          {tab === "hw" && (
            <ol className="flex flex-col gap-0.5">
              {HW_STEPS(m).map((s, i) => (
                <li key={s.t} className="rounded bg-white px-1.5 py-1 text-[9.5px] leading-tight">
                  <div className="flex items-center gap-1">
                    <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded bg-neutral-800 px-1 font-mono text-[9px] font-bold text-white">{i + 1}</span>
                    <b className="text-neutral-900">{s.t}</b>
                  </div>
                  <div className="mt-0.5 text-neutral-600">{s.d}</div>
                </li>
              ))}
            </ol>
          )}

          {tab === "sw" && (
            <ol className="flex flex-col gap-0.5">
              {SW_STEPS.map((s) => (
                <li key={s.t} className="rounded bg-white px-1.5 py-1 text-[9.5px] leading-tight">
                  <b className="text-neutral-900">{s.t}</b>
                  <div className="mt-0.5 text-neutral-600">{s.d}</div>
                </li>
              ))}
            </ol>
          )}

          <button
            onClick={exportTxt}
            className="mt-1.5 w-full rounded bg-cyan-700 px-2 py-1 text-[10px] font-bold text-white hover:bg-cyan-800"
          >
            ⤓ Export návodu (.txt)
          </button>
        </div>
      )}
    </div>
  );
}
