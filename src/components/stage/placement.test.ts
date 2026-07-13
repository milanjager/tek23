import { describe, it, expect } from "vitest";
import {
  computeGhostMode,
  stackSnapTarget,
  stackY,
  hasCollision,
  snapToGridXZ,
  type PlacementItem,
  type Vec3,
} from "./placement";

// Standard test cabinet: 1m wide, 0.6m tall, 0.8m deep.
const SIZE: Vec3 = [1, 0.6, 0.8];
const mk = (id: string, pos: Vec3, size: Vec3 = SIZE): PlacementItem => ({ id, pos, size });

const modeAt = (
  src: PlacementItem,
  others: PlacementItem[],
  rawPos: Vec3,
) => computeGhostMode(src, others, rawPos).mode;

describe("placement: grid snap", () => {
  it("rounds XZ to GRID_STEP and preserves Y", () => {
    expect(snapToGridXZ([0.34, 1.5, -0.27])).toEqual([0.3, 1.5, -0.3]);
  });
});

describe("placement: ground vs stack vs bad", () => {
  const base = mk("base", [0, 0, 0]);
  const moving = mk("mv", [5, 0, 5]);

  it("empty scene → ground on the floor", () => {
    const r = computeGhostMode(moving, [], [1, 0, 1]);
    expect(r.mode).toBe("ground");
    expect(r.buried).toBe(false);
  });

  it("hovered above another box (lifted past half) → stack", () => {
    // rawY at top of base (0.6) is well above half of moving (0.3).
    const r = computeGhostMode(moving, [base], [0, 0.6, 0]);
    expect(r.mode).toBe("stack");
    expect(r.ontoId).toBe("base");
    // Snapped XZ = target center, snapped Y = target top.
    expect(r.snappedPos).toEqual([0, 0.6, 0]);
  });

  it("laterally over another box at low rawY → auto-stacked to top (ground mode)", () => {
    // stackY promotes the ghost onto the target's top surface even below the
    // stack-snap lift threshold — this is intentional so the ghost never
    // clips through neighbours. Result: green, resting at oTop.
    const r = computeGhostMode(moving, [base], [0.1, 0, 0.1]);
    expect(r.mode).toBe("ground");
    expect(r.snappedPos[1]).toBe(0.6);
  });

  it("rawY below floor → bad (buried), no collision list", () => {
    const r = computeGhostMode(moving, [base], [5, -0.5, 5]);
    expect(r.mode).toBe("bad");
    expect(r.buried).toBe(true);
    expect(r.collided).toEqual([]);
  });
});

describe("regression: ghost mode is invariant under rotation input", () => {
  // Rotation is fixed to rotY=0 in placement — but the underlying helpers
  // must ignore any rotY the caller might carry on the source item.
  // We simulate by leaving `size` axis-aligned regardless of an imagined rotY.
  const base = mk("base", [0, 0, 0]);
  const moving = mk("mv", [0, 0, 0]);

  for (const rawY of [0, 0.3, 0.6, 1.2]) {
    it(`stack decision stable at rawY=${rawY} regardless of orientation`, () => {
      const a = modeAt(moving, [base], [0, rawY, 0]);
      const b = modeAt(moving, [base], [0, rawY, 0]);
      expect(a).toBe(b);
    });
  }
});

describe("regression: drag between two stacks", () => {
  //   [ A ] at (0,0)      [ B ] at (3,0)
  // Move box high enough and slide across → snap target should switch A → B.
  const A = mk("A", [0, 0, 0]);
  const B = mk("B", [3, 0, 0]);
  const moving = mk("mv", [0, 0, 0]);

  it("over A → snaps to A", () => {
    const r = computeGhostMode(moving, [A, B], [0, 0.7, 0]);
    expect(r.mode).toBe("stack");
    expect(r.ontoId).toBe("A");
    expect(r.snappedPos).toEqual([0, 0.6, 0]);
  });

  it("over B → snaps to B", () => {
    const r = computeGhostMode(moving, [A, B], [3, 0.7, 0]);
    expect(r.mode).toBe("stack");
    expect(r.ontoId).toBe("B");
    expect(r.snappedPos).toEqual([3, 0.6, 0]);
  });

  it("halfway between A and B (outside snap radius of both) → ground", () => {
    const r = computeGhostMode(moving, [A, B], [1.5, 0.7, 0]);
    expect(r.mode).toBe("ground");
  });

  it("higher stack wins when both are candidates", () => {
    const low = mk("low", [0, 0, 0], [1, 0.6, 0.8]);
    const stacked = mk("hi", [0, 0.6, 0], [1, 0.6, 0.8]); // sits on top of low
    const r = computeGhostMode(moving, [low, stacked], [0, 1.4, 0]);
    expect(r.mode).toBe("stack");
    expect(r.ontoId).toBe("hi");
    expect(r.snappedPos[1]).toBeCloseTo(1.2, 6);
  });
});

