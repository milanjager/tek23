/* ============================================================
   Krátké zvukové efekty pro zapojování kabelů (WebAudio, bez assetů).
   - sfxCableStart:    začátek tažení kabelu ze zdrojového portu
   - sfxPortConnect:   úspěšné připnutí na cílový port
   - sfxCableComplete: dokončení celého kabelového úkonu
   ============================================================ */

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  at: number,
  dur: number,
  opts: { type?: OscillatorType; gain?: number; slideTo?: number } = {},
) {
  const a = ac();
  if (!a) return;
  try {
    const t0 = a.currentTime + at;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
    const peak = opts.gain ?? 0.08;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    /* zvuk není kritický */
  }
}

/** Jemný náběh — kabel se začíná táhnout ze zdroje. */
export function sfxCableStart() {
  tone(420, 0, 0.09, { type: "triangle", gain: 0.06, slideTo: 640 });
}

/** Krátké „cvaknutí" — port chycen / konektor zapadl. */
export function sfxPortConnect() {
  tone(880, 0, 0.05, { type: "square", gain: 0.035 });
  tone(1320, 0.03, 0.06, { type: "sine", gain: 0.05 });
}

/** Potvrzovací dvojtón — celý kabelový úkon dokončen. */
export function sfxCableComplete() {
  tone(660, 0, 0.08, { type: "sine", gain: 0.06 });
  tone(990, 0.09, 0.12, { type: "sine", gain: 0.06 });
}

/** Měkké zamítnutí — neplatný cíl / zrušení. */
export function sfxCancel() {
  tone(240, 0, 0.1, { type: "sawtooth", gain: 0.025, slideTo: 170 });
}
