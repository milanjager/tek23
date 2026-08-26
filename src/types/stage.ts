/* ============================================================
   Canonical stage types — single source of truth.
   Previously mirrored ~7× across view components; every view
   now imports from here. `kind` is intentionally `string` so
   custom speakers (runtime ids) fit without casts.
   ============================================================ */

export type CableType = "signal" | "speaker" | "power" | "dmx";

export interface StageItem {
  id: string;
  kind: string;
  /** World position of bottom-center: [x, y (stack height), z]. */
  pos: [number, number, number];
  /** Rotation around Y in radians. */
  rotY: number;
  groupId?: string;
  label?: string;
  variant?: "red" | "blue";
  /** Free-form wiring/technical notes shown in inspector and export. */
  notes?: string;
}

export interface StageCable {
  id: string;
  /** Item id — source. */
  from: string;
  /** Item id — target. */
  to: string;
  type: CableType;
}

export interface StageSpec {
  label: string;
  category: string;
  /** Meters: [w, h, d]. */
  size: [number, number, number];
}
