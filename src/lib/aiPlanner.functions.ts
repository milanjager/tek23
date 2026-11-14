import { createServerFn } from "@tanstack/react-start";
import { GatewayError, generateResponse } from "@lovable.dev/ai-gateway";
import {
  aiPlanSchema,
  aiPlannerInputSchema,
  sanitizeAiPlan,
  type AiPlan,
} from "./aiPlanner";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "summary", "coverage", "recommendations", "warnings", "placements"],
  properties: {
    name: { type: "string" },
    summary: { type: "string" },
    coverage: { type: "string" },
    recommendations: { type: "array", items: { type: "string" }, maxItems: 8 },
    warnings: { type: "array", items: { type: "string" }, maxItems: 8 },
    placements: {
      type: "array",
      minItems: 1,
      maxItems: 120,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "label", "x", "y", "z", "rotationDeg"],
        properties: {
          kind: { type: "string" },
          label: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          z: { type: "number" },
          rotationDeg: { type: "number", minimum: -180, maximum: 180 },
        },
      },
    },
  },
} as const;

function outputText(output: Awaited<ReturnType<typeof generateResponse>>["output"]): string {
  const parts: string[] = [];
  for (const item of output) {
    if (item.type !== "message") continue;
    for (const content of item.content) {
      if (content.type === "output_text") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function gatewayMessage(error: GatewayError): string {
  if (error.code === "rate_limited") return "AI je teď vytížená. Počkej chvíli a zkus návrh znovu.";
  if (error.code === "payment_required") return "AI návrh je teď pozastavený, protože chybí dostupné kredity.";
  if (error.code === "permission_denied") return "AI návrh není pro tento projekt momentálně povolený.";
  return "Návrh se nepodařilo vytvořit. Zkus to prosím znovu.";
}

export type AiPlannerResult =
  | { ok: true; plan: AiPlan }
  | { ok: false; error: string };

export const generateAiLayout = createServerFn({ method: "POST" })
  .inputValidator(aiPlannerInputSchema)
  .handler(async ({ data }): Promise<AiPlannerResult> => {
    const instructions = `Jsi zkušený zvukař a světelný technik pro tekno soundsystémy. Navrhni praktické, bezpečné a přehledné rozmístění pouze z dodaných dostupných komponent. Odpovídej česky. Souřadnice jsou v metrech: x je šířka (střed prostoru 0), z je hloubka (stage vzadu při záporném z, publikum směrem kladnému z), y je spodní hrana komponenty nad podlahou. Hlavní PA postav symetricky v jedné přední linii; subwoofery soustřeď pro co nejmenší výpadky, středy a výšky dej nad ně nebo těsně vedle. Nevytvářej zpožďovací řady, pokud k nim chybí vhodná technika. Světla rozlož symetricky a bezpečně; nevěš nic nad limit výšky prostoru. Zesilovače a rozvaděč drž v servisní zóně u PA. Agregát do vnitřního prostoru neumisťuj. Nenechávej komponenty v únikových cestách ani uprostřed taneční plochy. Nepoužívej více kusů, než je dostupné. rotationDeg je 0 pro směr k publiku a 180 pro odposlechy k stage. Do warnings napiš skutečná rizika nebo nedostatky, ne obecné fráze. V recommendations uveď konkrétní další nastavení a ověření na místě. Vrať pouze JSON podle schématu.`;

    const input = `Navrhni rozmístění pro tento prostor a techniku. Rozměry jsou v metrech, powerW je orientační příkon. Vrať JSON podle schématu.\n${JSON.stringify(data)}`;

    try {
      const response = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions,
        input,
        max_output_tokens: 8000,
        reasoning: { effort: "low" },
        text: {
          format: {
            type: "json_schema",
            name: "stage_layout",
            strict: true,
            schema: responseSchema,
          },
        },
      });

      const text = outputText(response.output);
      if (!text) return { ok: false, error: "AI nevrátila použitelný návrh. Zkus to znovu." };
      const parsed = aiPlanSchema.safeParse(JSON.parse(text));
      if (!parsed.success) return { ok: false, error: "AI vrátila neúplný návrh. Zkus to znovu." };
      const plan = sanitizeAiPlan(parsed.data, data);
      if (!plan.placements.length) {
        return { ok: false, error: "AI nepoužila žádnou dostupnou komponentu. Uprav výběr a zkus to znovu." };
      }
      return { ok: true, plan };
    } catch (error) {
      if (error instanceof GatewayError) {
        console.error("AI layout gateway failure", { code: error.code, ids: error.ids });
        return { ok: false, error: gatewayMessage(error) };
      }
      console.error("AI layout response failure", error);
      return { ok: false, error: "Návrh se nepodařilo zpracovat. Zkus to prosím znovu." };
    }
  });
