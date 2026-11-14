/* Seznam posledních rigů v localStorage — slouží jen úvodní obrazovce
   ("Pokračovat") a autosave. Formát scény (items/cables/…) se nemění. */

export const RIGS_KEY = "stage.rigs.v1";
const MAX_RIGS = 8;

export interface SavedRig {
  id: string;
  name: string;
  updatedAt: number;
  items: unknown[];
  cables: unknown[];
  groupNames?: Record<string, string>;
  groupSpacing?: Record<string, unknown>;
}

export function loadRigs(legacyKey?: string): SavedRig[] {
  try {
    const raw = localStorage.getItem(RIGS_KEY);
    const list = raw ? (JSON.parse(raw) as SavedRig[]) : [];
    if (Array.isArray(list) && list.length) return list.sort((a, b) => b.updatedAt - a.updatedAt);
    // Jednorázová migrace: starý jediný uložený projekt → první položka seznamu.
    if (legacyKey) {
      const old = JSON.parse(localStorage.getItem(legacyKey) || "null");
      if (old && Array.isArray(old.items) && old.items.length) {
        const rig: SavedRig = { id: "legacy", name: "Rozpracovaný rig", updatedAt: Date.now(), ...old };
        localStorage.setItem(RIGS_KEY, JSON.stringify([rig]));
        return [rig];
      }
    }
  } catch { /* poškozená data ignoruj */ }
  return [];
}

export function saveRig(rig: SavedRig): SavedRig[] {
  const rest = loadRigs().filter((r) => r.id !== rig.id);
  const next = [rig, ...rest].slice(0, MAX_RIGS);
  try { localStorage.setItem(RIGS_KEY, JSON.stringify(next)); } catch { /* plné úložiště */ }
  return next;
}

/** "9:04" — čas uložení bez úvodní nuly u hodin. */
export function formatSavedTime(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
