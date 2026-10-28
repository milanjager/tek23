// Pure placement helpers extracted from StageBuilder3D so they can be
// unit-tested without pulling in three.js / R3F.
//
// The rules encoded here drive the ghost preview colors, so keep this
// module in sync with `PlacementGhost` in StageBuilder3D.tsx.
//
// Thresholds live in a mutable PLACEMENT_TUNING object so a dev panel
// can tweak them at runtime without touching source. Ghost useFrame
// reads these each frame, so changes re-render immediately.

export const GRID_STEP = 0.1;

export interface PlacementTuning {
  /** XZ grid snap step (m). */
  gridStep: number;
  /** stackY: min XZ footprint overlap to consider "on top of" (m). */
  stackOverlapMin: number;
  /** stackY: how close a new candidate top must be to the current best (m). */
  stackTopTolerance: number;
  /** stackY: fraction of half-footprint used as center-alignment tolerance. */
  stackCenterFactor: number;
  /** hasCollision: min XZ overlap (m) before a collision is even considered. */
  collisionXZMin: number;
  /** hasCollision: min vertical overlap (m) to count as a real collision. */
  collisionVerticalMin: number;
  /** stackSnapTarget: magnetic radius as fraction of moving half-footprint. */
  stackSnapRadiusFactor: number;
  /** stackSnapTarget: how high moving must be lifted (fraction of its own height) before snap engages. */
  stackSnapLiftFactor: number;
  /** stackSnapTarget: tolerance for "tied top" preference of nearer target (m). */
  stackSnapTopTie: number;
  /** computeGhostMode: Y below this = buried (bad). */
  buriedY: number;
  /** edgeSnapXZ: magnetic tolerance for edge/row alignment (m). */
  edgeSnapTol: number;
}

export const DEFAULT_TUNING: PlacementTuning = {
  gridStep: 0.1,
  stackOverlapMin: 0.02,
  stackTopTolerance: 0.02,
  stackCenterFactor: 0.9,
  collisionXZMin: 0.05,
  collisionVerticalMin: 0.05,
  stackSnapRadiusFactor: 0.6,
  stackSnapLiftFactor: 0.5,
  stackSnapTopTie: 0.01,
  buriedY: -0.02,
  edgeSnapTol: 0.35,
};


/** Live-tunable thresholds. Mutated by the dev panel; read every frame. */
export const PLACEMENT_TUNING: PlacementTuning = { ...DEFAULT_TUNING };

export function setPlacementTuning(patch: Partial<PlacementTuning>) {
  Object.assign(PLACEMENT_TUNING, patch);
}

export function resetPlacementTuning() {
  Object.assign(PLACEMENT_TUNING, DEFAULT_TUNING);
}

export type Vec3 = [number, number, number];

export interface PlacementItem {
  id: string;
  pos: Vec3;
  /** World-space size [w, h, d] (axis-aligned; rotY is ignored on purpose). */
  size: Vec3;
}

export function snapToGridXZ(v: Vec3, step: number = PLACEMENT_TUNING.gridStep): Vec3 {
  return [
    Math.round(v[0] / step) * step,
    v[1],
    Math.round(v[2] / step) * step,
  ];
}

export interface EdgeSnapResult {
  pos: Vec3;
  /** Which axes got magnetically pulled (for ghost feedback). */
  snappedX: boolean;
  snappedZ: boolean;
  /** Ids of the neighbours the snap aligned to. */
  refIds: string[];
}

/**
 * Magnetic edge/row snapping: pulls the moving box so its side sits flush
 * against a neighbour, or so their centers / outer edges line up in a row.
 * Only neighbours on a comparable height band are considered for flush X
 * snapping (a box floating above shouldn't drag the row apart).
 * Pure — call after grid snapping, before stack resolution.
 */
