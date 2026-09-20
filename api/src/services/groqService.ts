import Groq from 'groq-sdk';
import { ChatMessage, GroqChatResponse, UserProfile } from '../types/apiTypes';

const GROQ_MODEL = 'openai/gpt-oss-120b';

const SYSTEM_PROMPT = `You are the Health Agent: an elite, scientifically rigorous nutrition and physical activity tracking agent.

SCIENTIFIC CORE RULES:
1. Nutrition data must accurately reflect standard USDA FoodData Central nutritional densities.
   - For every food item, calculate: calories, protein (g), carbs (g), fat (g), fiber (g), sugar (g), and sodium (mg).
   - If portions are specified (e.g., "2 large eggs", "100g chicken breast", "1 slice sourdough"), scale nutrients accordingly.
2. Physical activity & energy expenditure:
   - Use the 2024 Adult Compendium of Physical Activities MET values.
   - Total Calories Burned = MET * weight_kg * (duration_minutes / 60).
   - Net Active Calories (burn above resting metabolic rate) = (MET - 1) * weight_kg * (duration_minutes / 60).
   - Use user's profile weight if provided (fallback to 70kg).
3. Ambiguity & Clarification Protocol:
   - If the user's input is ambiguous or missing critical details (e.g. food without portion size like "had pasta", or activity without duration/intensity like "went for a run"):
     * Set "needs_clarification": true
     * Provide 1-2 concise clarifying questions in "reply"
     * Populate "clarification_prompt" with a short description of what is missing
     * Inform the user they can simply reply or tap "Estimate" to proceed with standard adult average portions
     * Set "draft_entries": []
   - If the input is clear OR if the user says "estimate" / includes "estimate":
     * Set "needs_clarification": false
     * Set "clarification_prompt": null
     * Generate structured draft items in "draft_entries" (one item per food component or activity)
     * In "reply", provide a brief, encouraging scientific breakdown of the numbers.

RESPONSE SCHEMA:
Strict JSON adhering to the specified schema. All numbers must be non-negative. For activities, protein/carbs/fat/fiber/sugar/sodiumMg must be 0. For foods, durationMin/metValue/activeCalories must be 0.`;

export const HEALTH_LOG_JSON_SCHEMA = {
  name: 'health_log_response',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      reply: {
        type: 'string',
        description: 'Conversational response explaining calculations or asking clarifying questions.'
      },
      needs_clarification: {
        type: 'boolean',
        description: 'True if key information is missing and user has not requested an estimate.'
      },
      clarification_prompt: {
        type: ['string', 'null'],
        description: 'Short summary of missing details if clarification is needed.'
      },
      draft_entries: {
        type: 'array',
        description: 'Array of drafted items extracted from the conversation.',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['food', 'activity']
            },
            name: {
              type: 'string',
              description: 'Name of the food item or physical activity.'
            },
            calories: {
              type: 'number',
              description: 'Calories intake for food, or total calories burned for activity.'
            },
            protein: {
              type: 'number',
              description: 'Protein in grams (0 for activity).'
            },
            carbs: {
              type: 'number',
              description: 'Total carbohydrates in grams (0 for activity).'
            },
            fat: {
              type: 'number',
              description: 'Total fat in grams (0 for activity).'
            },
            fiber: {
              type: 'number',
              description: 'Dietary fiber in grams (0 for activity).'
            },
            sugar: {
              type: 'number',
              description: 'Total sugars in grams (0 for activity).'
            },
            sodiumMg: {
              type: 'number',
              description: 'Sodium in milligrams (0 for activity).'
            },
            mealType: {
              type: 'string',
              enum: ['breakfast', 'lunch', 'dinner', 'snack', 'workout']
            },
            durationMin: {
              type: 'number',
              description: 'Duration in minutes (0 for food).'
            },
            metValue: {
              type: 'number',
              description: 'MET value (0 for food).'
            },
            activeCalories: {
              type: 'number',
              description: 'Net active calories burned above resting BMR (0 for food).'
            },
            modality: {
              type: 'string',
              enum: ['none', 'cardio', 'strength_training', 'hiit', 'walking', 'sports']
            },
            intensity: {
              type: 'string',
              enum: ['none', 'low', 'moderate', 'vigorous', 'near_max']
            },
            servingInfo: {
              type: 'string',
              description: 'Serving size or workout details (e.g., "1.5 cups (350g)" or "45 mins moderate").'
            },
            details: {
              type: 'string',
              description: 'Brief nutritional or biomechanical details.'
            }
          },
          required: [
            'type',
            'name',
            'calories',
            'protein',
            'carbs',
            'fat',
            'fiber',
            'sugar',
            'sodiumMg',
            'mealType',
            'durationMin',
            'metValue',
            'activeCalories',
            'modality',
            'intensity',
            'servingInfo',
            'details'
          ],
          additionalProperties: false
        }
      }
    },
    required: ['reply', 'needs_clarification', 'clarification_prompt', 'draft_entries'],
    additionalProperties: false
  }
};

export async function processChatConversation(
  messages: ChatMessage[],
  userProfile?: UserProfile
): Promise<GroqChatResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not configured');
  }

  const groq = new Groq({ apiKey });

  // Build context with user profile
  let userContext = '';
  if (userProfile) {
    userContext = `\nUSER PROFILE CONTEXT:
- Weight: ${userProfile.weightKg} kg
- Height: ${userProfile.heightCm} cm
- Age: ${userProfile.age}
- Sex: ${userProfile.sex}
- Activity Level: ${userProfile.activityLevel}
- Health Goal: ${userProfile.goal}`;
  }

  const groqMessages = [
    { role: 'system' as const, content: SYSTEM_PROMPT + userContext },
    ...messages.map((m) => ({
      role: (m.role === 'health_agent' ? 'assistant' : m.role) as 'system' | 'user' | 'assistant',
      content: m.content
    }))
  ];

  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: groqMessages,
    temperature: 0.2,
    response_format: {
      type: 'json_schema',
      json_schema: HEALTH_LOG_JSON_SCHEMA
    } as any
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('Empty response received from Groq model');
  }

  try {
    const parsed: GroqChatResponse = JSON.parse(rawContent);
    return parsed;
  } catch (err: any) {
    throw new Error(`Failed to parse Groq structured response: ${err.message}. Content: ${rawContent}`);
  }
}
