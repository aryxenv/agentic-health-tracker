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
  HealthLogRecord,
  MealType,
  UserProfile,
} from "../types/apiTypes";
import { cosmosService } from "./cosmosService";
import {
  calculateMacroTargets,
  aggregateLogs,
  getDateRangeForFilter,
} from "./calculations";

dotenv.config();
if (!process.env.GROQ_API_KEY || !process.env.TAVILY_API_KEY) {
  dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";


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

  // Helper: Open Food Facts query implementation
  const executeOpenFoodFacts = async (
    productName: string,
    amount = 100,
    unit = "g",
  ) => {
    emit("tool_call", `Consulting Open Food Facts for "${productName}"`, {
      toolName: "search_open_food_facts",
      args: { productName, amount, unit },
    });

    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(productName)}&search_simple=1&action=process&json=1&page_size=2`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "HealthTrackerApp/1.0 (contact@healthtracker.app)",
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(`Open Food Facts returned HTTP ${response.status}`);
      }

      const data: any = await response.json();
      const product = data?.products?.[0];

      if (!product) {
        const notFound = {
          found: false,
          message: `Product "${productName}" not found in Open Food Facts. Use search_web to look up live facts.`,
        };
        emit("tool_result", `No match in Open Food Facts for "${productName}"`, {
          toolName: "search_open_food_facts",
          result: notFound,
        });
        return notFound;
      }

      const n = product.nutriments || {};
      const kcal100 =
        Number(
          n["energy-kcal_100g"] ??
            n["energy-kcal"] ??
            (n["energy_100g"] ? n["energy_100g"] / 4.184 : 0),
        ) || 0;
      const protein100 = Number(n.proteins_100g ?? n.proteins ?? 0);
      const carbs100 = Number(n.carbohydrates_100g ?? n.carbohydrates ?? 0);
      const fat100 = Number(n.fat_100g ?? n.fat ?? 0);
      const fiber100 = Number(n.fiber_100g ?? n.fiber ?? 0);
      const sugar100 = Number(n.sugars_100g ?? n.sugars ?? 0);
      const saltNum = Number(n.salt_100g || 0);
      const sodiumMg100 = Math.round(
        Number(n.sodium_100g !== undefined ? n.sodium_100g : saltNum / 2.5) *
          1000,
      );

      let scale = 1.0;
      const servingG = Number(product.serving_quantity) || 100;
      if (unit === "g" || unit === "grams" || unit === "ml") {
        scale = amount / 100;
      } else if (
        unit === "serving" ||
        unit === "bottle" ||
        unit === "can" ||
        unit === "pot" ||
        unit === "portion"
      ) {
        scale = (amount * servingG) / 100;
      } else if (amount > 1 && amount <= 10) {
        scale = (amount * servingG) / 100;
      }

      const result = {
        found: true,
        productName:
          product.product_name ||
          product.product_name_en ||
          product.product_name_nl ||
          product.product_name_fr ||
          productName,
        brand: product.brands || "Brand",
        servingInfo: `${amount} ${unit} (~${Math.round(servingG * (scale / (amount || 1)) * (amount || 1))}g/ml)`,
        calories: Math.round(kcal100 * scale),
        protein: Number((protein100 * scale).toFixed(1)),
        carbs: Number((carbs100 * scale).toFixed(1)),
        fat: Number((fat100 * scale).toFixed(1)),
        fiber: Number((fiber100 * scale).toFixed(1)),
        sugar: Number((sugar100 * scale).toFixed(1)),
        sodiumMg: Math.round(sodiumMg100 * scale),
        source: "Open Food Facts (Belgium / Europe)",
      };

      emit(
        "tool_result",
        `Nutritional facts retrieved from Open Food Facts for "${productName}"`,
        {
          toolName: "search_open_food_facts",
          result,
        },
      );

      return result;
    } catch (err: any) {
      const errorResult = {
        found: false,
        error: err.message,
        message: `Open Food Facts lookup failed: ${err.message}. Please use search_web to look up "${productName}".`,
      };
      emit("tool_result", `Open Food Facts bypassed (${err.message})`, {
        toolName: "search_open_food_facts",
        result: errorResult,
      });
      return errorResult;
    }
  };

  // Helper: Tavily search query implementation
  const executeTavilySearch = async (query: string) => {
    emit("tool_call", `Searching live web for "${query}"`, {
      toolName: "search_web",
      args: { query },
    });

    const tavilyKey =
      process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY;

    if (!tavilyKey) {
      const errorResult = {
        query,
        found: false,
        error: "TAVILY_API_KEY is not configured.",
        message:
          "Web search is currently unavailable because TAVILY_API_KEY is missing in environment variables.",
      };
      emit("tool_result", `Web search skipped (missing API key)`, {
        toolName: "search_web",
        result: errorResult,
      });
      return errorResult;
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          search_depth: "basic",
          max_results: 3,
          include_answer: true,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `Tavily responded with HTTP ${response.status}: ${errText}`,
        );
      }

      const data: any = await response.json();
      const result = {
        query,
        directAnswer: data.answer || null,
        results: (data.results || []).slice(0, 3).map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        })),
        source: "Tavily Live Web Search",
      };

      emit("tool_result", `Live web search completed for "${query}"`, {
        toolName: "search_web",
        result,
      });

      return result;
    } catch (err: any) {
      const errorResult = {
        query,
        found: false,
        error: err.message,
        message: `Web search error for "${query}": ${err.message}`,
      };
      emit("tool_result", `Web search failed for "${query}"`, {
        toolName: "search_web",
        result: errorResult,
      });
      return errorResult;
    }
  };

  // Tool 1: Open Food Facts Lookup Tool (Belgian, European & Global Grocery Products)
  const openFoodFactsTool = tool({
    name: "search_open_food_facts",
    description:
      "Search the live Open Food Facts database for Belgian and European supermarket products (Albert Heijn, Delhaize, Colruyt, Carrefour, Lidl, Aldi) and brands (Melkunie, Alpro, Boni, etc.). Returns exact calories and macronutrients per 100g and scaled to portions.",
    parameters: {
      type: "object",
      properties: {
        productName: {
          type: "string",
          description:
            "Name of the product or brand (e.g. 'Melkunie protein drink', 'Alpro soya', 'Delhaize skyr')",
        },
        amount: {
          type: "number",
          description: "Portion quantity or amount (e.g. 200, 1, 330)",
        },
        unit: {
          type: "string",
          description:
            "Portion unit (e.g. 'g', 'grams', 'ml', 'bottle', 'can', 'pot', 'serving')",
        },
      },
      required: ["productName"],
    },
    execute: async (args: any) => {
      const productName = String(args?.productName || "").trim();
      const amount = Number(args?.amount || 100);
      const unit = String(args?.unit || "g").trim().toLowerCase();
      return executeOpenFoodFacts(productName, amount, unit);
    },
  });

  // Tool 2: Tavily Live Web Search Tool
  const webSearchTool = tool({
    name: "search_web",
    description:
      "Search the live web using Tavily for factual nutritional details, calories, and macros for restaurant meals (Belgian frituur, stoofvlees, waterzooi, waffles, takeaway), recipes, European brands, or items not found in databases.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Targeted nutritional search query (e.g. 'Melkunie protein drink strawberry nutrition facts calories protein', 'Gentse waterzooi portion calories macros', 'Delhaize skyr calories per 100g').",
        },
      },
      required: ["query"],
    },
    execute: async (args: any) => {
      const query = String(args?.query || "").trim();
      return executeTavilySearch(query);
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
    const userWeight = userProfile?.weightKg || 70;

    return entries.map((e: any) => {
      const isExplicitActivity =
        e.type === "activity" ||
        e.type === "exercise" ||
        e.type === "workout";
      const isExplicitFood = e.type === "food";

      const hasActivityClues = Boolean(
        e.activityName ||
          e.activity_name ||
          e.exercise ||
          e.workout ||
          e.durationMin ||
          e.duration_min ||
          e.durationMinutes ||
          e.duration_minutes ||
          e.duration ||
          e.metValue ||
          e.met_value ||
          e.met ||
          e.MET ||
          e.activeCalories ||
          e.active_calories ||
          e.net_active_calories ||
          e.distanceKm ||
          e.distance_km ||
          e.distance,
      );

      const isFood =
        isExplicitFood || (!isExplicitActivity && !hasActivityClues);

      // Name resolution
      let name = String(
        e.name ||
          e.activityName ||
          e.activity_name ||
          e.food ||
          e.food_name ||
          e.foodItem ||
          e.food_item ||
          e.exercise ||
          e.workout ||
          e.item ||
          e.item_name ||
          e.dish ||
          e.product_name ||
          (isFood ? "Food item" : "Exercise session"),
      ).trim();

      // Duration resolution (activity)
      const durationMin = isFood
        ? 0
        : Math.max(
            1,
            Math.round(
              Number(
                e.durationMin ??
                  e.duration_min ??
                  e.durationMinutes ??
                  e.duration_minutes ??
                  e.duration ??
                  e.time_min ??
                  e.time_minutes,
              ) || 30,
            ),
          );

      // Modality & Intensity resolution
      const rawIntensity = String(e.intensity || e.effort || "").toLowerCase();
      const intensity: ActivityIntensity = isFood
        ? "none"
        : ["low", "moderate", "vigorous", "near_max"].includes(rawIntensity)
          ? (rawIntensity as ActivityIntensity)
          : "moderate";

      const rawModality = String(e.modality || e.category || "").toLowerCase();
      const modality: ActivityModality = isFood
        ? "none"
        : [
            "cardio",
            "strength_training",
            "hiit",
            "walking",
            "sports",
          ].includes(rawModality)
          ? (rawModality as ActivityModality)
          : "cardio";

      // MET Value resolution
      const rawMet = Number(e.metValue ?? e.met_value ?? e.met ?? e.MET);
      let metValue = 0;
      if (!isFood) {
        if (!isNaN(rawMet) && rawMet > 0) {
          metValue = Number(rawMet.toFixed(1));
        } else {
          // Attempt lookup in MET_REFERENCE_TABLE by matching name
          const lowerName = name.toLowerCase();
          const match = Object.entries(MET_REFERENCE_TABLE).find(
            ([key]) => lowerName.includes(key) || key.includes(lowerName),
          );
          if (match) {
            let base = match[1].baseMet;
            if (intensity === "vigorous") base *= 1.25;
            if (intensity === "near_max") base *= 1.5;
            if (intensity === "low") base *= 0.75;
            metValue = Number(base.toFixed(1));
          } else {
            metValue = 4.0;
          }
        }
      }

      // Calories & Active Calories resolution
      const durationHours = durationMin / 60;
      const restingKcal = Math.round(1 * userWeight * durationHours);

      // Extract any provided total calories
      const parsedTotalCalories = Number(
        e.calories ??
          e.totalCalories ??
          e.total_calories ??
          e.total_calories_burned ??
          e.totalCaloriesBurned ??
          e.caloriesBurned ??
          e.calories_burned ??
          e.calories_kcal ??
          e.kcal ??
          e.energy_kcal ??
          e.burn,
      );

      // Extract any provided active calories
      const parsedActiveCalories = Number(
        e.activeCalories ??
          e.active_calories ??
          e.netActiveCalories ??
          e.net_active_calories ??
          e.active_burn ??
          e.net_active_burn,
      );

      let totalCalories = 0;
      let activeCalories = 0;

      if (isFood) {
        totalCalories = Math.max(0, Math.round(parsedTotalCalories || 0));
        activeCalories = 0;
      } else {
        const hasValidTotal =
          !isNaN(parsedTotalCalories) && parsedTotalCalories > 0;
        const hasValidActive =
          !isNaN(parsedActiveCalories) && parsedActiveCalories > 0;

        if (hasValidTotal && hasValidActive) {
          totalCalories = Math.round(parsedTotalCalories);
          activeCalories = Math.round(parsedActiveCalories);
        } else if (hasValidTotal && !hasValidActive) {
          totalCalories = Math.round(parsedTotalCalories);
          activeCalories = Math.max(0, totalCalories - restingKcal);
        } else if (!hasValidTotal && hasValidActive) {
          activeCalories = Math.round(parsedActiveCalories);
          totalCalories = activeCalories + restingKcal;
        } else {
          // Neither provided: compute from MET formula
          totalCalories = Math.round(metValue * userWeight * durationHours);
          activeCalories = Math.round(
            Math.max(0, (metValue - 1) * userWeight * durationHours),
          );
        }

        // If metValue was not explicitly given and we have total calories, infer accurate MET
        if (
          (isNaN(rawMet) || rawMet <= 0) &&
          totalCalories > 0 &&
          durationHours > 0
        ) {
          const inferredMet = Number(
            (totalCalories / (userWeight * durationHours)).toFixed(1),
          );
          if (inferredMet > 1.0) {
            metValue = inferredMet;
          }
        }
      }

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

      const mealTypeRaw = e.mealType || e.meal_type || e.meal;
      const mealType: MealType = isFood
        ? ["breakfast", "lunch", "dinner", "snack"].includes(mealTypeRaw)
          ? mealTypeRaw
          : "snack"
        : "workout";

      // Distance check for serving info
      const distance = e.distanceKm ?? e.distance_km ?? e.distance;
      let servingInfo = String(
        e.servingInfo ||
          e.serving_info ||
          (e.quantity_g
            ? `${e.quantity_g}g`
            : isFood
              ? "1 serving"
              : distance
                ? `${durationMin} mins (${distance} km)`
                : `${durationMin} mins`),
      );
      if (!isFood && distance && !servingInfo.includes(String(distance))) {
        servingInfo = `${durationMin} mins (${distance} km)`;
      }

      const details = String(e.details || "");

      return {
        type: isFood ? "food" : "activity",
        name,
        calories: totalCalories,
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
            properties: {
              type: {
                type: "string",
                enum: ["food", "activity"],
                description: "Entry type: 'food' or 'activity'",
              },
              name: {
                type: "string",
                description:
                  "Specific name of food or activity (e.g. 'Cycling (moderate)', 'Grilled Chicken Breast')",
              },
              calories: {
                type: "number",
                description:
                  "Total calories: food calories consumed, or TOTAL calories burned during activity",
              },
              protein: {
                type: "number",
                description: "Protein in grams (0 for activity)",
              },
              carbs: {
                type: "number",
                description: "Carbohydrates in grams (0 for activity)",
              },
              fat: {
                type: "number",
                description: "Fat in grams (0 for activity)",
              },
              fiber: {
                type: "number",
                description: "Dietary fiber in grams (0 for activity)",
              },
              sugar: {
                type: "number",
                description: "Sugar in grams (0 for activity)",
              },
              sodiumMg: {
                type: "number",
                description: "Sodium in mg (0 for activity)",
              },
              mealType: {
                type: "string",
                enum: ["breakfast", "lunch", "dinner", "snack", "workout"],
                description: "Meal type ('workout' for activity)",
              },
              durationMin: {
                type: "number",
                description: "Duration of workout in minutes (0 for food)",
              },
              metValue: {
                type: "number",
                description: "Adult Compendium MET value (0 for food)",
              },
              activeCalories: {
                type: "number",
                description:
                  "Net active calories burned above resting metabolism (0 for food)",
              },
              modality: {
                type: "string",
                enum: [
                  "none",
                  "cardio",
                  "strength_training",
                  "hiit",
                  "walking",
                  "sports",
                ],
                description: "Workout modality ('none' for food)",
              },
              intensity: {
                type: "string",
                enum: ["none", "low", "moderate", "vigorous", "near_max"],
                description: "Workout intensity ('none' for food)",
              },
              servingInfo: {
                type: "string",
                description:
                  "Serving description or distance/duration (e.g. '30 mins (6 km)' or '200g')",
              },
              details: {
                type: "string",
                description: "Nutritional or biomechanical notes",
              },
            },
            required: [
              "type",
              "name",
              "calories",
            ],
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
      required: ["draft_entries", "needs_clarification"],
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

  // Tool 4: User Profile & Calibrated Targets Retrieval
  const getUserProfileTool = tool({
    name: "get_user_profile",
    description:
      "Retrieve the user's calibrated physical profile (weight, height, age, sex, activity level, health goal, training routine focus) and derived metabolic targets (BMR, TDEE, dynamic target calories, and ISSN macro targets: protein, fat, carbs, fiber, sugar ceiling, sodium ceiling). Use this when answering questions about the user's personal stats, goals, recommended targets, or personal calibrations.",
    parameters: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description:
            "Optional user ID to retrieve profile for, defaults to 'default_user'",
        },
      },
    },
    execute: async (args: any) => {
      emit("tool_call", "Retrieving user physical profile & targets", {
        toolName: "get_user_profile",
        args,
      });

      let profile = userProfile;
      if (!profile || !profile.weightKg) {
        try {
          const doc = await cosmosService.getProfile(
            args?.userId || "default_user",
          );
          if (doc) {
            profile = {
              weightKg: Number(doc.weightKg || 75),
              heightCm: Number(doc.heightCm || 180),
              age: Number(doc.age || 24),
              sex: doc.sex === "female" ? "female" : "male",
              activityLevel: doc.activityLevel || "moderate",
              goal: doc.goal || doc.strategy || "maintain",
              trainingFocus: doc.trainingFocus || "cardio",
            };
          }
        } catch (_) {}
      }

      const activeProfile: UserProfile = {
        weightKg: Number(profile?.weightKg || 75),
        heightCm: Number(profile?.heightCm || 180),
        age: Number(profile?.age || 24),
        sex: profile?.sex === "female" ? "female" : "male",
        activityLevel: profile?.activityLevel || "moderate",
        goal: profile?.goal || "maintain",
        trainingFocus: profile?.trainingFocus || "cardio",
      };

      const targets = calculateMacroTargets(activeProfile);

      const result = {
        profile: {
          weightKg: activeProfile.weightKg,
          heightCm: activeProfile.heightCm,
          age: activeProfile.age,
          sex: activeProfile.sex,
          activityLevel: activeProfile.activityLevel,
          goal: activeProfile.goal,
          trainingFocus: activeProfile.trainingFocus,
        },
        calculatedTargets: {
          bmrKcal: targets.bmr,
          sedentaryTdeeKcal: targets.sedentaryTDEE,
          activeTdeeKcal: targets.activeTDEE,
          dailyTargetCalories: targets.targetCalories,
          targetProteinGrams: targets.proteinGrams,
          proteinMultiplierGPerKg: targets.proteinMultiplier,
          targetFatGrams: targets.fatGrams,
          targetCarbGrams: targets.carbGrams,
          dailyFiberTargetGrams: targets.fiberGrams,
          sugarCeilingGrams: targets.sugarMaxGrams,
          sodiumCeilingMg: targets.sodiumMaxMg,
          bmi: targets.bmi,
        },
      };

      emit(
        "tool_result",
        `Profile retrieved: ${activeProfile.weightKg}kg, ${activeProfile.goal} goal, ${targets.targetCalories} kcal target`,
        {
          toolName: "get_user_profile",
          result,
        },
      );

      return result;
    },
  });

  // Tool 5: Historical User Data & Collection Aggregations Retrieval
  const getUserDataTool = tool({
    name: "get_user_data",
    description:
      "Retrieve historical logged food items, exercises, and aggregated telemetry from the user's collection (as displayed on the Data tab). Supports flexible filtering by time range (today, yesterday, this_week, last_7_days, this_month, custom, all), log type (food, activity, or all), meal type, or keyword search.",
    parameters: {
      type: "object",
      properties: {
        time_filter: {
          type: "string",
          enum: [
            "today",
            "yesterday",
            "this_week",
            "last_7_days",
            "this_month",
            "custom",
            "all",
          ],
          description: "Convenient time filter preset. Defaults to 'today'.",
        },
        start_date: {
          type: "string",
          description:
            "Start date in 'YYYY-MM-DD' format (used when time_filter is 'custom' or specific date requested).",
        },
        end_date: {
          type: "string",
          description:
            "End date in 'YYYY-MM-DD' format (optional, defaults to start_date or today).",
        },
        type: {
          type: "string",
          enum: ["all", "food", "activity"],
          description:
            "Filter by entry type: 'food' for nutrition logs, 'activity' for workouts/exercises, or 'all'.",
        },
        meal_type: {
          type: "string",
          enum: ["all", "breakfast", "lunch", "dinner", "snack", "workout"],
          description: "Filter by specific meal category or 'all'.",
        },
        search_query: {
          type: "string",
          description:
            "Optional keyword search filter (e.g. 'banana', 'running', 'shake', 'oats').",
        },
        include_aggregations: {
          type: "boolean",
          description:
            "Whether to calculate total intake calories, active calories burned, net calories, and macronutrient sums. Defaults to true.",
        },
        limit: {
          type: "number",
          description:
            "Maximum number of individual log entries to return. Defaults to 40.",
        },
        userId: {
          type: "string",
          description:
            "Optional user ID to retrieve logs for, defaults to 'default_user'.",
        },
      },
    },
    execute: async (args: any) => {
      const { startDateStr, endDateStr } = getDateRangeForFilter(
        args?.time_filter,
        args?.start_date,
        args?.end_date,
      );

      emit(
        "tool_call",
        `Retrieving health collection data (${args?.time_filter || "today"}${startDateStr ? `: ${startDateStr}` : ""})`,
        {
          toolName: "get_user_data",
          args: {
            ...args,
            resolvedStartDate: startDateStr,
            resolvedEndDate: endDateStr,
          },
        },
      );

      let rawLogs: any[] = [];
      try {
        rawLogs = await cosmosService.getLogs(
          startDateStr,
          endDateStr,
          args?.userId || "default_user",
        );
      } catch (err: any) {
        rawLogs = [];
      }

      // Filter by type
      let filtered = rawLogs;
      if (args?.type && args.type !== "all") {
        filtered = filtered.filter((r) => r.type === args.type);
      }

      // Filter by meal_type
      if (args?.meal_type && args.meal_type !== "all") {
        filtered = filtered.filter((r) => r.mealType === args.meal_type);
      }

      // Filter by search_query
      if (
        args?.search_query &&
        typeof args.search_query === "string" &&
        args.search_query.trim()
      ) {
        const query = args.search_query.toLowerCase().trim();
        filtered = filtered.filter(
          (r) =>
            (r.name && String(r.name).toLowerCase().includes(query)) ||
            (r.details && String(r.details).toLowerCase().includes(query)) ||
            (r.servingInfo &&
              String(r.servingInfo).toLowerCase().includes(query)),
        );
      }

      const aggregations = aggregateLogs(filtered);
      const limit = Number(args?.limit) || 40;
      const entries = filtered.slice(0, limit).map((r) => ({
        id: r.rowKey || r.id,
        date: r.timestamp ? String(r.timestamp).slice(0, 10) : r.date,
        time: r.timestamp ? String(r.timestamp).slice(11, 16) : undefined,
        type: r.type,
        name: r.name,
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        fiber: r.fiber,
        sugar: r.sugar,
        sodiumMg: r.sodiumMg,
        mealType: r.mealType,
        durationMin: r.durationMin,
        metValue: r.metValue,
        activeCalories: r.activeCalories,
        modality: r.modality,
        intensity: r.intensity,
        servingInfo: r.servingInfo,
        details: r.details,
      }));

      const summary = {
        filterApplied: {
          time_filter: args?.time_filter || "today",
          startDate: startDateStr,
          endDate: endDateStr,
          type: args?.type || "all",
          meal_type: args?.meal_type || "all",
          search_query: args?.search_query || null,
        },
        aggregations:
          args?.include_aggregations === false ? undefined : aggregations,
        matchedCount: filtered.length,
        returnedCount: entries.length,
        entries,
      };

      emit(
        "tool_result",
        `Retrieved ${filtered.length} telemetry entries (${aggregations.totalIntakeCalories} kcal in, ${aggregations.totalActiveCaloriesBurned} kcal active)`,
        {
          toolName: "get_user_data",
          result: summary,
        },
      );

      return summary;
    },
  });

  // Subagent 1: Nutrition Specialist
  const nutritionSpecialist = new Agent({
    client,
    name: "NutritionSpecialist",
    description:
      "Expert nutritionist subagent that retrieves verified online nutrition facts, Belgian/European supermarket products, and restaurant meals.",
    instructions: `You are the Nutrition Specialist subagent for Health Agent.
Your duty:
1. Deconstruct user food logs into specific food items, brands, and portion amounts.
2. For packaged grocery items (especially Belgian/European supermarket brands like Melkunie, Alpro, Delhaize, Albert Heijn, Colruyt/Boni, Carrefour, Lidl, Aldi):
   - Call "search_open_food_facts" with the product name and portion.
   - If not found or if Open Food Facts is unavailable, call "search_web" via Tavily.
3. For restaurant meals, takeout, Belgian dishes (e.g. frituur, stoofvlees, Gentse waterzooi, waffles), recipes, or unlisted foods:
   - Call "search_web" via Tavily with a concise query (e.g. "<food name> calories macros protein").
4. Accurately compute portion-scaled values: calories, protein (g), carbs (g), fat (g), fiber (g), sugar (g), and sodium (mg).
5. Return a clear, structured breakdown for each food item.`,
    tools: [
      openFoodFactsTool,
      webSearchTool,
      getUserProfileTool,
      getUserDataTool,
    ],
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
      "Consult the Nutrition Specialist to retrieve verified online nutrition facts, European/Belgian supermarket products, and restaurant meal macros.",
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
- Health Goal: ${userProfile.goal}
- Training Routine Focus: ${userProfile.trainingFocus || 'cardio'}`;
  }

  const primaryInstructions = `You are the Health Agent: an elite, scientifically rigorous health, nutrition, and physical activity tracking agent.

SCIENTIFIC CORE RULES:
1. Nutrition data:
   - Must retrieve verified, accurate nutritional data using live online sources (Open Food Facts & Tavily web search).
   - Use consult_nutrition_specialist, search_web, or search_open_food_facts to determine: calories, protein (g), carbs (g), fat (g), fiber (g), sugar (g), and sodium (mg).
   - If portions are specified, scale nutrients accurately to the user's portion.
2. Physical activity & energy expenditure:
   - Use consult_activity_specialist or calculate_met_expenditure to apply 2024 Adult Compendium of Physical Activities MET values.
   - Total Calories Burned = MET * weight_kg * (duration_minutes / 60).
   - Net Active Calories = (MET - 1) * weight_kg * (duration_minutes / 60).
   - Use user's profile weight (${userProfile?.weightKg || 70}kg).
3. Ambiguity & Clarification Protocol:
   - When user input lacks necessary details (such as portion size, quantities, or exercise duration):
     * If the missing detail is non-critical / estimable (e.g. food portion size without explicit grams, or workout pace):
       - Call record_health_log with needs_clarification: true, draft_entries: [], and clarification_prompt summarizing the missing detail.
       - In your reply message, ask 1 concise clarifying question about the missing detail, AND explicitly inform the user: "If you're not sure, you can simply reply with 'estimate' and I will make a reasonable assumption based on your description and context clues."
     * If the missing detail is critical (e.g. completely unknown food name, or workout with zero duration where guessing is impossible):
       - Call record_health_log with needs_clarification: true, draft_entries: [], and clarification_prompt summarizing the missing detail.
       - In your reply message, ask directly for the specific required information without offering estimation.
   - When user input is clear OR if the user replies "estimate":
     - Set needs_clarification: false, clarification_prompt: null.
     - CONTEXT-AWARE ESTIMATION RULES:
       * When estimating, NEVER blindly default to a static standard portion if the user provided descriptive context clues anywhere in the conversation!
       * Actively scan and extract context clues:
         - Size & volume adjectives (e.g., "huge", "big bowl", "large portion", "small slice", "heaping spoonful", "deep plate", "generous scoop", "handful", "thick cut").
         - Packaging & container fractions (e.g., "half the bottle", "whole can", "a tub", "2 scoops", "a slice", "a pint", "small takeaway box").
         - Situational & modifier context (e.g., "heavy dinner", "light afternoon snack", "shared with a friend", "extra protein").
       * If context clues exist: scale the portion size up or down logically based on those clues (e.g., "big bowl" -> ~1.5x-2.0x standard portion; "half a bottle" -> 50% of container size; "small cup" -> ~0.6x; "shared with a friend" -> 50%).
       * If zero context clues exist (e.g., only "I had pasta"): use realistic average adult portion baselines.
       * In your reply message, transparently explain your reasoning based on their clues (e.g., "Based on your description of a 'big bowl', I estimated ~300g cooked pasta (~450 kcal). You can edit the entry if needed!").
     - Call record_health_log with the calculated draft_entries and your clear, encouraging summary reply.
        * Structure each entry in draft_entries:
          - "type": "food" | "activity"
          - "name": descriptive name (e.g. "Cycling (moderate)", "Grilled Chicken Breast")
          - "calories": total calories (calories consumed for food, or TOTAL calories burned during activity)
          - For activity:
            * "durationMin": minutes (e.g. 30)
            * "metValue": Adult Compendium MET value (e.g. 7.5)
            * "activeCalories": net active calories burned above resting metabolism (e.g. 192)
            * "modality": "cardio" | "strength_training" | "hiit" | "walking" | "sports"
            * "intensity": "low" | "moderate" | "vigorous" | "near_max"
            * "servingInfo": duration and distance if applicable (e.g. "30 mins (6 km)")
            * "mealType": "workout"
          - For food:
            * "protein", "carbs", "fat", "fiber", "sugar", "sodiumMg", "mealType", "servingInfo"
4. MULTI-TURN CONVERSATION AWARENESS:
   - Carefully interpret conversational context from prior turns.
   - If the user modifies, corrects, or appends items (e.g. "actually make that 3 eggs", "add 1 banana", "change to 45 mins"):
     * Reconcile changes against previous items.
     * Always pass the COMPLETE, updated set of draft entries to record_health_log.
5. EXECUTION SEQUENCE:
   - First, consult specialist subagents or call lookup tools to calculate the numbers.
   - Next, call "record_health_log" with draft_entries and your reply.
   - After record_health_log returns, write a concise, encouraging scientific summary to the user as normal text and conclude.
6. USER PROFILE & HISTORICAL COLLECTION RETRIEVAL PROTOCOL:
   - You have 2 dedicated tools for user profile and collection retrieval:
     * "get_user_profile": Retrieves the user's calibrated physical profile (weight, height, age, sex, activity level, health goal, training routine focus) and derived metabolic targets (BMR, TDEE, dynamic target calories, protein target & multiplier, fat, carbs, fiber, sugar ceiling, sodium ceiling).
       - Light Guidance: Use this when the user asks about their personal stats, BMI, BMR, TDEE, daily targets, or when you need target thresholds to assess progress.
     * "get_user_data": Retrieves logged food items, exercises, and aggregated telemetry from the user's collection (as displayed on the Data tab).
       - Light Guidance: Use this when the user asks about their logged history or data (e.g. what they ate or did today or on a specific day), how many calories/macros they consumed so far, how much they burned, whether they already logged a specific food or workout, or remaining calorie/macro allowance.
       - Filtering options:
         * time_filter: 'today' (default), 'yesterday', 'this_week', 'last_7_days', 'this_month', 'custom', or 'all'.
         * type: 'food' (nutrition only), 'activity' (workouts only), or 'all'.
         * meal_type: 'breakfast', 'lunch', 'dinner', 'snack', 'workout', or 'all'.
         * search_query: optional keyword filter (e.g. 'banana', 'run', 'shake').
       - For progress / budget questions (e.g. "How much protein do I have left today?"):
         1. Call get_user_data(time_filter: "today") to get today's consumed total.
         2. Call get_user_profile() (or use profile context) to get daily target.
         3. Compare and explain the remaining amount encouragingly.
   - INFORMATION RETRIEVAL VS LOGGING:
     * If the user is only asking for profile stats or historical logged data (without logging new food or workout), do NOT invent or create new draft entries! Call record_health_log with draft_entries: [], needs_clarification: false, and provide your helpful answer in reply.
${userContext}`;

  const healthAgent = new Agent({
    client,
    name: "HealthAgent",
    instructions: primaryInstructions,
    tools: [
      getUserProfileTool,
      getUserDataTool,
      consultNutritionTool,
      consultActivityTool,
      openFoodFactsTool,
      webSearchTool,
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
      openFoodFactsTool,
      webSearchTool,
      metExpenditureTool,
      recordHealthLogTool,
      consultNutritionTool,
      consultActivityTool,
      getUserProfileTool,
      getUserDataTool,
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

  const maxRetries = 3;
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
                      "Evaluating input against live online nutrition facts and Adult Compendium MET standards.",
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
              } else if (fc.name === "search_web") {
                emit("tool_call", "Initiating Tavily live web search", {
                  toolName: fc.name,
                });
              } else if (fc.name === "search_open_food_facts") {
                emit("tool_call", "Querying Open Food Facts database", {
                  toolName: fc.name,
                });
              } else if (fc.name === "get_user_profile") {
                emit("tool_call", "Retrieving user physical profile & targets", {
                  toolName: fc.name,
                });
              } else if (fc.name === "get_user_data") {
                emit("tool_call", "Querying user logged telemetry from collection", {
                  toolName: fc.name,
                });
              }
            }
          }
        }
        if (
          !deltaEmitted &&
          (update as any).text &&
          typeof (update as any).text === "string"
        ) {
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
        let waitMs = (attempt + 1) * 3000;
        const retryAfterHeader =
          err?.headers?.["retry-after"] ||
          (typeof err?.headers?.get === "function"
            ? err.headers.get("retry-after")
            : null);
        const retryAfterNum = Number(retryAfterHeader);
        if (retryAfterNum > 0) {
          waitMs = Math.ceil(retryAfterNum * 1000) + 750;
        } else {
          const match = (err?.message || "").match(/try again in ([\d.]+)s/i);
          if (match) {
            waitMs = Math.ceil(parseFloat(match[1]) * 1000) + 750;
          }
        }
        waitMs = Math.min(Math.max(waitMs, 2000), 16000);

        emit("thought", "Deliberation rate limit backoff", {
          thought: `Temporarily rate limited by provider. Pausing ${(waitMs / 1000).toFixed(1)}s before auto-resuming...`,
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