export function edgeSnapXZ(
  moving: PlacementItem,
  others: PlacementItem[],
  tol: number = PLACEMENT_TUNING.edgeSnapTol,
): EdgeSnapResult {
  if (tol <= 0 || others.length === 0) {
    return { pos: [...moving.pos] as Vec3, snappedX: false, snappedZ: false, refIds: [] };
  }
  const hw = moving.size[0] / 2, hd = moving.size[2] / 2;
  const myBottom = moving.pos[1], myTop = moving.pos[1] + moving.size[1];

  let bestX: { v: number; d: number; id: string } | null = null;
  let bestZ: { v: number; d: number; id: string } | null = null;

  for (const o of others) {
    if (o.id === moving.id) continue;
    const ohw = o.size[0] / 2, ohd = o.size[2] / 2;
    const oBottom = o.pos[1], oTop = o.pos[1] + o.size[1];
    // Same height band = overlapping vertical extent (a real row neighbour).
    const sameBand = Math.min(myTop, oTop) - Math.max(myBottom, oBottom) > 0.05;

    const xCands: number[] = [o.pos[0]]; // center align
    if (sameBand) {
      xCands.push(o.pos[0] - ohw - hw, o.pos[0] + ohw + hw); // flush side-by-side
    }
    xCands.push(o.pos[0] - ohw + hw, o.pos[0] + ohw - hw); // outer edges aligned
    for (const v of xCands) {
      const d = Math.abs(v - moving.pos[0]);
      if (d <= tol && (!bestX || d < bestX.d)) bestX = { v, d, id: o.id };
    }

    const zCands = [o.pos[2], o.pos[2] - ohd + hd, o.pos[2] + ohd - hd];
    if (sameBand) zCands.push(o.pos[2] - ohd - hd, o.pos[2] + ohd + hd);
    for (const v of zCands) {
      const d = Math.abs(v - moving.pos[2]);
      if (d <= tol && (!bestZ || d < bestZ.d)) bestZ = { v, d, id: o.id };
    }
  }

  const refIds = [bestX?.id, bestZ?.id].filter((v): v is string => !!v);
  return {
    pos: [bestX ? bestX.v : moving.pos[0], moving.pos[1], bestZ ? bestZ.v : moving.pos[2]],
    snappedX: !!bestX,
    snappedZ: !!bestZ,
    refIds: [...new Set(refIds)],
  };
}



export function stackY(moving: PlacementItem, others: PlacementItem[]): number {
  const T = PLACEMENT_TUNING;
  const s = moving.size;
  const halfW = s[0] / 2, halfD = s[2] / 2;
  let best = 0;
  for (const o of others) {
    if (o.id === moving.id) continue;
    const os = o.size;
    const oTop = o.pos[1] + os[1];
    const oHalfW = os[0] / 2, oHalfD = os[2] / 2;
    const overlapX = Math.min(moving.pos[0] + halfW, o.pos[0] + oHalfW) - Math.max(moving.pos[0] - halfW, o.pos[0] - oHalfW);
    const overlapZ = Math.min(moving.pos[2] + halfD, o.pos[2] + oHalfD) - Math.max(moving.pos[2] - halfD, o.pos[2] - oHalfD);
    if (overlapX > T.stackOverlapMin && overlapZ > T.stackOverlapMin && oTop > best - T.stackTopTolerance) {
      if (
        Math.abs(moving.pos[0] - o.pos[0]) < oHalfW + halfW * T.stackCenterFactor &&
        Math.abs(moving.pos[2] - o.pos[2]) < oHalfD + halfD * T.stackCenterFactor
      ) {
        best = Math.max(best, oTop);
      }
    }
  }
  return best;
}

export function hasCollision(moving: PlacementItem, others: PlacementItem[]): boolean {
  const T = PLACEMENT_TUNING;
  const s = moving.size;
  const halfW = s[0] / 2, halfD = s[2] / 2;
  const my = moving.pos[1];
  const myTop = my + s[1];
  for (const o of others) {
    if (o.id === moving.id) continue;
    const os = o.size;
    const oHalfW = os[0] / 2, oHalfD = os[2] / 2;
    const oy = o.pos[1];
    const oTop = oy + os[1];
    const overlapX = Math.min(moving.pos[0] + halfW, o.pos[0] + oHalfW) - Math.max(moving.pos[0] - halfW, o.pos[0] - oHalfW);
    const overlapZ = Math.min(moving.pos[2] + halfD, o.pos[2] + oHalfD) - Math.max(moving.pos[2] - halfD, o.pos[2] - oHalfD);
    if (overlapX > T.collisionXZMin && overlapZ > T.collisionXZMin) {
      const vOverlap = Math.min(myTop, oTop) - Math.max(my, oy);
      if (vOverlap > T.collisionVerticalMin) return true;
    }
  }
  return false;
}

