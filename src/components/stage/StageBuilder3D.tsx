import { useEffect, useMemo, useRef, useState, useCallback, Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  TransformControls,
  Grid,
  Html,
  ContactShadows,
  Environment,
  Line,
} from "@react-three/drei";
import * as THREE from "three";
import {
  Speaker, Trash2, Save, Copy, ClipboardPaste, Group as GroupIcon, Ungroup,
  Move as MoveIcon, RotateCw, Boxes, Zap, Sparkles, Radio, Volume2,
  Cable as CableIcon, MousePointer2,
} from "lucide-react";


/* ============================================================
   Types & Catalog
   ============================================================ */

type Kind =
  | "horn" | "mid" | "bass" | "sub" | "linearray" | "monitor"
  | "badtekk_sub" | "badtekk_bass" | "badtekk_top"
  | "amp" | "powersoft" | "mixer" | "dj" | "cdj"
  | "korg" | "korg_red" | "korg_blue" | "turntable"
  | "strobe" | "laser" | "movinghead"
  | "bar" | "generator" | "crowd";

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
  amp:          { label: "Amp rack",         category: "infra",  size: [0.60, 0.90, 0.60], stackable: true,  hint: "Rack zesilovačů" },
  powersoft:    { label: "Powersoft K20",    category: "infra",  size: [0.60, 0.90, 0.60], stackable: true,  hint: "Powersoft výkonový amp", defaultLabel: "Powersoft" },
  mixer:        { label: "Mixer",            category: "infra",  size: [0.80, 0.15, 0.55], stackable: false, hint: "Mixážní pult" },
  dj:           { label: "DJ booth",         category: "infra",  size: [1.60, 1.00, 0.70], stackable: false, hint: "DJ pult" },
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
  crowd:        { label: "Dancefloor",       category: "infra",  size: [4.00, 0.02, 4.00], stackable: false, hint: "Prostor pro dav" },
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

type PresetKind = "mayapur" | "badtekk" | "namel" | "toroid" | "dub" | "techno" | "club" | "freetekno";

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

    // Passive furniture — no connectors.
    case "bar":
    case "crowd":
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

// Sample a hanging catenary-ish curve between two 3D points.
function cablePoints(a: [number, number, number], b: [number, number, number], segs = 24): [number, number, number][] {
  const ax = a[0], ay = a[1], az = a[2];
  const bx = b[0], by = b[1], bz = b[2];
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  const sag = Math.min(0.9, dist * 0.18); // meters
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const yOff = -4 * sag * t * (1 - t);
    pts.push([ax + dx * t, ay + dy * t + yOff, az + dz * t]);
  }
  return pts;
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
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Front grille panel */}
      <mesh position={[0, h / 2, d / 2 + 0.001]}>
        <planeGeometry args={[w * 0.9, h * 0.9]} />
        <meshStandardMaterial color={grilleColor} roughness={0.98} metalness={0.05} />
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
  const [w, h] = size;
  const r = Math.min(w * 0.28, h * 0.42);
  return (
    <Cabinet
      size={size}
      color={WOOD_DARK}
      tealFrame={false}
      yellowCross={true}
      onPallet={true}
      frontDetail={
        <group>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * w * 0.22, 0, 0.01]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[r, r * 0.75, 0.1, 32]} />
                <meshStandardMaterial color="#050505" roughness={0.55} />
              </mesh>
              <mesh position={[0, 0, 0.06]}>
                <sphereGeometry args={[r * 0.35, 16, 12]} />
                <meshStandardMaterial color="#2a2a2a" roughness={0.5} metalness={0.4} />
              </mesh>
            </group>
          ))}
        </group>
      }
    />
  );
}


