import { Agent, agentAsTool, tool } from "@microsoft/agent-framework";
import { OpenAIChatClient } from "@microsoft/agent-framework/openai";
import * as dotenv from "dotenv";
import * as path from "path";
import {
  ActivityIntensity,
  ActivityModality,
  AgenticStep,
  ChatMessage,
  DraftEntry,
  GroqChatResponse,
  MealType,
  UserProfile,
} from "../types/apiTypes";

dotenv.config();
if (!process.env.GROQ_API_KEY) {
  dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

// Standard USDA Reference Densities (per 100g or typical unit)
const USDA_NUTRITION_REFERENCE: Record<
  string,
  {
    servingGrams: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodiumMg: number;
    defaultServing: string;
  }
> = {
  "chicken breast": {
    servingGrams: 100,
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiber: 0,
    sugar: 0,
    sodiumMg: 74,
    defaultServing: "100g cooked",
  },
  egg: {
    servingGrams: 50,
    calories: 72,
    protein: 6.3,
    carbs: 0.4,
    fat: 4.8,
    fiber: 0,
    sugar: 0.2,
    sodiumMg: 71,
    defaultServing: "1 large egg (50g)",
  },
  eggs: {
    servingGrams: 50,
    calories: 72,
    protein: 6.3,
    carbs: 0.4,
    fat: 4.8,
    fiber: 0,
    sugar: 0.2,
    sodiumMg: 71,
    defaultServing: "1 large egg (50g)",
  },
  "white rice": {
    servingGrams: 158,
    calories: 205,
    protein: 4.2,
    carbs: 44.5,
    fat: 0.4,
    fiber: 0.6,
    sugar: 0.1,
    sodiumMg: 1.6,
    defaultServing: "1 cup cooked (158g)",
  },
  rice: {
    servingGrams: 158,
    calories: 205,
    protein: 4.2,
    carbs: 44.5,
    fat: 0.4,
    fiber: 0.6,
    sugar: 0.1,
    sodiumMg: 1.6,
    defaultServing: "1 cup cooked (158g)",
  },
  "brown rice": {
    servingGrams: 195,
    calories: 216,
    protein: 5.0,
    carbs: 44.8,
    fat: 1.8,
    fiber: 3.5,
    sugar: 0.7,
    sodiumMg: 10,
    defaultServing: "1 cup cooked (195g)",
  },
  oats: {
    servingGrams: 40,
    calories: 150,
    protein: 5.0,
    carbs: 27.0,
    fat: 2.5,
    fiber: 4.0,
    sugar: 1.0,
    sodiumMg: 2,
    defaultServing: "1/2 cup dry (40g)",
  },
  oatmeal: {
    servingGrams: 234,
    calories: 158,
    protein: 6.0,
    carbs: 27.0,
    fat: 3.2,
    fiber: 4.0,
    sugar: 1.1,
    sodiumMg: 115,
    defaultServing: "1 cup cooked (234g)",
  },
  salmon: {
    servingGrams: 100,
    calories: 208,
    protein: 20.4,
    carbs: 0,
    fat: 13.4,
    fiber: 0,
    sugar: 0,
    sodiumMg: 59,
    defaultServing: "100g cooked fillet",
  },
  banana: {
    servingGrams: 118,
    calories: 105,
    protein: 1.3,
    carbs: 27.0,
    fat: 0.3,
    fiber: 3.1,
    sugar: 14.4,
    sodiumMg: 1.2,
    defaultServing: "1 medium (118g)",
  },
  apple: {
    servingGrams: 182,
    calories: 95,
    protein: 0.5,
    carbs: 25.0,
    fat: 0.3,
    fiber: 4.4,
    sugar: 19.0,
    sodiumMg: 1.8,
    defaultServing: "1 medium (182g)",
  },
  milk: {
    servingGrams: 244,
    calories: 149,
    protein: 7.7,
    carbs: 11.7,
    fat: 8.0,
    fiber: 0,
    sugar: 12.3,
    sodiumMg: 105,
    defaultServing: "1 cup whole milk (244g)",
  },
  pasta: {
    servingGrams: 140,
    calories: 220,
    protein: 8.1,
    carbs: 43.2,
    fat: 1.3,
    fiber: 2.5,
    sugar: 0.8,
    sodiumMg: 1,
    defaultServing: "1 cup cooked (140g)",
  },
  beef: {
    servingGrams: 100,
    calories: 250,
    protein: 26.0,
    carbs: 0,
    fat: 15.0,
    fiber: 0,
    sugar: 0,
    sodiumMg: 72,
    defaultServing: "100g lean beef",
  },
  "olive oil": {
    servingGrams: 14,
    calories: 119,
    protein: 0,
    carbs: 0,
    fat: 13.5,
    fiber: 0,
    sugar: 0,
    sodiumMg: 0.3,
    defaultServing: "1 tbsp (14g)",
  },
  "whey protein": {
    servingGrams: 30,
    calories: 120,
    protein: 24.0,
    carbs: 3.0,
    fat: 1.5,
    fiber: 0,
    sugar: 1.0,
    sodiumMg: 130,
    defaultServing: "1 scoop (30g)",
  },
  bread: {
    servingGrams: 36,
    calories: 90,
    protein: 3.0,
    carbs: 15.0,
    fat: 1.0,
    fiber: 1.5,
    sugar: 1.5,
    sodiumMg: 140,
    defaultServing: "1 slice (36g)",
  },
};

// 2024 Adult Compendium of Physical Activities MET Reference Table
const MET_REFERENCE_TABLE: Record<
  string,
  { baseMet: number; modality: ActivityModality; intensity: ActivityIntensity }
> = {
  walking: { baseMet: 3.5, modality: "walking", intensity: "moderate" },
  "brisk walking": { baseMet: 4.3, modality: "walking", intensity: "moderate" },
  running: { baseMet: 9.8, modality: "cardio", intensity: "vigorous" },
  jogging: { baseMet: 7.0, modality: "cardio", intensity: "moderate" },
  sprinting: { baseMet: 14.5, modality: "cardio", intensity: "near_max" },
  cycling: { baseMet: 7.5, modality: "cardio", intensity: "moderate" },
  swimming: { baseMet: 8.0, modality: "cardio", intensity: "vigorous" },
  weightlifting: {
    baseMet: 4.0,
    modality: "strength_training",
    intensity: "moderate",
  },
  "strength training": {
    baseMet: 4.5,
    modality: "strength_training",
    intensity: "moderate",
  },
  hiit: { baseMet: 10.0, modality: "hiit", intensity: "vigorous" },
  yoga: { baseMet: 2.5, modality: "sports", intensity: "low" },
  basketball: { baseMet: 6.5, modality: "sports", intensity: "vigorous" },
  soccer: { baseMet: 7.0, modality: "sports", intensity: "vigorous" },
  tennis: { baseMet: 7.3, modality: "sports", intensity: "vigorous" },
};

export type StepEmitter = (step: AgenticStep) => void;

/**
 * Custom OpenAIChatClient tailored for Groq endpoints:
 * Sanitizes open-source model reasoning items so stateless tool re-invocations
 * do not fail the OpenAI-specific encrypted reasoning validation, and strips
 * raw reasoning items from input payloads since Groq does not accept reasoning items on input.
 */
export class GroqChatClient extends OpenAIChatClient {
  override buildRequest(messages: any[], options?: any) {
    const sanitizedMessages = messages.map((m) => {
      if (!m.contents || !Array.isArray(m.contents)) return m;
      return {
        ...m,
        contents: m.contents.map((c: any) => {
          if (c.type === "text_reasoning") {
            return {
              ...c,
              protectedData: "groq-reasoning-passthrough",
            };
          }
          return c;
        }),
      };
    });

    const request = super.buildRequest(sanitizedMessages, options);
    if (Array.isArray(request.input)) {
      request.input = request.input.filter(
        (item: any) => item.type !== "reasoning",
      );
    }
    return request;
  }
}

/**
 * Creates tools and subagents configured with a step emitter for real-time SSE observability.
 */
export function createHealthAgentSystem(
  userProfile?: UserProfile,
  onStep?: StepEmitter,
) {
  const emit = (
    type: AgenticStep["type"],
    title: string,
    meta?: Partial<AgenticStep>,
  ) => {
    if (onStep) {
      onStep({
        id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type,
        title,
        timestamp: new Date().toISOString(),
        ...meta,
      });
    }
  };

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not configured");
  }

  // Create OpenAI-compatible client for Groq API with reasoning bypass
  const client = new GroqChatClient({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
    model: GROQ_MODEL,
    includeReasoningEncryptedContent: false,
  });

  // Tool 1: USDA Nutrition Lookup Tool
  const usdaNutritionTool = tool({
    name: "lookup_usda_nutrition",
    description:
      "Look up standard USDA FoodData Central nutritional densities for food items.",
    parameters: {
      type: "object",
      properties: {
        foodItem: { type: "string", description: "Name of the food item" },
        amount: {
          type: "number",
          description: "Estimated quantity or portion weight",
        },
        unit: {
          type: "string",
          description: "Measurement unit (e.g. grams, cups, slices, items)",
        },
      },
      required: ["foodItem"],
    },
    execute: async (args: any) => {
      const foodItem = String(args?.foodItem || "");
      const amount = Number(args?.amount || 1);
      const unit = String(args?.unit || "serving");
      emit("tool_call", `Consulting USDA FoodData Central for "${foodItem}"`, {
        toolName: "lookup_usda_nutrition",
        args: { foodItem, amount, unit },
      });

      const normalized = foodItem.toLowerCase().trim();
      let match = Object.entries(USDA_NUTRITION_REFERENCE).find(
        ([key]) => normalized.includes(key) || key.includes(normalized),
      );

      let result;
      if (match) {
        const [matchedKey, ref] = match;
        // Scale based on amount if specified in grams or count
        let scale = 1.0;
        if (unit === "g" || unit === "grams") {
          scale = amount / ref.servingGrams;
        } else if (amount > 1) {
          scale = amount;
        }
        result = {
          foodItem,
          matchedStandard: matchedKey,
          servingInfo: `${amount} ${unit} (~${Math.round(ref.servingGrams * scale)}g)`,
          calories: Math.round(ref.calories * scale),
          protein: Number((ref.protein * scale).toFixed(1)),
          carbs: Number((ref.carbs * scale).toFixed(1)),
          fat: Number((ref.fat * scale).toFixed(1)),
          fiber: Number((ref.fiber * scale).toFixed(1)),
          sugar: Number((ref.sugar * scale).toFixed(1)),
          sodiumMg: Math.round(ref.sodiumMg * scale),
          source: "USDA FoodData Central",
        };
      } else {
        // Generic nutritional density fallback
        const estScale = Math.max(1, amount);
        result = {
          foodItem,
          matchedStandard: "general adult portion average",
          servingInfo: `${amount} ${unit}`,
          calories: Math.round(180 * estScale),
          protein: Number((8.0 * estScale).toFixed(1)),
          carbs: Number((22.0 * estScale).toFixed(1)),
          fat: Number((6.0 * estScale).toFixed(1)),
          fiber: Number((2.0 * estScale).toFixed(1)),
          sugar: Number((3.0 * estScale).toFixed(1)),
          sodiumMg: Math.round(120 * estScale),
          source: "Scientific Adult Average Estimation",
        };
      }

      emit(
        "tool_result",
        `USDA nutritional profile resolved for "${foodItem}"`,
        {
          toolName: "lookup_usda_nutrition",
          result,
        },
      );

      return result;
    },
  });

  // Tool 2: 2024 Adult Compendium MET & Energy Expenditure Tool
  const metExpenditureTool = tool({
    name: "calculate_met_expenditure",
    description:
      "Calculate 2024 Adult Compendium MET values, active calories, and total energy expenditure.",
    parameters: {
      type: "object",
      properties: {
        activityName: {
          type: "string",
          description: "Name of the exercise or sport",
        },
        durationMinutes: { type: "number", description: "Duration in minutes" },
        intensity: {
          type: "string",
          enum: ["low", "moderate", "vigorous", "near_max"],
          description: "Reported or inferred intensity level",
        },
      },
      required: ["activityName", "durationMinutes"],
    },
    execute: async (args: any) => {
      const activityName = String(args?.activityName || "");
      const durationMinutes = Number(args?.durationMinutes || 30);
      const intensity = String(args?.intensity || "moderate");
      emit(
        "tool_call",
        `Calculating MET energy expenditure for "${activityName}"`,
        {
          toolName: "calculate_met_expenditure",
          args: { activityName, durationMinutes, intensity },
        },
      );

      const normalized = activityName.toLowerCase().trim();
      let match = Object.entries(MET_REFERENCE_TABLE).find(
        ([key]) => normalized.includes(key) || key.includes(normalized),
      );

      const userWeight = userProfile?.weightKg || 70;
      let metValue = 6.0;
      let modality: ActivityModality = "cardio";
      let resolvedIntensity: ActivityIntensity = intensity as ActivityIntensity;

      if (match) {
        metValue = match[1].baseMet;
        modality = match[1].modality;
        resolvedIntensity =
          (intensity as ActivityIntensity) || match[1].intensity;
      }

      // Adjust MET by intensity
      if (intensity === "vigorous") metValue *= 1.25;
      if (intensity === "near_max") metValue *= 1.5;
      if (intensity === "low") metValue *= 0.75;
      metValue = Number(metValue.toFixed(1));

      // Adult Compendium Formulas:
      // Total Burn = MET * weight_kg * (duration_min / 60)
      // Net Active Burn = (MET - 1) * weight_kg * (duration_min / 60)
      const durationHours = durationMinutes / 60;
      const totalCalories = Math.round(metValue * userWeight * durationHours);
      const activeCalories = Math.round(
        Math.max(0, (metValue - 1) * userWeight * durationHours),
      );

      const result = {
        activityName,
        modality,
        intensity: resolvedIntensity,
        durationMinutes,
        userWeightKg: userWeight,
        metValue,
        totalCalories,
        activeCalories,
        compendiumVersion: "2024 Adult Compendium of Physical Activities",
      };

      emit(
        "tool_result",
        `MET calculation complete: ${totalCalories} total kcal (${activeCalories} net active kcal)`,
        {
          toolName: "calculate_met_expenditure",
          result,
        },
      );

      return result;
    },
  });

  // Shared state for capturing results within this agent run
  const agentRunState: { recordedResult: GroqChatResponse | null } = {
    recordedResult: null,
  };

  const sanitizeDraftEntries = (entries: any[]): DraftEntry[] => {
    return entries.map((e: any) => {
      const isFood =
        e.type === "food" ||
        (!e.type &&
          !e.activityName &&
          !e.modality &&
          !e.durationMin &&
          !e.durationMinutes);
      const name = String(
        e.name ||
          e.food ||
          e.foodItem ||
          e.activityName ||
          e.activity ||
          (isFood ? "Food item" : "Exercise session"),
      );
      const calories = Math.max(
        0,
        Math.round(
          Number(
            e.calories ??
              e.calories_kcal ??
              e.totalCalories ??
              e.activeCalories,
          ) || 0,
        ),
      );
      const protein = isFood
        ? Math.max(0, Number(Number(e.protein ?? e.protein_g ?? 0).toFixed(1)))
        : 0;
      const carbs = isFood
        ? Math.max(0, Number(Number(e.carbs ?? e.carbs_g ?? 0).toFixed(1)))
        : 0;
      const fat = isFood
        ? Math.max(0, Number(Number(e.fat ?? e.fat_g ?? 0).toFixed(1)))
        : 0;
      const fiber = isFood
        ? Math.max(0, Number(Number(e.fiber ?? e.fiber_g ?? 0).toFixed(1)))
        : 0;
      const sugar = isFood
        ? Math.max(0, Number(Number(e.sugar ?? e.sugar_g ?? 0).toFixed(1)))
        : 0;
      const sodiumMg = isFood
        ? Math.max(0, Math.round(Number(e.sodiumMg ?? e.sodium_mg) || 0))
        : 0;

      const mealTypeRaw = e.mealType || e.meal;
      const mealType: MealType = isFood
        ? ["breakfast", "lunch", "dinner", "snack"].includes(mealTypeRaw)
          ? mealTypeRaw
          : "snack"
        : "workout";

      const durationMin = isFood
        ? 0
        : Math.max(
            1,
            Math.round(
              Number(e.durationMin ?? e.duration_min ?? e.durationMinutes) ||
                30,
            ),
          );
      const metValue = isFood
        ? 0
        : Math.max(0, Number(Number(e.metValue ?? e.met ?? 4.0).toFixed(1)));
      const activeCalories = isFood
        ? 0
        : Math.max(
            0,
            Math.round(
              Number(e.activeCalories ?? e.active_calories) ||
                Math.round(
                  Math.max(
                    0,
                    (metValue - 1) *
                      (userProfile?.weightKg || 70) *
                      (durationMin / 60),
                  ),
                ),
            ),
          );
      const modality: ActivityModality = isFood
        ? "none"
        : e.modality &&
            [
              "cardio",
              "strength_training",
              "hiit",
              "walking",
              "sports",
            ].includes(e.modality)
          ? e.modality
          : "cardio";
      const intensity: ActivityIntensity = isFood
        ? "none"
        : e.intensity &&
            ["low", "moderate", "vigorous", "near_max"].includes(e.intensity)
          ? e.intensity
          : "moderate";

      const servingInfo = String(
        e.servingInfo ||
          (e.quantity_g
            ? `${e.quantity_g}g`
            : isFood
              ? "1 serving"
              : `${durationMin} mins`),
      );
      const details = String(e.details || "");

      return {
        type: isFood ? "food" : "activity",
        name,
        calories,
        protein,
        carbs,
        fat,
        fiber,
        sugar,
        sodiumMg,
        mealType,
        durationMin,
        metValue,
        activeCalories,
        modality,
        intensity,
        servingInfo,
        details,
      };
    });
  };

  // Tool 3: Final Telemetry Recorder & Sanitizer
  const recordHealthLogTool = tool({
    name: "record_health_log",
    description:
      "Record the calculated telemetry draft entries, reply message, and clarification status into the system.",
    parameters: {
      type: "object",
      properties: {
        reply: {
          type: ["string", "null"],
          description: "Clear scientific explanation and summary for the user",
        },
        draft_entries: {
          type: "array",
          description: "List of drafted food or exercise entries",
          items: {
            type: "object",
          },
        },
        needs_clarification: {
          type: ["boolean", "null"],
          description:
            "Set to true if user input was ambiguous or missing required portion/duration",
        },
        clarification_prompt: {
          type: ["string", "null"],
          description: "Prompt asking the user for missing details, or null",
        },
      },
    },
    execute: async (args: any) => {
      emit("thought", "Recording and sanitizing telemetry entries...", {
        thought: `Processing ${args?.draft_entries?.length || 0} candidate entries with needs_clarification=${Boolean(args?.needs_clarification)}`,
      });

      const rawEntries = Array.isArray(args?.draft_entries)
        ? args.draft_entries
        : [];
      const sanitized = sanitizeDraftEntries(rawEntries);

      agentRunState.recordedResult = {
        reply: String(args?.reply || ""),
        needs_clarification: Boolean(args?.needs_clarification),
        clarification_prompt: args?.clarification_prompt
          ? String(args.clarification_prompt)
          : null,
        draft_entries: sanitized,
      };

      emit("tool_result", `Telemetry recorded (${sanitized.length} entries)`, {
        toolName: "record_health_log",
        result: {
          status: "recorded_successfully",
          count: sanitized.length,
          clarification: Boolean(args?.needs_clarification),
        },
      });

      return {
        status: "recorded_successfully",
        count: sanitized.length,
        message:
          "Telemetry has been successfully recorded. Now provide a short, encouraging scientific summary to the user and conclude your turn.",
      };
    },
  });

  // Subagent 1: Nutrition Specialist
  const nutritionSpecialist = new Agent({
    client,
    name: "NutritionSpecialist",
    description:
      "Expert nutritionist subagent that decomposes foods into USDA FoodData Central components and calculates exact macros.",
    instructions: `You are the Nutrition Specialist subagent for Health Agent.
Your duty:
1. Deconstruct user food logs into specific food components.
2. Call "lookup_usda_nutrition" to obtain USDA nutritional densities for each food item.
3. Compute exact portion-scaled calories, protein (g), carbs (g), fat (g), fiber (g), sugar (g), and sodium (mg).
4. Return a structured breakdown for each food item.`,
    tools: [usdaNutritionTool],
  });

  // Subagent 2: Physical Activity Specialist
  const activitySpecialist = new Agent({
    client,
    name: "ActivitySpecialist",
    description:
      "Biomechanical exercise specialist subagent that applies 2024 Adult Compendium MET values and calculates active burn.",
    instructions: `You are the Physical Activity Specialist subagent for Health Agent.
User weight context: ${userProfile?.weightKg || 70} kg.
Your duty:
1. Identify workout modality, intensity, and duration.
2. Call "calculate_met_expenditure" to apply the 2024 Adult Compendium of Physical Activities MET formula.
3. Calculate Total Calories and Net Active Calories burned above resting metabolic rate.
4. Return the biomechanical summary and metrics.`,
    tools: [metExpenditureTool],
  });

  // Expose Subagents as Tools using agentAsTool
  const consultNutritionTool = agentAsTool(nutritionSpecialist, {
    name: "consult_nutrition_specialist",
    description:
      "Consult the Nutrition Specialist to decompose and analyze foods using USDA densities.",
  });

  const consultActivityTool = agentAsTool(activitySpecialist, {
    name: "consult_activity_specialist",
    description:
      "Consult the Physical Activity Specialist to calculate MET and energy expenditure.",
  });

  // Primary Health Agent Orchestrator
  let userContext = "";
  if (userProfile) {
    userContext = `\nUSER PROFILE CONTEXT:
- Weight: ${userProfile.weightKg} kg
- Height: ${userProfile.heightCm} cm
- Age: ${userProfile.age}
- Sex: ${userProfile.sex}
- Activity Level: ${userProfile.activityLevel}
- Health Goal: ${userProfile.goal}`;
  }

  const primaryInstructions = `You are the Health Agent: an elite, scientifically rigorous health, nutrition, and physical activity tracking agent.

SCIENTIFIC CORE RULES:
1. Nutrition data:
   - Must accurately reflect standard USDA FoodData Central nutritional densities.
   - Use consult_nutrition_specialist or lookup_usda_nutrition to calculate: calories, protein (g), carbs (g), fat (g), fiber (g), sugar (g), and sodium (mg).
   - If portions are specified, scale nutrients accordingly.
2. Physical activity & energy expenditure:
   - Use consult_activity_specialist or calculate_met_expenditure to apply 2024 Adult Compendium of Physical Activities MET values.
   - Total Calories Burned = MET * weight_kg * (duration_minutes / 60).
   - Net Active Calories = (MET - 1) * weight_kg * (duration_minutes / 60).
   - Use user's profile weight (${userProfile?.weightKg || 70}kg).
3. Ambiguity & Clarification Protocol:
   - When user input lacks necessary details, determine if the missing detail is ESTIMABLE or IMPORTANT/CRITICAL:
     * ESTIMABLE / NON-CRITICAL (e.g. food portion size when the food item is known, like chicken breast, rice, oatmeal, or typical walking pace):
       - Call record_health_log with needs_clarification: true, draft_entries: [], and clarification_prompt summarizing the missing detail.
       - In your reply message, ask 1 concise clarifying question about the missing detail, AND explicitly inform the user: "If you're not sure, you can simply reply with 'estimate' and I will calculate based on standard average adult portions."
     * IMPORTANT / CRITICAL (e.g. completely unknown food name, workout with no duration specified where guessing could be wildly inaccurate, or medical/safety ambiguity):
       - Call record_health_log with needs_clarification: true, draft_entries: [], and clarification_prompt summarizing the missing detail.
       - In your reply message, ask directly for the specific required information.
       - DO NOT offer an estimation option in the output when the missing detail is critical.
   - When user input is clear OR if the user replies "estimate":
     - Set needs_clarification: false, clarification_prompt: null.
     - Calculate telemetry using USDA FoodData Central densities or 2024 Adult Compendium MET values (applying standard adult portions/averages if "estimate" was requested).
     - Call record_health_log with the calculated draft_entries and an encouraging scientific summary reply.
4. MULTI-TURN CONVERSATION AWARENESS:
   - Carefully interpret conversational context from prior turns.
   - If the user modifies, corrects, or appends items (e.g. "actually make that 3 eggs", "add 1 banana", "change to 45 mins"):
     * Reconcile changes against previous items.
     * Always pass the COMPLETE, updated set of draft entries to record_health_log.
5. EXECUTION SEQUENCE:
   - First, consult specialist subagents or call lookup tools to calculate the numbers.
   - Next, call "record_health_log" with draft_entries and your reply.
   - After record_health_log returns, write a concise, encouraging scientific summary to the user as normal text and conclude.
${userContext}`;

  const healthAgent = new Agent({
    client,
    name: "HealthAgent",
    instructions: primaryInstructions,
    tools: [
      consultNutritionTool,
      consultActivityTool,
      usdaNutritionTool,
      metExpenditureTool,
      recordHealthLogTool,
    ],
  });

  return {
    healthAgent,
    client,
    emit,
    agentRunState,
    sanitizeDraftEntries,
    tools: {
      usdaNutritionTool,
      metExpenditureTool,
      recordHealthLogTool,
      consultNutritionTool,
      consultActivityTool,
    },
  };
}

