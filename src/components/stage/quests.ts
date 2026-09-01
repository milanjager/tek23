/* ============================================================
   Cesta stavitele — questy, XP a úrovně.
   Progress se počítá ze stavu scény, XP se ukládá do prohlížeče.
   ============================================================ */

export type QuestId =
  | "first_box"
  | "stack"
  | "power"
  | "amp"
  | "wire"
  | "checklist";

export type QuestSignals = {
  items: number;
  stacks: number;
  hasPower: boolean;
  hasAmp: boolean;
  cables: number;
  reportOpened: boolean;
};

export type Quest = {
  id: QuestId;
  title: string;
  action: string;
  reward: number;
  done: (s: QuestSignals) => boolean;
};

export const QUESTS: Quest[] = [
  {
    id: "first_box",
    title: "Postav první bednu",
    action: "Přidat bednu",
    reward: 50,
    done: (s) => s.items >= 1,
  },
  {
    id: "stack",
    title: "Postav stack ze 4 beden",
    action: "Stavět dál",
    reward: 100,
    done: (s) => s.items >= 4,
  },
  {
    id: "power",
    title: "Přidej zdroj proudu",
    action: "Přidat agregát",
    reward: 100,
    done: (s) => s.hasPower,
  },
  {
    id: "amp",
    title: "Přidej zesilovač",
    action: "Přidat amp rack",
    reward: 100,
    done: (s) => s.hasAmp,
  },
  {
    id: "wire",
    title: "Zapoj celý systém",
    action: "Zapojit kabely",
    reward: 150,
    done: (s) => s.cables >= 3,
  },
  {
    id: "checklist",
    title: "Vytvoř plán pro crew",
    action: "Vytvořit plán",
    reward: 200,
    done: (s) => s.reportOpened,
  },
];

export const TOTAL_XP = QUESTS.reduce((a, q) => a + q.reward, 0);

export const LEVELS = [
  { min: 0, name: "Nováček" },
  { min: 150, name: "Stavitel" },
  { min: 350, name: "Technik" },
  { min: 600, name: "Rig Master" },
];

export function levelOf(xp: number) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]!.min) idx = i;
  const cur = LEVELS[idx]!;
  const next = LEVELS[idx + 1];
  const span = (next?.min ?? TOTAL_XP) - cur.min || 1;
  return {
    index: idx + 1,
    name: cur.name,
    nextName: next?.name ?? null,
    toNext: next ? Math.max(0, next.min - xp) : 0,
    ratio: Math.min(1, (xp - cur.min) / span),
  };
}

export function evaluateQuests(s: QuestSignals) {
  const done = QUESTS.filter((q) => q.done(s));
  const doneIds = new Set(done.map((q) => q.id));
  const xp = done.reduce((a, q) => a + q.reward, 0);
  const next = QUESTS.find((q) => !doneIds.has(q.id)) ?? null;
  return {
    doneIds,
    xp,
    next,
    completed: done.length,
    total: QUESTS.length,
    ratio: done.length / QUESTS.length,
  };
}

const KEY = "stage.journey.v1";

export function loadSeenQuests(): QuestId[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QuestId[]) : [];
  } catch {
    return [];
  }
}

export function saveSeenQuests(ids: QuestId[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}
