/* ============================================================
   Globální styl beden — barva skříně, mřížky a rails.
   Ukládá se do localStorage a aplikuje se na celou 3D scénu.
   ============================================================ */

export interface CabinetStyle {
  /** Hlavní barva skříně (touring case). */
  cabinet: string;
  /** Tmavší odstín skříně (boky, stíny, výplně). */
  cabinetDark: string;
  /** Podklad mřížky. */
  grille: string;
  /** Kresba (drát) mřížky. */
  grilleMesh: string;
  /** Rails / madla / akcenty. */
  rails: string;
  /** Kov (šrouby, kování). */
  metal: string;
  /** Chrom (drivery, phase plug). */
  chrome: string;
  /** Rám kolem mřížky. */
  frame: string;
}

export const DEFAULT_CABINET_STYLE: CabinetStyle = {
  cabinet: "#1a1d23",
  cabinetDark: "#131519",
  grille: "#0d0f14",
  grilleMesh: "#2b303a",
  rails: "#f2a01d",
  metal: "#191919",
  chrome: "#a8afb6",
  frame: "#2d323b",
};

export interface StylePreset {
  id: string;
  label: string;
  style: CabinetStyle;
}

export const STYLE_PRESETS: StylePreset[] = [
  { id: "touring", label: "Touring antracit / oranžová", style: DEFAULT_CABINET_STYLE },
  {
    id: "black",
    label: "Černá / stříbrná (klasika)",
    style: { cabinet: "#101013", cabinetDark: "#0a0a0c", grille: "#08090b", grilleMesh: "#3a3f47", rails: "#c9ced6", metal: "#15151a", chrome: "#cfd5db", frame: "#22252b" },
  },
  {
    id: "birch",
    label: "Bříza / natur dřevo",
    style: { cabinet: "#b4884f", cabinetDark: "#8a6636", grille: "#141310", grilleMesh: "#4a4438", rails: "#2b2b2b", metal: "#2a2a2a", chrome: "#b9bec4", frame: "#5d4a2c" },
  },
  {
    id: "white",
    label: "Bílá instalace",
    style: { cabinet: "#e6e8ea", cabinetDark: "#c8ccd0", grille: "#d3d7db", grilleMesh: "#9aa1a9", rails: "#8f959c", metal: "#b7bbc0", chrome: "#e9edf1", frame: "#aeb4ba" },
  },
  {
    id: "neon",
    label: "Klubová modrá",
    style: { cabinet: "#15202f", cabinetDark: "#0d1622", grille: "#0a1220", grilleMesh: "#2b5c8a", rails: "#38bdf8", metal: "#141c26", chrome: "#9fb6c8", frame: "#1e3550" },
  },
];

const KEY = "stagerig3d:cabinetStyle:v1";

export function loadCabinetStyle(): CabinetStyle {
  if (typeof window === "undefined") return { ...DEFAULT_CABINET_STYLE };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_CABINET_STYLE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CABINET_STYLE, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return { ...DEFAULT_CABINET_STYLE };
  }
}

export function saveCabinetStyle(s: CabinetStyle) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export const STYLE_FIELDS: { key: keyof CabinetStyle; label: string }[] = [
  { key: "cabinet", label: "Skříň" },
  { key: "cabinetDark", label: "Skříň — stín" },
  { key: "grille", label: "Mřížka" },
  { key: "grilleMesh", label: "Kresba mřížky" },
  { key: "rails", label: "Rails / madla" },
  { key: "frame", label: "Rám mřížky" },
  { key: "metal", label: "Kování" },
  { key: "chrome", label: "Chrom / drivery" },
];