function xzOverlapAmount(a: PlacementItem, b: PlacementItem) {
  const ahw = a.size[0] / 2, ahd = a.size[2] / 2;
  const bhw = b.size[0] / 2, bhd = b.size[2] / 2;
  return {
    x: Math.min(a.pos[0] + ahw, b.pos[0] + bhw) - Math.max(a.pos[0] - ahw, b.pos[0] - bhw),
    z: Math.min(a.pos[2] + ahd, b.pos[2] + bhd) - Math.max(a.pos[2] - ahd, b.pos[2] - bhd),
  };
}

function yOverlapAmount(a: PlacementItem, b: PlacementItem) {
  return Math.min(a.pos[1] + a.size[1], b.pos[1] + b.size[1]) - Math.max(a.pos[1], b.pos[1]);
}

export function collisionIds(moving: PlacementItem, others: PlacementItem[]): string[] {
  const T = PLACEMENT_TUNING;
  const out: string[] = [];
  for (const o of others) {
    if (o.id === moving.id) continue;
    const xz = xzOverlapAmount(moving, o);
    if (xz.x <= T.collisionXZMin || xz.z <= T.collisionXZMin) continue;
    if (yOverlapAmount(moving, o) > T.collisionVerticalMin) out.push(o.id);
  }
  return out;
}

export function hasAnyOverlap(items: PlacementItem[]): boolean {
  const T = PLACEMENT_TUNING;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const xz = xzOverlapAmount(items[i], items[j]);
      if (xz.x <= T.collisionXZMin || xz.z <= T.collisionXZMin) continue;
      if (yOverlapAmount(items[i], items[j]) > T.collisionVerticalMin) return true;
    }
  }
  return false;
}

export function stackSnapTarget(
  moving: PlacementItem,
  others: PlacementItem[],
  rawY: number,
): { x: number; z: number; y: number; ontoId: string } | null {
  const T = PLACEMENT_TUNING;
  const s = moving.size;
  const halfW = s[0] / 2, halfD = s[2] / 2;
  let best: { it: PlacementItem; dist: number; top: number } | null = null;
  for (const o of others) {
    if (o.id === moving.id) continue;
    const os = o.size;
    const oHalfW = os[0] / 2, oHalfD = os[2] / 2;
    const dx = moving.pos[0] - o.pos[0];
    const dz = moving.pos[2] - o.pos[2];
    const rx = oHalfW + halfW * T.stackSnapRadiusFactor;
    const rz = oHalfD + halfD * T.stackSnapRadiusFactor;
    if (Math.abs(dx) > rx || Math.abs(dz) > rz) continue;
    const top = o.pos[1] + os[1];
    if (rawY < top - s[1] * T.stackSnapLiftFactor) continue;
    const dist = Math.hypot(dx, dz);
    if (!best || top > best.top + T.stackSnapTopTie || (Math.abs(top - best.top) < T.stackSnapTopTie && dist < best.dist)) {
      best = { it: o, dist, top };
    }
  }
  if (!best) return null;
  return { x: best.it.pos[0], z: best.it.pos[2], y: best.top, ontoId: best.it.id };
}

export type GhostMode = "ground" | "stack" | "bad";

/**
 * Mirrors the ghost color logic in PlacementGhost.useFrame:
 *   - "stack"  → cyan (snapped onto another box)
 *   - "ground" → green (valid floor placement)
 *   - "bad"    → red (buried or collides)
 */