function LineArrayModel({ size }: { size: [number, number, number] }) {
  // 3 stacked elements
  const [w, h, d] = size;
  const eH = h / 3;
  return (
    <group>
      {[0, 1, 2].map((i) => {
        const off = i * eH;
        const shrink = 1 - i * 0.06;
        return (
          <mesh key={i} position={[0, off + eH / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w * shrink, eH * 0.9, d]} />
            <meshStandardMaterial color="#0d0d0d" roughness={0.6} metalness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}

function MonitorModel({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  // Wedge: tilted trapezoid
  return (
    <group rotation={[-0.35, 0, 0]} position={[0, h * 0.15, 0]}>
      <Cabinet size={[w, h, d]} color="#0e0e0e"
        frontDetail={
          <mesh position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[h * 0.3, h * 0.24, 0.05, 20]} />
            <meshStandardMaterial color="#050505" />
          </mesh>
        }
      />
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
      <mesh position={[0, h + 0.006, d * 0.35]}>
        <planeGeometry args={[w * 0.6, 0.04]} rotation-x={-Math.PI / 2} />
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
      <mesh position={[0, h / 2, d / 2 + 0.005]}>
        <cylinderGeometry args={[0.04, 0.04, 0.02, 16]} rotation-x={Math.PI / 2} />
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
      <mesh position={[0, h * 0.7, 0]} castShadow>
        <cylinderGeometry args={[w * 0.32, w * 0.32, h * 0.5, 20]} rotation-z={Math.PI / 2} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Lens */}
      <mesh position={[0, h * 0.7, d * 0.35]}>
        <cylinderGeometry args={[w * 0.25, w * 0.25, 0.02, 24]} rotation-x={Math.PI / 2} />
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

function ModelFor({ kind, size, variant }: { kind: Kind; size: [number, number, number]; variant?: "red" | "blue" }) {
  switch (kind) {
    case "horn": return <HornModel size={size} />;
    case "mid": return <MidModel size={size} />;
    case "bass": return <BassModel size={size} />;
    case "sub": return <SubModel size={size} />;
    case "badtekk_sub": return <SubModel size={size} />;
    case "badtekk_bass": return <BassModel size={size} />;
    case "badtekk_top": return <HornModel size={size} />;
    case "linearray": return <LineArrayModel size={size} />;
    case "monitor": return <MonitorModel size={size} />;
    case "amp": return <AmpRack size={size} />;
    case "powersoft": return <AmpRack size={size} brand="powersoft" />;
    case "mixer": return <MixerModel size={size} />;
    case "dj": return <DJBooth size={size} />;
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
    case "crowd": return <CrowdModel size={size} />;
  }
}


/* ============================================================
   Item mesh — receives selection + click
   ============================================================ */

const ItemObject = ({
  item, selected, pending, onSelect, onRegister,
}: {
  item: Placed;
  selected: boolean;
  pending?: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onRegister: (id: string, obj: THREE.Object3D | null) => void;
}) => {
  const spec = SPECS[item.kind];
  const ref = useRef<THREE.Group>(null!);

  useEffect(() => {
    onRegister(item.id, ref.current);
    return () => onRegister(item.id, null);
  }, [item.id, onRegister]);

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
      {/* Pallet under sound cabinets sitting on the ground */}
      {spec.category === "sound" && item.pos[1] < 0.05 && item.kind !== "linearray" && item.kind !== "monitor" && (
        <group position={[0, 0, 0]}>
          <Pallet w={spec.size[0] * 1.02} d={spec.size[2] * 1.02} />
        </group>
      )}
      <group position={[0, spec.category === "sound" && item.pos[1] < 0.05 && item.kind !== "linearray" && item.kind !== "monitor" ? 0.14 : 0, 0]}>
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
      {/* Custom label above the box */}
      {item.label && (
        <Html position={[0, spec.size[1] + 0.25, 0]} center distanceFactor={8} occlude={false}>
          <div className="pointer-events-none rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-lime-400 shadow-lg">
            {item.label}
          </div>
        </Html>
      )}
    </group>
  );
};


/* ============================================================
   Snap / stacking
   ============================================================ */

const GRID_STEP = 0.1;

function snapToGridXZ(v: [number, number, number]): [number, number, number] {
  return [
    Math.round(v[0] / GRID_STEP) * GRID_STEP,
    v[1],
    Math.round(v[2] / GRID_STEP) * GRID_STEP,
  ];
}

// Compute stacking Y for `moving` given other items. Simple axis-aligned XZ overlap check.
function stackY(moving: Placed, others: Placed[]): number {
  const s = SPECS[moving.kind].size;
  const halfW = s[0] / 2, halfD = s[2] / 2;
  let best = 0;
  for (const o of others) {
    if (o.id === moving.id) continue;
    const os = SPECS[o.kind].size;
    const oTop = o.pos[1] + os[1];
    const oHalfW = os[0] / 2, oHalfD = os[2] / 2;
    // Simple AABB (ignores rotation for snap) XZ overlap
    const overlapX = Math.min(moving.pos[0] + halfW, o.pos[0] + oHalfW) - Math.max(moving.pos[0] - halfW, o.pos[0] - oHalfW);
    const overlapZ = Math.min(moving.pos[2] + halfD, o.pos[2] + oHalfD) - Math.max(moving.pos[2] - halfD, o.pos[2] - oHalfD);
    if (overlapX > 0.05 && overlapZ > 0.05 && oTop > best - 0.02) {
      // Require center within cabinet top footprint
      if (Math.abs(moving.pos[0] - o.pos[0]) < oHalfW + halfW * 0.5 &&
          Math.abs(moving.pos[2] - o.pos[2]) < oHalfD + halfD * 0.5) {
        best = Math.max(best, oTop);
      }
    }
  }
  return best;
}

/* ============================================================
   Scene root with TransformControls
   ============================================================ */

function SceneContent({
  items, setItems, selection, setSelection, tool,
  cables, setCables, mode, cableType, pendingFrom, setPendingFrom,
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
  pendingFrom: string | null;
  setPendingFrom: React.Dispatch<React.SetStateAction<string | null>>;
}) {

  const objectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const orbitRef = useRef<any>(null);
  const transformRef = useRef<any>(null);

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

  const handleTransformEnd = useCallback(() => {
    setItems((cur) => {
      const map = new Map(cur.map((i) => [i.id, i]));
      for (const id of selection) {
        const it = map.get(id);
        if (!it) continue;
        const snapped: Placed = { ...it, pos: snapToGridXZ(it.pos) };
        const y = stackY(snapped, [...map.values()].filter((o) => o.id !== id));
        snapped.pos = [snapped.pos[0], y, snapped.pos[2]];
        // snap rotation to 15°
        snapped.rotY = Math.round(snapped.rotY / (Math.PI / 12)) * (Math.PI / 12);
        map.set(id, snapped);
      }
      return [...map.values()];
    });
  }, [selection, setItems]);

  // Disable orbit while gizmo dragging
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (orbitRef.current) orbitRef.current.enabled = !dragging;
  }, [dragging]);

  return (
    <>
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 20, 60]} />

      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#8899ff", "#221100", 0.35]} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={0.1}
        shadow-camera-far={50}
      />
      <pointLight position={[0, 4, 4]} intensity={20} color="#ff2a6d" distance={12} />
      <pointLight position={[-6, 4, -3]} intensity={15} color="#05d9e8" distance={12} />
      <pointLight position={[6, 4, -3]} intensity={15} color="#a3ff12" distance={12} />

      <Suspense fallback={null}>
        <Environment preset="warehouse" background={false} />
      </Suspense>

      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerDown={(e) => {
          if (e.button === 0) {
            if (mode === "cable") setPendingFrom(null);
            else setSelection([]);
          }
        }}
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.95} />
      </mesh>
      <Grid
        args={[60, 60]}
        cellColor="#222"
        sectionColor="#3a2416"
        sectionSize={1}
        cellSize={0.25}
        fadeDistance={40}
        fadeStrength={1}
        infiniteGrid
        position={[0, 0.001, 0]}
      />
      <ContactShadows position={[0, 0.002, 0]} opacity={0.5} scale={40} blur={2} far={10} />

      {items.map((it) => (
        <ItemObject
          key={it.id}
          item={it}
          selected={mode === "select" && selection.includes(it.id)}
          pending={mode === "cable" && pendingFrom === it.id}
          onSelect={(id, additive) => {
            if (mode === "cable") {
              if (!pendingFrom) {
                setPendingFrom(id);
              } else if (pendingFrom === id) {
                setPendingFrom(null);
              } else {
                const from = pendingFrom, to = id;
                setCables((cs) => [...cs, { id: uid(), from, to, type: cableType }]);
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
              return groupMembers;
            });
          }}
          onRegister={registerObject}
        />
      ))}

      {/* Cables */}
      {cables.map((c) => {
        const a = items.find((i) => i.id === c.from);
        const b = items.find((i) => i.id === c.to);
        if (!a || !b) return null;
        const meta = CABLE_META[c.type];
        const p1 = anchorFor(a, c.type);
        const p2 = anchorFor(b, c.type);
        const pts = cablePoints(p1, p2, 28);
        return (
          <group key={c.id}>
            <Line
              points={pts as unknown as [number, number, number][]}
              color={meta.color}
              lineWidth={meta.width}
              transparent
              opacity={0.95}
              onClick={(e) => {
                e.stopPropagation();
                if (mode === "cable") setCables((cs) => cs.filter((x) => x.id !== c.id));
              }}
            />
            {/* connector caps */}
            <mesh position={p1}>
              <sphereGeometry args={[0.05, 12, 8]} />
              <meshStandardMaterial color={meta.color} emissive={meta.color} emissiveIntensity={0.6} />
            </mesh>
            <mesh position={p2}>
              <sphereGeometry args={[0.05, 12, 8]} />
              <meshStandardMaterial color={meta.color} emissive={meta.color} emissiveIntensity={0.6} />
            </mesh>
          </group>
        );
      })}

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

      <OrbitControls
        ref={orbitRef}
        makeDefault
        target={[0, 1, 0]}
        maxPolarAngle={Math.PI / 2 - 0.02}
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
  const mk = (k: Kind, x: number, y: number, z: number, rot = 0): Placed => ({
    id: uid(), kind: k, pos: [x, y, z], rotY: rot,
  });

  if (kind === "freetekno") {
    // Wall inspired by the reference photo: pallets + row of subs at bottom,
    // mid bins in middle, big teal-front tops on the outside, horns/mids stacked.
    const sub = SPECS.sub.size, bass = SPECS.bass.size, mid = SPECS.mid.size, horn = SPECS.horn.size;
    const arr: Placed[] = [];
    // Bottom row: 5 subs side by side
    for (let i = -2; i <= 2; i++) {
      arr.push(mk("sub", i * (sub[0] + 0.02), 0, -1));
    }
    // Second row: 5 bass bins on top of subs
    for (let i = -2; i <= 2; i++) {
      arr.push(mk("bass", i * (sub[0] + 0.02), sub[1], -1));
    }
    // Third row: 5 mids on top of bass
    for (let i = -2; i <= 2; i++) {
      arr.push(mk("mid", i * (sub[0] + 0.02), sub[1] + bass[1], -1));
    }
    // Outer tall towers: double horn stack on far left & right
    for (const sx of [-3.2, 3.2]) {
      arr.push(mk("sub", sx, 0, -1));
      arr.push(mk("bass", sx, sub[1], -1));
      arr.push(mk("mid", sx, sub[1] + bass[1], -1));
      arr.push(mk("horn", sx, sub[1] + bass[1] + mid[1], -1));
      arr.push(mk("horn", sx, sub[1] + bass[1] + mid[1] + horn[1] + 0.02, -1));
    }
    // Amps on the side
    arr.push(mk("amp", -4.5, 0, 0.5));
    arr.push(mk("amp", 4.5, 0, 0.5));
    // DJ / mixer
    arr.push(mk("dj", 0, 0, 2.5));
    arr.push(mk("cdj", -0.6, 1.0, 2.4));
    arr.push(mk("cdj", 0.6, 1.0, 2.4));
    // Lighting truss (approximated with moving heads on the flanks)
    arr.push(mk("movinghead", -3.5, 3.2, -0.5));
    arr.push(mk("movinghead", 3.5, 3.2, -0.5));
    arr.push(mk("strobe", 0, 3.5, -1));
    // Generator + crowd
    arr.push(mk("generator", -6, 0, 3));
    arr.push(mk("crowd", 0, 0, 5));
    return arr;
  }


  if (kind === "mayapur") {
    const stack = (sx: number): Placed[] => {
      const s = SPECS.sub.size, b = SPECS.bass.size, m = SPECS.mid.size, h = SPECS.horn.size;
      return [
        mk("sub", sx, 0, -1),
        mk("sub", sx, 0, -1 - s[2] - 0.02),
        mk("bass", sx, s[1], -1),
        mk("mid", sx, s[1] + b[1], -1),
        mk("horn", sx, s[1] + b[1] + m[1], -1),
        mk("horn", sx, s[1] + b[1] + m[1] + h[1] + 0.02, -1),
      ];
    };
    return [
      ...stack(-2.5), ...stack(0), ...stack(2.5),
      mk("amp", -1.6, 0, 1.6),
      mk("amp", 1.6, 0, 1.6),
      mk("mixer", 0, 0, 2.4),
      mk("turntable", -0.6, 0.15, 2.9),
      mk("turntable", 0.6, 0.15, 2.9),
      mk("generator", 5, 0, 2.5),
      mk("crowd", 0, 0, 5),
    ];
  }

  if (kind === "badtekk") {
    const s = SPECS.badtekk_sub.size, b = SPECS.badtekk_bass.size;
    const arr: Placed[] = [];
    const Z = -1.6;

    // ---- LEFT tower ----
    for (const sx of [-3.8, -2.55]) {
      arr.push(mk("badtekk_sub", sx, 0, Z));
      arr.push(mk("badtekk_bass", sx, s[1], Z));
      const isOuter = sx < -3;
      const rot = isOuter ? 0.35 : 0.1;
      arr.push(mk("badtekk_top", sx, s[1] + b[1], Z, rot));
    }

    // ---- RIGHT tower (mirror) ----
    for (const sx of [2.55, 3.8]) {
      arr.push(mk("badtekk_sub", sx, 0, Z));
      arr.push(mk("badtekk_bass", sx, s[1], Z));
      const isOuter = sx > 3;
      const rot = isOuter ? -0.35 : -0.1;
      arr.push(mk("badtekk_top", sx, s[1] + b[1], Z, rot));
    }

    // ---- CENTER lower stack (DJ sits on top) ----
    for (const sx of [-0.65, 0.65]) {
      arr.push(mk("badtekk_sub", sx, 0, Z));
      arr.push(mk("badtekk_bass", sx, s[1], Z));
    }
    const djY = s[1] + b[1];
    arr.push({ ...mk("dj", 0, djY, Z + 0.15), label: "Badtekk DJ" });
    arr.push(mk("cdj", -0.55, djY + 1.0, Z + 0.05));
    arr.push(mk("cdj", 0.55, djY + 1.0, Z + 0.05));
    arr.push(mk("mixer", 0, djY + 1.0, Z + 0.25));

    // ---- Powersoft amp racks on the flanks ----
    arr.push(mk("powersoft", -5.2, 0, 0.4));
    arr.push(mk("powersoft", -4.6, 0, 0.4));
    arr.push(mk("powersoft",  4.6, 0, 0.4));
    arr.push(mk("powersoft",  5.2, 0, 0.4));


    // ---- Lighting truss (moving heads + strobes across the top) ----
    const trussY = s[1] + b[1] + SPECS.badtekk_top.size[1] + 1.3;
    for (const tx of [-4, -2, 0, 2, 4]) {
      arr.push(mk("movinghead", tx, trussY, Z + 0.2));
    }
    arr.push(mk("strobe", -3, trussY - 0.1, Z + 0.3));
    arr.push(mk("strobe",  3, trussY - 0.1, Z + 0.3));
    arr.push(mk("laser", 0, trussY - 0.1, Z + 0.3));

    // ---- Crowd (indoor hall, no generator visible) ----
    arr.push(mk("crowd", 0, 0, 4.5));
    return arr;
  }


  if (kind === "namel") {
    const stack = (sx: number, rot: number): Placed[] => {
      const s = SPECS.sub.size, b = SPECS.bass.size, m = SPECS.mid.size;
      return [
        mk("sub", sx, 0, -1, rot),
        mk("bass", sx, s[1], -1, rot),
        mk("mid", sx, s[1] + b[1], -1, rot),
        mk("horn", sx, s[1] + b[1] + m[1], -1, rot),
      ];
    };
    return [
      ...stack(-2, 0.25),
      ...stack(2, -0.25),
      mk("powersoft", -1.5, 0, 1.5),
      mk("powersoft", 1.5, 0, 1.5),
      mk("turntable", 0, 0.15, 2.2),
      mk("korg_red", -0.4, 0.1, 2.9),
      mk("korg_blue", 0.4, 0.1, 2.9),
      mk("generator", -5, 0, 2),
      mk("crowd", 0, 0, 5),
    ];
  }


  if (kind === "toroid") {
    const arr: Placed[] = [];
    const R = 3;
    const N = 5;
    for (let i = 0; i < N; i++) {
      const a = (i - (N - 1) / 2) * 0.35 - Math.PI / 2;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      arr.push(mk("sub", x, 0, z, -a - Math.PI / 2));
    }
    arr.push(mk("linearray", -2, 3, -R + 0.5));
    arr.push(mk("linearray", 2, 3, -R + 0.5));
    arr.push(mk("movinghead", -1.5, 3, -R + 0.2));
    arr.push(mk("movinghead", 1.5, 3, -R + 0.2));
    arr.push(mk("dj", 0, 0, 1));
    arr.push(mk("cdj", -0.6, 1.0, 0.9));
    arr.push(mk("cdj", 0.6, 1.0, 0.9));
    arr.push(mk("amp", -3, 0, 1.5));
    arr.push(mk("amp", 3, 0, 1.5));
    arr.push(mk("generator", -5, 0, 2));
    arr.push(mk("crowd", 0, 0, 4));
    return arr;
  }

  if (kind === "dub") {
    return [
      mk("sub", 0, 0, -1),
      mk("bass", 0, SPECS.sub.size[1], -1),
      mk("mid", 0, SPECS.sub.size[1] + SPECS.bass.size[1], -1),
      mk("horn", 0, SPECS.sub.size[1] + SPECS.bass.size[1] + SPECS.mid.size[1], -1),
      mk("amp", 1.5, 0, 1),
      mk("mixer", 0, 0, 2),
      mk("turntable", 0, 0.15, 2.7),
      mk("generator", -4, 0, 2),
      mk("crowd", 0, 0, 4),
    ];
  }

  if (kind === "techno") {
    return [
      mk("sub", -1.3, 0, -1.5),
      mk("sub", 0, 0, -1.5),
      mk("sub", 1.3, 0, -1.5),
      mk("bass", -0.6, SPECS.sub.size[1], -1.5),
      mk("bass", 0.6, SPECS.sub.size[1], -1.5),
      mk("linearray", -2.5, 2.5, -1.5),
      mk("linearray", 2.5, 2.5, -1.5),
      mk("dj", 0, 0, 1.5),
      mk("cdj", -0.6, 1, 1.4),
      mk("cdj", 0.6, 1, 1.4),
      mk("monitor", -1.2, 0, 1.2),
      mk("monitor", 1.2, 0, 1.2),
      mk("strobe", -3, 2, -1),
      mk("strobe", 3, 2, -1),
      mk("generator", -5, 0, 2),
      mk("crowd", 0, 0, 5),
    ];
  }

  // club
  return [
    mk("sub", -0.7, 0, -1),
    mk("sub", 0.7, 0, -1),
    mk("mid", -0.7, SPECS.sub.size[1], -1),
    mk("mid", 0.7, SPECS.sub.size[1], -1),
    mk("dj", 0, 0, 1),
    mk("cdj", -0.5, 1, 0.9),
    mk("cdj", 0.5, 1, 0.9),
    mk("mixer", 0, 1, 1.3),
    mk("bar", 3, 0, 2),
    mk("crowd", 0, 0, 3.5),
  ];
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
    <div className="pointer-events-none h-16 w-full overflow-hidden rounded bg-gradient-to-b from-neutral-950 to-neutral-900">
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
  const [tool, setTool] = useState<"translate" | "rotate">("translate");
  const [mode, setMode] = useState<"select" | "cable">("select");
  const [cableType, setCableType] = useState<CableType>("signal");
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("sound");
  const [clipboard, setClipboard] = useState<Placed[]>([]);


  // Load from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.items)) setItems(parsed.items);
        if (Array.isArray(parsed.cables)) setCables(parsed.cables);
      } else {
        setItems(loadPreset("techno"));
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify({ items, cables }));
  }, [items, cables]);


  const addItem = (kind: Kind) => {
    const spec = SPECS[kind];
    const it: Placed = {
      id: uid(), kind,
      pos: [0, 0, 2 + Math.random() * 0.4],
      rotY: 0,
      ...(spec.defaultLabel ? { label: spec.defaultLabel } : {}),
      ...(spec.defaultVariant ? { variant: spec.defaultVariant } : {}),
    };
    const y = stackY(it, items);
    it.pos = [it.pos[0], y, it.pos[2]];
    setItems((cur) => [...cur, it]);
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
    setItems((cur) => [...cur, ...created]);
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
    setItems((cur) => [...cur, ...created]);
    setSelection(created.map((c) => c.id));
  }, [items, selection]);

  const groupSelection = useCallback(() => {
    if (selection.length < 2) return;
    const gid = uid();
    setItems((cur) => cur.map((i) => selection.includes(i.id) ? { ...i, groupId: gid } : i));
  }, [selection]);

  const ungroupSelection = useCallback(() => {
    setItems((cur) => cur.map((i) => selection.includes(i.id) ? { ...i, groupId: undefined } : i));
  }, [selection]);

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
      else if (e.key.toLowerCase() === "r") { setMode("select"); setTool("rotate"); }
      else if (e.key.toLowerCase() === "c" && !meta) { setMode((m) => (m === "cable" ? "select" : "cable")); setSelection([]); setPendingFrom(null); }

    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelection, copySelection, pasteSelection, duplicateSelection, groupSelection, ungroupSelection]);

  const palette = useMemo(
    () => (Object.entries(SPECS) as [Kind, Spec][]).filter(([, s]) => s.category === category),
    [category]
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-neutral-950 text-neutral-100">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/95 px-3 py-2 text-sm">
        <div className="flex items-center gap-1 font-bold text-lime-400">
          <Boxes size={16} /> STAGE RIG 3D
        </div>
        <div className="mx-3 h-5 w-px bg-neutral-700" />
        <button onClick={() => setItems(loadPreset("mayapur"))} className="rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700"><Zap size={12} className="inline" /> Mayapur</button>
        <button onClick={() => setItems(loadPreset("badtekk"))} className="rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700"><Zap size={12} className="inline" /> Badtekk</button>
        <button onClick={() => setItems(loadPreset("namel"))} className="rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700"><Zap size={12} className="inline" /> Namel</button>
        <button onClick={() => setItems(loadPreset("toroid"))} className="rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700"><Zap size={12} className="inline" /> Toroid</button>
        <button onClick={() => setItems(loadPreset("dub"))} className="rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700">Dub wall</button>
        <button onClick={() => setItems(loadPreset("techno"))} className="rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700">Techno rig</button>
        <button onClick={() => setItems(loadPreset("club"))} className="rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700">Malý klub</button>
        <button onClick={() => setItems(loadPreset("freetekno"))} className="rounded bg-teal-700/70 px-2 py-1 hover:bg-teal-600"><Zap size={12} className="inline" /> Freetekno wall</button>
        <div className="mx-3 h-5 w-px bg-neutral-700" />
        <button onClick={() => { setMode("select"); setPendingFrom(null); }} className={`flex items-center gap-1 rounded px-2 py-1 ${mode === "select" ? "bg-lime-500 text-neutral-950" : "bg-neutral-800 hover:bg-neutral-700"}`}><MousePointer2 size={12} /> Výběr</button>
        <button onClick={() => setTool("translate")} disabled={mode !== "select"} className={`flex items-center gap-1 rounded px-2 py-1 ${tool === "translate" && mode === "select" ? "bg-lime-500 text-neutral-950" : "bg-neutral-800 hover:bg-neutral-700"} disabled:opacity-40`}><MoveIcon size={12} /> Posun (T)</button>
        <button onClick={() => setTool("rotate")} disabled={mode !== "select"} className={`flex items-center gap-1 rounded px-2 py-1 ${tool === "rotate" && mode === "select" ? "bg-lime-500 text-neutral-950" : "bg-neutral-800 hover:bg-neutral-700"} disabled:opacity-40`}><RotateCw size={12} /> Rotace (R)</button>
        <div className="mx-2 h-5 w-px bg-neutral-700" />
        <button onClick={() => { setMode("cable"); setSelection([]); }} className={`flex items-center gap-1 rounded px-2 py-1 ${mode === "cable" ? "bg-lime-500 text-neutral-950" : "bg-neutral-800 hover:bg-neutral-700"}`}><CableIcon size={12} /> Kabely</button>
        {mode === "cable" && (
          <div className="flex items-center gap-1 rounded bg-neutral-800 p-0.5">
            {(Object.keys(CABLE_META) as CableType[]).map((t) => (
              <button
                key={t}
                onClick={() => setCableType(t)}
                className={`rounded px-2 py-0.5 text-[11px] font-bold ${cableType === t ? "text-neutral-950" : "text-neutral-300 hover:text-white"}`}
                style={cableType === t ? { backgroundColor: CABLE_META[t].color } : { backgroundColor: "transparent" }}
                title={CABLE_META[t].label}
              >
                <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: CABLE_META[t].color }} />
                {CABLE_META[t].short}
              </button>
            ))}
          </div>
        )}

        <button onClick={duplicateSelection} disabled={!selection.length} className="flex items-center gap-1 rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700 disabled:opacity-40"><Copy size={12} /> Duplikovat</button>
        <button onClick={copySelection} disabled={!selection.length} className="rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700 disabled:opacity-40">Kopírovat</button>
        <button onClick={pasteSelection} disabled={!clipboard.length} className="flex items-center gap-1 rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700 disabled:opacity-40"><ClipboardPaste size={12} /> Vložit</button>
        <button onClick={groupSelection} disabled={selection.length < 2} className="flex items-center gap-1 rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700 disabled:opacity-40"><GroupIcon size={12} /> Group</button>
        <button onClick={ungroupSelection} disabled={!selection.length} className="flex items-center gap-1 rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700 disabled:opacity-40"><Ungroup size={12} /> Ungroup</button>
        <button onClick={deleteSelection} disabled={!selection.length} className="flex items-center gap-1 rounded bg-red-900/70 px-2 py-1 hover:bg-red-800 disabled:opacity-40"><Trash2 size={12} /> Smazat</button>
        <div className="ml-auto flex items-center gap-2 text-xs text-neutral-400">
          <span>{items.length} prvků · {cables.length} kabelů · {selection.length} vybráno</span>
          <button onClick={() => localStorage.setItem(STORAGE, JSON.stringify({ items, cables }))} className="flex items-center gap-1 rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700"><Save size={12} /> Uložit</button>
          <button onClick={() => { if (confirm("Vymazat vše?")) { setItems([]); setCables([]); setSelection([]); }}} className="rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700">Vyčistit</button>

        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Palette */}
        <aside className="flex w-56 flex-col border-r border-neutral-800 bg-neutral-900/80">
          <div className="flex border-b border-neutral-800">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`flex flex-1 items-center justify-center gap-1 py-2 text-xs ${category === c.id ? "bg-neutral-800 text-lime-400" : "text-neutral-400 hover:text-neutral-200"}`}
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
                onClick={() => addItem(k)}
                className="mb-2 block w-full overflow-hidden rounded border border-neutral-800 bg-neutral-900 text-left transition hover:border-lime-500/60 hover:bg-neutral-800"
              >
                <PaletteThumb kind={k} />
                <div className="px-2 py-1.5">
                  <div className="text-xs font-semibold text-neutral-100">{s.label}</div>
                  <div className="text-[10px] text-neutral-500">{s.hint}</div>
                  <div className="mt-0.5 font-mono text-[9px] text-neutral-600">
                    {s.size[0].toFixed(2)}×{s.size[1].toFixed(2)}×{s.size[2].toFixed(2)} m
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-neutral-800 p-2 text-[10px] text-neutral-500">
            <div><b>T/R</b> — posun/rotace · <b>C</b> — kabely</div>
            <div><b>Ctrl+C/V/D</b> — kopie / vložit / duplikovat</div>
            <div><b>Ctrl+G / Ctrl+Shift+G</b> — group / ungroup</div>
            <div><b>Shift+klik</b> — přidat do výběru · <b>Del</b> — smazat</div>
            <div className="mt-1 text-neutral-400">V režimu Kabely: klik na první bednu → klik na druhou. Klik na kabel = smazat.</div>
          </div>

        </aside>

        {/* 3D Canvas */}
        <div className="relative flex-1">
          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{ position: [6, 5, 8], fov: 45, near: 0.1, far: 200 }}
            gl={{ antialias: true }}
          >
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
              pendingFrom={pendingFrom}
              setPendingFrom={setPendingFrom}
            />
          </Canvas>
          <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-neutral-900/80 px-2 py-1 text-[10px] text-neutral-400">
            {mode === "cable"
              ? (pendingFrom ? "Kabely: klik na druhou bednu (Esc / klik do prázdna zruší)" : `Kabely (${CABLE_META[cableType].short}): klik na zdrojovou bednu`)
              : "Levé tl.: rotace · Pravé: pan · Kolečko: zoom · Klik na bednu: výběr"}
          </div>

        </div>
      </div>
    </div>
  );
}

export default StageBuilder3D;
