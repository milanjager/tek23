import { z } from "zod";

export const aiPlannerComponentSchema = z.object({
  kind: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  category: z.enum(["sound", "lights", "infra", "fun"]),
  size: z.tuple([
    z.number().positive().max(20),
    z.number().positive().max(20),
    z.number().positive().max(20),
  ]),
  quantity: z.number().int().min(1).max(99),
  powerW: z.number().min(0).max(100000).optional(),
});

export const aiPlannerInputSchema = z.object({
  room: z.object({
    width: z.number().min(3).max(200),
    depth: z.number().min(3).max(300),
    height: z.number().min(2.2).max(40),
    attendees: z.number().int().min(1).max(100000),
    venue: z.enum(["indoor", "outdoor"]),
  }),
  components: z.array(aiPlannerComponentSchema).min(1).max(60),
});

export const aiPlacementSchema = z.object({
  kind: z.string(),
  label: z.string().min(1).max(120),
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
  rotationDeg: z.number().min(-180).max(180),
});

export const aiPlanSchema = z.object({
  name: z.string().min(1).max(120),
  summary: z.string().min(1).max(1200),
  coverage: z.string().min(1).max(800),
  recommendations: z.array(z.string().min(1).max(500)).max(8),
  warnings: z.array(z.string().min(1).max(500)).max(8),
  placements: z.array(aiPlacementSchema).min(1).max(120),
});

export type AiPlannerComponent = z.infer<typeof aiPlannerComponentSchema>;
export type AiPlannerInput = z.infer<typeof aiPlannerInputSchema>;
export type AiPlacement = z.infer<typeof aiPlacementSchema>;
export type AiPlan = z.infer<typeof aiPlanSchema>;
export type AiCatalogEntry = Omit<AiPlannerComponent, "quantity">;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * AI je poradce, ne zdroj pravdy: výsledek projde stejnými limity jako formulář.
 * Odstraní neznámé typy, nepřekročí dostupné kusy a drží komponenty v prostoru.
 */
export function sanitizeAiPlan(plan: AiPlan, input: AiPlannerInput): AiPlan {
  const used = new Map<string, number>();
  const byKind = new Map(input.components.map((component) => [component.kind, component]));
  const placements: AiPlacement[] = [];

  for (const placement of plan.placements) {
    const component = byKind.get(placement.kind);
    if (!component) continue;
    const count = used.get(placement.kind) ?? 0;
    if (count >= component.quantity) continue;
    used.set(placement.kind, count + 1);

    const [width, height, depth] = component.size;
    const maxX = Math.max(0, input.room.width / 2 - width / 2);
    const maxZ = Math.max(0, input.room.depth / 2 - depth / 2);
    placements.push({
      ...placement,
      label: placement.label.trim() || component.label,
      x: round(clamp(placement.x, -maxX, maxX)),
      y: round(clamp(placement.y, 0, Math.max(0, input.room.height - height))),
      z: round(clamp(placement.z, -maxZ, maxZ)),
      rotationDeg: Math.abs(placement.rotationDeg) > 90 ? 180 : 0,
    });
  }

  return { ...plan, placements };
}