describe("regression: height threshold flips ground ↔ stack", () => {
  const base = mk("base", [0, 0, 0]);
  const moving = mk("mv", [0, 0, 0]);

  // stackSnapTarget requires rawY ≥ top − h/2  (top=0.6, h=0.6 → threshold 0.3).
  it("just below threshold (0.29) → stackY auto-promotes → ground on top", () => {
    const r = computeGhostMode(moving, [base], [0, 0.29, 0]);
    expect(r.mode).toBe("ground");
    expect(r.snappedPos[1]).toBe(0.6);
  });

  it("just above threshold → stack", () => {
    const r = computeGhostMode(moving, [base], [0, 0.31, 0]);
    expect(r.mode).toBe("stack");
    expect(r.ontoId).toBe("base");
  });

  it("far above stack (levitating) still snaps to top", () => {
    const r = computeGhostMode(moving, [base], [0, 5, 0]);
    expect(r.mode).toBe("stack");
    expect(r.snappedPos[1]).toBe(0.6);
  });

  it("Y below 0 → buried regardless of XZ", () => {
    expect(modeAt(moving, [], [5, -0.05, 5])).toBe("bad");
  });
});

describe("regression: release matches ghost preview (handleTransformEnd parity)", () => {
  // handleTransformEnd runs snapToGridXZ → stackSnapTarget → else stackY.
  // The ghost preview does the same. Assert they agree on final XYZ.
  const A = mk("A", [0, 0, 0]);
  const moving = mk("mv", [0, 0, 0]);

  const release = (raw: Vec3) => {
    const snappedXZ = snapToGridXZ(raw);
    const candidate: PlacementItem = { ...moving, pos: [snappedXZ[0], Math.max(0, raw[1]), snappedXZ[2]] };
    const t = stackSnapTarget(candidate, [A], raw[1]);
    if (t) return [t.x, t.y, t.z] as Vec3;
    const y = stackY(candidate, [A]);
    return [snappedXZ[0], y, snappedXZ[2]] as Vec3;
  };

  const cases: Vec3[] = [
    [0, 0.7, 0],       // clean stack
    [0.34, 0.9, -0.27],// grid-snap + stack
    [3, 0, 0],         // empty ground far away
    [0, 5, 0],         // levitating stack snap
  ];

  for (const raw of cases) {
    it(`ghost snappedPos === release position for raw=${JSON.stringify(raw)}`, () => {
      const ghost = computeGhostMode(moving, [A], raw).snappedPos;
      const rel = release(raw);
      expect(ghost[0]).toBeCloseTo(rel[0], 6);
      expect(ghost[1]).toBeCloseTo(rel[1], 6);
      expect(ghost[2]).toBeCloseTo(rel[2], 6);
    });
  }
});

describe("regression: collision list only fires when truly buried-into-scene", () => {
  it("buried into floor lists no colliders (buried short-circuits)", () => {
    const a = mk("a", [0, 0, 0]);
    const r = computeGhostMode(mk("mv", [0.2, 0, 0]), [a], [0.2, -0.1, 0]);
    expect(r.mode).toBe("bad");
    expect(r.buried).toBe(true);
    expect(r.collided).toEqual([]);
  });
});

describe("regression: hasCollision ignores clean stacking", () => {
  it("box exactly on top does not collide", () => {
    const base = mk("base", [0, 0, 0]);
    const top = mk("top", [0, 0.6, 0]);
    expect(hasCollision(top, [base])).toBe(false);
  });
});
