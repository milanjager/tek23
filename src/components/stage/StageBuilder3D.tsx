import React, { useEffect, useMemo, useRef, useState, useCallback, Suspense } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  TransformControls,
  Grid,
  Html,
  ContactShadows,
  Environment,
  Line,
  Edges,
  OrthographicCamera,
} from "@react-three/drei";
import * as THREE from "three";
import {
  Speaker, Trash2, Save, Copy, ClipboardPaste, Group as GroupIcon, Ungroup,
  Move as MoveIcon, Boxes, Zap, Sparkles, Radio, Volume2,
  Cable as CableIcon, MousePointer2, Menu, X, BoxSelect, PanelLeft, PanelRight,
  Workflow, Box as BoxIcon, LayoutGrid, GalleryVerticalEnd,
} from "lucide-react";
import SchematicView from "./SchematicView";
import GridPlannerView from "./GridPlannerView";
import ElevationView from "./ElevationView";
import IsometricView from "./IsometricView";
import { PlacementDevPanel } from "./PlacementDevPanel";

// Lovable's preview annotates JSX with data-tsd-source. R3F treats dashed
// props as nested Three.js paths (data → tsd → source), so provide that path
// on Three prototypes instead of letting the renderer crash in the preview.
function ensureThreePreviewDataPath(proto: object) {
  const p = proto as { data?: { tsd?: Record<string, unknown> } };
  if (!p.data) p.data = { tsd: {} };
  else if (!p.data.tsd) p.data.tsd = {};
}
ensureThreePreviewDataPath(THREE.Object3D.prototype);
ensureThreePreviewDataPath(THREE.Material.prototype);
ensureThreePreviewDataPath(THREE.BufferGeometry.prototype);


/* ============================================================
   Types & Catalog
   ============================================================ */

type Kind =
  | "horn" | "mid" | "bass" | "sub" | "linearray" | "monitor"
  | "badtekk_sub" | "badtekk_bass" | "badtekk_top"
  | "img_0838" | "img_0839" | "img_0841" | "img_0842" | "img_0843"
  | "picus_scoop_lo" | "picus_scoop_hi" | "picus_bass_row" | "picus_shelf_bin"
  | "picus_mid_grill" | "picus_mid_stack" | "picus_top_3way" | "picus_hex_horn"
  | "picus_wing_horn" | "picus_deep_sub"
  | "amp" | "powersoft" | "mixer" | "dj" | "dj_table" | "cdj"
  | "korg" | "korg_red" | "korg_blue" | "turntable"
  | "strobe" | "laser" | "movinghead"
  | "bar" | "generator" | "distro";


type Category = "sound" | "lights" | "infra";

interface Spec {
  label: string;
  category: Category;
  size: [number, number, number]; // w, h, d (meters)
  stackable: boolean;
  hint: string;
  defaultLabel?: string;
  defaultVariant?: "red" | "blue";
}

const SPECS: Record<Kind, Spec> = {
  horn:         { label: "Horn",             category: "sound",  size: [0.60, 0.40, 0.40], stackable: true,  hint: "Výškový horn" },
  mid:          { label: "Mid",              category: "sound",  size: [0.60, 0.60, 0.50], stackable: true,  hint: "Střední pásmo" },
  bass:         { label: "Bass bin",         category: "sound",  size: [0.80, 0.60, 0.70], stackable: true,  hint: "Basová bedna" },
  sub:          { label: "Sub 2×18",         category: "sound",  size: [1.20, 0.80, 0.90], stackable: true,  hint: "Sub-bass" },
  linearray:    { label: "Line array",       category: "sound",  size: [0.90, 0.28, 0.55], stackable: true,  hint: "Line array element" },
  monitor:      { label: "Stage monitor",    category: "sound",  size: [0.60, 0.40, 0.45], stackable: true,  hint: "Wedge odposlech" },
  badtekk_sub:  { label: "Badtekk Sub",      category: "sound",  size: [1.20, 0.80, 0.90], stackable: true,  hint: "Badtekk 2×18\" sub", defaultLabel: "Badtekk Sub" },
  badtekk_bass: { label: "Badtekk Bass",     category: "sound",  size: [0.90, 0.65, 0.75], stackable: true,  hint: "Badtekk 2×15\" bass", defaultLabel: "Badtekk Bass" },
  badtekk_top:  { label: "Badtekk Top",      category: "sound",  size: [0.65, 0.55, 0.45], stackable: true,  hint: "Badtekk W-bin top", defaultLabel: "Badtekk Top" },
  img_0838:     { label: "JB181 4×18\" RCF LF18G401", category: "sound", size: [0.80, 1.20, 0.90], stackable: true, hint: "4× JB181 – RCF LF18G401", defaultLabel: "JB181 4×18\"" },
  img_0839:     { label: "JB181 4×18\" RCF LF18G401", category: "sound", size: [0.85, 1.30, 0.95], stackable: true, hint: "4× JB181 – RCF LF18G401", defaultLabel: "JB181 4×18\"" },
  img_0841:     { label: "JB218 2×18\" RCF LF18N401", category: "sound", size: [1.20, 0.80, 0.95], stackable: true, hint: "2× JB218 – RCF LF18N401", defaultLabel: "JB218 2×18\"" },
  img_0842:     { label: "JB181 stack",       category: "sound",  size: [0.75, 1.80, 0.85], stackable: true,  hint: "Stack JB181 skříní", defaultLabel: "JB181 stack" },
  img_0843:     { label: "Picus top grill",   category: "sound",  size: [1.80, 1.60, 0.85], stackable: true,  hint: "Top řada s hex mřížkou", defaultLabel: "Picus top" },

  // --- Picus wall (10 kabinetů z reference fotky) ---
  picus_scoop_lo:   { label: "Picus Scoop Lo 4×18\"",   category: "sound", size: [1.00, 1.00, 0.90], stackable: true, hint: "Spodní řada – 4×18\" scoop sub (žluté kříže)",     defaultLabel: "Picus Scoop Lo" },
  picus_scoop_hi:   { label: "Picus Scoop Hi 4×18\"",   category: "sound", size: [1.00, 1.00, 0.90], stackable: true, hint: "Druhá řada – 4×18\" scoop sub (žluté kříže)",     defaultLabel: "Picus Scoop Hi" },
  picus_bass_row:   { label: "Picus Bass 2×15\"",       category: "sound", size: [1.00, 0.55, 0.75], stackable: true, hint: "Horní krátká řada – 2×15\" bass shelf",           defaultLabel: "Picus Bass" },
  picus_shelf_bin:  { label: "Picus Shelf 1×15\"",      category: "sound", size: [0.80, 0.55, 0.70], stackable: true, hint: "Doplňková krátká shelf bedna",                    defaultLabel: "Picus Shelf" },
  picus_mid_grill:  { label: "Picus Mid Grill 2×12\"",  category: "sound", size: [0.80, 1.80, 0.55], stackable: true, hint: "Centrální perforovaná mid věž (2×12\")",          defaultLabel: "Picus Mid Grill" },
  picus_mid_stack:  { label: "Picus Mid Stack 2×12\"",  category: "sound", size: [0.90, 1.40, 0.70], stackable: true, hint: "Dvojitý mid stack ve středu (2×12\" v páru)",     defaultLabel: "Picus Mid Stack" },
  picus_top_3way:   { label: "Picus Top 3-way",         category: "sound", size: [0.90, 0.70, 0.60], stackable: true, hint: "Letěný 3-way top (mid + horn) se žlutou vzpěrou", defaultLabel: "Picus Top 3-way" },
  picus_hex_horn:   { label: "Picus Hex Horn",          category: "sound", size: [1.40, 0.90, 0.60], stackable: true, hint: "Boční hex-array cluster (3× šestihran)",          defaultLabel: "Picus Hex" },
  picus_wing_horn:  { label: "Picus Wing Horn",         category: "sound", size: [1.10, 0.70, 0.55], stackable: true, hint: "Boční wing horn (2× drivery)",                    defaultLabel: "Picus Wing" },
  picus_deep_sub:   { label: "Picus Deep Sub 2×21\"",   category: "sound", size: [1.20, 1.10, 1.05], stackable: true, hint: "Hluboký scoop-sub s prodlouženou komorou",        defaultLabel: "Picus Deep Sub" },
  amp:          { label: "Amp rack",         category: "infra",  size: [0.60, 0.90, 0.60], stackable: true,  hint: "Rack zesilovačů" },
  powersoft:    { label: "Powersoft K20",    category: "infra",  size: [0.60, 0.90, 0.60], stackable: true,  hint: "Powersoft výkonový amp", defaultLabel: "Powersoft" },
  mixer:        { label: "Mixer",            category: "infra",  size: [0.80, 0.15, 0.55], stackable: false, hint: "Mixážní pult" },
  dj:           { label: "DJ booth",         category: "infra",  size: [1.60, 1.00, 0.70], stackable: true,  hint: "DJ pult" },
  dj_table:     { label: "DJ stůl",          category: "infra",  size: [1.80, 0.95, 0.70], stackable: true,  hint: "Stůl pod DJ techniku (Korg, CDJ, mixer…)" },

  cdj:          { label: "CDJ",              category: "infra",  size: [0.35, 0.10, 0.42], stackable: false, hint: "CDJ přehrávač" },
  korg:         { label: "Korg live",        category: "infra",  size: [0.75, 0.10, 0.40], stackable: false, hint: "Korg groovebox" },
  korg_red:     { label: "Korg červený",     category: "infra",  size: [0.75, 0.10, 0.40], stackable: false, hint: "Korg groovebox – červený", defaultLabel: "Korg červený", defaultVariant: "red" },
  korg_blue:    { label: "Korg modrý",       category: "infra",  size: [0.75, 0.10, 0.40], stackable: false, hint: "Korg groovebox – modrý",   defaultLabel: "Korg modrý",   defaultVariant: "blue" },
  turntable:    { label: "Gramofon",         category: "infra",  size: [0.45, 0.15, 0.35], stackable: false, hint: "Vinyl deck" },
  strobe:       { label: "Strobo",           category: "lights", size: [0.45, 0.30, 0.20], stackable: false, hint: "Stroboskop" },
  laser:        { label: "Laser",            category: "lights", size: [0.40, 0.25, 0.35], stackable: false, hint: "Laser" },
  movinghead:   { label: "Moving head",      category: "lights", size: [0.35, 0.55, 0.35], stackable: false, hint: "Otočná hlava" },
  bar:          { label: "Bar",              category: "infra",  size: [2.40, 1.10, 0.65], stackable: false, hint: "Bar pult" },
  generator:    { label: "Aggregát",         category: "infra",  size: [1.50, 1.20, 0.85], stackable: false, hint: "Diesel generátor" },
  distro:       { label: "Rozdělovač",       category: "infra",  size: [0.60, 0.35, 0.40], stackable: true,  hint: "Silový rozvaděč / power distro (CEE in → 230V outs + DMX/SIG patch)", defaultLabel: "Rozdělovač" },
  
};


const CATEGORIES: { id: Category; label: string; icon: typeof Speaker }[] = [
  { id: "sound",  label: "Sound",  icon: Volume2 },
  { id: "lights", label: "Lights", icon: Sparkles },
  { id: "infra",  label: "Infra",  icon: Radio },
];

interface Placed {
  id: string;
  kind: Kind;
  pos: [number, number, number]; // world position of bottom-center
  rotY: number;                  // radians
  groupId?: string;
  label?: string;
  variant?: "red" | "blue";
}

type PresetKind = "namel_wall" | "club_stack" | "festival_ground";

type CableType = "signal" | "speaker" | "power" | "dmx";

interface Cable {
  id: string;
  from: string; // item id
  to: string;   // item id
  type: CableType;
}

const CABLE_META: Record<CableType, { label: string; short: string; color: string; width: number }> = {
  signal:  { label: "Signál (XLR / jack)",  short: "SIG",   color: "#a3ff12", width: 1.6 },
  speaker: { label: "Repro (Speakon)",       short: "SPK",   color: "#05d9e8", width: 3.0 },
  power:   { label: "Silový (230V)",         short: "PWR",   color: "#ff2a6d", width: 2.4 },
  dmx:     { label: "DMX / světla",          short: "DMX",   color: "#f4c11a", width: 1.4 },
};

const STORAGE = "stagerig3d:v2";
const uid = () => Math.random().toString(36).slice(2, 10);

// ---- Connector catalog ------------------------------------------------------
// Each Kind exposes specific plug points (SIG / SPK / PWR / DMX) with role
// ("in" = female / input, "out" = male / output) and a local offset relative
// to the item's bottom-center. Cables snap onto real connectors, so routing
// on scene matches how the gear is actually wired.

type ConnRole = "in" | "out";
interface Connector {
  type: CableType;
  role: ConnRole;
  offset: [number, number, number]; // local (before rotation)
}

function connectorsFor(kind: Kind): Connector[] {
  const [bx, by, bz] = SPECS[kind].size;
  const passiveSpeaker: Connector[] = [
    { type: "speaker", role: "in", offset: [ bx * 0.28, by * 0.85, -bz * 0.45] },
  ];
  switch (kind) {
    // Passive PA cabinets — one Speakon input on the back.
    case "horn":
    case "mid":
    case "bass":
    case "sub":
    case "badtekk_sub":
    case "badtekk_bass":
    case "badtekk_top":
    case "img_0838":
    case "img_0839":
    case "img_0841":
    case "img_0842":
    case "img_0843":
    case "picus_scoop_lo":
    case "picus_scoop_hi":
    case "picus_bass_row":
    case "picus_shelf_bin":
    case "picus_mid_grill":
    case "picus_mid_stack":
    case "picus_top_3way":
    case "picus_hex_horn":
    case "picus_wing_horn":
    case "picus_deep_sub":
    case "linearray":
    case "monitor":
      return passiveSpeaker;

    // Power amps — SIG in, SPK out, PWR in.
    case "amp":
    case "powersoft":
      return [
        { type: "signal",  role: "in",  offset: [-bx * 0.30, by * 0.82, -bz * 0.50] },
        { type: "speaker", role: "out", offset: [ bx * 0.30, by * 0.82, -bz * 0.50] },
        { type: "power",   role: "in",  offset: [ 0,         by * 0.15, -bz * 0.50] },
      ];

    // Mixer — signal in/out + power.
    case "mixer":
      return [
        { type: "signal", role: "in",  offset: [-bx * 0.35, by * 0.55, -bz * 0.50] },
        { type: "signal", role: "out", offset: [ bx * 0.35, by * 0.55, -bz * 0.50] },
        { type: "power",  role: "in",  offset: [ 0,         by * 0.10, -bz * 0.50] },
      ];

    // DJ deck / grooveboxes — signal out + power in.
    case "dj":
      return [
        { type: "signal", role: "out", offset: [ bx * 0.35, by * 0.90, -bz * 0.40] },
        { type: "power",  role: "in",  offset: [-bx * 0.35, by * 0.10, -bz * 0.40] },
      ];
    case "cdj":
    case "turntable":
    case "korg":
    case "korg_red":
    case "korg_blue":
      return [
        { type: "signal", role: "out", offset: [ bx * 0.35, by * 0.55, -bz * 0.50] },
        { type: "power",  role: "in",  offset: [-bx * 0.35, by * 0.55, -bz * 0.50] },
      ];

    // Lights — DMX in + power in.
    case "movinghead":
      return [
        { type: "dmx",   role: "in", offset: [ bx * 0.30, by * 0.15, -bz * 0.40] },
        { type: "power", role: "in", offset: [-bx * 0.30, by * 0.15, -bz * 0.40] },
      ];
    case "strobe":
    case "laser":
      return [
        { type: "dmx",   role: "in", offset: [ bx * 0.30, by * 0.55, -bz * 0.50] },
        { type: "power", role: "in", offset: [-bx * 0.30, by * 0.55, -bz * 0.50] },
      ];

    // Generator — pure PWR source.
    case "generator":
      return [
        { type: "power", role: "out", offset: [ bx * 0.35, by * 0.35,  bz * 0.50] },
        { type: "power", role: "out", offset: [-bx * 0.35, by * 0.35,  bz * 0.50] },
      ];

    // Power distro — 1× PWR in, 4× PWR out + DMX pass-through.
    case "distro":
      return [
        { type: "power", role: "in",  offset: [-bx * 0.40, by * 0.60, -bz * 0.50] },
        { type: "power", role: "out", offset: [ bx * 0.10, by * 0.60, -bz * 0.50] },
        { type: "power", role: "out", offset: [ bx * 0.25, by * 0.60, -bz * 0.50] },
        { type: "power", role: "out", offset: [ bx * 0.40, by * 0.60, -bz * 0.50] },
        { type: "dmx",   role: "in",  offset: [-bx * 0.40, by * 0.25, -bz * 0.50] },
        { type: "dmx",   role: "out", offset: [ bx * 0.40, by * 0.25, -bz * 0.50] },
      ];

    // Passive furniture — no connectors.
    case "bar":
    case "dj_table":
      return [];

  }
}

function localToWorld(
  item: Placed,
  local: [number, number, number],
): [number, number, number] {
  const cs = Math.cos(item.rotY), sn = Math.sin(item.rotY);
  const [lx, ly, lz] = local;
  return [
    item.pos[0] + lx * cs + lz * sn,
    item.pos[1] + ly,
    item.pos[2] + (-lx * sn + lz * cs),
  ];
}

function hasConnector(kind: Kind, type: CableType): boolean {
  return connectorsFor(kind).some((c) => c.type === type);
}

// Returns null when target can accept this cable end, otherwise a human-readable
// reason why the connection is incompatible (shown in the cable inspector).
function connectorIncompatibility(
  target: Placed,
  type: CableType,
  end: "from" | "to",
): string | null {
  const cs = connectorsFor(target.kind);
  const label = SPECS[target.kind].label;
  const short = CABLE_META[type].short;
  const full = CABLE_META[type].label;
  if (!cs.length) return `${label} nemá žádné konektory.`;
  const matches = cs.filter((c) => c.type === type);
  if (!matches.length) {
    const available = Array.from(new Set(cs.map((c) => CABLE_META[c.type].short))).join(", ");
    return `${label} nemá konektor typu ${short} (${full}). Dostupné: ${available}.`;
  }
  const neededRole: "in" | "out" = end === "from" ? "out" : "in";
  if (!matches.some((c) => c.role === neededRole)) {
    const have = matches[0].role.toUpperCase();
    return `${label} má ${short} pouze jako ${have}, pro ${end === "from" ? "zdroj" : "cíl"} je potřeba ${neededRole.toUpperCase()}.`;
  }
  return null;
}

// Pick the best pair of connectors between a and b for the given cable type.
// Prefers OUT on source, IN on target. Falls back to any connector of that
// type, then to the generic anchorFor() so legacy items still route.
function bestAnchorPair(
  a: Placed,
  b: Placed,
  type: CableType,
): { p1: [number, number, number]; p2: [number, number, number] } {
  const ca = connectorsFor(a.kind).filter((c) => c.type === type);
  const cb = connectorsFor(b.kind).filter((c) => c.type === type);
  if (ca.length && cb.length) {
    const outA = ca.find((c) => c.role === "out") ?? ca[0];
    const inB  = cb.find((c) => c.role === "in")  ?? cb[0];
    return { p1: localToWorld(a, outA.offset), p2: localToWorld(b, inB.offset) };
  }
  return { p1: anchorFor(a, type), p2: anchorFor(b, type) };
}

// Legacy generic anchor — kept as fallback for items with no specific plug.
function anchorFor(item: Placed, type: CableType): [number, number, number] {
  const s = SPECS[item.kind].size;
  const [x, y, z] = item.pos;
  const cs = Math.cos(item.rotY), sn = Math.sin(item.rotY);
  let lx = 0, ly = s[1] * 0.9, lz = -s[2] * 0.35;
  if (type === "power")   { ly = s[1] * 0.15; lz = -s[2] * 0.4; }
  if (type === "speaker") { ly = s[1] * 0.75; lz =  s[2] * 0.4; }
  if (type === "dmx")     { ly = s[1] * 0.95; lz = -s[2] * 0.2; lx = s[0] * 0.3; }
  const wx = lx * cs + lz * sn;
  const wz = -lx * sn + lz * cs;
  return [x + wx, y + ly, z + wz];
}

// Cables run like real touring rigs: drop from the source connector down to
// the floor, run orthogonally along the ground, then rise up to the target.
// A per-cable seed offsets each floor run laterally so parallel cables don't
// stack on top of each other.
function cablePoints(
  a: [number, number, number],
  b: [number, number, number],
  seed = 0,
): [number, number, number][] {
  const [ax, ay, az] = a;
  const [bx, by, bz] = b;
  // Lateral fan-out so parallel runs don't overlap.
  const spread = ((seed % 9) - 4) * 0.05;
  const floorY = 0.02 + Math.abs((seed % 5) * 0.008); // rest on the ground
  // Route on ground: down → over-Z → over-X → up. Choose leg order based on
  // deltas to keep the visible bend closer to the shorter side.
  const dx = bx - ax, dz = bz - az;
  const zFirst = Math.abs(dz) >= Math.abs(dx);
  const midX = ax + (zFirst ? 0 : dx * 0.5);
  const midZ = az + (zFirst ? dz * 0.5 : 0);
  return [
    [ax, ay, az],
    [ax, ay * 0.35 + 0.05, az],                    // slack drop out of connector
    [ax + spread, floorY, az + spread],            // land on floor
    [zFirst ? ax + spread : midX + spread, floorY, zFirst ? midZ + spread : az + spread],
    [zFirst ? bx + spread : midX + spread, floorY, zFirst ? midZ + spread : bz + spread],
    [bx + spread, floorY, bz + spread],            // arrive at target foot
    [bx, by * 0.35 + 0.05, bz],                    // rise to target connector
    [bx, by, bz],
  ];
}




