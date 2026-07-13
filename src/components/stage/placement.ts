// Pure placement helpers extracted from StageBuilder3D so they can be
// unit-tested without pulling in three.js / R3F.
//
// The rules encoded here drive the ghost preview colors, so keep this
// module in sync with `PlacementGhost` in StageBuilder3D.tsx.

export const GRID_STEP = 0.1;

export type Vec3 = [number, number, number];

export interface PlacementItem {
  id: string;
  pos: Vec3;
  /** World-space size [w, h, d] (axis-aligned; rotY is ignored on purpose). */
  size: Vec3;
}

export function snapToGridXZ(v: Vec3, step: number = GRID_STEP): Vec3 {
  return [
    Math.round(v[0] / step) * step,
    v[1],
    Math.round(v[2] / step) * step,
  ];
}

export function stackY(moving: PlacementItem, others: PlacementItem[]): number {
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
    if (overlapX > 0.02 && overlapZ > 0.02 && oTop > best - 0.02) {
      if (
        Math.abs(moving.pos[0] - o.pos[0]) < oHalfW + halfW * 0.9 &&
        Math.abs(moving.pos[2] - o.pos[2]) < oHalfD + halfD * 0.9
      ) {
        best = Math.max(best, oTop);
      }
    }
  }
  return best;
}

export function hasCollision(moving: PlacementItem, others: PlacementItem[]): boolean {
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
    if (overlapX > 0.05 && overlapZ > 0.05) {
      const vOverlap = Math.min(myTop, oTop) - Math.max(my, oy);
      if (vOverlap > 0.05) return true;
    }
  }
  return false;
}

export function stackSnapTarget(
  moving: PlacementItem,
  others: PlacementItem[],
  rawY: number,
): { x: number; z: number; y: number; ontoId: string } | null {
  const s = moving.size;
  const halfW = s[0] / 2, halfD = s[2] / 2;
  let best: { it: PlacementItem; dist: number; top: number } | null = null;
  for (const o of others) {
    if (o.id === moving.id) continue;
    const os = o.size;
    const oHalfW = os[0] / 2, oHalfD = os[2] / 2;
    const dx = moving.pos[0] - o.pos[0];
    const dz = moving.pos[2] - o.pos[2];
    const rx = oHalfW + halfW * 0.6;
    const rz = oHalfD + halfD * 0.6;
    if (Math.abs(dx) > rx || Math.abs(dz) > rz) continue;
    const top = o.pos[1] + os[1];
    if (rawY < top - s[1] * 0.5) continue;
    const dist = Math.hypot(dx, dz);
    if (!best || top > best.top + 0.01 || (Math.abs(top - best.top) < 0.01 && dist < best.dist)) {
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
 *
 * `rawPos` is the live drag position (pre-snap). The XZ is grid-snapped,
 * Y is used both for the buried check (rawPos[1] < -0.02) and the
 * stack-target lift check.
 */
export function computeGhostMode(
  src: PlacementItem,
  others: PlacementItem[],
  rawPos: Vec3,
  step: number = GRID_STEP,
): { mode: GhostMode; snappedPos: Vec3; ontoId?: string; buried: boolean; collided: string[] } {
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

  const buried = rawY < -0.02;
  const collides = hasCollision(candidate, others);
  const bad = buried || collides;
  if (bad) mode = "bad";

  const collided: string[] = [];
  if (bad && !buried) {
    const s = candidate.size;
    const halfW = s[0] / 2, halfD = s[2] / 2;
    for (const o of others) {
      if (o.id === src.id) continue;
      const os = o.size;
      const oHalfW = os[0] / 2, oHalfD = os[2] / 2;
      const ox = Math.min(candidate.pos[0] + halfW, o.pos[0] + oHalfW) - Math.max(candidate.pos[0] - halfW, o.pos[0] - oHalfW);
      const oz = Math.min(candidate.pos[2] + halfD, o.pos[2] + oHalfD) - Math.max(candidate.pos[2] - halfD, o.pos[2] - oHalfD);
      if (ox <= 0.05 || oz <= 0.05) continue;
      const vy = Math.min(candidate.pos[1] + s[1], o.pos[1] + os[1]) - Math.max(candidate.pos[1], o.pos[1]);
      if (vy > 0.05) collided.push(o.id);
    }
  }

  return { mode, snappedPos: candidate.pos, ontoId, buried, collided };
}