export function computeGhostMode(
  src: PlacementItem,
  others: PlacementItem[],
  rawPos: Vec3,
  step: number = PLACEMENT_TUNING.gridStep,
): { mode: GhostMode; snappedPos: Vec3; ontoId?: string; buried: boolean; collided: string[] } {
  const T = PLACEMENT_TUNING;
  const sx = Math.round(rawPos[0] / step) * step;
  const sz = Math.round(rawPos[2] / step) * step;
  const rawY = rawPos[1];
  const candidate: PlacementItem = {
    ...src,
    pos: [sx, Math.max(0, rawY), sz],
  };

  const snap = stackSnapTarget(candidate, others, rawY);
  let mode: GhostMode = "ground";
  let ontoId: string | undefined;
  if (snap) {
    candidate.pos = [snap.x, snap.y, snap.z];
    mode = "stack";
    ontoId = snap.ontoId;
  } else {
    const y = stackY(candidate, others);
    candidate.pos = [sx, y, sz];
  }





  const buried = rawY < T.buriedY;
  const collides = hasCollision(candidate, others);
  const bad = buried || collides;
  if (bad) mode = "bad";

  const collided = bad && !buried ? collisionIds(candidate, others) : [];

  return { mode, snappedPos: candidate.pos, ontoId, buried, collided };
}

/**
 * Repairs partial vertical overlaps: any item whose XZ footprint overlaps
 * a lower item is lifted so its bottom sits exactly on the highest such
 * neighbor's top. Runs in bottom-up order so cascading stacks resolve.
 * Pure — returns a new array; caller decides whether to persist.
 */
export function sanitizeStacks<It extends PlacementItem>(items: It[]): It[] {
  const TUN = PLACEMENT_TUNING;
  const sorted = [...items].sort((a, b) => a.pos[1] - b.pos[1]);
  const fixed: It[] = [];
  for (const it of sorted) {
    const halfW = it.size[0] / 2, halfD = it.size[2] / 2;
    let requiredBottom = 0;
    for (const o of fixed) {
      if (o.id === it.id) continue;
      const oHalfW = o.size[0] / 2, oHalfD = o.size[2] / 2;
      const ox = Math.min(it.pos[0] + halfW, o.pos[0] + oHalfW) - Math.max(it.pos[0] - halfW, o.pos[0] - oHalfW);
      const oz = Math.min(it.pos[2] + halfD, o.pos[2] + oHalfD) - Math.max(it.pos[2] - halfD, o.pos[2] - oHalfD);
      if (ox > TUN.stackOverlapMin && oz > TUN.stackOverlapMin) {
        requiredBottom = Math.max(requiredBottom, o.pos[1] + o.size[1]);
      }
    }
    const finalY = requiredBottom > 0 ? Math.max(requiredBottom, it.pos[1]) : Math.max(0, it.pos[1]);
    fixed.push({ ...it, pos: [it.pos[0], finalY, it.pos[2]] });
  }
  return fixed;
}

/**
 * Moves a same-height horizontal row apart along X until no real volume overlap
 * remains. Vertical stacks are kept intact because those are intentional.
 */
export function resolveHorizontalOverlaps<It extends PlacementItem>(items: It[], gap = 0.06): It[] {
  let out = items.map((it) => ({ ...it, pos: [...it.pos] as Vec3 }));
  for (let pass = 0; pass < Math.max(12, out.length * 2); pass++) {
    let changed = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        const xz = xzOverlapAmount(a, b);
        const vy = yOverlapAmount(a, b);
        if (xz.x <= PLACEMENT_TUNING.collisionXZMin || xz.z <= PLACEMENT_TUNING.collisionXZMin || vy <= PLACEMENT_TUNING.collisionVerticalMin) continue;

        const bRight = b.pos[0] >= a.pos[0];
        const shift = xz.x + gap;
        const half = shift / 2;
        out[i] = { ...a, pos: [a.pos[0] + (bRight ? -half : half), a.pos[1], a.pos[2]] };
        out[j] = { ...b, pos: [b.pos[0] + (bRight ? half : -half), b.pos[1], b.pos[2]] };
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out as It[];
}
