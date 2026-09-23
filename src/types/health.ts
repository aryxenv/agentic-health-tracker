export type TrainingFocus = 'cardio' | 'balanced' | 'strength' | 'athletic_cut';

export interface UserProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'very_active';
  goal: 'cut' | 'maintain' | 'bulk';
  trainingFocus?: TrainingFocus;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'workout';
export type ActivityModality = 'none' | 'cardio' | 'strength_training' | 'hiit' | 'walking' | 'sports';
export type ActivityIntensity = 'none' | 'low' | 'moderate' | 'vigorous' | 'near_max';

export interface DraftEntry {
  type: 'food' | 'activity';
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodiumMg: number;
  mealType: MealType;
  durationMin: number;
  metValue: number;
  activeCalories: number;
  modality: ActivityModality;
  intensity: ActivityIntensity;
  servingInfo: string;
  details: string;
}

export interface HealthLogRecord extends DraftEntry {
  partitionKey: string;
  rowKey: string;
  rawInput?: string;
  timestamp: string;
}

export interface ChatResponse {
  reply: string;
  needs_clarification: boolean;
  clarification_prompt: string | null;
  draft_entries: DraftEntry[];
  activeModel?: ModelId;
}

export type AgenticStepType = 'thought' | 'tool_call' | 'tool_result';

export interface AgenticStep {
  id: string;
  type: AgenticStepType;
  title: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  thought?: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'health_agent';
  text: string;
  timestamp: string;
  needsClarification?: boolean;
  draftEntries?: DraftEntry[];
  agenticSteps?: AgenticStep[];
  isConfirmed?: boolean;
  isRateLimit?: boolean;
  failedModel?: string;
}

export type ModelId = 'openai/gpt-oss-120b' | 'openai/gpt-oss-20b' | 'qwen/qwen3.8-27b';

export interface ModelOption {
  id: ModelId;
  name: string;
  provider: 'openai' | 'qwen';
  shortName: string;
  description: string;
  badge?: string;
}

export const DEFAULT_MODEL_ID: ModelId = 'openai/gpt-oss-20b';

export const AVAILABLE_MODELS: readonly ModelOption[] = [
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT OSS 20B',
    provider: 'openai',
    shortName: '20B',
    description: 'Ultra-fast & lightweight reasoning model (recommended)',
    badge: 'Default',
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT OSS 120B',
    provider: 'openai',
    shortName: '120B',
    description: 'Flagship reasoning model for complex queries & research',
    badge: 'High Precision',
  },
  {
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B',
    provider: 'qwen',
    shortName: 'Qwen 27B',
    description: 'High efficiency 27B multilingual model',
    badge: 'Balanced',
  },
] as const;

export interface MacroTargets {
  bmr: number;
  tdee: number;
  targetCalories: number;
  proteinGrams: number;
  proteinMultiplier: number;
  fatGrams: number;
  carbGrams: number;
  fiberGrams: number;
  sugarLimitGrams: number;
  sodiumLimitMg: number;
}

export interface DailyAggregations {
  totalIntakeCalories: number;
  totalActiveCaloriesBurned: number;
  netCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  totalSugar: number;
  totalSodiumMg: number;
  foodCount: number;
  activityCount: number;
}

// Runtime constants to ensure valid module exports for bundler hydration
export const DEFAULT_PROFILE: UserProfile = {
  weightKg: 75,
  heightCm: 180,
  age: 24,
  sex: 'male',
  activityLevel: 'moderate',
  goal: 'maintain',
  trainingFocus: 'cardio'
};

export const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'workout'] as const;
export const ACTIVITY_MODALITIES: readonly ActivityModality[] = ['none', 'cardio', 'strength_training', 'hiit', 'walking', 'sports'] as const;
