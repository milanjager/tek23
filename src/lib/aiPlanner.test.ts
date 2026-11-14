import { describe, expect, it } from "vitest";
import { sanitizeAiPlan, type AiPlan, type AiPlannerInput } from "./aiPlanner";

const input: AiPlannerInput = {
  room: { width: 10, depth: 20, height: 5, attendees: 100, venue: "indoor" },
  components: [
    { kind: "sub", label: "Sub", category: "sound", size: [1, 1, 1], quantity: 2 },
    { kind: "movinghead", label: "Hlava", category: "lights", size: [0.5, 0.5, 0.5], quantity: 1 },
  ],
};

const plan: AiPlan = {
  name: "Test",
  summary: "Test",
  coverage: "Test",
  recommendations: [],
  warnings: [],
  placements: [
    { kind: "sub", label: "Sub L", x: -20, y: -2, z: -30, rotationDeg: 0 },
    { kind: "sub", label: "Sub R", x: 20, y: 2, z: 30, rotationDeg: 0 },
    { kind: "sub", label: "Navíc", x: 0, y: 0, z: 0, rotationDeg: 0 },
    { kind: "neexistuje", label: "Neznámá", x: 0, y: 0, z: 0, rotationDeg: 0 },
    { kind: "movinghead", label: "Hlava", x: 0, y: 20, z: 0, rotationDeg: 135 },
  ],
};

describe("sanitizeAiPlan", () => {
  it("nepoužije více kusů ani neznámé komponenty", () => {
    const result = sanitizeAiPlan(plan, input);
    expect(result.placements.filter((item) => item.kind === "sub")).toHaveLength(2);
    expect(result.placements.some((item) => item.kind === "neexistuje")).toBe(false);
  });

  it("drží komponenty uvnitř zadaného prostoru", () => {
    const result = sanitizeAiPlan(plan, input);
    expect(result.placements[0]).toMatchObject({ x: -4.5, y: 0, z: -9.5 });
    expect(result.placements[1]).toMatchObject({ x: 4.5, y: 2, z: 9.5 });
    expect(result.placements[2].y).toBe(4.5);
  });

  it("převede natočení na orientace podporované editorem", () => {
    const result = sanitizeAiPlan(plan, input);
    expect(result.placements[2].rotationDeg).toBe(180);
  });
});
