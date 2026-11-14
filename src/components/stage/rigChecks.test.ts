import { describe, it, expect } from "vitest";
import { checkRig, powerBudget, parallelOhm, type KindInfo } from "./rigChecks";

const base: KindInfo = { name: "", category: "sound", peakW: 0, needsPower: false, passiveSpeaker: false, ampChannels: 0, ohm: 8, capacityW: 0, isDistro: false };
const K: Record<string, KindInfo> = {
  box: { ...base, name: "Box", passiveSpeaker: true },
  amp: { ...base, name: "Amp", category: "infra", ampChannels: 2, needsPower: true, peakW: 5000 },
  gen: { ...base, name: "Gen", category: "infra", capacityW: 15000 },
  distro: { ...base, name: "Distro", category: "infra", isDistro: true },
  light: { ...base, name: "Strobe", category: "lights", needsPower: true, peakW: 1000 },
};
const info = (k: string) => K[k];

describe("rigChecks", () => {
  it("flags an unwired speaker box", () => {
    const r = checkRig([{ id: "b", kind: "box" }, { id: "g", kind: "gen" }], [], info);
    expect(r.some((i) => i.id === "unwired-spk-b")).toBe(true);
  });
  it("offers distro fix for unpowered light when a distro exists", () => {
    const r = checkRig([{ id: "l", kind: "light" }, { id: "d", kind: "distro" }, { id: "g", kind: "gen" }], [], info);
    expect(r.find((i) => i.itemId === "l")?.fix?.label).toBe("Zapojit do rozdělovače");
  });
  it("sums load vs generator capacity (11.2 of 15 kW)", () => {
    const items = [{ id: "g", kind: "gen" }, { id: "a", kind: "amp" }, { id: "a2", kind: "amp" }, { id: "l", kind: "light" }];
    const p = powerBudget(items, (k) => (k === "light" ? { ...K.light, peakW: 1200 } : K[k]));
    expect(p).toEqual({ loadW: 11200, capacityW: 15000 });
  });
  it("errors when load exceeds generator", () => {
    const items = [{ id: "g", kind: "gen" }, ...[1, 2, 3, 4].map((n) => ({ id: `a${n}`, kind: "amp" }))];
    expect(checkRig(items, [], info).some((i) => i.id === "power-over")).toBe(true);
  });
  it("warns under 4 Ω per channel (three 8 Ω boxes)", () => {
    expect(parallelOhm(8, 3)).toBeCloseTo(2.67, 2);
    const items = [{ id: "a", kind: "amp" }, { id: "g", kind: "gen" }, { id: "b1", kind: "box" }, { id: "b2", kind: "box" }, { id: "b3", kind: "box" }];
    const cables = [
      { id: "c1", from: "a", to: "b1", type: "speaker" as const },
      { id: "c2", from: "b1", to: "b2", type: "speaker" as const },
      { id: "c3", from: "b2", to: "b3", type: "speaker" as const },
    ];
    expect(checkRig(items, cables, info).find((i) => i.kind === "impedance")?.severity).toBe("warn");
  });
  it("does not warn at exactly 4 Ω (two 8 Ω boxes)", () => {
    const items = [{ id: "a", kind: "amp" }, { id: "g", kind: "gen" }, { id: "b1", kind: "box" }, { id: "b2", kind: "box" }];
    const cables = [{ id: "c1", from: "a", to: "b1", type: "speaker" as const }, { id: "c2", from: "b1", to: "b2", type: "speaker" as const }];
    expect(checkRig(items, cables, info).some((i) => i.kind === "impedance")).toBe(false);
  });
  it("errors above 4 boxes on one channel", () => {
    const boxes = [1, 2, 3, 4, 5].map((n) => ({ id: `b${n}`, kind: "box" }));
    const cables = boxes.map((b, i) => ({ id: `c${i}`, from: i ? boxes[i - 1].id : "a", to: b.id, type: "speaker" as const }));
    const r = checkRig([{ id: "a", kind: "amp" }, { id: "g", kind: "gen" }, ...boxes], cables, info);
    expect(r.some((i) => i.kind === "count")).toBe(true);
  });
});