/**
 * Runs the Health Agent with SSE streaming, emitting real-time agentic steps and final response.
 */
export async function runHealthAgentStream(
  messages: ChatMessage[],
  userProfile?: UserProfile,
  onStep?: StepEmitter,
  onDelta?: (delta: string) => void,
): Promise<GroqChatResponse> {
  const { healthAgent, emit, agentRunState, sanitizeDraftEntries } =
    createHealthAgentSystem(userProfile, onStep);

  // Extract latest user query and previous messages
  const userMessages = messages.filter((m) => m.role === "user");
  const latestMessage =
    userMessages[userMessages.length - 1]?.content || "Hello";

  // Construct structured conversation summary context for multi-turn runs
  let fullPrompt = latestMessage;
  if (messages.length > 1) {
    const historyText = messages
      .slice(-10)
      .map((m) => {
        const roleLabel = m.role === "user" ? "USER" : "HEALTH AGENT";
        return `${roleLabel}: ${m.content}`;
      })
      .join("\n");

    fullPrompt = `PRIOR CONVERSATION HISTORY (chronological):
${historyText}

LATEST USER REQUEST:
"${latestMessage}"

CONTEXT INSTRUCTIONS:
- Resolve any relative references, pronouns, modifications, or additions in the latest request using the conversation history above.
- If the user is correcting or updating a previous item (e.g. "make that 3 eggs", "change to 45 min"), regenerate the complete telemetry with the updated values.
- Call record_health_log with all updated entries.`;
  }

  emit(
    "thought",
    `Deconstructing request: "${latestMessage.slice(0, 60)}${latestMessage.length > 60 ? "..." : ""}"`,
    {
      thought:
        "Classifying domain (food intake vs physical activity) and checking completeness of portions/duration.",
    },
  );

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const runStream = healthAgent.run(fullPrompt);

      let hasEmittedReasoningThought = false;
      let reasoningBuffer = "";

      // Consume stream updates to capture thoughts and step progress without single-token duds
      for await (const update of runStream) {
        let deltaEmitted = false;
        if (update.contents && Array.isArray(update.contents)) {
          for (const content of update.contents) {
            if (content.type === "text_reasoning" && (content as any).text) {
              reasoningBuffer += (content as any).text;
              if (
                !hasEmittedReasoningThought &&
                reasoningBuffer.trim().length > 15
              ) {
                emit(
                  "thought",
                  "Deliberating health telemetry & domain context",
                  {
                    thought:
                      "Evaluating input against USDA densities and Adult Compendium MET standards.",
                  },
                );
                hasEmittedReasoningThought = true;
              }
            } else if (content.type === "text" && (content as any).text) {
              onDelta?.((content as any).text);
              deltaEmitted = true;
            } else if (content.type === "function_call") {
              const fc = content as any;
              if (fc.name === "consult_nutrition_specialist") {
                emit("tool_call", "Consulting Nutrition Specialist subagent", {
                  toolName: fc.name,
                });
              } else if (fc.name === "consult_activity_specialist") {
                emit(
                  "tool_call",
                  "Consulting Physical Activity Specialist subagent",
                  { toolName: fc.name },
                );
              }
            }
          }
        }
        if (!deltaEmitted && (update as any).text && typeof (update as any).text === "string") {
          onDelta?.((update as any).text);
        }
      }

      const finalResponse = await runStream.finalResponse();
      const responseText = (finalResponse.text || "").trim();

      let result: GroqChatResponse;
      if (agentRunState.recordedResult) {
        result = agentRunState.recordedResult;
        if (
          responseText &&
          responseText.length > 15 &&
          (!result.reply || responseText.length > result.reply.length)
        ) {
          result.reply = responseText;
        }
      } else {
        // Fallback: Check if responseText contains JSON
        let parsed: any = null;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (_) {}
        }

        if (parsed) {
          result = {
            reply: parsed.reply || responseText,
            needs_clarification: Boolean(parsed.needs_clarification),
            clarification_prompt: parsed.clarification_prompt || null,
            draft_entries: sanitizeDraftEntries(
              Array.isArray(parsed.draft_entries) ? parsed.draft_entries : [],
            ),
          };
        } else {
          result = {
            reply: responseText || "Telemetry analyzed successfully.",
            needs_clarification: false,
            clarification_prompt: null,
            draft_entries: [],
          };
        }
      }

      if (result.draft_entries && result.draft_entries.length > 0) {
        emit("thought", "Health Agent completed deliberation.", {
          thought: `Generated ${result.draft_entries.length} telemetry item${result.draft_entries.length > 1 ? "s" : ""}.`,
        });
      }

      return result;
    } catch (err: any) {
      const isRateLimit =
        err?.status === 429 ||
        err?.statusCode === 429 ||
        err?.message?.includes("429") ||
        err?.message?.toLowerCase().includes("rate limit");

      if (isRateLimit && attempt < maxRetries) {
        const waitMs = (attempt + 1) * 2000;
        emit("thought", "Deliberation rate limit backoff", {
          thought: `Temporarily rate limited. Resuming in ${(waitMs / 1000).toFixed(1)}s...`,
        });
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      emit("thought", `Agentic execution note: ${err.message}`, {
        thought: "Applying fallback telemetry parsing.",
      });
      throw err;
    }
  }

  throw new Error("Health Agent run failed after retries.");
}