// Highlighted connector endpoint drawn at a cable's plug position.
// Grows and pulses when the user is picking a new target for reconnect,
// gently glows when the cable is selected or hovered.
function CableEndpoint({
  position,
  color,
  state,
}: {
  position: [number, number, number];
  color: string;
  state: "idle" | "hover" | "selected" | "active";
}) {
  const inner = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const baseSize = state === "idle" ? 0.05 : state === "hover" ? 0.07 : 0.09;
  const emissive = state === "active" ? 2.4 : state === "selected" ? 1.4 : state === "hover" ? 1.0 : 0.55;

  useFrame((_, dt) => {
    if (state === "active" && inner.current) {
      const t = performance.now() / 1000;
      const s = 1 + Math.sin(t * 6) * 0.35;
      inner.current.scale.setScalar(s);
    } else if (inner.current) {
      inner.current.scale.setScalar(1);
    }
    if (ring.current && ringMat.current) {
      if (state === "active" || state === "selected") {
        const t = (performance.now() / 1000) % 1.2;
        const p = t / 1.2;
        const s = 1 + p * (state === "active" ? 4 : 2.5);
        ring.current.scale.setScalar(s);
        ringMat.current.opacity = (1 - p) * (state === "active" ? 0.9 : 0.55);
      } else {
        ringMat.current.opacity = 0;
      }
    }
  });

  return (
    <group position={position}>
      <mesh ref={inner}>
        <sphereGeometry args={[baseSize, 16, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[baseSize * 1.4, baseSize * 1.7, 24]} />
        <meshBasicMaterial ref={ringMat} color={color} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// Animated dash flow along a polyline — signals direction of a focused cable.
function CableFlow({
  points, color, width,
}: {
  points: [number, number, number][];
  color: string;
  width: number;
}) {
  const ref = useRef<any>(null);
  useFrame(() => {
    const mat = ref.current?.material;
    if (mat && "dashOffset" in mat) {
      mat.dashOffset = (mat.dashOffset ?? 0) - 0.03;
    }
  });
  return (
    <Line
      ref={ref}
      points={points as unknown as [number, number, number][]}
      color={color}
      lineWidth={Math.max(1, width - 0.5)}
      dashed
      dashSize={0.22}
      gapSize={0.16}
      transparent
      opacity={0.95}
      depthTest={false}
    />
  );
}





/* ============================================================
   3D Models — parametric low-poly per kind
   ============================================================ */

const WOOD = "#1a1a1a";        // freetekno cabinets are black
const WOOD_DARK = "#0a0a0a";
const GRILLE = "#050505";
const METAL = "#1a1a1a";
const CHROME = "#8a8f95";
const TEAL = "#0d8a8a";        // signature teal/cyan grille frame
const YELLOW = "#f4c11a";      // freetekno yellow crosshair
const PALLET_WOOD = "#7a5a30";

function Pallet({ w, d }: { w: number; d: number }) {
  // EUR pallet-ish: 3 top planks, 3 bottom blocks
  const H = 0.14;
  return (
    <group position={[0, H / 2, 0]}>
      {[-1, 0, 1].map((i) => (
        <mesh key={`t${i}`} position={[0, H * 0.3, i * (d / 3)]} castShadow receiveShadow>
          <boxGeometry args={[w, H * 0.35, d / 3.4]} />
          <meshStandardMaterial color={PALLET_WOOD} roughness={0.95} />
        </mesh>
      ))}
      {[-1, 0, 1].map((i) => (
        <mesh key={`b${i}`} position={[i * (w / 3), -H * 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[w / 4, H * 0.5, d]} />
          <meshStandardMaterial color={"#5a3f20"} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Cabinet({
  size, color = WOOD, grilleColor = GRILLE, cornerColor = TEAL,
  frontDetail, tealFrame = false, yellowCross = false, onPallet = false,
}: {
  size: [number, number, number];
  color?: string;
  grilleColor?: string;
  cornerColor?: string;
  frontDetail?: React.ReactNode;
  tealFrame?: boolean;
  yellowCross?: boolean;
  onPallet?: boolean;
}) {

  const [w, h, d] = size;
  const palletH = onPallet ? 0.14 : 0;
  return (
    <group position={[0, palletH, 0]}>
      {onPallet && <group position={[0, -palletH, 0]}><Pallet w={w * 1.02} d={d * 1.02} /></group>}
      {/* Body */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.08} />
        <Edges threshold={15} color="#000000" scale={1.001} />
      </mesh>
      {/* Front grille panel */}
      <mesh position={[0, h / 2, d / 2 + 0.001]}>
        <planeGeometry args={[w * 0.9, h * 0.9]} />
        <meshStandardMaterial color={grilleColor} roughness={0.95} metalness={0.15} />
      </mesh>
      {/* Teal frame around grille (4 bars) */}
      {tealFrame && (
        <group position={[0, h / 2, d / 2 + 0.003]}>
          <mesh position={[0, h * 0.44, 0]}><boxGeometry args={[w * 0.95, 0.03, 0.015]} /><meshStandardMaterial color={TEAL} roughness={0.6} metalness={0.3} /></mesh>
          <mesh position={[0, -h * 0.44, 0]}><boxGeometry args={[w * 0.95, 0.03, 0.015]} /><meshStandardMaterial color={TEAL} roughness={0.6} metalness={0.3} /></mesh>
          <mesh position={[w * 0.46, 0, 0]}><boxGeometry args={[0.03, h * 0.92, 0.015]} /><meshStandardMaterial color={TEAL} roughness={0.6} metalness={0.3} /></mesh>
          <mesh position={[-w * 0.46, 0, 0]}><boxGeometry args={[0.03, h * 0.92, 0.015]} /><meshStandardMaterial color={TEAL} roughness={0.6} metalness={0.3} /></mesh>
        </group>
      )}
      {/* Yellow crosshair (spray-paint) */}
      {yellowCross && (
        <group position={[0, h / 2, d / 2 + 0.004]}>
          <mesh><boxGeometry args={[w * 0.55, 0.025, 0.005]} /><meshStandardMaterial color={YELLOW} emissive={YELLOW} emissiveIntensity={0.2} roughness={0.8} /></mesh>
          <mesh><boxGeometry args={[0.025, h * 0.55, 0.005]} /><meshStandardMaterial color={YELLOW} emissive={YELLOW} emissiveIntensity={0.2} roughness={0.8} /></mesh>
        </group>
      )}
      {/* Corner protectors (8) */}
      {([-1, 1] as const).map((sx) =>
        ([-1, 1] as const).map((sy) =>
          ([-1, 1] as const).map((sz) => (
            <mesh
              key={`${sx}${sy}${sz}`}
              position={[sx * (w / 2 - 0.04), h / 2 + sy * (h / 2 - 0.04), sz * (d / 2 - 0.04)]}
            >
              <boxGeometry args={[0.08, 0.08, 0.08]} />
              <meshStandardMaterial color={cornerColor} metalness={0.5} roughness={0.5} />
            </mesh>
          ))
        )
      )}
      {frontDetail && (
        <group position={[0, h / 2, d / 2 + 0.006]}>{frontDetail}</group>
      )}
    </group>
  );
}


function Cone({ radius, depth, color = "#0e0e0e" }: { radius: number; depth: number; color?: string }) {
  return (
    <mesh>
      <cylinderGeometry args={[radius, radius * 0.35, depth, 24]} />
      <meshStandardMaterial color={color} roughness={0.7} metalness={0.2} />
    </mesh>
  );
}

function HornFlare({ size }: { size: number }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[size * 0.6, size * 0.2, size * 0.5, 4, 1, false]} />
      <meshStandardMaterial color="#111" roughness={0.6} metalness={0.4} />
    </mesh>
  );
}

function HornModel({ size }: { size: [number, number, number] }) {
  const [w, h] = size;
  return (
    <Cabinet
      size={size}
      color={WOOD}
      tealFrame={false}
      yellowCross={false}
      frontDetail={
        <group>
          <mesh position={[0, 0, 0.02]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[Math.min(w, h) * 0.35, Math.min(w, h) * 0.15, 0.05, 16]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <sphereGeometry args={[Math.min(w, h) * 0.12, 16, 12]} />
            <meshStandardMaterial color={CHROME} metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      }
    />
  );
}


function MidModel({ size }: { size: [number, number, number] }) {
  const [w, h] = size;
  const r = Math.min(w, h) * 0.28;
  return (
    <Cabinet
      size={size}
      tealFrame={true}
      yellowCross={false}
      frontDetail={
        <group>
          <mesh position={[0, h * 0.12, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[r, r * 0.8, 0.06, 24]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.7} />
          </mesh>
          <mesh position={[0, -h * 0.2, 0.005]}>
            <planeGeometry args={[w * 0.5, 0.06]} />
            <meshStandardMaterial color={CHROME} metalness={0.9} roughness={0.3} />
          </mesh>
        </group>
      }
    />
  );
}


function BassModel({ size }: { size: [number, number, number] }) {
  const [w, h] = size;
  const r = Math.min(w * 0.35, h * 0.42);
  return (
    <Cabinet
      size={size}
      tealFrame={true}
      yellowCross={false}
      frontDetail={
        <group>
          <mesh position={[-w * 0.2, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[r, r * 0.7, 0.08, 24]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.6} />
          </mesh>
          <mesh position={[w * 0.2, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[r, r * 0.7, 0.08, 24]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.6} />
          </mesh>
        </group>
      }
    />
  );
}


function SubModel({ size }: { size: [number, number, number] }) {
  // KS28-inspired: dual 18" front drivers with a vented port between them.
  const [w, h] = size;
  const r = Math.min(w * 0.22, h * 0.34);
  return (
    <Cabinet
      size={size}
      color={WOOD_DARK}
      tealFrame={false}
      yellowCross={false}
      onPallet={true}
      frontDetail={
        <group>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * w * 0.26, 0, 0.012]}>
              {/* Basket */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[r * 1.05, r * 1.05, 0.02, 40]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.6} metalness={0.5} />
              </mesh>
              {/* Cone */}
              <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[r * 0.92, 0.045, 40, 1, true]} />
                <meshStandardMaterial color="#0b0b0b" roughness={0.9} side={THREE.DoubleSide} />
              </mesh>
              {/* Dust cap */}
              <mesh position={[0, 0, 0.05]}>
                <sphereGeometry args={[r * 0.38, 20, 14]} />
                <meshStandardMaterial color="#141414" roughness={0.5} metalness={0.35} />
              </mesh>
              {/* Bolt ring */}
              {Array.from({ length: 8 }).map((_, i) => {
                const a = (i / 8) * Math.PI * 2;
                return (
                  <mesh key={i} position={[Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02, 0.014]}>
                    <cylinderGeometry args={[0.006, 0.006, 0.008, 6]} />
                    <meshStandardMaterial color={CHROME} metalness={0.9} roughness={0.25} />
                  </mesh>
                );
              })}
            </group>
          ))}
          {/* Center bass-reflex port slot */}
          <mesh position={[0, 0, 0.005]}>
            <boxGeometry args={[w * 0.14, h * 0.55, 0.02]} />
            <meshStandardMaterial color="#050505" roughness={0.95} />
          </mesh>
          {/* Recessed side handles */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * w * 0.46, 0, 0.005]}>
              <boxGeometry args={[0.04, h * 0.22, 0.015]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
            </mesh>
          ))}
        </group>
      }
    />
  );
}


function LineArrayModel({ size }: { size: [number, number, number] }) {
  // K2-inspired: 3 stacked trapezoidal elements, dual LF + HF waveguide,
  // rigging plates on sides + top frame.
  const [w, h, d] = size;
  const eH = h / 3;
  return (
    <group>
      {[0, 1, 2].map((i) => {
        const off = i * eH;
        const splay = i * 0.06;
        const eltW = w * (1 - i * 0.02);
        return (
          <group key={i} position={[0, off + eH / 2, 0]} rotation={[splay, 0, 0]}>
            {/* Body */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[eltW, eH * 0.92, d]} />
              <meshStandardMaterial color="#0a0a0a" roughness={0.55} metalness={0.35} />
            </mesh>
            {/* Baffle */}
            <mesh position={[0, 0, d / 2 + 0.001]}>
              <planeGeometry args={[eltW * 0.94, eH * 0.86]} />
              <meshStandardMaterial color="#050505" roughness={0.85} />
            </mesh>
            {/* Twin LF drivers */}
            {[-1, 1].map((s) => (
              <group key={s} position={[s * eltW * 0.28, 0, d / 2 + 0.003]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[eH * 0.28, eH * 0.28, 0.008, 24]} />
                  <meshStandardMaterial color="#141414" roughness={0.55} metalness={0.45} />
                </mesh>
                <mesh position={[0, 0, 0.006]}>
                  <sphereGeometry args={[eH * 0.11, 14, 10]} />
                  <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.4} />
                </mesh>
              </group>
            ))}
            {/* HF waveguide slot */}
            <mesh position={[0, 0, d / 2 + 0.004]}>
              <boxGeometry args={[eltW * 0.08, eH * 0.55, 0.008]} />
              <meshStandardMaterial color={CHROME} metalness={0.85} roughness={0.3} />
            </mesh>
            {/* Rigging plates */}
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * (eltW / 2 + 0.008), 0, 0]}>
                <boxGeometry args={[0.012, eH * 0.7, d * 0.85]} />
                <meshStandardMaterial color="#2a2a2a" metalness={0.75} roughness={0.35} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* Top rigging frame */}
      <mesh position={[0, h + 0.02, 0]}>
        <boxGeometry args={[w * 0.9, 0.03, d * 0.9]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.35} />
      </mesh>
    </group>
  );
}

function MonitorModel({ size }: { size: [number, number, number] }) {
  // X15-style stage wedge with 15" LF + horn.
  const [w, h, d] = size;
  const r = Math.min(h * 0.34, w * 0.26);
  return (
    <group rotation={[-0.38, 0, 0]} position={[0, h * 0.18, 0]}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Front grille */}
      <mesh position={[0, h / 2, d / 2 + 0.002]}>
        <planeGeometry args={[w * 0.94, h * 0.86]} />
        <meshStandardMaterial color="#050505" roughness={0.9} />
      </mesh>
      {/* 15" LF */}
      <group position={[0, h * 0.4, d / 2 + 0.005]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r, r, 0.01, 32]} />
          <meshStandardMaterial color="#141414" roughness={0.55} metalness={0.45} />
        </mesh>
        <mesh position={[0, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[r * 0.85, 0.035, 32, 1, true]} />
          <meshStandardMaterial color="#0b0b0b" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, 0.032]}>
          <sphereGeometry args={[r * 0.32, 16, 12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.4} />
        </mesh>
      </group>
      {/* HF horn */}
      <mesh position={[0, h * 0.82, d / 2 + 0.005]}>
        <boxGeometry args={[w * 0.55, h * 0.18, 0.02]} />
        <meshStandardMaterial color={CHROME} metalness={0.85} roughness={0.3} />
      </mesh>
      {/* Side handles */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - 0.005), h * 0.5, 0]}>
          <boxGeometry args={[0.012, 0.05, d * 0.35]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function AmpRack({ size, brand = "generic" }: { size: [number, number, number]; brand?: "generic" | "powersoft" }) {
  const [w, h, d] = size;
  const isPS = brand === "powersoft";
  const ledColor = isPS ? "#05d9e8" : "#f43f5e";
  const rackColor = isPS ? "#141a22" : "#1e1e1e";
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={isPS ? "#0a0f14" : "#111"} roughness={0.5} metalness={0.55} />
      </mesh>
      {/* Rack units */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[0, 0.15 + i * (h - 0.3) / 4 + (h - 0.3) / 8, d / 2 + 0.001]}>
          <mesh>
            <planeGeometry args={[w * 0.9, (h - 0.3) / 4 * 0.85]} />
            <meshStandardMaterial color={rackColor} metalness={0.7} roughness={0.35} />
          </mesh>
          {/* LEDs */}
          {[-1, 0, 1].map((k) => (
            <mesh key={k} position={[k * w * 0.15, 0, 0.005]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshStandardMaterial color={ledColor} emissive={ledColor} emissiveIntensity={2} />
            </mesh>
          ))}
          {/* Powersoft cyan branding stripe on top rack unit */}
          {isPS && i === 3 && (
            <mesh position={[w * 0.28, 0, 0.006]}>
              <planeGeometry args={[w * 0.35, 0.015]} />
              <meshStandardMaterial color="#05d9e8" emissive="#05d9e8" emissiveIntensity={1.2} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}


function MixerModel({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]} rotation={[-0.15, 0, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#141414" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Knob grid */}
      {Array.from({ length: 6 }).map((_, i) =>
        Array.from({ length: 3 }).map((_, j) => (
          <mesh
            key={`${i}-${j}`}
            position={[
              -w / 2 + 0.08 + i * (w - 0.16) / 5,
              h + 0.005,
              -d / 2 + 0.08 + j * (d - 0.16) / 2,
            ]}
          >
            <cylinderGeometry args={[0.018, 0.018, 0.02, 12]} />
            <meshStandardMaterial color="#e5e5e5" metalness={0.6} roughness={0.4} />
          </mesh>
        ))
      )}
    </group>
  );
}

function DJBooth({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Countertop */}
      <mesh position={[0, h + 0.01, 0]}>
        <boxGeometry args={[w + 0.06, 0.02, d + 0.06]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* LED strip */}
      <mesh position={[0, h * 0.5, d / 2 + 0.001]}>
        <planeGeometry args={[w * 0.9, 0.03]} />
        <meshStandardMaterial color="#a3ff12" emissive="#a3ff12" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

function DJTable({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  const legR = 0.04;
  const topT = 0.05;
  const skirtH = 0.08;
  return (
    <group>
      {/* Four legs */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} castShadow position={[sx * (w / 2 - legR - 0.02), (h - topT) / 2, sz * (d / 2 - legR - 0.02)]}>
          <cylinderGeometry args={[legR, legR, h - topT, 12]} />
          <meshStandardMaterial color="#111" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      {/* Cross-brace under the top */}
      <mesh position={[0, h - topT - skirtH / 2, 0]}>
        <boxGeometry args={[w - 0.1, skirtH, 0.04]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* Table top */}
      <mesh castShadow receiveShadow position={[0, h - topT / 2, 0]}>
        <boxGeometry args={[w, topT, d]} />
        <meshStandardMaterial color="#141414" metalness={0.55} roughness={0.4} />
      </mesh>
      {/* Front skirt/scrim — black cloth stretched below the top */}
      <mesh position={[0, (h - topT) / 2, d / 2 - 0.005]}>
        <planeGeometry args={[w - 0.06, h - topT]} />
        <meshStandardMaterial color="#050505" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* Subtle LED strip under the front lip */}
      <mesh position={[0, h - topT - 0.005, d / 2 + 0.002]}>
        <planeGeometry args={[w * 0.85, 0.015]} />
        <meshStandardMaterial color="#05d9e8" emissive="#05d9e8" emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}


function CDJModel({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  return (
    <group>
      <mesh castShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Jog wheel */}
      <mesh position={[0, h + 0.005, -d * 0.05]}>
        <cylinderGeometry args={[w * 0.35, w * 0.35, 0.01, 32]} />
        <meshStandardMaterial color={CHROME} metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Display */}
      <mesh position={[0, h + 0.006, d * 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.6, 0.04]} />
        <meshStandardMaterial color="#0af" emissive="#0af" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function KorgModel({ size, variant }: { size: [number, number, number]; variant?: "red" | "blue" }) {
  const [w, h, d] = size;
  const palette =
    variant === "red"
      ? ["#ff2a6d", "#ff1744", "#d50000", "#ff5252"]
      : variant === "blue"
      ? ["#05d9e8", "#2979ff", "#00b0ff", "#82b1ff"]
      : ["#ff2a6d", "#05d9e8", "#d1f7ff", "#a3ff12"];
  return (
    <group>
      <mesh castShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.4} roughness={0.6} />
      </mesh>
      {Array.from({ length: 4 }).map((_, i) =>
        Array.from({ length: 4 }).map((_, j) => (
          <mesh
            key={`${i}-${j}`}
            position={[
              -w * 0.3 + i * (w * 0.6) / 3,
              h + 0.003,
              -d * 0.2 + j * (d * 0.4) / 3,
            ]}
          >
            <boxGeometry args={[0.06, 0.006, 0.06]} />
            <meshStandardMaterial
              color={palette[(i + j) % 4]}
              emissive={palette[(i + j) % 4]}
              emissiveIntensity={1.2}
            />
          </mesh>
        ))
      )}
    </group>
  );
}

function TurntableModel({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  return (
    <group>
      <mesh castShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Platter */}
      <mesh position={[0, h + 0.008, -d * 0.05]}>
        <cylinderGeometry args={[w * 0.42, w * 0.42, 0.015, 32]} />
        <meshStandardMaterial color="#111" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Vinyl */}
      <mesh position={[0, h + 0.016, -d * 0.05]}>
        <cylinderGeometry args={[w * 0.4, w * 0.4, 0.002, 32]} />
        <meshStandardMaterial color="#050505" roughness={0.9} />
      </mesh>
      {/* Tonearm */}
      <mesh position={[w * 0.35, h + 0.015, d * 0.28]} rotation={[0, -0.6, 0]}>
        <boxGeometry args={[0.02, 0.006, w * 0.5]} />
        <meshStandardMaterial color={CHROME} metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

function StrobeModel({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  return (
    <group>
      <mesh castShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Tube */}
      <mesh position={[0, h / 2, d / 2 + 0.005]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, w * 0.85, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.5} />
      </mesh>
    </group>
  );
}

function LaserModel({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  return (
    <group>
      <mesh castShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Aperture */}
      <mesh position={[0, h / 2, d / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.02, 16]} />
        <meshStandardMaterial color="#ff2a6d" emissive="#ff2a6d" emissiveIntensity={2.5} />
      </mesh>
      {/* Heatsink fins */}
      {[-2, -1, 0, 1, 2].map((i) => (
        <mesh key={i} position={[0, h + 0.02, i * 0.03]}>
          <boxGeometry args={[w * 0.6, 0.04, 0.01]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function MovingHeadModel({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  return (
    <group>
      {/* Base */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <boxGeometry args={[w, 0.12, d]} />
        <meshStandardMaterial color="#111" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Yoke */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * w * 0.4, h * 0.45, 0]} castShadow>
          <boxGeometry args={[0.04, h * 0.6, 0.06]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {/* Head */}
      <mesh position={[0, h * 0.7, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[w * 0.32, w * 0.32, h * 0.5, 20]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Lens */}
      <mesh position={[0, h * 0.7, d * 0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[w * 0.25, w * 0.25, 0.02, 24]} />
        <meshStandardMaterial color="#a3ff12" emissive="#a3ff12" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

function BarModel({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  return (
    <group>
      <mesh castShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#4a2f1a" roughness={0.85} />
      </mesh>
      <mesh position={[0, h + 0.02, 0]}>
        <boxGeometry args={[w + 0.06, 0.04, d + 0.06]} />
        <meshStandardMaterial color="#2a1a10" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Bottles */}
      {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[i * (w / 8), h + 0.18, -d * 0.3]}>
          <cylinderGeometry args={[0.04, 0.04, 0.25, 10]} />
          <meshStandardMaterial
            color={["#a3ff12", "#ff2a6d", "#05d9e8", "#e5e5e5"][Math.abs(i) % 4]}
            transparent
            opacity={0.75}
            metalness={0.3}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

function GeneratorModel({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  return (
    <group>
      <mesh castShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#2f4a1e" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* Exhaust */}
      <mesh position={[w * 0.35, h + 0.2, -d * 0.3]}>
        <cylinderGeometry args={[0.06, 0.06, 0.4, 12]} />
        <meshStandardMaterial color="#333" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Grille */}
      <mesh position={[0, h * 0.5, d / 2 + 0.001]}>
        <planeGeometry args={[w * 0.7, h * 0.4]} />
        <meshStandardMaterial color="#111" roughness={0.9} />
      </mesh>
      {/* Warning stripe */}
      <mesh position={[0, h + 0.005, 0]}>
        <boxGeometry args={[w * 1.01, 0.004, d * 1.01]} />
        <meshStandardMaterial color="#f4c11a" emissive="#f4c11a" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function CrowdModel({ size }: { size: [number, number, number] }) {
  const [w, , d] = size;
  return (
    <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color="#1a0a1a" emissive="#3d0d3d" emissiveIntensity={0.3} roughness={0.9} />
    </mesh>
  );
}

function PicusBinModel({
  size,
  cols = 2,
  rows = 1,
  hasTopVent = true,
}: {
  size: [number, number, number];
  cols?: number;
  rows?: number;
  hasTopVent?: boolean;
}) {
  const [w, h, d] = size;
  const YELLOW = "#f4c11a";
  const YELLOW_DARK = "#c99a10";
  const BLACK = "#0a0a0a";
  const CONE = "#141414";
  const DUSTCAP = "#1c1c1c";
  const METAL = "#2a2a2a";
  const BAR = 0.032;
  const front = d / 2;
  const ventH = hasTopVent ? h * 0.14 : 0;
  const bodyBottom = 0;
  const bodyTop = h - ventH;
  const cellsH = bodyTop - bodyBottom;
  const cellW = w / cols;
  const cellH = cellsH / rows;
  // 18" speaker radius, capped to cell so it never overflows.
  const coneR = Math.min(cellW, cellH) * 0.44;

  const cones: React.ReactNode[] = [];
  const braces: React.ReactNode[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = -w / 2 + (c + 0.5) * cellW;
      const cy = bodyBottom + (r + 0.5) * cellH;

      // Recessed dark opening (the cone chamber)
      cones.push(
        <mesh key={`hole-${r}-${c}`} position={[cx, cy, front + 0.001]}>
          <circleGeometry args={[coneR * 1.02, 48]} />
          <meshStandardMaterial color="#020202" roughness={1} />
        </mesh>,
      );
      // Outer speaker rim / basket
      cones.push(
        <mesh key={`rim-${r}-${c}`} position={[cx, cy, front + 0.003]}>
          <ringGeometry args={[coneR * 0.92, coneR * 1.0, 48]} />
          <meshStandardMaterial color={METAL} metalness={0.75} roughness={0.35} />
        </mesh>,
      );
      // Cone (slightly recessed inside)
      cones.push(
        <mesh key={`cone-${r}-${c}`} position={[cx, cy, front - 0.02]} rotation={[0, 0, 0]}>
          <coneGeometry args={[coneR * 0.9, 0.06, 48, 1, true]} />
          <meshStandardMaterial color={CONE} roughness={0.9} metalness={0.05} side={2} />
        </mesh>,
      );
      // Dust cap
      cones.push(
        <mesh key={`dc-${r}-${c}`} position={[cx, cy, front + 0.008]}>
          <sphereGeometry args={[coneR * 0.28, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={DUSTCAP} roughness={0.6} metalness={0.15} />
        </mesh>,
      );

      // Diagonal yellow X-brace over the cell (this is the JB signature look).
      const diag = Math.sqrt(cellW * cellW + cellH * cellH) * 0.92;
      const ang = Math.atan2(cellH, cellW);
      braces.push(
        <mesh key={`x1-${r}-${c}`} position={[cx, cy, front + 0.012]} rotation={[0, 0, ang]}>
          <boxGeometry args={[diag, BAR, BAR * 0.6]} />
          <meshStandardMaterial color={YELLOW} emissive={YELLOW_DARK} emissiveIntensity={0.15} metalness={0.4} roughness={0.5} />
        </mesh>,
      );
      braces.push(
        <mesh key={`x2-${r}-${c}`} position={[cx, cy, front + 0.012]} rotation={[0, 0, -ang]}>
          <boxGeometry args={[diag, BAR, BAR * 0.6]} />
          <meshStandardMaterial color={YELLOW} emissive={YELLOW_DARK} emissiveIntensity={0.15} metalness={0.4} roughness={0.5} />
        </mesh>,
      );
      // Central bolt where the X crosses
      braces.push(
        <mesh key={`bolt-${r}-${c}`} position={[cx, cy, front + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[BAR * 0.9, BAR * 0.9, BAR * 0.6, 16]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.3} />
        </mesh>,
      );

    }
  }

  // Outer yellow frame (rectangle around the whole speaker area)
  const frameThk = BAR;
  const frameZ = front + 0.008;
  const frameYcenter = bodyBottom + cellsH / 2;
  const frame = (
    <group>
      <mesh position={[0, bodyTop, frameZ]}>
        <boxGeometry args={[w * 0.985, frameThk, BAR * 0.5]} />
        <meshStandardMaterial color={YELLOW} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, bodyBottom, frameZ]}>
        <boxGeometry args={[w * 0.985, frameThk, BAR * 0.5]} />
        <meshStandardMaterial color={YELLOW} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[-w / 2 + frameThk / 2, frameYcenter, frameZ]}>
        <boxGeometry args={[frameThk, cellsH, BAR * 0.5]} />
        <meshStandardMaterial color={YELLOW} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[w / 2 - frameThk / 2, frameYcenter, frameZ]}>
        <boxGeometry args={[frameThk, cellsH, BAR * 0.5]} />
        <meshStandardMaterial color={YELLOW} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Dividers */}
      {cols > 1 &&
        Array.from({ length: cols - 1 }).map((_, i) => (
          <mesh key={`fd-v-${i}`} position={[-w / 2 + (i + 1) * cellW, frameYcenter, frameZ]}>
            <boxGeometry args={[frameThk, cellsH, BAR * 0.5]} />
            <meshStandardMaterial color={YELLOW} metalness={0.4} roughness={0.5} />
          </mesh>
        ))}
      {rows > 1 &&
        Array.from({ length: rows - 1 }).map((_, i) => (
          <mesh key={`fd-h-${i}`} position={[0, bodyBottom + (i + 1) * cellH, frameZ]}>
            <boxGeometry args={[w * 0.985, frameThk, BAR * 0.5]} />
            <meshStandardMaterial color={YELLOW} metalness={0.4} roughness={0.5} />
          </mesh>
        ))}
    </group>
  );

  // Corner metal reinforcement plates
  const cornerSz = Math.min(w, h) * 0.09;
  const cornerZ = d / 2 + 0.003;
  const corners = [
    [-w / 2 + cornerSz / 2, cornerSz / 2],
    [w / 2 - cornerSz / 2, cornerSz / 2],
    [-w / 2 + cornerSz / 2, h - cornerSz / 2],
    [w / 2 - cornerSz / 2, h - cornerSz / 2],
  ] as const;

  // Side recessed handles
  const handleY = h * 0.5;
  const handleW = Math.min(h * 0.22, 0.22);

  return (
    <group>
      {/* Cabinet body */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={BLACK} roughness={0.92} metalness={0.05} />
      </mesh>
      {/* Front baffle slightly inset for depth */}
      <mesh position={[0, h / 2, d / 2 - 0.005]}>
        <boxGeometry args={[w * 0.99, h * 0.99, 0.01]} />
        <meshStandardMaterial color="#080808" roughness={0.98} />
      </mesh>

      {/* Top vent (bass port) */}
      {hasTopVent && (
        <group position={[0, bodyTop + ventH / 2, front + 0.002]}>
          {/* dark port opening */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[w * 0.9, ventH * 0.7, 0.02]} />
            <meshStandardMaterial color="#020202" roughness={1} />
          </mesh>
          {/* two yellow vertical port bars */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * w * 0.16, 0, 0.012]}>
              <boxGeometry args={[BAR, ventH * 0.6, BAR * 0.5]} />
              <meshStandardMaterial color={YELLOW} metalness={0.4} roughness={0.5} />
            </mesh>
          ))}
          {/* yellow horizontal port bottom */}
          <mesh position={[0, -ventH * 0.32, 0.012]}>
            <boxGeometry args={[w * 0.9, BAR, BAR * 0.5]} />
            <meshStandardMaterial color={YELLOW} metalness={0.4} roughness={0.5} />
          </mesh>
        </group>
      )}

      {cones}
      {braces}
      {frame}

      {/* Corner plates */}
      {corners.map(([cx, cy], i) => (
        <mesh key={`cn-${i}`} position={[cx, cy, cornerZ]}>
          <boxGeometry args={[cornerSz, cornerSz, 0.008]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.85} roughness={0.4} />
        </mesh>
      ))}

      {/* Side handles (recessed cutouts on left/right) */}
      {[-1, 1].map((s) => (
        <group key={`h-${s}`} position={[s * (w / 2 + 0.002), handleY, 0]} rotation={[0, s * Math.PI / 2, 0]}>
          <mesh>
            <boxGeometry args={[handleW, 0.05, 0.02]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.005]}>
            <boxGeometry args={[handleW * 0.75, 0.025, 0.005]} />
            <meshStandardMaterial color="#000" roughness={1} />
          </mesh>
        </group>
      ))}

      {/* Small type label bottom-left */}
      <mesh position={[-w / 2 + 0.06, 0.03, d / 2 + 0.004]}>
        <planeGeometry args={[0.08, 0.02]} />
        <meshStandardMaterial color={YELLOW} emissive={YELLOW_DARK} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function PicusTopGrillModel({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  const BLACK = "#0a0a0a";
  const STEEL = "#7a7a7a";
  const STEEL_DARK = "#4a4a4a";

  // Hex grid instanced circles across the grill face
  const cellsX = 26;
  const cellsY = Math.max(6, Math.round(cellsX * (h / w) * 0.9));
  const gridW = w * 0.92;
  const gridH = h * 0.86;
  const dx = gridW / cellsX;
  const dy = gridH / cellsY;
  const hexR = Math.min(dx, dy) * 0.42;
  const holes: React.ReactNode[] = [];
  for (let j = 0; j < cellsY; j++) {
    for (let i = 0; i < cellsX; i++) {
      const ox = j % 2 === 0 ? 0 : dx * 0.5;
      const x = -gridW / 2 + dx * 0.5 + i * dx + ox;
      const y = -gridH / 2 + dy * 0.5 + j * dy;
      if (Math.abs(x) > gridW / 2 - dx * 0.4) continue;
      holes.push(
        <mesh key={`hex-${i}-${j}`} position={[x, y, 0.001]} rotation={[0, 0, Math.PI / 6]}>
          <circleGeometry args={[hexR, 6]} />
          <meshStandardMaterial color="#020202" roughness={1} />
        </mesh>,
      );
    }
  }

  return (
    <group>
      {/* Cabinet body */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={BLACK} roughness={0.85} metalness={0.15} />
      </mesh>
      {/* Front recessed frame */}
      <mesh position={[0, h / 2, d / 2 - 0.004]}>
        <boxGeometry args={[w * 0.99, h * 0.98, 0.008]} />
        <meshStandardMaterial color="#050505" roughness={0.95} />
      </mesh>
      {/* Steel grill plate */}
      <mesh position={[0, h / 2, d / 2 + 0.005]}>
        <boxGeometry args={[w * 0.94, h * 0.9, 0.006]} />
        <meshStandardMaterial color={STEEL} metalness={0.9} roughness={0.35} />
      </mesh>
      {/* Hex perforations */}
      <group position={[0, h / 2, d / 2 + 0.009]}>{holes}</group>

      {/* Center brand plate */}
      <mesh position={[0, h * 0.5, d / 2 + 0.012]}>
        <boxGeometry args={[w * 0.22, h * 0.08, 0.004]} />
        <meshStandardMaterial color="#111" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, h * 0.5, d / 2 + 0.015]}>
        <planeGeometry args={[w * 0.18, h * 0.03]} />
        <meshStandardMaterial color="#f4c11a" emissive="#c99a10" emissiveIntensity={0.4} />
      </mesh>

      {/* Corner plates */}
      {[
        [-w / 2 + 0.06, 0.06],
        [w / 2 - 0.06, 0.06],
        [-w / 2 + 0.06, h - 0.06],
        [w / 2 - 0.06, h - 0.06],
      ].map(([cx, cy], i) => (
        <mesh key={`cn-${i}`} position={[cx, cy, d / 2 + 0.006]}>
          <boxGeometry args={[0.09, 0.09, 0.006]} />
          <meshStandardMaterial color={STEEL_DARK} metalness={0.9} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}


function ModelFor({ kind, size, variant }: { kind: Kind; size: [number, number, number]; variant?: "red" | "blue" }) {
  switch (kind) {
    case "horn": return <HornModel size={size} />;
    case "mid": return <MidModel size={size} />;
    case "bass": return <BassModel size={size} />;
    case "sub": return <SubModel size={size} />;
    case "badtekk_sub": return <SubModel size={size} />;
    case "badtekk_bass": return <BassModel size={size} />;
    case "badtekk_top": return <HornModel size={size} />;
    case "img_0838": return <PicusBinModel size={size} cols={1} rows={2} hasTopVent />;
    case "img_0839": return <PicusBinModel size={size} cols={1} rows={2} hasTopVent />;
    case "img_0841": return <PicusBinModel size={size} cols={2} rows={2} hasTopVent={false} />;
    case "img_0842": return <PicusBinModel size={size} cols={1} rows={3} hasTopVent />;
    case "img_0843": return <PicusTopGrillModel size={size} />;
    case "picus_scoop_lo":  return <PicusBinModel size={size} cols={1} rows={1} hasTopVent />;
    case "picus_scoop_hi":  return <PicusBinModel size={size} cols={1} rows={1} hasTopVent />;
    case "picus_bass_row":  return <PicusBinModel size={size} cols={2} rows={1} hasTopVent={false} />;
    case "picus_shelf_bin": return <PicusBinModel size={size} cols={1} rows={1} hasTopVent={false} />;
    case "picus_mid_grill": return <PicusTopGrillModel size={size} />;
    case "picus_mid_stack": return <PicusBinModel size={size} cols={1} rows={2} hasTopVent />;
    case "picus_top_3way":  return <PicusBinModel size={size} cols={2} rows={1} hasTopVent />;
    case "picus_hex_horn":  return <PicusTopGrillModel size={size} />;
    case "picus_wing_horn": return <PicusBinModel size={size} cols={2} rows={1} hasTopVent={false} />;
    case "picus_deep_sub":  return <PicusBinModel size={size} cols={1} rows={1} hasTopVent />;
    case "linearray": return <LineArrayModel size={size} />;
    case "monitor": return <MonitorModel size={size} />;
    case "amp": return <AmpRack size={size} />;
    case "powersoft": return <AmpRack size={size} brand="powersoft" />;
    case "mixer": return <MixerModel size={size} />;
    case "dj": return <DJBooth size={size} />;
    case "dj_table": return <DJTable size={size} />;

    case "cdj": return <CDJModel size={size} />;
    case "korg": return <KorgModel size={size} variant={variant} />;
    case "korg_red": return <KorgModel size={size} variant="red" />;
    case "korg_blue": return <KorgModel size={size} variant="blue" />;
    case "turntable": return <TurntableModel size={size} />;
    case "strobe": return <StrobeModel size={size} />;
    case "laser": return <LaserModel size={size} />;
    case "movinghead": return <MovingHeadModel size={size} />;
    case "bar": return <BarModel size={size} />;
    case "generator": return <GeneratorModel size={size} />;
    
  }
}


/* ============================================================
   Item mesh — receives selection + click
   ============================================================ */

const ItemObject = ({
  item, selected, pending, showConnectors, showConnectorLabels, activeCableType, pendingItemId,
  onSelect, onRegister, onConnectorPick,
}: {
  item: Placed;
  selected: boolean;
  pending?: boolean;
  showConnectors?: boolean;
  showConnectorLabels?: boolean;
  activeCableType?: CableType;
  pendingItemId?: string | null;
  onSelect: (id: string, additive: boolean) => void;
  onRegister: (id: string, obj: THREE.Object3D | null) => void;
  onConnectorPick?: (itemId: string, connector: Connector) => void;
}) => {
  const spec = SPECS[item.kind];
  const ref = useRef<THREE.Group>(null!);
  const connectors = useMemo(() => connectorsFor(item.kind), [item.kind]);

  useEffect(() => {
    onRegister(item.id, ref.current);
    return () => onRegister(item.id, null);
  }, [item.id, onRegister]);

  // Where the ModelFor group actually renders (accounts for pallet lift).
  const onPallet = spec.category === "sound" && item.pos[1] < 0.05 && item.kind !== "linearray" && item.kind !== "monitor";
  const modelYOffset = onPallet ? 0.14 : 0;

  return (
    <group
      ref={ref}
      position={item.pos}
      rotation={[0, item.rotY, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(item.id, e.shiftKey || e.metaKey || e.ctrlKey);
      }}
    >
      {onPallet && (
        <group position={[0, 0, 0]}>
          <Pallet w={spec.size[0] * 1.02} d={spec.size[2] * 1.02} />
        </group>
      )}
      <group position={[0, modelYOffset, 0]}>
        <ModelFor kind={item.kind} size={spec.size} variant={item.variant} />
      </group>
      {/* Selection halo */}
      {selected && (
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(spec.size[0], spec.size[2]) * 0.65, Math.max(spec.size[0], spec.size[2]) * 0.75, 40]} />
          <meshBasicMaterial color="#a3ff12" transparent opacity={0.9} />
        </mesh>
      )}
      {/* Pending source for cable */}
      {pending && (
        <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(spec.size[0], spec.size[2]) * 0.55, Math.max(spec.size[0], spec.size[2]) * 0.9, 48]} />
          <meshBasicMaterial color="#f4c11a" transparent opacity={0.6} />
        </mesh>
      )}
      {/* Connector plugs — visible in cable mode so users see exactly where cables snap */}
      {showConnectors && connectors.map((c, i) => {
        const meta = CABLE_META[c.type];
        const isTypeActive = activeCableType === c.type;
        // While a pending source exists, other items' compatible IN-plugs of
        // the pending cable's type should pulse as valid drop targets.
        const isPendingElsewhere = !!pendingItemId && pendingItemId !== item.id;
        const isCompatibleTarget =
          isPendingElsewhere && isTypeActive && (c.role === "in" || connectors.filter(x => x.type === c.type).every(x => x.role !== "in"));
        const isSourceCandidate = !pendingItemId && isTypeActive;
        const highlight = isCompatibleTarget || isSourceCandidate;
        const size = highlight ? 0.14 : 0.11;

        return (
          <group key={i} position={[c.offset[0], modelYOffset + c.offset[1], c.offset[2]]}>
            {/* Larger invisible hit area so plugs are easy to click on mobile too. */}
            <mesh
              onPointerDown={(e) => {
                if (!onConnectorPick) return;
                e.stopPropagation();
                onConnectorPick(item.id, c);
              }}
              onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "crosshair"; }}
              onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ""; }}
            >
              <sphereGeometry args={[0.18, 12, 8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* Visible plug body */}
            <mesh>
              <boxGeometry args={[size, size, size * 0.55]} />
              <meshStandardMaterial
                color={meta.color}
                emissive={meta.color}
                emissiveIntensity={highlight ? 1.4 : isTypeActive ? 0.9 : 0.35}
                metalness={0.5}
                roughness={0.35}
              />
            </mesh>
            {/* Pulsing halo ring when this plug is a valid target */}
            {isCompatibleTarget && (
              <PulseRing color={meta.color} size={size} />
            )}
            {/* Role badge */}
            {(showConnectorLabels || highlight) && (
              <Html position={[0, 0.16, 0]} center distanceFactor={10} occlude={false}>
                <div
                  className="pointer-events-none rounded px-1 font-mono text-[9px] font-bold uppercase leading-none"
                  style={{
                    color: meta.color,
                    background: "rgba(0,0,0,.85)",
                    opacity: 1,
                    border: `1px solid ${meta.color}`,
                    boxShadow: highlight ? `0 0 8px ${meta.color}` : undefined,
                  }}
                >
                  {meta.short}{c.role === "out" ? "▶" : "◀"}
                </div>
              </Html>
            )}
          </group>
        );
      })}
      {/* Custom label above the box */}
      {item.label && (
        <Html position={[0, spec.size[1] + 0.25, 0]} center distanceFactor={8} occlude={false}>
          <div className="pointer-events-none rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-lime-600 shadow-lg">
            {item.label}
          </div>
        </Html>
      )}
    </group>
  );
};

// Pulsing ring shown around compatible target plugs during cable drag.
function PulseRing({ color, size }: { color: string; size: number }) {
  const ring = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!ring.current || !mat.current) return;
    const t = (performance.now() / 1000) % 1.1;
    const p = t / 1.1;
    ring.current.scale.setScalar(1 + p * 3.2);
    mat.current.opacity = (1 - p) * 0.85;
  });
  return (
    <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[size * 0.9, size * 1.15, 28]} />
      <meshBasicMaterial ref={mat} color={color} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}




/* ============================================================
   Snap / stacking
   ============================================================ */

import {
  snapToGridXZ as snapToGridXZPure,
  stackY as stackYPure,
  hasCollision as hasCollisionPure,
  collisionIds as collisionIdsPure,
  hasAnyOverlap as hasAnyOverlapPure,
  stackSnapTarget as stackSnapTargetPure,
  sanitizeStacks as sanitizeStacksPure,
  resolveHorizontalOverlaps as resolveHorizontalOverlapsPure,
  PLACEMENT_TUNING,
  type PlacementItem,
} from "./placement";

/** Wrapper that keeps SPECS-derived sizes without leaking Placed→PlacementItem. */
function sanitizeStacks(items: Placed[]): Placed[] {
  const wrapped = items.map((p) => ({ ...asPlacementItem(p), _orig: p }));
  const fixed = sanitizeStacksPure(wrapped);
  return fixed.map((w) => ({ ...(w as unknown as { _orig: Placed })._orig, pos: w.pos as [number, number, number] }));
}

function resolveHorizontalOverlaps(items: Placed[], gap = 0.06): Placed[] {
  const wrapped = items.map((p) => ({ ...asPlacementItem(p), _orig: p }));
  const fixed = resolveHorizontalOverlapsPure(wrapped, gap);
  return fixed.map((w) => ({ ...(w as unknown as { _orig: Placed })._orig, pos: w.pos as [number, number, number] }));
}

function sceneHasOverlap(items: Placed[]): boolean {
  return hasAnyOverlapPure(items.map(asPlacementItem));
}

function normalizeScene(items: Placed[], gap = 0.06): Placed[] {
  const stacked = sanitizeStacks(items.map((it) => ({ ...it, rotY: 0 })));
  return resolveHorizontalOverlaps(stacked, gap);
}

function findOpenGroundPosition(kind: Kind, items: Placed[], desired: [number, number, number] = [0, 0, 2]): [number, number, number] {
  const base: Placed = { id: "__candidate__", kind, pos: desired, rotY: 0 };
  for (let radius = 0; radius <= 20; radius++) {
    const candidates: [number, number, number][] = radius === 0
      ? [desired]
      : [
          [desired[0] + radius * 0.5, 0, desired[2]],
          [desired[0] - radius * 0.5, 0, desired[2]],
          [desired[0], 0, desired[2] + radius * 0.5],
          [desired[0], 0, desired[2] - radius * 0.5],
          [desired[0] + radius * 0.5, 0, desired[2] + radius * 0.5],
          [desired[0] - radius * 0.5, 0, desired[2] - radius * 0.5],
        ] as [number, number, number][];
    for (const raw of candidates) {
      const pos = snapToGridXZ(raw);
      const candidate = { ...base, pos };
      if (!hasCollision(candidate, items)) return pos;
    }
  }
  return snapToGridXZ([desired[0] + items.length * 0.6, 0, desired[2]]);
}

function spreadGroupItems(items: Placed[], groupId: string, gap: number): Placed[] {
  const group = items.filter((i) => i.groupId === groupId);
  if (group.length < 2) return items;
  const rows = new Map<number, Placed[]>();
  for (const it of group) {
    const rowKey = Math.round(it.pos[1] * 20) / 20;
    const row = rows.get(rowKey) ?? [];
    row.push(it);
    rows.set(rowKey, row);
  }
  const nextPos = new Map<string, [number, number, number]>();
  for (const row of rows.values()) {
    if (row.length < 2) continue;
    const sorted = [...row].sort((a, b) => a.pos[0] - b.pos[0]);
    const center = sorted.reduce((sum, it) => sum + it.pos[0], 0) / sorted.length;
    const totalWidth = sorted.reduce((sum, it) => sum + SPECS[it.kind].size[0], 0) + gap * (sorted.length - 1);
    let cursor = center - totalWidth / 2;
    for (const it of sorted) {
      const w = SPECS[it.kind].size[0];
      nextPos.set(it.id, [cursor + w / 2, it.pos[1], it.pos[2]]);
      cursor += w + gap;
    }
  }
  return items.map((it) => nextPos.has(it.id) ? { ...it, pos: nextPos.get(it.id)! } : it);
}

function itemScreenBounds(it: Placed, camera: THREE.Camera, width: number, height: number) {
  const s = SPECS[it.kind].size;
  const hw = s[0] / 2;
  const hd = s[2] / 2;
  const pts: THREE.Vector3[] = [];
  for (const dx of [-hw, hw]) {
    for (const dy of [0, s[1]]) {
      for (const dz of [-hd, hd]) {
        pts.push(new THREE.Vector3(it.pos[0] + dx, it.pos[1] + dy, it.pos[2] + dz).project(camera));
      }
    }
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    const x = (p.x * 0.5 + 0.5) * width;
    const y = (1 - (p.y * 0.5 + 0.5)) * height;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

// Backwards-compatible constant; live grid step is read from PLACEMENT_TUNING.
const GRID_STEP = PLACEMENT_TUNING.gridStep;

const asPlacementItem = (p: Placed): PlacementItem => ({
  id: p.id,
  pos: p.pos,
  size: SPECS[p.kind].size,
});

function snapToGridXZ(v: [number, number, number]): [number, number, number] {
  return snapToGridXZPure(v, PLACEMENT_TUNING.gridStep);
}

function stackY(moving: Placed, others: Placed[]): number {
  return stackYPure(asPlacementItem(moving), others.map(asPlacementItem));
}

function hasCollision(moving: Placed, others: Placed[]): boolean {
  return hasCollisionPure(asPlacementItem(moving), others.map(asPlacementItem));
}

function collisionIds(moving: Placed, others: Placed[]): string[] {
  return collisionIdsPure(asPlacementItem(moving), others.map(asPlacementItem));
}

function stackSnapTarget(
  moving: Placed,
  others: Placed[],
  rawY: number,
): { x: number; z: number; y: number; ontoId?: string } | null {
  return stackSnapTargetPure(asPlacementItem(moving), others.map(asPlacementItem), rawY);
}


// Ghost preview of the currently-dragged selection at its snapped position.
// - Green translucent box  = valid ground placement (no collision, on floor).
// - Cyan translucent box   = valid STACK target detected (snaps XZ to the box
//                            underneath and rests on top of it).
// - Red translucent box    = collides with / buries into other cabinets.
// Colliding items are also outlined in red so the conflict is obvious.
function PlacementGhost({
  selection, items, objectsRef, onSnapChange, speakerLineZ,
}: {
  selection: string[];
  items: Placed[];
  objectsRef: React.MutableRefObject<Map<string, THREE.Object3D>>;
  onSnapChange?: (info: { id: string; mode: "ground" | "stack" | "bad"; ontoId?: string; ontoLabel?: string }) => void;
  speakerLineZ: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const highlightRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  // Snap target visualization: highlighted top face + tolerance box, per selected id.
  const snapCapRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const snapTolRefs = useRef<Map<string, THREE.LineSegments>>(new Map());
  const lastModeRef = useRef<Map<string, "ground" | "stack" | "bad">>(new Map());

  useFrame(() => {
    const others = items.filter((o) => !selection.includes(o.id));
    const collided = new Set<string>();
    const activeSnaps = new Set<string>();

    for (const id of selection) {
      const src = items.find((i) => i.id === id);
      const obj = objectsRef.current.get(id);
      const mesh = meshRefs.current.get(id);
      if (!src || !obj || !mesh) continue;

      const step = PLACEMENT_TUNING.gridStep;
      const sx = Math.round(obj.position.x / step) * step;
      const rawSz = Math.round(obj.position.z / step) * step;
      const sz = SPECS[src.kind].category === "sound" ? speakerLineZ : rawSz;
      const rawY = obj.position.y;
      const s = SPECS[src.kind].size;
      const candidate: Placed = { ...src, pos: [sx, Math.max(0, rawY), sz], rotY: 0 };

      const snap = stackSnapTarget(candidate, others, rawY);
      let mode: "ground" | "stack" | "bad" = "ground";
      let ontoId: string | undefined;
      if (snap) {
        candidate.pos = [snap.x, snap.y, snap.z];
        mode = "stack";
        ontoId = snap.ontoId;
      } else {
        const y = stackY(candidate, others);
        candidate.pos = [sx, y, sz];
      }

      const buried = rawY < PLACEMENT_TUNING.buriedY;
      const bad = buried || hasCollision(candidate, others);
      if (bad) mode = "bad";

      if (bad && !buried) {
        collisionIds(candidate, others).forEach((cid) => collided.add(cid));
      }

      mesh.position.set(candidate.pos[0], candidate.pos[1] + s[1] / 2, candidate.pos[2]);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const col = mode === "bad" ? "#ef4444" : mode === "stack" ? "#22d3ee" : "#22c55e";
      mat.color.set(col);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);
      mat.opacity = mode === "bad" ? 0.35 + 0.15 * pulse
                    : mode === "stack" ? 0.28 + 0.12 * pulse
                    : 0.22;

      // Snap-target visualization: only render for the currently-hovered stack target.
      const cap = snapCapRefs.current.get(id);
      const tol = snapTolRefs.current.get(id);
      if (snap && ontoId && mode !== "bad") {
        const target = others.find((o) => o.id === ontoId);
        if (target) {
          const ts = SPECS[target.kind].size;
          const halfW = s[0] / 2, halfD = s[2] / 2;
          const rx = ts[0] / 2 + halfW * PLACEMENT_TUNING.stackSnapRadiusFactor;
          const rz = ts[2] / 2 + halfD * PLACEMENT_TUNING.stackSnapRadiusFactor;
          const topY = target.pos[1] + ts[1] + 0.001;
          if (cap) {
            cap.visible = true;
            cap.position.set(target.pos[0], topY, target.pos[2]);
            cap.scale.set(ts[0], 1, ts[2]);
            const cm = cap.material as THREE.MeshBasicMaterial;
            cm.opacity = 0.35 + 0.25 * pulse;
          }
          if (tol) {
            tol.visible = true;
            tol.position.set(target.pos[0], topY + 0.002, target.pos[2]);
            tol.scale.set(rx * 2, 1, rz * 2);
            const tm = tol.material as THREE.LineBasicMaterial;
            tm.opacity = 0.6 + 0.3 * pulse;
          }
          activeSnaps.add(id);
        }
      }
      if (!activeSnaps.has(id)) {
        if (cap) cap.visible = false;
        if (tol) tol.visible = false;
      }

      // Emit mode-change events so the parent can flash a tooltip.
      const prev = lastModeRef.current.get(id);
      if (prev !== mode) {
        lastModeRef.current.set(id, mode);
        if (onSnapChange) {
          const ontoLabel = ontoId
            ? (() => {
                const t = items.find((i) => i.id === ontoId);
                if (!t) return undefined;
                return t.label ?? SPECS[t.kind].defaultLabel ?? SPECS[t.kind].label;
              })()
            : undefined;
          onSnapChange({ id, mode, ontoId, ontoLabel });
        }
      }
    }

    for (const [oid, h] of highlightRefs.current) {
      const o = items.find((i) => i.id === oid);
      const mat = h.material as THREE.MeshBasicMaterial;
      if (o && collided.has(oid)) {
        const os = SPECS[o.kind].size;
        h.position.set(o.pos[0], o.pos[1] + os[1] / 2, o.pos[2]);
        h.scale.set(os[0] + 0.06, os[1] + 0.06, os[2] + 0.06);
        h.visible = true;
        mat.opacity = 0.34 + 0.22 * Math.sin(performance.now() * 0.008);
      } else {
        h.visible = false;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {selection.map((id) => {
        const it = items.find((i) => i.id === id);
        if (!it) return null;
        const s = SPECS[it.kind].size;
        return (
          <React.Fragment key={id}>
            <mesh
              ref={(m) => {
                if (m) meshRefs.current.set(id, m);
                else meshRefs.current.delete(id);
              }}
            >
              <boxGeometry args={[s[0] + 0.02, s[1] + 0.02, s[2] + 0.02]} />
              <meshBasicMaterial color="#22c55e" transparent opacity={0.22} depthWrite={false} />
            </mesh>
            {/* Snap target top-face plate (cyan, 1m×1m base scaled to target). */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              visible={false}
              ref={(m) => {
                if (m) snapCapRefs.current.set(id, m);
                else snapCapRefs.current.delete(id);
              }}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            {/* Snap tolerance boundary (dashed cyan rectangle on target top). */}
            <lineSegments
              visible={false}
              ref={(m) => {
                if (m) snapTolRefs.current.set(id, m as THREE.LineSegments);
                else snapTolRefs.current.delete(id);
              }}
            >
              <edgesGeometry args={[new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)]} />
              <lineBasicMaterial color="#67e8f9" transparent opacity={0.85} depthTest={false} />
            </lineSegments>
          </React.Fragment>
        );
      })}
      {/* Collision highlight overlays for every non-selected item — hidden
          until PlacementGhost's useFrame detects an actual conflict. */}
      {items.filter((o) => !selection.includes(o.id)).map((o) => (
        <mesh
          key={`hl-${o.id}`}
          visible={false}
          ref={(m) => {
            if (m) highlightRefs.current.set(o.id, m);
            else highlightRefs.current.delete(o.id);
          }}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.42} depthWrite={false} wireframe={false} />
        </mesh>
      ))}
    </group>
  );
}


/* ============================================================
   Scene root with TransformControls
   ============================================================ */

function CameraExposer({ cameraRef }: { cameraRef: React.MutableRefObject<THREE.Camera | null> }) {
  const { camera } = useThree();
  useEffect(() => { cameraRef.current = camera; }, [camera, cameraRef]);
  return null;
}

/** Tunes renderer + material envMap intensity for the "realistic look" toggle. */
function RealisticTuner({ enabled }: { enabled: boolean }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.toneMapping = enabled ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    gl.toneMappingExposure = enabled ? 1.05 : 1.0;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [enabled, gl]);
  useFrame(() => {
    const target = enabled ? 1.15 : 0.35;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const mat = (mesh as any).material as THREE.Material | THREE.Material[] | undefined;
      if (!mat) return;
      const list = Array.isArray(mat) ? mat : [mat];
      for (const m of list) {
        if ((m as any).isMeshStandardMaterial) {
          const sm = m as THREE.MeshStandardMaterial;
          if (sm.envMapIntensity !== target) sm.envMapIntensity = target;
        }
      }
    });
  });
  return null;
}


function SceneContent({
  items, setItems, selection, setSelection, tool,
  cables, setCables, mode, cableType, setCableType, pendingFrom, setPendingFrom,
  showConnectorLabels, showCableLabels, realistic, autoSanitize, frontView, topView, speakerLineZ,
}: {
  items: Placed[];
  setItems: React.Dispatch<React.SetStateAction<Placed[]>>;
  selection: string[];
  setSelection: React.Dispatch<React.SetStateAction<string[]>>;
  tool: "translate" | "rotate";
  cables: Cable[];
  setCables: React.Dispatch<React.SetStateAction<Cable[]>>;
  mode: "select" | "cable";
  cableType: CableType;
  setCableType: React.Dispatch<React.SetStateAction<CableType>>;
  pendingFrom: string | null;
  setPendingFrom: React.Dispatch<React.SetStateAction<string | null>>;
  showConnectorLabels: boolean;
  showCableLabels: boolean;
  realistic: boolean;
  autoSanitize: boolean;
  frontView: boolean;
  topView: boolean;
  speakerLineZ: number;
}) {



  const objectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const orbitRef = useRef<any>(null);
  const transformRef = useRef<any>(null);
  const { camera } = useThree();

  useEffect(() => {
    if (!frontView) return;
    const bounds = items.reduce(
      (acc, it) => {
        const s = SPECS[it.kind].size;
        acc.minX = Math.min(acc.minX, it.pos[0] - s[0] / 2);
        acc.maxX = Math.max(acc.maxX, it.pos[0] + s[0] / 2);
        acc.minY = Math.min(acc.minY, it.pos[1]);
        acc.maxY = Math.max(acc.maxY, it.pos[1] + s[1]);
        acc.minZ = Math.min(acc.minZ, it.pos[2] - s[2] / 2);
        acc.maxZ = Math.max(acc.maxZ, it.pos[2] + s[2] / 2);
        return acc;
      },
      { minX: -4, maxX: 4, minY: 0, maxY: 3, minZ: -2, maxZ: 2 },
    );
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = Math.max(1, (bounds.minY + bounds.maxY) / 2);
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const width = Math.max(6, bounds.maxX - bounds.minX);
    const height = Math.max(4, bounds.maxY - bounds.minY);
    const dist = Math.max(9, width * 1.25, height * 2.2);
    camera.position.set(cx, cy, cz + dist);
    camera.lookAt(cx, cy, cz);
    camera.updateProjectionMatrix();
    if (orbitRef.current) {
      orbitRef.current.target.set(cx, cy, cz);
      orbitRef.current.update();
    }
  }, [camera, frontView, items]);

  const registerObject = useCallback((id: string, obj: THREE.Object3D | null) => {
    if (obj) objectsRef.current.set(id, obj);
    else objectsRef.current.delete(id);
  }, []);

  const primaryId = selection[0];
  const primaryObj = primaryId ? objectsRef.current.get(primaryId) : undefined;

  // Track previous transform for delta application
  const prev = useRef<{ pos: THREE.Vector3; rotY: number } | null>(null);

  useEffect(() => {
    if (primaryObj) {
      prev.current = {
        pos: primaryObj.position.clone(),
        rotY: primaryObj.rotation.y,
      };
    } else {
      prev.current = null;
    }
  }, [primaryObj, primaryId]);

  const handleTransformChange = useCallback(() => {
    if (!primaryObj || !prev.current) return;
    const newPos = primaryObj.position.clone();
    const newRotY = primaryObj.rotation.y;
    const dPos = newPos.clone().sub(prev.current.pos);
    const dRot = newRotY - prev.current.rotY;
    if (dPos.lengthSq() === 0 && dRot === 0) return;

    setItems((cur) =>
      cur.map((it) => {
        if (!selection.includes(it.id)) return it;
        if (it.id === primaryId) {
          return { ...it, pos: [newPos.x, Math.max(0, newPos.y), newPos.z], rotY: newRotY };
        }
        return {
          ...it,
          pos: [it.pos[0] + dPos.x, Math.max(0, it.pos[1] + dPos.y), it.pos[2] + dPos.z],
          rotY: it.rotY + dRot,
        };
      })
    );
    prev.current = { pos: newPos, rotY: newRotY };
  }, [primaryId, primaryObj, selection, setItems]);

  const [dropReport, setDropReport] = useState<{ text: string; kind: "stack" | "ground"; at: number } | null>(null);
  const [snapTooltip, setSnapTooltip] = useState<{ text: string; kind: "stack" | "ground" | "bad"; at: number } | null>(null);
  useEffect(() => {
    if (!snapTooltip) return;
    const t = setTimeout(() => setSnapTooltip((s) => (s && s.at === snapTooltip.at ? null : s)), 1600);
    return () => clearTimeout(t);
  }, [snapTooltip]);
  const handleTransformEnd = useCallback(() => {
    const reports: { label: string; raw: [number, number, number]; final: [number, number, number]; mode: "stack" | "ground"; onto?: string }[] = [];
    setItems((cur) => {
      const map = new Map(cur.map((i) => [i.id, i]));
      for (const id of selection) {
        const it = map.get(id);
        if (!it) continue;
        const raw: [number, number, number] = [it.pos[0], it.pos[1], it.pos[2]];
        const rawY = it.pos[1];
        const gridSnapped = snapToGridXZ(it.pos);
        const zSnapped: [number, number, number] = SPECS[it.kind].category === "sound"
          ? [gridSnapped[0], gridSnapped[1], speakerLineZ]
          : gridSnapped;
        const snapped: Placed = { ...it, pos: zSnapped, rotY: 0 };
        const others = [...map.values()].filter((o) => o.id !== id);
        const target = stackSnapTarget(snapped, others, rawY);
        let mode: "stack" | "ground";
        let ontoLabel: string | undefined;
        if (target) {
          snapped.pos = [target.x, target.y, target.z];
          mode = "stack";
          const onto = others.find((o) => o.id === target.ontoId);
          ontoLabel = onto ? (onto.label ?? SPECS[onto.kind].defaultLabel ?? SPECS[onto.kind].label) : undefined;
        } else {
          const y = stackY(snapped, others);
          snapped.pos = [snapped.pos[0], y, snapped.pos[2]];
          mode = "ground";
        }
        reports.push({
          label: it.label ?? SPECS[it.kind].defaultLabel ?? SPECS[it.kind].label,
          raw,
          final: [snapped.pos[0], snapped.pos[1], snapped.pos[2]],
          mode,
          onto: ontoLabel,
        });
        map.set(id, snapped);
      }
      const out = [...map.values()];
      return autoSanitize ? normalizeScene(out) : resolveHorizontalOverlaps(out);
    });
    if (reports.length) {
      const fmt = (v: number) => v.toFixed(2);
      for (const r of reports) {
        // eslint-disable-next-line no-console
        console.log(
          `[drop] ${r.label} → ${r.mode}${r.onto ? ` on ${r.onto}` : ""} | raw (${fmt(r.raw[0])}, ${fmt(r.raw[1])}, ${fmt(r.raw[2])}) → final (${fmt(r.final[0])}, ${fmt(r.final[1])}, ${fmt(r.final[2])}) | Δy=${fmt(r.final[1] - r.raw[1])}`,
        );
      }
      const first = reports[0];
      const extra = reports.length > 1 ? ` (+${reports.length - 1})` : "";
      const text =
        first.mode === "stack"
          ? `${first.label} položeno na ${first.onto ?? "bednu"} · y=${fmt(first.final[1])}m (Δy ${fmt(first.final[1] - first.raw[1])})${extra}`
          : `${first.label} položeno na zem · y=${fmt(first.final[1])}m (Δy ${fmt(first.final[1] - first.raw[1])})${extra}`;
      setDropReport({ text, kind: first.mode, at: Date.now() });
    }
  }, [selection, setItems, autoSanitize, speakerLineZ]);

  // Auto-hide the drop report after a couple of seconds.
  useEffect(() => {
    if (!dropReport) return;
    const t = setTimeout(() => setDropReport((r) => (r && r.at === dropReport.at ? null : r)), 2600);
    return () => clearTimeout(t);
  }, [dropReport]);

  // Disable orbit while gizmo dragging
  const [dragging, setDragging] = useState(false);
  const [selectedCableId, setSelectedCableId] = useState<string | null>(null);
  const [reconnect, setReconnect] = useState<null | { cableId: string; end: "from" | "to" }>(null);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [hoveredCableId, setHoveredCableId] = useState<string | null>(null);
  const [popupOffset, setPopupOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null);
  const [devicePopupOffset, setDevicePopupOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Ghost cable state while dragging from a connector.
  const [cursorWorld, setCursorWorld] = useState<[number, number, number] | null>(null);
  const [pendingSourceConnector, setPendingSourceConnector] = useState<Connector | null>(null);
  // Reset drag offset when switching between cables / devices.
  useEffect(() => { setPopupOffset({ x: 0, y: 0 }); }, [selectedCableId]);
  useEffect(() => { setDevicePopupOffset({ x: 0, y: 0 }); }, [inspectedItemId]);
  // Clear ghost when leaving cable mode or clearing the pending source.
  useEffect(() => {
    if (mode !== "cable" || !pendingFrom) {
      setCursorWorld(null);
      setPendingSourceConnector(null);
    }
  }, [mode, pendingFrom]);
  // ESC cancels a pending cable drag.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPendingFrom(null); setCursorWorld(null); setPendingSourceConnector(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPendingFrom]);


  const itemLabel = (it: Placed) => it.label ?? SPECS[it.kind].defaultLabel ?? SPECS[it.kind].label;

  useEffect(() => {
    if (orbitRef.current) orbitRef.current.enabled = !dragging;
  }, [dragging]);

  return (
    <>
      <color attach="background" args={[realistic ? "#e9ecef" : "#ffffff"]} />
      <fog attach="fog" args={[realistic ? "#dfe3e8" : "#f5f5f5", realistic ? 25 : 20, realistic ? 80 : 60]} />

      <ambientLight intensity={realistic ? 0.25 : 0.85} />
      <hemisphereLight args={["#e8f0ff", "#3a3a3a", realistic ? 0.35 : 0.6]} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={realistic ? 2.2 : 1.4}
        color={realistic ? "#fff2dc" : "#ffffff"}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={0.1}
        shadow-camera-far={50}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
      {!realistic && (
        <>
          <pointLight position={[0, 4, 4]} intensity={8} color="#ff2a6d" distance={12} />
          <pointLight position={[-6, 4, -3]} intensity={6} color="#05d9e8" distance={12} />
          <pointLight position={[6, 4, -3]} intensity={6} color="#a3ff12" distance={12} />
        </>
      )}

      <Suspense fallback={null}>
        <Environment preset={realistic ? "city" : "warehouse"} background={false} />
      </Suspense>

      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerMove={(e) => {
          if (mode === "cable" && pendingFrom) {
            setCursorWorld([e.point.x, Math.max(e.point.y, 0.05), e.point.z]);
          }
        }}
        onPointerDown={(e) => {
          if (e.button === 0) {
            if (mode === "cable") { setPendingFrom(null); setCursorWorld(null); setPendingSourceConnector(null); }
            else setSelection([]);
          }
        }}
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial
          color={realistic ? "#d0d3d6" : "#e8e8e8"}
          roughness={realistic ? 0.75 : 0.95}
          metalness={realistic ? 0.1 : 0}
        />
      </mesh>

      <Grid
        args={[60, 60]}
        cellColor={realistic ? "#b8bcc0" : "#cccccc"}
        sectionColor={realistic ? "#7d8288" : "#999999"}
        sectionSize={1}
        cellSize={0.25}
        fadeDistance={40}
        fadeStrength={1}
        infiniteGrid
        position={[0, 0.001, 0]}
      />
      <ContactShadows
        position={[0, 0.002, 0]}
        opacity={realistic ? 0.55 : 0.25}
        scale={40}
        blur={realistic ? 2.6 : 2}
        far={10}
      />


      {items.map((it) => (
        <ItemObject
          key={it.id}
          item={it}
          selected={mode === "select" && selection.includes(it.id)}
          pending={mode === "cable" && pendingFrom === it.id}
          showConnectors={mode === "cable"}
          showConnectorLabels={showConnectorLabels}
          activeCableType={cableType}
          pendingItemId={pendingFrom}
          onConnectorPick={(itemId, conn) => {
            // Reconnect flow — pick the specific plug to reroute to.
            if (reconnect) {
              const cable = cables.find((c) => c.id === reconnect.cableId);
              const target = items.find((x) => x.id === itemId);
              if (!cable || !target) return;
              const other = reconnect.end === "from" ? cable.to : cable.from;
              if (other === itemId) { setReconnectError("Nelze zapojit oba konce do stejné bedny."); return; }
              if (conn.type !== cable.type) { setReconnectError(`Konektor je ${CABLE_META[conn.type].short}, kabel je ${CABLE_META[cable.type].short}.`); return; }
              setCables((cs) => cs.map((c) => c.id === cable.id ? { ...c, [reconnect.end]: itemId } : c));
              setReconnect(null); setReconnectError(null);
              return;
            }
            if (!pendingFrom) {
              // Start a cable drag from this plug.
              setPendingFrom(itemId);
              setPendingSourceConnector(conn);
              // Auto-switch the active cable type to match the plug the user grabbed.
              if (conn.type !== cableType) setCableType(conn.type);
              const src = items.find((x) => x.id === itemId);
              if (src) setCursorWorld(localToWorld(src, conn.offset));
              return;
            }
            if (pendingFrom === itemId) return; // ignore same-item second click
            // Complete: type must match the pending cable type.
            if (conn.type !== cableType) return;
            setCables((cs) => [...cs, { id: uid(), from: pendingFrom!, to: itemId, type: cableType }]);
            setPendingFrom(null);
            setPendingSourceConnector(null);
            setCursorWorld(null);
          }}

          onSelect={(id, additive) => {
            // Reconnect flow — replace one endpoint of the selected cable.
            if (reconnect) {
              const cable = cables.find((c) => c.id === reconnect.cableId);
              const target = items.find((x) => x.id === id);
              if (!cable || !target) return;
              const other = reconnect.end === "from" ? cable.to : cable.from;
              if (other === id) {
                setReconnectError("Nelze zapojit oba konce kabelu do stejné bedny.");
                return;
              }
              const reason = connectorIncompatibility(target, cable.type, reconnect.end);
              if (reason) {
                setReconnectError(reason);
                return;
              }
              setCables((cs) => cs.map((c) => c.id === cable.id ? { ...c, [reconnect.end]: id } : c));
              setReconnect(null);
              setReconnectError(null);
              return;
            }
            if (mode === "cable") {
              const target = items.find((x) => x.id === id);
              if (!target) return;
              if (!hasConnector(target.kind, cableType)) return;
              if (!pendingFrom) {
                setPendingFrom(id);
              } else if (pendingFrom === id) {
                setPendingFrom(null);
              } else {
                const source = items.find((x) => x.id === pendingFrom);
                if (!source || !hasConnector(source.kind, cableType)) {
                  setPendingFrom(id);
                  return;
                }
                setCables((cs) => [...cs, { id: uid(), from: pendingFrom!, to: id, type: cableType }]);
                setPendingFrom(null);
              }
              return;
            }

            setSelection((prev) => {
              const target = items.find((x) => x.id === id);
              const groupMembers = target?.groupId
                ? items.filter((x) => x.groupId === target.groupId).map((x) => x.id)
                : [id];
              if (additive) {
                const set = new Set(prev);
                const allIn = groupMembers.every((g) => set.has(g));
                if (allIn) groupMembers.forEach((g) => set.delete(g));
                else groupMembers.forEach((g) => set.add(g));
                return [...set];
              }
              // Single click in select mode → open the device inspector modal
              // (toggle off if clicking the same device again).
              setInspectedItemId((cur) => (cur === id ? null : id));
              setSelectedCableId(null);
              return groupMembers;
            });
          }}
          onRegister={registerObject}
        />
      ))}

      {/* Placement ghost — snapped preview while dragging a selected item */}
      {dragging && mode === "select" && (
        <PlacementGhost
          selection={selection}
          items={items}
          objectsRef={objectsRef}
          onSnapChange={(info) => {
            // Only announce transitions to/from stack — the interesting change.
            if (info.mode === "stack") {
              setSnapTooltip({ text: `▣ Snap na ${info.ontoLabel ?? "bednu"}`, kind: "stack", at: Date.now() });
            } else if (info.mode === "ground") {
              setSnapTooltip({ text: "▤ Volno – snap uvolněn", kind: "ground", at: Date.now() });
            } else {
              setSnapTooltip({ text: "✗ Kolize – nelze položit", kind: "bad", at: Date.now() });
            }
          }}
          speakerLineZ={speakerLineZ}
        />
      )}

      {/* Snap-mode transition tooltip */}
      {snapTooltip && dragging && (
        <Html fullscreen prepend zIndexRange={[100, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 68,
              transform: "translateX(-50%)",
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(15,17,22,0.92)",
              color: snapTooltip.kind === "stack" ? "#7fe3ff" : snapTooltip.kind === "bad" ? "#ffb0b0" : "#8fffb0",
              fontSize: 11.5,
              fontWeight: 600,
              fontFamily: "ui-sans-serif, system-ui",
              boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
              border: `1px solid ${snapTooltip.kind === "stack" ? "rgba(127,227,255,0.55)" : snapTooltip.kind === "bad" ? "rgba(255,120,120,0.55)" : "rgba(143,255,176,0.5)"}`,
              whiteSpace: "nowrap",
              opacity: Math.max(0, 1 - (Date.now() - snapTooltip.at) / 1600),
              transition: "opacity .25s linear",
            }}
          >
            {snapTooltip.text}
          </div>
        </Html>
      )}




      {/* Transient drop report — shows where the item actually landed vs the ghost preview. */}
      {dropReport && (
        <Html fullscreen prepend zIndexRange={[100, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 24,
              transform: "translateX(-50%)",
              padding: "8px 14px",
              borderRadius: 10,
              background: "rgba(15,17,22,0.86)",
              color: dropReport.kind === "stack" ? "#7fe3ff" : "#8fffb0",
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
              border: `1px solid ${dropReport.kind === "stack" ? "rgba(127,227,255,0.4)" : "rgba(143,255,176,0.4)"}`,
              whiteSpace: "nowrap",
            }}
          >
            {dropReport.kind === "stack" ? "▣ stack" : "▤ zem"} · {dropReport.text}
          </div>
        </Html>
      )}


      {/* Ghost cable — visible while the user is dragging a plug to a target */}
      {mode === "cable" && pendingFrom && cursorWorld && (() => {
        const src = items.find((i) => i.id === pendingFrom);
        if (!src) return null;
        const meta = CABLE_META[cableType];
        const srcLocal =
          pendingSourceConnector?.offset ??
          (connectorsFor(src.kind).find((c) => c.type === cableType && c.role === "out")
            ?? connectorsFor(src.kind).find((c) => c.type === cableType))?.offset;
        const p1 = srcLocal ? localToWorld(src, srcLocal) : anchorFor(src, cableType);
        const seed = pendingFrom.split("").reduce((s, ch) => s + ch.charCodeAt(0), 0);
        const pts = cablePoints(p1, cursorWorld, seed);
        return (
          <group>
            <Line
              points={pts as unknown as [number, number, number][]}
              color={meta.color}
              lineWidth={meta.width + 1}
              dashed
              dashSize={0.18}
              gapSize={0.12}
              transparent
              opacity={0.85}
            />
            <CableEndpoint position={p1} color={meta.color} state="active" />
            <mesh position={cursorWorld}>
              <sphereGeometry args={[0.09, 16, 12]} />
              <meshBasicMaterial color={meta.color} transparent opacity={0.65} />
            </mesh>
          </group>
        );
      })()}

      {/* Cables */}

      {cables.map((c) => {
        const a = items.find((i) => i.id === c.from);
        const b = items.find((i) => i.id === c.to);
        if (!a || !b) return null;
        const meta = CABLE_META[c.type];
        const { p1, p2 } = bestAnchorPair(a, b, c.type);
        // Per-cable seed so parallel runs fan out at slightly different bus heights.
        const seed = c.id.split("").reduce((s, ch) => s + ch.charCodeAt(0), 0);
        const pts = cablePoints(p1, p2, seed);
        const mid = pts[Math.floor(pts.length / 2)];
        const isSelected = selectedCableId === c.id;
        const isReconnecting = reconnect?.cableId === c.id;
        const fromName = itemLabel(a);
        const toName = itemLabel(b);

        const isHovered = hoveredCableId === c.id;
        const fromState: "idle" | "hover" | "selected" | "active" =
          isReconnecting && reconnect?.end === "from" ? "active"
          : isSelected ? "selected"
          : isHovered ? "hover"
          : "idle";
        const toState: "idle" | "hover" | "selected" | "active" =
          isReconnecting && reconnect?.end === "to" ? "active"
          : isSelected ? "selected"
          : isHovered ? "hover"
          : "idle";

        // When user hovers/selects a cable, fade the rest to bring it forward.
        const anyFocus = hoveredCableId !== null || selectedCableId !== null;
        const isFocus = isHovered || isSelected;
        const dimmed = anyFocus && !isFocus;
        const baseOpacity = isReconnecting ? 0.4 : dimmed ? 0.18 : 0.95;
        const width = isFocus ? meta.width + 3 : dimmed ? Math.max(1, meta.width - 0.5) : meta.width;

        return (
          <group key={c.id} renderOrder={isFocus ? 20 : dimmed ? 0 : 10}>
            {/* Soft glow halo behind the focused cable */}
            {isFocus && (
              <Line
                points={pts as unknown as [number, number, number][]}
                color={meta.color}
                lineWidth={width + 5}
                transparent
                opacity={0.22}
                depthTest={false}
              />
            )}
            <Line
              points={pts as unknown as [number, number, number][]}
              color={meta.color}
              lineWidth={width}
              transparent
              opacity={baseOpacity}
              depthTest={!isFocus}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredCableId(c.id); }}
              onPointerOut={(e) => { e.stopPropagation(); setHoveredCableId((cur) => (cur === c.id ? null : cur)); }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCableId((cur) => (cur === c.id ? null : c.id));
                setReconnect(null);
                setReconnectError(null);
              }}
            />
            {/* Animated flow overlay on hover/selected — dashes travel from source to target */}
            {isFocus && (
              <CableFlow points={pts} color={meta.color} width={width} />
            )}

            {/* Highlighted endpoints — pulse when picking a new target */}
            <CableEndpoint position={p1} color={meta.color} state={fromState} />
            <CableEndpoint position={p2} color={meta.color} state={toState} />



            {/* Always-visible compact label at cable midpoint */}
            {!isSelected && showCableLabels && (
              <Html position={mid} center distanceFactor={10} occlude={false} zIndexRange={[10, 0]}>
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedCableId(c.id);
                    setReconnect(null);
                    setReconnectError(null);
                  }}
                  className="cursor-pointer whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase leading-tight shadow-lg"
                  style={{
                    color: meta.color,
                    background: "rgba(0,0,0,.85)",
                    border: `1px solid ${meta.color}`,
                  }}
                  title={`${meta.label}: ${fromName} → ${toName}`}
                >
                  {meta.short} · {fromName}→{toName}
                </div>
              </Html>
            )}

            {/* Expanded inspector popup when selected — draggable, translucent */}
            {isSelected && (() => {
              // Candidates for each end: items with a compatible plug.
              const sourceCandidates = items.filter(
                (it) => it.id !== c.to && !connectorIncompatibility(it, c.type, "from"),
              );
              const targetCandidates = items.filter(
                (it) => it.id !== c.from && !connectorIncompatibility(it, c.type, "to"),
              );
              const swapEndpoint = (end: "from" | "to", newId: string) => {
                const other = end === "from" ? c.to : c.from;
                if (newId === other) { setReconnectError("Nelze zapojit oba konce do stejné bedny."); return; }
                const target = items.find((x) => x.id === newId);
                if (!target) return;
                const reason = connectorIncompatibility(target, c.type, end);
                if (reason) { setReconnectError(reason); return; }
                setCables((cs) => cs.map((x) => x.id === c.id ? { ...x, [end]: newId } : x));
                setReconnect(null);
                setReconnectError(null);
              };
              return (
                <Html position={mid} center distanceFactor={8} occlude={false} zIndexRange={[100, 0]}>
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-64 rounded-md border p-2 font-mono text-[10px] text-neutral-900 shadow-2xl backdrop-blur-md"
                    style={{
                      borderColor: meta.color,
                      background: "rgba(255,255,255,0.55)",
                      transform: `translate(${popupOffset.x}px, ${popupOffset.y}px)`,
                    }}
                  >
                    {/* Drag handle */}
                    <div
                      className="mb-1.5 flex cursor-grab items-center justify-between active:cursor-grabbing select-none"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const start = { x: e.clientX, y: e.clientY };
                        const base = { ...popupOffset };
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                        const move = (ev: PointerEvent) => {
                          setPopupOffset({ x: base.x + (ev.clientX - start.x), y: base.y + (ev.clientY - start.y) });
                        };
                        const up = () => {
                          window.removeEventListener("pointermove", move);
                          window.removeEventListener("pointerup", up);
                        };
                        window.addEventListener("pointermove", move);
                        window.addEventListener("pointerup", up);
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
                        />
                        <span className="font-bold uppercase" style={{ color: meta.color }}>
                          {meta.short}
                        </span>
                        <span className="text-neutral-600">{meta.label}</span>
                      </div>
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => { setSelectedCableId(null); setReconnect(null); setReconnectError(null); }}
                        className="rounded px-1 text-neutral-600 hover:bg-neutral-200"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Source dropdown */}
                    <div className="mb-1 rounded bg-white/60 p-1.5">
                      <div className="text-[8px] uppercase tracking-wider text-neutral-600">Zdroj (OUT · {meta.short}▶)</div>
                      <select
                        value={c.from}
                        onChange={(e) => swapEndpoint("from", e.target.value)}
                        onPointerDown={(ev) => ev.stopPropagation()}
                        className="mt-0.5 w-full rounded border border-neutral-300 bg-white/80 px-1 py-0.5 font-mono text-[10px] font-bold text-lime-700 outline-none focus:border-lime-500"
                      >
                        {sourceCandidates.length === 0 && (
                          <option value={c.from}>{fromName}</option>
                        )}
                        {sourceCandidates.map((it) => (
                          <option key={it.id} value={it.id}>
                            {itemLabel(it)} — {SPECS[it.kind].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Target dropdown */}
                    <div className="mb-1.5 rounded bg-white/60 p-1.5">
                      <div className="text-[8px] uppercase tracking-wider text-neutral-600">Cíl (IN · {meta.short}◀)</div>
                      <select
                        value={c.to}
                        onChange={(e) => swapEndpoint("to", e.target.value)}
                        onPointerDown={(ev) => ev.stopPropagation()}
                        className="mt-0.5 w-full rounded border border-neutral-300 bg-white/80 px-1 py-0.5 font-mono text-[10px] font-bold text-cyan-700 outline-none focus:border-cyan-500"
                      >
                        {targetCandidates.length === 0 && (
                          <option value={c.to}>{toName}</option>
                        )}
                        {targetCandidates.map((it) => (
                          <option key={it.id} value={it.id}>
                            {itemLabel(it)} — {SPECS[it.kind].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {reconnect && !reconnectError && (
                      <div
                        className="mb-1.5 rounded p-1 text-center text-[9px] font-bold"
                        style={{ background: "rgba(244,193,26,.2)", color: "#8a6a00", border: "1px dashed #f4c11a" }}
                      >
                        Klikni na novou bednu pro {reconnect.end === "from" ? "zdroj" : "cíl"}…
                      </div>
                    )}

                    {reconnectError && (
                      <div className="mb-1.5 rounded border border-red-400 bg-red-50/90 p-1.5 text-[9px] font-semibold leading-snug text-red-700">
                        <div className="mb-0.5 uppercase tracking-wider">Nekompatibilní konektor</div>
                        <div className="font-normal">{reconnectError}</div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => { setReconnect({ cableId: c.id, end: "from" }); setReconnectError(null); }}
                        className={`rounded px-1 py-1 text-[9px] font-bold uppercase ${reconnect?.end === "from" ? "bg-yellow-500 text-black" : "bg-white/70 text-neutral-800 hover:bg-white"}`}
                      >
                        Pick ve scéně (zdroj)
                      </button>
                      <button
                        onClick={() => { setReconnect({ cableId: c.id, end: "to" }); setReconnectError(null); }}
                        className={`rounded px-1 py-1 text-[9px] font-bold uppercase ${reconnect?.end === "to" ? "bg-yellow-500 text-black" : "bg-white/70 text-neutral-800 hover:bg-white"}`}
                      >
                        Pick ve scéně (cíl)
                      </button>
                      <button
                        onClick={() => {
                          setCables((cs) => cs.filter((x) => x.id !== c.id));
                          setSelectedCableId(null);
                          setReconnect(null);
                          setReconnectError(null);
                        }}
                        className="col-span-2 rounded bg-red-500/80 px-1 py-1 text-[9px] font-bold uppercase text-white hover:bg-red-600"
                      >
                        Smazat kabel
                      </button>
                    </div>
                  </div>
                </Html>
              );
            })()}
          </group>
        );
      })}

      {/* Device inspector modal — opens on click in select mode. Shows every
          connector, what's plugged into it, and a dropdown to wire empty ones. */}
      {(() => {
        if (!inspectedItemId) return null;
        const it = items.find((x) => x.id === inspectedItemId);
        if (!it) return null;
        const spec = SPECS[it.kind];
        const ports = connectorsFor(it.kind);
        const [pw, ph] = [spec.size[0], spec.size[1]];
        const topPos: [number, number, number] = [it.pos[0], it.pos[1] + ph + 0.5, it.pos[2]];
        // For each port, list cables attached to this device of that type/role.
        const cablesForPort = (type: CableType, role: ConnRole) =>
          cables.filter((c) => c.type === type && ((role === "out" && c.from === it.id) || (role === "in" && c.to === it.id)));
        return (
          <Html position={topPos} center distanceFactor={7} occlude={false} zIndexRange={[200, 0]}>
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="w-72 rounded-md border border-neutral-400 p-2 font-mono text-[10px] text-neutral-900 shadow-2xl backdrop-blur-md"
              style={{
                background: "rgba(255,255,255,0.6)",
                transform: `translate(${devicePopupOffset.x}px, ${devicePopupOffset.y}px)`,
              }}
            >
              <div
                className="mb-2 flex cursor-grab items-center justify-between border-b border-neutral-300 pb-1 select-none active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const start = { x: e.clientX, y: e.clientY };
                  const base = { ...devicePopupOffset };
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  const move = (ev: PointerEvent) => setDevicePopupOffset({ x: base.x + (ev.clientX - start.x), y: base.y + (ev.clientY - start.y) });
                  const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                  window.addEventListener("pointermove", move);
                  window.addEventListener("pointerup", up);
                }}
              >
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-bold uppercase text-neutral-900">{itemLabel(it)}</div>
                  <div className="truncate text-[9px] text-neutral-600">{spec.label} · {spec.hint}</div>
                </div>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setInspectedItemId(null)}
                  className="rounded px-1 text-neutral-700 hover:bg-neutral-200"
                >✕</button>
              </div>

              {ports.length === 0 && (
                <div className="rounded bg-white/70 p-2 text-center text-[10px] text-neutral-600">
                  Toto zařízení nemá žádné konektory.
                </div>
              )}

              <div className="space-y-1.5">
                {ports.map((port, i) => {
                  const meta = CABLE_META[port.type];
                  const attached = cablesForPort(port.type, port.role);
                  // Candidates for a new cable = other items with matching plug.
                  const need = port.role === "out" ? "to" : "from";
                  const candidates = items.filter(
                    (o) => o.id !== it.id && !connectorIncompatibility(o, port.type, need === "from" ? "from" : "to"),
                  );
                  const arrow = port.role === "out" ? "▶ OUT" : "◀ IN";
                  return (
                    <div key={i} className="rounded border p-1.5" style={{ borderColor: meta.color, background: "rgba(255,255,255,0.55)" }}>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
                          <span className="font-bold uppercase" style={{ color: meta.color }}>{meta.short}</span>
                          <span className="text-[9px] text-neutral-700">{arrow}</span>
                        </div>
                        <span className="text-[9px] text-neutral-600">{meta.label}</span>
                      </div>

                      {/* Currently attached cables */}
                      {attached.length > 0 ? (
                        <div className="mb-1 space-y-0.5">
                          {attached.map((cab) => {
                            const otherId = port.role === "out" ? cab.to : cab.from;
                            const other = items.find((o) => o.id === otherId);
                            return (
                              <div key={cab.id} className="flex items-center justify-between gap-1 rounded bg-white/70 px-1 py-0.5">
                                <button
                                  onClick={() => { setInspectedItemId(otherId); }}
                                  className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold text-neutral-800 hover:underline"
                                  title="Otevřít protějšek"
                                >
                                  → {other ? itemLabel(other) : "?"}
                                </button>
                                <button
                                  onClick={() => setCables((cs) => cs.filter((x) => x.id !== cab.id))}
                                  className="rounded bg-red-500/70 px-1 text-[9px] font-bold uppercase text-white hover:bg-red-600"
                                  title="Odpojit"
                                >✕</button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mb-1 rounded bg-white/50 px-1 py-0.5 text-[9px] italic text-neutral-500">
                          nezapojeno
                        </div>
                      )}

                      {/* Add-new dropdown */}
                      <select
                        value=""
                        onChange={(e) => {
                          const otherId = e.target.value;
                          if (!otherId) return;
                          const newCable: Cable = port.role === "out"
                            ? { id: uid(), from: it.id, to: otherId, type: port.type }
                            : { id: uid(), from: otherId, to: it.id, type: port.type };
                          setCables((cs) => [...cs, newCable]);
                          e.target.value = "";
                        }}
                        onPointerDown={(ev) => ev.stopPropagation()}
                        className="w-full rounded border border-neutral-300 bg-white/80 px-1 py-0.5 font-mono text-[10px] outline-none focus:border-neutral-500"
                      >
                        <option value="">＋ zapojit do…</option>
                        {candidates.length === 0 && (
                          <option value="" disabled>Žádné kompatibilní zařízení ve scéně</option>
                        )}
                        {candidates.map((o) => (
                          <option key={o.id} value={o.id}>
                            {itemLabel(o)} — {SPECS[o.kind].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex justify-between border-t border-neutral-300 pt-1 text-[9px] text-neutral-600">
                <span>Klikni na jiné zařízení pro přepnutí.</span>
                <button
                  onClick={() => setInspectedItemId(null)}
                  className="rounded bg-neutral-200/80 px-1.5 py-0.5 font-bold uppercase text-neutral-800 hover:bg-neutral-300"
                >Zavřít</button>
              </div>
            </div>
          </Html>
        );
      })()}


      {mode === "select" && primaryObj && (
        <TransformControls
          ref={transformRef}
          object={primaryObj}
          mode={tool}
          size={0.8}
          onMouseDown={() => setDragging(true)}
          onMouseUp={() => {
            setDragging(false);
            handleTransformEnd();
          }}
          onObjectChange={handleTransformChange}
        />
      )}

      {topView && (
        <>
          <OrthographicCamera
            makeDefault
            position={[0, 40, 0]}
            zoom={40}
            near={0.1}
            far={200}
          />
          {/* PA linie Z – zvýrazněná kóta, na kterou se snapují reproduktory */}
          <Line
            points={[[-40, 0.02, speakerLineZ], [40, 0.02, speakerLineZ]]}
            color="#f59e0b"
            lineWidth={2}
            dashed
            dashSize={0.4}
            gapSize={0.25}
          />
          <Html position={[-6, 0.03, speakerLineZ]} center distanceFactor={20} style={{ pointerEvents: "none" }}>
            <div style={{ background: "rgba(245,158,11,.95)", color: "#111", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
              PA linie Z = {speakerLineZ.toFixed(2)} m
            </div>
          </Html>
        </>
      )}

      <OrbitControls
        ref={orbitRef}
        makeDefault={!topView}
        target={[0, topView ? 0 : 1, 0]}
        maxPolarAngle={topView ? 0.001 : Math.PI / 2 - 0.02}
        minPolarAngle={topView ? 0 : 0}
        enableRotate={!topView}
        enableDamping
        dampingFactor={0.1}
      />
    </>

  );
}

/* ============================================================
   Presets (positions in meters, bottom-center)
   ============================================================ */

function loadPreset(kind: PresetKind): Placed[] {
  const mk = (k: Kind, x: number, y: number, z: number, label?: string): Placed => ({
    id: uid(), kind: k, pos: [x, y, z], rotY: 0, ...(label ? { label } : {}),
  });

  const arr: Placed[] = [];

  // Speakers always sit on the same audience-facing line.
  const SPK_Z = -1.4;

  if (kind === "namel_wall") {
    // --- Bottom row: 4×18" scoop subs (4 wide) ---
    for (let i = 0; i < 4; i++) {
      const x = -1.65 + i * 1.10;
      arr.push(mk("picus_scoop_lo", x, 0, SPK_Z, `Scoop Lo ${i + 1}`));
    }
    // --- Second row: 4×18" scoop hi stacked on lo ---
    for (let i = 0; i < 4; i++) {
      const x = -1.65 + i * 1.10;
      arr.push(mk("picus_scoop_hi", x, 1.00, SPK_Z, `Scoop Hi ${i + 1}`));
    }
    // --- Bass row (shelf) ---
    for (let i = 0; i < 3; i++) {
      const x = -1.10 + i * 1.10;
      arr.push(mk("picus_bass_row", x, 2.00, SPK_Z, `Bass ${i + 1}`));
    }
    // --- Central mid grill tower ---
    arr.push(mk("picus_mid_grill", 0.00, 2.55, SPK_Z, "Mid Grill"));
    // --- Top: 3-way tops flanked by hex horns ---
    arr.push(mk("picus_hex_horn", -1.75, 4.40, SPK_Z, "Hex L"));
    arr.push(mk("picus_top_3way", -0.55, 4.55, SPK_Z, "Top L"));
    arr.push(mk("picus_top_3way",  0.55, 4.55, SPK_Z, "Top R"));
    arr.push(mk("picus_hex_horn",  1.75, 4.40, SPK_Z, "Hex R"));
    // --- Infra ---
    arr.push(mk("powersoft", -3.4, 0, 0.8, "Amp L"));
    arr.push(mk("powersoft",  3.4, 0, 0.8, "Amp R"));
    arr.push(mk("distro",    -3.4, 0, 1.8, "Distro"));
    arr.push(mk("generator", -4.8, 0, 3.4, "Aggregát"));
    arr.push(mk("mixer",      0.0, 1.0, 3.2, "FOH mix"));
    arr.push(mk("dj",         0.0, 0.0, 3.6, "DJ"));
  } else if (kind === "club_stack") {
    // Compact 2×2 sub base + tops L/R
    arr.push(mk("picus_scoop_lo", -0.60, 0.00, SPK_Z, "Sub L1"));
    arr.push(mk("picus_scoop_lo",  0.60, 0.00, SPK_Z, "Sub R1"));
    arr.push(mk("picus_scoop_hi", -0.60, 1.00, SPK_Z, "Sub L2"));
    arr.push(mk("picus_scoop_hi",  0.60, 1.00, SPK_Z, "Sub R2"));
    arr.push(mk("picus_top_3way", -0.60, 2.00, SPK_Z, "Top L"));
    arr.push(mk("picus_top_3way",  0.60, 2.00, SPK_Z, "Top R"));
    arr.push(mk("powersoft", -2.4, 0, 0.8, "Amp"));
    arr.push(mk("distro",    -2.4, 0, 1.8, "Distro"));
    arr.push(mk("mixer",      0.0, 1.0, 2.6, "Mix"));
    arr.push(mk("dj",         0.0, 0.0, 3.0, "DJ"));
  } else {
    // festival_ground — three sub clusters + mid columns + wing horns
    for (let c = -1; c <= 1; c++) {
      const cx = c * 3.0;
      arr.push(mk("picus_deep_sub", cx - 0.65, 0.00, SPK_Z, `Sub ${c + 2}L`));
      arr.push(mk("picus_deep_sub", cx + 0.65, 0.00, SPK_Z, `Sub ${c + 2}R`));
    }
    arr.push(mk("picus_mid_stack", -1.20, 1.15, SPK_Z, "Mid L"));
    arr.push(mk("picus_mid_stack",  1.20, 1.15, SPK_Z, "Mid R"));
    arr.push(mk("picus_wing_horn", -3.60, 1.15, SPK_Z, "Wing L"));
    arr.push(mk("picus_wing_horn",  3.60, 1.15, SPK_Z, "Wing R"));
    arr.push(mk("picus_top_3way", -1.20, 2.60, SPK_Z, "Top L"));
    arr.push(mk("picus_top_3way",  1.20, 2.60, SPK_Z, "Top R"));
    arr.push(mk("powersoft", -4.4, 0, 1.0, "Amp L"));
    arr.push(mk("powersoft",  4.4, 0, 1.0, "Amp R"));
    arr.push(mk("distro",    -4.4, 0, 2.0, "Distro"));
    arr.push(mk("generator", -5.8, 0, 3.4, "Aggregát"));
    arr.push(mk("mixer",      0.0, 1.0, 4.0, "FOH"));
  }
  return arr;
}

/* ============================================================
   Auto-cabling — derive SIG / PWR / DMX routing from item types
   ============================================================ */

// Groups items by kind category and creates the cables a rider tech would
// actually run: generator distributes 230V to every powered box, sources feed
// the mixer which feeds every amp, and DMX daisy-chains all lighting fixtures.
// Speaker (SPK) cables are intentionally skipped — those are already implied
// by the physical stacking of amps under their boxes.
function autoWireCables(items: Placed[]): Cable[] {
  const cables: Cable[] = [];
  const of = (ks: Kind[]) => items.filter((i) => ks.includes(i.kind));

  const generator = of(["generator"])[0];
  const mixer = of(["mixer"])[0];
  const amps = of(["amp", "powersoft"]);
  const sources = of(["dj", "cdj", "turntable", "korg", "korg_red", "korg_blue"]);
  const dmxFixtures = of(["movinghead", "strobe", "laser"]);
  const passiveSpeakers = items.filter((i) => SPECS[i.kind].category === "sound");

  // Bin-family helpers.
  const SUB_KINDS: Kind[] = [
    "sub", "bass", "badtekk_sub", "badtekk_bass",
    "img_0838", "img_0839", "img_0841", "img_0842",
  ];
  const isSub = (k: Kind) => SUB_KINDS.includes(k);
  const dist = (a: Placed, b: Placed) =>
    Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]);

  // Everything that expects 230V.
  const powered = items.filter((i) =>
    connectorsFor(i.kind).some((c) => c.type === "power" && c.role === "in"),
  );

  // PWR — radial from generator/distro.
  if (generator) {
    for (const p of powered) {
      cables.push({ id: uid(), from: generator.id, to: p.id, type: "power" });
    }
  }

  // SPK — cluster speakers by proximity (< 4 m), pair each cluster with the
  // nearest amp, then chain subs and tops separately (Speakon link-out).
  if (amps.length && passiveSpeakers.length) {
    const seen = new Set<string>();
    const clusters: Placed[][] = [];
    for (const s of passiveSpeakers) {
      if (seen.has(s.id)) continue;
      const cluster = [s];
      seen.add(s.id);
      let grew = true;
      while (grew) {
        grew = false;
        for (const t of passiveSpeakers) {
          if (seen.has(t.id)) continue;
          if (cluster.some((c) => dist(c, t) < 4)) {
            cluster.push(t);
            seen.add(t.id);
            grew = true;
          }
        }
      }
      clusters.push(cluster);
    }

    const ampUse = new Map<string, number>(); // fan-out counter
    for (const cluster of clusters) {
      const subs = cluster.filter((c) => isSub(c.kind)).sort((a, b) => a.pos[0] - b.pos[0]);
      const tops = cluster.filter((c) => !isSub(c.kind)).sort((a, b) => a.pos[0] - b.pos[0]);
      const cx = cluster.reduce((s, c) => s + c.pos[0], 0) / cluster.length;
      const cz = cluster.reduce((s, c) => s + c.pos[2], 0) / cluster.length;
      const near = amps
        .slice()
        .sort((a, b) => {
          const da = Math.hypot(a.pos[0] - cx, a.pos[2] - cz) + (ampUse.get(a.id) ?? 0) * 0.01;
          const db = Math.hypot(b.pos[0] - cx, b.pos[2] - cz) + (ampUse.get(b.id) ?? 0) * 0.01;
          return da - db;
        })[0];
      if (!near) continue;
      ampUse.set(near.id, (ampUse.get(near.id) ?? 0) + 1);

      // Subs: amp → first sub, then link-chain sub → sub.
      if (subs[0]) cables.push({ id: uid(), from: near.id, to: subs[0].id, type: "speaker" });
      for (let i = 0; i < subs.length - 1; i++) {
        cables.push({ id: uid(), from: subs[i].id, to: subs[i + 1].id, type: "speaker" });
      }
      // Tops: separate run.
      if (tops[0]) cables.push({ id: uid(), from: near.id, to: tops[0].id, type: "speaker" });
      for (let i = 0; i < tops.length - 1; i++) {
        cables.push({ id: uid(), from: tops[i].id, to: tops[i + 1].id, type: "speaker" });
      }
    }
  }

  // SIG — sources → mixer → amps. If no mixer, sources go straight to amps.
  if (mixer) {
    for (const s of sources) {
      cables.push({ id: uid(), from: s.id, to: mixer.id, type: "signal" });
    }
    for (const a of amps) {
      cables.push({ id: uid(), from: mixer.id, to: a.id, type: "signal" });
    }
  } else if (sources[0]) {
    for (const a of amps) {
      cables.push({ id: uid(), from: sources[0].id, to: a.id, type: "signal" });
    }
  }

  // DMX — daisy-chain all lighting fixtures.
  for (let i = 0; i < dmxFixtures.length - 1; i++) {
    cables.push({
      id: uid(),
      from: dmxFixtures[i].id,
      to: dmxFixtures[i + 1].id,
      type: "dmx",
    });
  }

  return cables;
}



/* ============================================================
   Palette thumbnail — mini 3D preview per catalog item
   ============================================================ */

function ThumbLookAt() {
  const { camera } = useThree();
  useEffect(() => { camera.lookAt(0, 0, 0); }, [camera]);
  return null;
}

function PaletteThumb({ kind }: { kind: Kind }) {
  const spec = SPECS[kind];
  const [w, h, d] = spec.size;
  const maxDim = Math.max(w, h, d);
  const camDist = maxDim * 2.2 + 0.4;
  return (
    <div className="pointer-events-none h-16 w-full overflow-hidden rounded bg-gradient-to-b from-neutral-100 to-white">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [camDist * 0.9, camDist * 0.75, camDist], fov: 32 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        shadows={false}
        frameloop="demand"
      >
        <ThumbLookAt />
        <ambientLight intensity={0.7} />
        <hemisphereLight args={["#a3ff12", "#221100", 0.4]} />
        <directionalLight position={[3, 4, 3]} intensity={1.1} />
        <group position={[0, -h / 2, 0]}>
          <ModelFor kind={kind} size={spec.size} />
        </group>
      </Canvas>
    </div>
  );
}

/* ============================================================
   Main component
   ============================================================ */

export function StageBuilder3D() {
  const [items, setItems] = useState<Placed[]>([]);
  const [cables, setCables] = useState<Cable[]>([]);
  const [selection, setSelection] = useState<string[]>([]);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [groupSpacing, setGroupSpacing] = useState<Record<string, number>>({});
  const [sceneHydrated, setSceneHydrated] = useState(false);
  const [tool, setTool] = useState<"translate" | "rotate">("translate");
  const [mode, setMode] = useState<"select" | "cable">("select");
  const [cableType, setCableType] = useState<CableType>("signal");
  const [showConnectorLabels, setShowConnectorLabels] = useState(true);
  const [showCableLabels, setShowCableLabels] = useState(true);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("sound");
  const [clipboard, setClipboard] = useState<Placed[]>([]);
  // Panels start closed to match SSR; hydrate from localStorage / viewport after mount.
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);
  const [rightOpen, setRightOpen] = useState<boolean>(false);
  const [panelsHydrated, setPanelsHydrated] = useState(false);
  useEffect(() => {
    const l = localStorage.getItem("stage.panel.left");
    const r = localStorage.getItem("stage.panel.right");
    const wide = window.matchMedia("(min-width: 768px)").matches;
    setPaletteOpen(l !== null ? l === "1" : wide);
    setRightOpen(r !== null ? r === "1" : wide);
    setPanelsHydrated(true);
  }, []);
  const [marqueeMode, setMarqueeMode] = useState(false);
  const [realistic, setRealistic] = useState(false);
  const [autoSanitize, setAutoSanitize] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("stage.autoSanitize");
    setAutoSanitize(saved === null ? true : saved === "1");
  }, []);
  useEffect(() => {
    if (panelsHydrated) localStorage.setItem("stage.autoSanitize", autoSanitize ? "1" : "0");
  }, [autoSanitize, panelsHydrated]);
  const [viewMode, setViewMode] = useState<"3d" | "front3d" | "top" | "schema" | "grid" | "elev" | "iso">("3d");
  const [marquee, setMarquee] = useState<null | { x1: number; y1: number; x2: number; y2: number; additive: boolean }>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  // Global audience-facing line for all speakers. All sound-category items
  // snap their Z to this value on placement / drop / arrow-nudge so the PA
  // wall stays coplanar. Non-speakers (amps, mixer, distro, lights) are free.
  const [speakerLineZ, setSpeakerLineZ] = useState<number>(() => {
    if (typeof window === "undefined") return -1.4;
    const raw = localStorage.getItem("stage.speakerLineZ");
    const v = raw ? Number(raw) : NaN;
    return Number.isFinite(v) ? v : -1.4;
  });
  useEffect(() => { localStorage.setItem("stage.speakerLineZ", String(speakerLineZ)); }, [speakerLineZ]);
  const isSpeakerKind = useCallback((k: Kind) => {
    if (SPECS[k].category !== "sound") return false;
    return true;
  }, []);
  const snapSpeakerZ = useCallback((k: Kind, z: number) => (isSpeakerKind(k) ? speakerLineZ : z), [isSpeakerKind, speakerLineZ]);

  // Dark mode — toggle .dark class on <html> + persist. Initial read runs
  // in effect to avoid SSR hydration mismatches.
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("stage.theme");
    const wants = stored === "dark";
    setDark(wants);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark"); else root.classList.remove("dark");
    localStorage.setItem("stage.theme", dark ? "dark" : "light");
  }, [dark]);

  // Auto-scroll active layer into view whenever selection changes.
  const layerRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  useEffect(() => {
    if (!selection.length) return;
    const first = selection[0];
    const el = layerRowRefs.current.get(first);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selection]);
  // Collapsible group folders (Photoshop-style).
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const toggleGroupCollapsed = useCallback((gid: string) => {
    setCollapsedGroups((cur) => ({ ...cur, [gid]: !cur[gid] }));
  }, []);



  // Load from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.items)) setItems(normalizeScene(parsed.items));
        if (Array.isArray(parsed.cables)) setCables(parsed.cables);
        if (parsed.groupNames && typeof parsed.groupNames === "object") setGroupNames(parsed.groupNames);
        if (parsed.groupSpacing && typeof parsed.groupSpacing === "object") setGroupSpacing(parsed.groupSpacing);
      } else {
        setItems(normalizeScene(loadPreset("namel_wall")));
      }
    } catch { /* noop */ }
    finally { setSceneHydrated(true); }
  }, []);

  useEffect(() => {
    if (!sceneHydrated) return;
    localStorage.setItem(STORAGE, JSON.stringify({ items, cables, groupNames, groupSpacing }));
  }, [items, cables, groupNames, groupSpacing, sceneHydrated]);

  /* ---------------- Undo / Redo history ---------------- */
  const historyRef = useRef<{ items: Placed[]; cables: Cable[] }[]>([]);
  const historyIdxRef = useRef(-1);
  const skipHistoryRef = useRef(false);
  const [, forceHistoryTick] = useState(0);
  useEffect(() => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return; }
    // Skip pushing an identical snapshot (avoids duplicates from unrelated re-renders).
    const top = historyRef.current[historyIdxRef.current];
    if (top && top.items === items && top.cables === cables) return;
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push({ items, cables });
    if (historyRef.current.length > 120) historyRef.current.shift();
    historyIdxRef.current = historyRef.current.length - 1;
    forceHistoryTick((t) => t + 1);
  }, [items, cables]);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const s = historyRef.current[historyIdxRef.current];
    skipHistoryRef.current = true;
    setItems(s.items);
    setCables(s.cables);
    forceHistoryTick((t) => t + 1);
  }, []);
  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    const s = historyRef.current[historyIdxRef.current];
    skipHistoryRef.current = true;
    setItems(s.items);
    setCables(s.cables);
    forceHistoryTick((t) => t + 1);
  }, []);
  const canUndo = historyIdxRef.current > 0;
  const canRedo = historyIdxRef.current < historyRef.current.length - 1;


  useEffect(() => { if (panelsHydrated) localStorage.setItem("stage.panel.left", paletteOpen ? "1" : "0"); }, [paletteOpen, panelsHydrated]);
  useEffect(() => { if (panelsHydrated) localStorage.setItem("stage.panel.right", rightOpen ? "1" : "0"); }, [rightOpen, panelsHydrated]);


  const addItem = (kind: Kind) => {
    const spec = SPECS[kind];
    const desiredZ = isSpeakerKind(kind) ? speakerLineZ : 2;
    const raw = findOpenGroundPosition(kind, items, [0, 0, desiredZ]);
    const pos: [number, number, number] = [raw[0], raw[1], snapSpeakerZ(kind, raw[2])];
    const it: Placed = {
      id: uid(), kind,
      pos,
      rotY: 0,
      ...(spec.defaultLabel ? { label: spec.defaultLabel } : {}),
      ...(spec.defaultVariant ? { variant: spec.defaultVariant } : {}),
    };
    setItems((cur) => normalizeScene([...cur, it]));
    setSelection([it.id]);
  };


  const deleteSelection = useCallback(() => {
    if (!selection.length) return;
    const del = new Set(selection);
    setItems((cur) => cur.filter((i) => !del.has(i.id)));
    setCables((cs) => cs.filter((c) => !del.has(c.from) && !del.has(c.to)));
    setSelection([]);
  }, [selection]);


  const copySelection = useCallback(() => {
    setClipboard(items.filter((i) => selection.includes(i.id)));
  }, [items, selection]);

  const pasteSelection = useCallback(() => {
    if (!clipboard.length) return;
    const groupMap = new Map<string, string>();
    const created = clipboard.map((c) => {
      let gid = c.groupId;
      if (gid) {
        if (!groupMap.has(gid)) groupMap.set(gid, uid());
        gid = groupMap.get(gid)!;
      }
      return {
        ...c,
        id: uid(),
        pos: [c.pos[0] + 0.5, c.pos[1], c.pos[2] + 0.5] as [number, number, number],
        groupId: gid,
      };
    });
    setItems((cur) => normalizeScene([...cur, ...created]));
    setSelection(created.map((c) => c.id));
  }, [clipboard]);

  const duplicateSelection = useCallback(() => {
    if (!selection.length) return;
    const src = items.filter((i) => selection.includes(i.id));
    const groupMap = new Map<string, string>();
    const created = src.map((c) => {
      let gid = c.groupId;
      if (gid) {
        if (!groupMap.has(gid)) groupMap.set(gid, uid());
        gid = groupMap.get(gid)!;
      }
      return {
        ...c,
        id: uid(),
        pos: [c.pos[0] + 0.5, c.pos[1], c.pos[2] + 0.5] as [number, number, number],
        groupId: gid,
      };
    });
    setItems((cur) => normalizeScene([...cur, ...created]));
    setSelection(created.map((c) => c.id));
  }, [items, selection]);

  const groupSelection = useCallback(() => {
    if (selection.length < 2) return;
    const gid = uid();
    setGroupSpacing((cur) => ({ ...cur, [gid]: 0.06 }));
    setItems((cur) => normalizeScene(cur.map((i) => selection.includes(i.id) ? { ...i, groupId: gid } : i)));
  }, [selection]);

  const ungroupSelection = useCallback(() => {
    setItems((cur) => cur.map((i) => selection.includes(i.id) ? { ...i, groupId: undefined } : i));
  }, [selection]);

  const renameGroup = useCallback((gid: string, name: string) => {
    setGroupNames((cur) => {
      const next = { ...cur };
      if (name.trim()) next[gid] = name;
      else delete next[gid];
      return next;
    });
  }, []);

  const setGroupGap = useCallback((gid: string, gap: number) => {
    const safeGap = Math.max(0, Math.min(2, Number.isFinite(gap) ? gap : 0));
    setGroupSpacing((cur) => ({ ...cur, [gid]: safeGap }));
    setItems((cur) => normalizeScene(spreadGroupItems(cur, gid, safeGap), safeGap));
  }, []);

  // Nudge selection by dx/dy/dz (world meters). dy clamped ≥ 0 on the ground.
  const nudgeSelection = useCallback((dx: number, dy: number, dz: number) => {
    if (!selection.length) return;
    setItems((cur) => normalizeScene(cur.map((it) => {
      if (!selection.includes(it.id)) return it;
      const ny = Math.max(0, it.pos[1] + dy);
      const nz = isSpeakerKind(it.kind) ? speakerLineZ : it.pos[2] + dz;
      return { ...it, pos: [it.pos[0] + dx, ny, nz] as [number, number, number] };
    })));
  }, [selection, isSpeakerKind, speakerLineZ]);

  /* ── Photoshop-style alignment ──────────────────────────────────────
     Uses top-down XZ footprint (X = horizontal, Z = "vertical" on plan)
     plus Y (elevation). All ops operate on the current selection. */
  type AlignOp =
    | "left" | "right" | "hcenter"   // X axis
    | "front" | "back" | "vcenter"   // Z axis
    | "top" | "bottom" | "ycenter";  // Y axis
  const alignSelection = useCallback((op: AlignOp) => {
    if (selection.length < 2) return;
    setItems((cur) => {
      const sel = cur.filter((i) => selection.includes(i.id));
      if (sel.length < 2) return cur;
      const bounds = sel.map((i) => {
        const [w, h, d] = SPECS[i.kind].size;
        return {
          id: i.id,
          minX: i.pos[0] - w / 2, maxX: i.pos[0] + w / 2, cx: i.pos[0],
          minZ: i.pos[2] - d / 2, maxZ: i.pos[2] + d / 2, cz: i.pos[2],
          minY: i.pos[1],         maxY: i.pos[1] + h,     cy: i.pos[1] + h / 2,
          w, h, d,
        };
      });
      const minX = Math.min(...bounds.map((b) => b.minX));
      const maxX = Math.max(...bounds.map((b) => b.maxX));
      const minZ = Math.min(...bounds.map((b) => b.minZ));
      const maxZ = Math.max(...bounds.map((b) => b.maxZ));
      const minY = Math.min(...bounds.map((b) => b.minY));
      const maxY = Math.max(...bounds.map((b) => b.maxY));
      const cxAll = (minX + maxX) / 2;
      const czAll = (minZ + maxZ) / 2;
      const cyAll = (minY + maxY) / 2;
      const targetPos = new Map<string, [number, number, number]>();
      for (const b of bounds) {
        const src = sel.find((i) => i.id === b.id)!;
        let [x, y, z] = src.pos;
        switch (op) {
          case "left":    x = minX + b.w / 2; break;
          case "right":   x = maxX - b.w / 2; break;
          case "hcenter": x = cxAll; break;
          case "front":   z = minZ + b.d / 2; break;
          case "back":    z = maxZ - b.d / 2; break;
          case "vcenter": z = czAll; break;
          case "bottom":  y = Math.max(0, minY); break;
          case "top":     y = Math.max(0, maxY - b.h); break;
          case "ycenter": y = Math.max(0, cyAll - b.h / 2); break;
        }
        targetPos.set(b.id, [x, y, z]);
      }
      return normalizeScene(cur.map((it) => targetPos.has(it.id) ? { ...it, pos: targetPos.get(it.id)! } : it));
    });
  }, [selection]);

  // Distribute evenly across an axis (center-to-center spacing).
  const distributeSelection = useCallback((axis: "x" | "z" | "y") => {
    if (selection.length < 3) return;
    setItems((cur) => {
      const sel = cur.filter((i) => selection.includes(i.id));
      if (sel.length < 3) return cur;
      const idx = axis === "x" ? 0 : axis === "y" ? 1 : 2;
      const sorted = [...sel].sort((a, b) => a.pos[idx] - b.pos[idx]);
      const first = sorted[0].pos[idx];
      const last = sorted[sorted.length - 1].pos[idx];
      const step = (last - first) / (sorted.length - 1);
      const targetPos = new Map<string, [number, number, number]>();
      sorted.forEach((it, i) => {
        const p: [number, number, number] = [...it.pos] as [number, number, number];
        p[idx] = first + step * i;
        if (idx === 1) p[1] = Math.max(0, p[1]);
        targetPos.set(it.id, p);
      });
      return normalizeScene(cur.map((it) => targetPos.has(it.id) ? { ...it, pos: targetPos.get(it.id)! } : it));
    });
  }, [selection]);

  // Auto-layout: place all items on the ground in tidy rows by category so
  // nothing overlaps. Stacks (shared groupId) are kept together as one unit;
  // vertical Y positions inside a stack are preserved.
  const autoLayout = useCallback(() => {
    setItems((cur) => {
      if (cur.length === 0) return cur;
      const units = new Map<string, Placed[]>();
      for (const it of cur) {
        const key = it.groupId ?? it.id;
        if (!units.has(key)) units.set(key, []);
        units.get(key)!.push(it);
      }
      const CAT_ORDER: Array<Spec["category"]> = ["sound", "infra", "lights"];
      const catRank = (k: string) => {
        const c = SPECS[k as Kind]?.category ?? "infra";
        const i = CAT_ORDER.indexOf(c);
        return i === -1 ? CAT_ORDER.length : i;
      };
      type Unit = { key: string; ids: string[]; w: number; d: number; cat: number; primaryKind: string };
      const unitList: Unit[] = [];
      units.forEach((arr, key) => {
        let w = 0, d = 0;
        for (const it of arr) {
          const s = SPECS[it.kind as Kind]?.size ?? [0.5, 0.5, 0.5];
          if (s[0] > w) w = s[0];
          if (s[2] > d) d = s[2];
        }
        arr.sort((a, b) => a.pos[1] - b.pos[1]);
        unitList.push({
          key, ids: arr.map((i) => i.id), w, d,
          cat: catRank(arr[0].kind),
          primaryKind: arr[0].kind,
        });
      });
      unitList.sort((a, b) => a.cat - b.cat || a.primaryKind.localeCompare(b.primaryKind));

      const MAX_W = 14;
      const GAP = 0.08;
      const ROW_GAP = 0.7;
      type Row = { units: Unit[]; width: number; depth: number };
      const rows: Row[] = [];
      let row: Row = { units: [], width: 0, depth: 0 };
      let curCat = unitList[0]?.cat ?? 0;
      for (const u of unitList) {
        const needed = row.width + (row.units.length ? GAP : 0) + u.w;
        if (u.cat !== curCat || needed > MAX_W) {
          if (row.units.length) rows.push(row);
          row = { units: [], width: 0, depth: 0 };
          curCat = u.cat;
        }
        row.units.push(u);
        row.width += (row.units.length > 1 ? GAP : 0) + u.w;
        if (u.d > row.depth) row.depth = u.d;
      }
      if (row.units.length) rows.push(row);

      let z = 0;
      const rowZ: number[] = [];
      for (const r of rows) {
        rowZ.push(z + r.depth / 2);
        z += r.depth + ROW_GAP;
      }
      const totalDepth = Math.max(0, z - ROW_GAP);
      const zOffset = -totalDepth / 2;

      const posByUnit = new Map<string, { x: number; z: number }>();
      rows.forEach((r, ri) => {
        let x = -r.width / 2;
        for (const u of r.units) {
          const cx = x + u.w / 2;
          posByUnit.set(u.key, { x: cx, z: rowZ[ri] + zOffset });
          x += u.w + GAP;
        }
      });

      const byId = new Map<string, { x: number; z: number }>();
      unitList.forEach((u) => {
        const p = posByUnit.get(u.key)!;
        for (const id of u.ids) byId.set(id, p);
      });
      return normalizeScene(cur.map((it) => {
        const p = byId.get(it.id);
        if (!p) return it;
        return { ...it, pos: [p.x, it.pos[1], p.z] as [number, number, number], rotY: 0 };
      }));
    });
    setSelection([]);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const meta = e.ctrlKey || e.metaKey;
      if (e.key === "Delete" || e.key === "Backspace") { deleteSelection(); e.preventDefault(); }
      else if (meta && e.key.toLowerCase() === "c") { copySelection(); e.preventDefault(); }
      else if (meta && e.key.toLowerCase() === "v") { pasteSelection(); e.preventDefault(); }
      else if (meta && e.key.toLowerCase() === "d") { duplicateSelection(); e.preventDefault(); }
      else if (meta && e.shiftKey && e.key.toLowerCase() === "g") { ungroupSelection(); e.preventDefault(); }
      else if (meta && e.key.toLowerCase() === "g") { groupSelection(); e.preventDefault(); }
      else if (e.key === "Escape") { setSelection([]); setPendingFrom(null); }
      else if (e.key.toLowerCase() === "t") { setMode("select"); setTool("translate"); }
      else if (e.key.toLowerCase() === "c" && !meta) { setMode((m) => (m === "cable" ? "select" : "cable")); setSelection([]); setPendingFrom(null); }
      else if (meta && !e.shiftKey && e.key.toLowerCase() === "z") { undo(); e.preventDefault(); }
      else if (meta && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { redo(); e.preventDefault(); }
      else if (e.key === "[") { setPaletteOpen((v) => !v); }
      else if (e.key === "]") { setRightOpen((v) => !v); }
      // Arrow-key nudge: 0.1m, Shift = 1m. Alt = Y axis (up/down).
      else if (selection.length && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
        const step = e.shiftKey ? 1.0 : 0.1;
        let dx = 0, dy = 0, dz = 0;
        if (e.altKey) {
          if (e.key === "ArrowUp") dy = step;
          else if (e.key === "ArrowDown") dy = -step;
        } else {
          if (e.key === "ArrowLeft") dx = -step;
          else if (e.key === "ArrowRight") dx = step;
          else if (e.key === "ArrowUp") dz = -step;
          else if (e.key === "ArrowDown") dz = step;
        }
        if (dx || dy || dz) { nudgeSelection(dx, dy, dz); e.preventDefault(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelection, copySelection, pasteSelection, duplicateSelection, groupSelection, ungroupSelection, undo, redo, nudgeSelection, selection.length]);

  const palette = useMemo(
    () => (Object.entries(SPECS) as [Kind, Spec][]).filter(([, s]) => s.category === category),
    [category]
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-white text-neutral-900">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-200 bg-neutral-50/95 px-2 py-2 text-sm sm:gap-2 sm:px-3">
        <button
          onClick={() => setPaletteOpen((v) => !v)}
          className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200 md:hidden"
          aria-label="Toggle palette"
        >
          {paletteOpen ? <X size={14} /> : <Menu size={14} />}
        </button>
        <div className="flex items-center gap-1 font-bold text-lime-600">
          <Boxes size={16} /> <span className="hidden xs:inline sm:inline">STAGE RIG 3D</span>
        </div>
        <div className="mx-3 h-5 w-px bg-neutral-700" />
        <select
          value=""
          onChange={(e) => {
            const v = e.target.value as PresetKind | "";
            if (!v) return;
            const it = normalizeScene(loadPreset(v));
            setItems(it);
            // Preset ships with auto-wired cabling.
            setCables(autoWireCables(it));
            e.target.value = "";
          }}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-[12px] font-semibold text-neutral-800 hover:border-lime-500 focus:border-lime-500 focus:outline-none"
          title="Načíst hotový sound-system preset"
        >
          <option value="">⚡ Načíst preset…</option>
          <option value="namel_wall">Namel Wall — velká 4×18" stěna dle reference</option>
          <option value="club_stack">Club Stack — 2×2 sub + top L/R (kompakt)</option>
          <option value="festival_ground">Festival Ground — 3 sub clustery + wing horny</option>
        </select>
        <div className="mx-3 h-5 w-px bg-neutral-700" />
        <div className="flex items-center gap-0.5 rounded bg-neutral-200 p-0.5" title="Přepni mezi 3D scénou a klasickým technickým schématem zapojení">
          <button
            onClick={() => setViewMode("3d")}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${viewMode === "3d" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
          >
            <BoxIcon size={12} /> 3D scéna
          </button>
          <button
            onClick={() => setViewMode("front3d")}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${viewMode === "front3d" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
            title="3D pohled z nárysu — stavění zepředu se zachovanými 3D modely"
          >
            <GalleryVerticalEnd size={12} /> 3D Nárys
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${viewMode === "grid" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
            title="Půdorys stage — mřížka pro rozmístění beden z ptačí perspektivy"
          >
            <LayoutGrid size={12} /> Plán 2D
          </button>
          <button
            onClick={() => setViewMode("elev")}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${viewMode === "elev" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
            title="Nárys — pohled zepředu, ukazuje výšku stacků a patra beden"
          >
            <GalleryVerticalEnd size={12} /> Nárys
          </button>
          <button
            onClick={() => setViewMode("iso")}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${viewMode === "iso" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
            title="Isometrický pseudo-3D pohled — přehledné patra stacků z ptačí perspektivy"
          >
            <BoxIcon size={12} /> Iso
          </button>
          <button
            onClick={() => setViewMode("schema")}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${viewMode === "schema" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}
          >
            <Workflow size={12} /> Schéma zapojení
          </button>
        </div>
        <button
          onClick={() => setItems((cur) => normalizeScene(cur))}
          className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200"
          title="Srovná stackovací věže — každá bedna dosedne přesně na horní plochu bedny pod sebou (žádné zanořené kusy)."
        >
          <Boxes size={12} /> Srovnat stacky
        </button>
        <button
          onClick={() => setAutoSanitize((v) => !v)}
          className={`flex items-center gap-1 rounded px-2 py-1 ${autoSanitize ? "bg-cyan-500 text-neutral-950" : "bg-neutral-100 hover:bg-neutral-200"}`}
          title="Po každém dropu automaticky srovnat stacky (žádné bedny v půlce jiných)."
        >
          <Boxes size={12} /> Auto srovnat {autoSanitize ? "· ON" : "· OFF"}
        </button>
        <button onClick={() => { setMode("select"); setPendingFrom(null); setMarqueeMode(false); }} className={`flex items-center gap-1 rounded px-2 py-1 ${mode === "select" && !marqueeMode ? "bg-lime-500 text-neutral-950" : "bg-neutral-100 hover:bg-neutral-200"}`}><MousePointer2 size={12} /> Výběr</button>
        <button onClick={() => { setMode("select"); setPendingFrom(null); setMarqueeMode((v) => !v); }} className={`flex items-center gap-1 rounded px-2 py-1 ${marqueeMode ? "bg-lime-500 text-neutral-950" : "bg-neutral-100 hover:bg-neutral-200"}`} title="Táhni myší přes bedny (Shift = přidat k výběru)"><BoxSelect size={12} /> Skupinový výběr</button>
        <button
          onClick={() => setRealistic((v) => !v)}
          className={`flex items-center gap-1 rounded px-2 py-1 ${realistic ? "bg-amber-400 text-neutral-950" : "bg-neutral-100 hover:bg-neutral-200"}`}
          title="Přepnout PBR osvětlení + ACES tone mapping pro realističtější zobrazení"
        >
          <Sparkles size={12} /> {realistic ? "Realistický" : "Realističtější vzhled"}
        </button>
        <button
          onClick={() => setDark((v) => !v)}
          className={`flex items-center gap-1 rounded px-2 py-1 ${dark ? "bg-neutral-900 text-neutral-100" : "bg-neutral-100 hover:bg-neutral-200"}`}
          title="Přepnout světlý / tmavý režim"
        >
          {dark ? "☾ Tmavý" : "☀ Světlý"}
        </button>
        <div className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-1" title="Osa (Z) linie reproduktorů — všechny reprobedny se srovnají na tuto hodnotu">
          <span className="text-[10px] text-neutral-500">PA linie Z</span>
          <input
            type="number"
            step={0.1}
            value={speakerLineZ}
            onChange={(e) => setSpeakerLineZ(Number(e.target.value) || 0)}
            className="w-14 rounded border border-neutral-300 bg-white px-1 py-0.5 text-[11px]"
          />
        </div>
        <button onClick={() => setTool("translate")} disabled={mode !== "select"} className={`flex items-center gap-1 rounded px-2 py-1 ${tool === "translate" && mode === "select" ? "bg-lime-500 text-neutral-950" : "bg-neutral-100 hover:bg-neutral-200"} disabled:opacity-40`}><MoveIcon size={12} /> Posun (T)</button>
        {/* Rotace UI odstraněna — bedny mají fixní orientaci */}
        {/* ── Zarovnání (Photoshop-style) ─────────────────────── */}
            {selection.length >= 2 && (
              <div className="flex items-center gap-1 rounded bg-neutral-100 p-1" title="Zarovnání vybraných komponent">
            <span className="px-1 text-[9px] font-bold uppercase tracking-wider text-neutral-500">Zarovnat</span>
                <button onClick={() => alignSelection("left")}    className="min-h-7 min-w-7 rounded px-2 py-1 font-mono text-[15px] hover:bg-white" title="Zarovnat vlevo (X min)">⇤</button>
                <button onClick={() => alignSelection("hcenter")} className="min-h-7 min-w-7 rounded px-2 py-1 font-mono text-[15px] hover:bg-white" title="Vodorovně na střed (X)">⇔</button>
                <button onClick={() => alignSelection("right")}   className="min-h-7 min-w-7 rounded px-2 py-1 font-mono text-[15px] hover:bg-white" title="Zarovnat vpravo (X max)">⇥</button>
            <span className="mx-0.5 h-4 w-px bg-neutral-300" />
                <button onClick={() => alignSelection("front")}   className="min-h-7 min-w-7 rounded px-2 py-1 font-mono text-[15px] hover:bg-white" title="Zarovnat dopředu (Z min)">⤒</button>
                <button onClick={() => alignSelection("vcenter")} className="min-h-7 min-w-7 rounded px-2 py-1 font-mono text-[15px] hover:bg-white" title="Do hloubky na střed (Z)">⇕</button>
                <button onClick={() => alignSelection("back")}    className="min-h-7 min-w-7 rounded px-2 py-1 font-mono text-[15px] hover:bg-white" title="Zarovnat dozadu (Z max)">⤓</button>
            <span className="mx-0.5 h-4 w-px bg-neutral-300" />
                <button onClick={() => alignSelection("bottom")}  className="min-h-7 min-w-7 rounded px-2 py-1 font-mono text-[15px] hover:bg-white" title="Zarovnat dolů (Y min)">▁</button>
                <button onClick={() => alignSelection("ycenter")} className="min-h-7 min-w-7 rounded px-2 py-1 font-mono text-[15px] hover:bg-white" title="Výškově na střed (Y)">▬</button>
                <button onClick={() => alignSelection("top")}     className="min-h-7 min-w-7 rounded px-2 py-1 font-mono text-[15px] hover:bg-white" title="Zarovnat nahoru (Y max)">▔</button>
            {selection.length >= 3 && (
              <>
                <span className="mx-0.5 h-4 w-px bg-neutral-300" />
                <span className="px-1 text-[9px] font-bold uppercase tracking-wider text-neutral-500">Rozmístit</span>
                    <button onClick={() => distributeSelection("x")} className="min-h-7 min-w-7 rounded px-2 py-1 font-mono text-[15px] hover:bg-white" title="Rovnoměrně po X">↔</button>
                    <button onClick={() => distributeSelection("z")} className="min-h-7 min-w-7 rounded px-2 py-1 font-mono text-[15px] hover:bg-white" title="Rovnoměrně po Z (hloubka)">↕</button>
                    <button onClick={() => distributeSelection("y")} className="min-h-7 min-w-7 rounded px-2 py-1 font-mono text-[15px] hover:bg-white" title="Rovnoměrně po Y (výška)">⇅</button>
              </>
            )}
          </div>
        )}
        <div className="mx-2 h-5 w-px bg-neutral-700" />
        <button onClick={() => { setMode("cable"); setSelection([]); }} className={`flex items-center gap-1 rounded px-2 py-1 ${mode === "cable" ? "bg-lime-500 text-neutral-950" : "bg-neutral-100 hover:bg-neutral-200"}`}><CableIcon size={12} /> Kabely</button>
        {mode === "cable" && (
          <div className="flex items-center gap-1 rounded bg-neutral-100 p-0.5">
            {(Object.keys(CABLE_META) as CableType[]).map((t) => (
              <button
                key={t}
                onClick={() => setCableType(t)}
                className={`rounded px-2 py-0.5 text-[11px] font-bold ${cableType === t ? "text-neutral-950" : "text-neutral-600 hover:text-white"}`}
                style={cableType === t ? { backgroundColor: CABLE_META[t].color } : { backgroundColor: "transparent" }}
                title={CABLE_META[t].label}
              >
                <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: CABLE_META[t].color }} />
                {CABLE_META[t].short}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setCables(autoWireCables(items))}
          className="flex items-center gap-1 rounded bg-amber-400 px-2.5 py-1 font-bold text-neutral-950 shadow-sm hover:bg-amber-300"
          title="Automaticky vygeneruje kompletní kabeláž: PWR z aggregátu, SIG přes mixer, SPK z ampů do beden včetně link-out řetězení, DMX daisy-chain"
        >
          <Zap size={13} className="inline" /> Zapojit vše
        </button>
        <div className="mx-2 h-5 w-px bg-neutral-700" />
        <button
          onClick={() => setShowConnectorLabels((v) => !v)}
          className={`rounded px-2 py-1 text-[11px] ${showConnectorLabels ? "bg-lime-500 text-neutral-950" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"}`}
          title="Zobrazit / skrýt popisky konektorů (SIG▶, PWR◀, …)"
        >
          Popisky konektorů
        </button>
        <button
          onClick={() => setShowCableLabels((v) => !v)}
          className={`rounded px-2 py-1 text-[11px] ${showCableLabels ? "bg-lime-500 text-neutral-950" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"}`}
          title="Zobrazit / skrýt popisky kabelů uprostřed"
        >
          Popisky kabelů
        </button>


        <button onClick={undo} disabled={!canUndo} title="Zpět (Ctrl+Z)" className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200 disabled:opacity-40">↶ Zpět</button>
        <button onClick={redo} disabled={!canRedo} title="Vpřed (Ctrl+Shift+Z / Ctrl+Y)" className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200 disabled:opacity-40">↷ Vpřed</button>
        <button onClick={duplicateSelection} disabled={!selection.length} className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200 disabled:opacity-40"><Copy size={12} /> Duplikovat</button>
        <button onClick={copySelection} disabled={!selection.length} className="rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200 disabled:opacity-40">Kopírovat</button>
        <button onClick={pasteSelection} disabled={!clipboard.length} className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200 disabled:opacity-40"><ClipboardPaste size={12} /> Vložit</button>
        <button onClick={groupSelection} disabled={selection.length < 2} className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200 disabled:opacity-40"><GroupIcon size={12} /> Group</button>
        <button onClick={ungroupSelection} disabled={!selection.length} className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200 disabled:opacity-40"><Ungroup size={12} /> Ungroup</button>
        <button onClick={deleteSelection} disabled={!selection.length} className="flex items-center gap-1 rounded bg-red-100 px-2 py-1 hover:bg-red-200 disabled:opacity-40"><Trash2 size={12} /> Smazat</button>
        <div className="ml-auto flex w-full flex-wrap items-center gap-2 text-xs text-neutral-500 sm:w-auto">
          <span className="whitespace-nowrap">{items.length} prvků · {cables.length} kabelů · {selection.length} vybráno</span>
          <button onClick={autoLayout} disabled={!items.length} title="Rozmístí všechny bedny do přehledných řad, aby se nepřekrývaly" className="rounded bg-lime-100 px-2 py-1 font-semibold text-lime-800 hover:bg-lime-200 disabled:opacity-40">⇹ Auto rozmístit</button>
          <button onClick={() => localStorage.setItem(STORAGE, JSON.stringify({ items, cables, groupNames, groupSpacing }))} className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200"><Save size={12} /> Uložit</button>
          <button onClick={() => { if (confirm("Vymazat vše?")) { setItems([]); setCables([]); setSelection([]); }}} className="rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200">Vyčistit</button>
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Mobile palette backdrop */}
        {paletteOpen && (
          <div
            className="absolute inset-0 z-20 bg-black/30 md:hidden"
            onClick={() => setPaletteOpen(false)}
          />
        )}
        {/* Left rail (visible when palette collapsed) */}
        {!paletteOpen && (
          <button
            onClick={() => setPaletteOpen(true)}
            title="Otevřít paletu komponent ( [ )"
            className="absolute left-0 top-2 z-20 hidden h-10 w-6 items-center justify-center rounded-r border border-l-0 border-neutral-300 bg-white/95 text-neutral-600 shadow-md hover:bg-lime-50 hover:text-lime-700 md:flex"
          >
            <PanelLeft size={14} />
          </button>
        )}
        {/* Palette */}
        <aside
          className={`${paletteOpen ? "absolute inset-y-0 left-0 z-30 flex w-64 shadow-2xl md:static md:z-auto md:w-56 md:shadow-none" : "hidden"} flex-col border-r border-neutral-200 bg-neutral-50 md:bg-neutral-50/80`}
        >
          {/* Desktop collapse header */}
          <div className="hidden items-center justify-between border-b border-neutral-200 bg-white/60 px-2 py-1 md:flex">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Paleta ( [ )</span>
            <button
              onClick={() => setPaletteOpen(false)}
              title="Sbalit paletu"
              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X size={12} />
            </button>
          </div>
          <div className="flex border-b border-neutral-200">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`flex flex-1 items-center justify-center gap-1 py-2 text-xs ${category === c.id ? "bg-neutral-100 text-lime-600" : "text-neutral-500 hover:text-neutral-700"}`}
                >
                  <Icon size={12} /> {c.label}
                </button>
              );
            })}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {palette.map(([k, s]) => (
              <button
                key={k}
                onClick={() => { addItem(k); setPaletteOpen(false); }}
                className="mb-2 block w-full overflow-hidden rounded border border-neutral-200 bg-neutral-50 text-left transition hover:border-lime-500/60 hover:bg-neutral-100"
              >
                <PaletteThumb kind={k} />
                <div className="px-2 py-1.5">
                  <div className="text-xs font-semibold text-neutral-900">{s.label}</div>
                  <div className="text-[10px] text-neutral-500">{s.hint}</div>
                  <div className="mt-0.5 font-mono text-[9px] text-neutral-600">
                    {s.size[0].toFixed(2)}×{s.size[1].toFixed(2)}×{s.size[2].toFixed(2)} m
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="hidden border-t border-neutral-200 p-2 text-[10px] text-neutral-500 md:block">
            <div><b>T/R</b> — posun/rotace · <b>C</b> — kabely</div>
            <div><b>Ctrl+C/V/D</b> — kopie / vložit / duplikovat</div>
            <div><b>Ctrl+G / Ctrl+Shift+G</b> — group / ungroup</div>
            <div><b>Shift+klik</b> — přidat do výběru · <b>Del</b> — smazat</div>
            <div className="mt-1 text-neutral-500">V režimu Kabely: klik na první bednu → klik na druhou. Klik na kabel = smazat.</div>
          </div>
        </aside>

        {/* 3D Canvas / Schematic view */}
        <div className="relative flex-1" ref={canvasWrapRef}>
          {viewMode === "elev" ? (
            <ElevationView
              items={items}
              specs={SPECS as unknown as Record<string, { label: string; category: string; size: [number, number, number] }>}
              selectedIds={selection}
              onSelectItem={(id, additive) => {
                if (id === null) { setSelection([]); return; }
                setSelection((prev) => {
                  if (!additive) return [id];
                  return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
                });
              }}
              onUpdateItem={(id, patch) => {
                setItems((cur) => normalizeScene(cur.map((x) => x.id === id ? { ...x, ...patch, rotY: 0 } as Placed : x)));
              }}
              onDeleteItem={(id) => {
                setItems((cur) => cur.filter((x) => x.id !== id));
                setCables((cs) => cs.filter((c) => c.from !== id && c.to !== id));
                setSelection((prev) => prev.filter((x) => x !== id));
              }}
              onAddDeviceAt={(kind, x, z) => {
                const k = kind as Kind;
                const spec = SPECS[k];
                if (!spec) return;
                const it: Placed = {
                  id: uid(), kind: k,
                  pos: [x, 0, z], rotY: 0,
                  ...(spec.defaultLabel ? { label: spec.defaultLabel } : {}),
                  ...(spec.defaultVariant ? { variant: spec.defaultVariant } : {}),
                };
                const y = stackY(it, items);
                it.pos = [it.pos[0], y, it.pos[2]];
                setItems((cur) => normalizeScene([...cur, it]));
                setSelection([it.id]);
              }}
            />
          ) : viewMode === "grid" ? (
            <GridPlannerView
              items={items}
              specs={SPECS as unknown as Record<string, { label: string; category: string; size: [number, number, number] }>}
              selectedIds={selection}
              onSelectItem={(id, additive) => {
                if (id === null) { setSelection([]); return; }
                setSelection((prev) => {
                  if (!additive) return [id];
                  return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
                });
              }}
              onUpdateItem={(id, patch) => {
                setItems((cur) => normalizeScene(cur.map((x) => x.id === id ? { ...x, ...patch, rotY: 0 } as Placed : x)));
              }}
              onDeleteItem={(id) => {
                setItems((cur) => cur.filter((x) => x.id !== id));
                setCables((cs) => cs.filter((c) => c.from !== id && c.to !== id));
                setSelection((prev) => prev.filter((x) => x !== id));
              }}
              onAddDeviceAt={(kind, x, z) => {
                const k = kind as Kind;
                const spec = SPECS[k];
                if (!spec) return;
                const it: Placed = {
                  id: uid(), kind: k,
                  pos: [x, 0, z], rotY: 0,
                  ...(spec.defaultLabel ? { label: spec.defaultLabel } : {}),
                  ...(spec.defaultVariant ? { variant: spec.defaultVariant } : {}),
                };
                const y = stackY(it, items);
                it.pos = [it.pos[0], y, it.pos[2]];
                setItems((cur) => normalizeScene([...cur, it]));
                setSelection([it.id]);
              }}
            />
          ) : viewMode === "schema" ? (
            <SchematicView
              items={items}
              cables={cables}
              selectedIds={selection}
              onSelectItem={(id, additive) => {
                if (id === null) { setSelection([]); return; }
                setSelection((prev) => {
                  if (!additive) return [id];
                  return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
                });
              }}
              onAddDevice={(k) => addItem(k as Kind)}
              onConnect={(from, to, type) => {
                setCables((cs) => [...cs, { id: uid(), from, to, type }]);
              }}
              onRemoveCable={(id) => setCables((cs) => cs.filter((c) => c.id !== id))}
              kindOptions={(Object.entries(SPECS) as [Kind, Spec][]).map(([k, s]) => ({
                value: k, label: s.label, category: s.category,
              }))}
              onUpdateItem={(id, patch) => {
                setItems((cur) => normalizeScene(cur.map((x) => {
                  if (x.id !== id) return x;
                  const next = { ...x, ...patch, rotY: 0 } as Placed;
                  // Changing kind: apply that kind's default variant if it has one.
                  if (patch.kind && patch.kind !== x.kind) {
                    const nk = patch.kind as Kind;
                    next.kind = nk;
                    if (SPECS[nk]?.defaultVariant) next.variant = SPECS[nk].defaultVariant;
                  }
                  return next;
                })));
              }}
              onDeleteItem={(id) => {
                setItems((cur) => cur.filter((x) => x.id !== id));
                setCables((cs) => cs.filter((c) => c.from !== id && c.to !== id));
                setSelection((prev) => prev.filter((x) => x !== id));
              }}
            />

          ) : viewMode === "iso" ? (
            <IsometricView
              items={items}
              specs={SPECS as unknown as Record<string, { label: string; category: string; size: [number, number, number] }>}
              selectedIds={selection}
              onSelectItem={(id, additive) => {
                if (id === null) { setSelection([]); return; }
                setSelection((prev) => {
                  if (!additive) return [id];
                  return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
                });
              }}
              onDeleteItem={(id) => {
                setItems((cur) => cur.filter((x) => x.id !== id));
                setCables((cs) => cs.filter((c) => c.from !== id && c.to !== id));
                setSelection((prev) => prev.filter((x) => x !== id));
              }}
            />
          ) : (
          <>


          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{ position: [6, 5, 8], fov: 45, near: 0.1, far: 200 }}
            gl={{ antialias: true }}
          >
            <CameraExposer cameraRef={cameraRef} />
            <RealisticTuner enabled={realistic} />
            <SceneContent
              items={items}
              setItems={setItems}
              selection={selection}
              setSelection={setSelection}
              tool={tool}
              cables={cables}
              setCables={setCables}
              mode={mode}
              cableType={cableType}
              setCableType={setCableType}

              pendingFrom={pendingFrom}
              setPendingFrom={setPendingFrom}
              showConnectorLabels={showConnectorLabels}
              showCableLabels={showCableLabels}
              realistic={realistic}
              autoSanitize={autoSanitize}
              frontView={viewMode === "front3d"}
              speakerLineZ={speakerLineZ}
            />
          </Canvas>

          {/* Marquee overlay — active only when Skupinový výběr is toggled on */}
          {marqueeMode && (
            <div
              className="absolute inset-0 z-20 cursor-crosshair"
              style={{ background: "transparent" }}
              onPointerDown={(e) => {
                if (e.button !== 0 || !canvasWrapRef.current) return;
                const rect = canvasWrapRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setMarquee({ x1: x, y1: y, x2: x, y2: y, additive: e.shiftKey });
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!marquee || !canvasWrapRef.current) return;
                const rect = canvasWrapRef.current.getBoundingClientRect();
                setMarquee({ ...marquee, x2: e.clientX - rect.left, y2: e.clientY - rect.top });
              }}
              onPointerUp={() => {
                if (!marquee || !cameraRef.current || !canvasWrapRef.current) { setMarquee(null); return; }
                const rect = canvasWrapRef.current.getBoundingClientRect();
                const minX = Math.min(marquee.x1, marquee.x2);
                const maxX = Math.max(marquee.x1, marquee.x2);
                const minY = Math.min(marquee.y1, marquee.y2);
                const maxY = Math.max(marquee.y1, marquee.y2);
                const w = rect.width, h = rect.height;
                const cam = cameraRef.current;
                const v = new THREE.Vector3();
                const picked: string[] = [];
                for (const it of items) {
                  const s = SPECS[it.kind].size;
                  v.set(it.pos[0], it.pos[1] + s[1] / 2, it.pos[2]).project(cam);
                  const sx = (v.x * 0.5 + 0.5) * w;
                  const sy = (1 - (v.y * 0.5 + 0.5)) * h;
                  if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) picked.push(it.id);
                }
                setMode("select");
                if (Math.abs(maxX - minX) < 4 && Math.abs(maxY - minY) < 4) {
                  // treated as click on empty space → clear
                  if (!marquee.additive) setSelection([]);
                } else if (marquee.additive) {
                  setSelection((prev) => Array.from(new Set([...prev, ...picked])));
                } else {
                  setSelection(picked);
                }
                setMarquee(null);
              }}
            >
              {marquee && (
                <div
                  className="pointer-events-none absolute rounded-sm border-2 border-lime-500 bg-lime-400/15"
                  style={{
                    left: Math.min(marquee.x1, marquee.x2),
                    top: Math.min(marquee.y1, marquee.y2),
                    width: Math.abs(marquee.x2 - marquee.x1),
                    height: Math.abs(marquee.y2 - marquee.y1),
                  }}
                />
              )}
            </div>
          )}

          <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-neutral-50/80 px-2 py-1 text-[10px] text-neutral-500">
            {marqueeMode
              ? "Skupinový výběr: táhni myší přes bedny · Shift = přidat · vypnout tlačítkem v liště"
              : mode === "cable"
              ? (pendingFrom ? "Táhni na svítící konektor druhé bedny (Esc / klik do prázdna zruší)" : `Kabely (${CABLE_META[cableType].short}): klikni na barevný konektor bedny – typ kabelu se přepne automaticky`)
              : "Levé tl.: rotace · Pravé: pan · Kolečko: zoom · Klik na bednu: výběr"}
          </div>
          </>
          )}
        </div>

        {/* Right rail (visible when inspector collapsed) */}
        {!rightOpen && (
          <button
            onClick={() => setRightOpen(true)}
            title="Otevřít inspektor ( ] )"
            className="absolute right-0 top-2 z-20 flex h-10 w-6 items-center justify-center rounded-l border border-r-0 border-neutral-300 bg-white/95 text-neutral-600 shadow-md hover:bg-lime-50 hover:text-lime-700"
          >
            <PanelRight size={14} />
          </button>
        )}
        {/* Right inspector — per-item model / label / variant */}
        <aside className={`${rightOpen ? "flex w-72" : "hidden"} flex-col border-l border-neutral-200 bg-neutral-50/80`}>
          <div className="flex items-center justify-between border-b border-neutral-200 bg-white/60 px-2 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Inspektor ( ] )</span>
            <button
              onClick={() => setRightOpen(false)}
              title="Sbalit inspektor"
              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X size={12} />
            </button>
          </div>
          {/* ── Detail výběru ─────────────────────────────────────────── */}
          {(() => {
            const primary = items.find((x) => x.id === selection[0]);
            if (!primary) {
              return (
                <div className="border-b border-neutral-200 bg-white/60 px-3 py-3 text-[11px] text-neutral-500">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Detail výběru</div>
                  Vyber komponentu ve scéně, nárysu, plánu nebo schématu.
                </div>
              );
            }
            const pspec = SPECS[primary.kind];
            const pconns = connectorsFor(primary.kind);
            // "Patra" — stack of items sharing (x, z) sorted by y bottom-up
            const stack = items
              .filter((x) => Math.abs(x.pos[0] - primary.pos[0]) < 0.05 && Math.abs(x.pos[2] - primary.pos[2]) < 0.05)
              .sort((a, b) => a.pos[1] - b.pos[1]);
            const stackIdx = stack.findIndex((x) => x.id === primary.id);
            const linkedCables = cables.filter((c) => c.from === primary.id || c.to === primary.id);
            const deg = Math.round((primary.rotY * 180) / Math.PI);
            const patchPrimary = (patch: Partial<Placed>) => {
              setItems((cur) => normalizeScene(cur.map((x) => x.id === primary.id ? { ...x, ...patch, rotY: 0 } as Placed : x)));
            };
            return (
              <div className="border-b-2 border-lime-300 bg-white/80 px-3 py-2 text-[11px]">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-lime-700">Detail výběru</span>
                  <span className="font-mono text-[9px] text-neutral-500">#{primary.id.slice(0, 4)}</span>
                </div>
                <div className="mb-2">
                  <div className="truncate text-[13px] font-bold text-neutral-900">{primary.label || pspec.label}</div>
                  <div className="text-[10px] text-neutral-500">{pspec.label} · {pspec.hint}</div>
                </div>

                {/* Rozměry */}
                <div className="mb-2 rounded bg-neutral-100 px-2 py-1 font-mono text-[10px] text-neutral-700">
                  Š×V×H&nbsp; {pspec.size[0].toFixed(2)} × {pspec.size[1].toFixed(2)} × {pspec.size[2].toFixed(2)} m
                </div>

                {/* Patra */}
                <div className="mb-2">
                  <div className="mb-0.5 text-[9px] uppercase tracking-wider text-neutral-500">Patra ve stacku ({stackIdx + 1}/{stack.length})</div>
                  <div className="flex flex-col gap-0.5">
                    {stack.slice().reverse().map((s, i) => {
                      const sp = SPECS[s.kind];
                      const isMe = s.id === primary.id;
                      const level = stack.length - i;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelection([s.id])}
                          className={`flex items-center justify-between rounded px-1.5 py-0.5 text-left text-[10px] ${isMe ? "bg-lime-200 font-bold text-neutral-900" : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"}`}
                        >
                          <span className="truncate">{level}. {s.label || sp.label}</span>
                          <span className="ml-2 font-mono text-[9px] text-neutral-500">y {s.pos[1].toFixed(2)}m</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Orientace odstraněna – bedny mají fixní směr (▼ = přední strana) */}

                {/* Výška (Y) */}
                <div className="mb-2">
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-wider text-neutral-500">Výška (spodek bedny)</span>
                    <span className="font-mono text-[10px] text-neutral-700">{primary.pos[1].toFixed(2)} m</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => patchPrimary({ pos: [primary.pos[0], Math.max(0, primary.pos[1] - 0.1), primary.pos[2]] })}
                      className="rounded bg-neutral-100 px-2 py-1 text-[11px] hover:bg-neutral-200"
                    >−0.1</button>
                    <input
                      type="number" step={0.05} min={0}
                      value={Number(primary.pos[1].toFixed(2))}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        patchPrimary({ pos: [primary.pos[0], v, primary.pos[2]] });
                      }}
                      className="flex-1 rounded border border-neutral-300 bg-white px-1.5 py-1 font-mono text-[11px] focus:border-lime-500 focus:outline-none"
                    />
                    <button
                      onClick={() => patchPrimary({ pos: [primary.pos[0], primary.pos[1] + 0.1, primary.pos[2]] })}
                      className="rounded bg-neutral-100 px-2 py-1 text-[11px] hover:bg-neutral-200"
                    >+0.1</button>
                  </div>
                  <div className="mt-1 flex gap-1">
                    <button
                      onClick={() => patchPrimary({ pos: [primary.pos[0], 0, primary.pos[2]] })}
                      className="flex-1 rounded bg-neutral-100 px-1 py-0.5 text-[10px] hover:bg-neutral-200"
                    >Na zem</button>
                    <button
                      onClick={() => {
                        const y = stackY(primary, items.filter((i) => i.id !== primary.id));
                        patchPrimary({ pos: [primary.pos[0], y, primary.pos[2]] });
                      }}
                      className="flex-1 rounded bg-neutral-100 px-1 py-0.5 text-[10px] hover:bg-neutral-200"
                    >Auto-stack</button>
                  </div>
                </div>

                {/* Konektory */}
                <div className="mb-1">
                  <div className="mb-0.5 text-[9px] uppercase tracking-wider text-neutral-500">Konektory ({pconns.length})</div>
                  {pconns.length === 0 ? (
                    <div className="rounded bg-neutral-100 px-2 py-1 text-[10px] italic text-neutral-500">Žádné (pasivní prvek)</div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {pconns.map((c, i) => {
                        const meta = CABLE_META[c.type];
                        const used = linkedCables.find((cab) => cab.type === c.type && ((c.role === "out" && cab.from === primary.id) || (c.role === "in" && cab.to === primary.id)));
                        const otherId = used ? (used.from === primary.id ? used.to : used.from) : null;
                        const other = otherId ? items.find((x) => x.id === otherId) : null;
                        return (
                          <div key={i} className="flex items-center justify-between rounded bg-neutral-100 px-1.5 py-0.5 text-[10px]">
                            <span className="flex items-center gap-1">
                              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                              <span className="font-mono font-bold">{meta.short}</span>
                              <span className="text-neutral-500">{c.role === "in" ? "◀ IN" : "OUT ▶"}</span>
                            </span>
                            <span className="truncate text-[9px] text-neutral-600">
                              {other ? (other.label || SPECS[other.kind].label) : <span className="italic text-neutral-400">volný</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Vrstvy ({items.length})
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={groupSelection}
                disabled={selection.length < 2}
                className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] hover:bg-neutral-200 disabled:opacity-40"
                title="Seskupit výběr (Ctrl+G)"
              ><GroupIcon size={10} className="inline" /> Seskupit</button>
              <button
                onClick={ungroupSelection}
                disabled={!selection.length}
                className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] hover:bg-neutral-200 disabled:opacity-40"
                title="Rozpustit skupinu (Ctrl+Shift+G)"
              ><Ungroup size={10} className="inline" /> Rozpustit</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {items.length === 0 && (
              <div className="p-4 text-center text-[11px] text-neutral-500">Zatím žádné komponenty. Přidej z levého panelu nebo načti preset.</div>
            )}
            {(() => {
              // Photoshop-like Layers: group by groupId, ungrouped last.
              const groups = new Map<string, Placed[]>();
              const loose: Placed[] = [];
              for (const it of items) {
                if (it.groupId) {
                  if (!groups.has(it.groupId)) groups.set(it.groupId, []);
                  groups.get(it.groupId)!.push(it);
                } else {
                  loose.push(it);
                }
              }
              const renderItemCard = (it: Placed) => {
                const spec = SPECS[it.kind];
                const isSel = selection.includes(it.id);
                const isKorg = it.kind === "korg" || it.kind === "korg_red" || it.kind === "korg_blue";
                return (
                  <div
                    key={it.id}
                    className={`mb-1.5 rounded border p-2 text-[11px] transition ${isSel ? "border-lime-500 bg-neutral-100" : "border-neutral-200 bg-neutral-50 hover:border-neutral-300"}`}
                  >
                    <button
                      onClick={(e) => {
                        setMode("select");
                        if (e.shiftKey || e.ctrlKey || e.metaKey) {
                          setSelection((cur) => cur.includes(it.id) ? cur.filter((x) => x !== it.id) : [...cur, it.id]);
                        } else {
                          setSelection([it.id]);
                        }
                      }}
                      className="mb-1.5 flex w-full items-center gap-2 text-left"
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: spec.category === "sound" ? "#a3ff12" : spec.category === "lights" ? "#f4c11a" : "#05d9e8" }}
                      />
                      <span className="flex-1 truncate font-semibold text-neutral-900">
                        {it.label || spec.label}
                      </span>
                      <span className="font-mono text-[9px] text-neutral-500">
                        {it.pos[0].toFixed(1)},{it.pos[2].toFixed(1)}
                      </span>
                    </button>
                    <label className="mb-1 block">
                      <span className="mb-0.5 block text-[9px] uppercase tracking-wider text-neutral-500">Model / typ bedny</span>
                      <select
                        value={it.kind}
                        onChange={(e) => {
                          const newKind = e.target.value as Kind;
                          setItems((cur) => normalizeScene(cur.map((x) => x.id === it.id ? {
                            ...x, kind: newKind,
                            variant: SPECS[newKind].defaultVariant ?? x.variant,
                            rotY: 0,
                          } : x)));
                        }}
                        className="w-full rounded border border-neutral-300 bg-white px-1.5 py-1 text-[11px] text-neutral-900 focus:border-lime-500 focus:outline-none"
                      >
                        {CATEGORIES.map((cat) => (
                          <optgroup key={cat.id} label={cat.label}>
                            {(Object.entries(SPECS) as [Kind, Spec][])
                              .filter(([, s]) => s.category === cat.id)
                              .map(([k, s]) => (<option key={k} value={k}>{s.label}</option>))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <label className="mb-1 block">
                      <span className="mb-0.5 block text-[9px] uppercase tracking-wider text-neutral-500">Vlastní štítek</span>
                      <input
                        type="text" value={it.label ?? ""} placeholder={spec.defaultLabel ?? spec.label}
                        onChange={(e) => {
                          const v = e.target.value;
                          setItems((cur) => cur.map((x) => x.id === it.id ? { ...x, label: v || undefined } : x));
                        }}
                        className="w-full rounded border border-neutral-300 bg-white px-1.5 py-1 font-mono text-[11px] text-lime-600 focus:border-lime-500 focus:outline-none"
                      />
                    </label>
                    {isKorg && (
                      <div className="mb-1 flex items-center gap-1">
                        <span className="text-[9px] uppercase tracking-wider text-neutral-500">Barva:</span>
                        {(["red", "blue"] as const).map((v) => (
                          <button
                            key={v}
                            onClick={() => setItems((cur) => cur.map((x) => x.id === it.id ? { ...x, variant: v } : x))}
                            className={`h-5 w-5 rounded border-2 ${it.variant === v ? "border-lime-400" : "border-neutral-300"}`}
                            style={{ backgroundColor: v === "red" ? "#c81e2a" : "#1e5ec8" }}
                            title={v === "red" ? "Červený" : "Modrý"}
                          />
                        ))}
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-mono text-[9px] text-neutral-600">
                        {spec.size[0].toFixed(2)}×{spec.size[1].toFixed(2)}×{spec.size[2].toFixed(2)} m
                      </span>
                      <button
                        onClick={() => {
                          setItems((cur) => cur.filter((x) => x.id !== it.id));
                          setCables((cs) => cs.filter((c) => c.from !== it.id && c.to !== it.id));
                        }}
                        className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700 hover:bg-red-200"
                      ><Trash2 size={10} className="inline" /></button>
                    </div>
                  </div>
                );
              };
              return (
                <>
                  {Array.from(groups.entries()).map(([gid, gItems]) => {
                    const gName = groupNames[gid] ?? `Skupina ${gid.slice(0, 4)}`;
                    const gIds = gItems.map((x) => x.id);
                    const allSelected = gIds.every((id) => selection.includes(id));
                    return (
                      <div key={gid} className="mb-2 rounded-md border border-neutral-300 bg-white">
                        <div className="flex items-center gap-1 rounded-t-md bg-neutral-100 px-2 py-1">
                          <button
                            onClick={(e) => {
                              setMode("select");
                              if (e.shiftKey) setSelection((cur) => Array.from(new Set([...cur, ...gIds])));
                              else setSelection(allSelected ? [] : gIds);
                            }}
                            className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider ${allSelected ? "bg-lime-500 text-neutral-950" : "text-neutral-700 hover:bg-white"}`}
                            title="Vybrat celou skupinu (Shift = přidat)"
                          >
                            <GroupIcon size={10} /> {gItems.length}
                          </button>
                          <input
                            type="text"
                            value={groupNames[gid] ?? ""}
                            placeholder={`Skupina ${gid.slice(0, 4)}`}
                            onChange={(e) => renameGroup(gid, e.target.value)}
                            className="flex-1 rounded bg-transparent px-1 py-0.5 text-[11px] font-semibold text-neutral-900 focus:bg-white focus:outline focus:outline-1 focus:outline-lime-500"
                            title="Přejmenovat skupinu"
                          />
                          <button
                            onClick={() => {
                              setItems((cur) => cur.map((i) => gIds.includes(i.id) ? { ...i, groupId: undefined } : i));
                              renameGroup(gid, "");
                            }}
                            className="rounded p-0.5 text-neutral-500 hover:bg-white hover:text-red-600"
                            title="Rozpustit skupinu"
                          ><Ungroup size={11} /></button>
                        </div>
                        <div className="border-b border-neutral-200 bg-neutral-50 px-2 py-1.5">
                          <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                            <span>Odsazení beden ve skupině</span>
                            <span className="font-mono text-neutral-700">{(groupSpacing[gid] ?? 0.06).toFixed(2)} m</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1.2}
                            step={0.02}
                            value={groupSpacing[gid] ?? 0.06}
                            onChange={(e) => setGroupGap(gid, Number(e.target.value))}
                            className="w-full accent-lime-500"
                            title="Rozestup beden v rámci skupiny — po změně se automaticky odstraní překryvy"
                          />
                        </div>
                        <div className="p-1.5">{gItems.map(renderItemCard)}</div>
                      </div>
                    );
                  })}
                  {loose.length > 0 && groups.size > 0 && (
                    <div className="mt-2 mb-1 px-1 text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                      Nezařazené ({loose.length})
                    </div>
                  )}
                  {loose.map(renderItemCard)}
                </>
              );
            })()}
          </div>
        </aside>
      </div>
      <PlacementDevPanel />
    </div>
  );

}

export default StageBuilder3D;
