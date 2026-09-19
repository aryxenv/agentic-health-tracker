export interface UserProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'very_active';
  goal: 'cut' | 'maintain' | 'bulk';
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

export interface CosmosHealthDoc extends HealthLogRecord {
  id: string;
  userId: string;
  docType: 'log' | 'profile';
  date: string;
  food?: {
    mealType: MealType;
    servingInfo: string;
    nutrients: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber: number;
      sugar: number;
      sodiumMg: number;
    };
  };
  activity?: {
    durationMin: number;
    metValue: number;
    activeCalories: number;
    modality: ActivityModality;
    intensity: ActivityIntensity;
    details: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfileDoc {
  id: string;
  userId: string;
  docType: 'profile';
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  activityLevel: string;
  strategy: string;
  targets: {
    bmr: number;
    tdee: number;
    targetCalories: number;
    targetProtein: number;
    targetCarbs: number;
    targetFat: number;
    sugarCeiling: number;
    sodiumCeilingMg: number;
  };
  updatedAt: string;
}


export interface GroqChatResponse {
  reply: string;
  needs_clarification: boolean;
  clarification_prompt: string | null;
  draft_entries: DraftEntry[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'health_agent';
  content: string;
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

export type AgenticStreamEvent =
  | { event: 'step'; data: AgenticStep }
  | { event: 'message'; data: GroqChatResponse }
  | { event: 'error'; data: { error: string } }
  | { event: 'done'; data: Record<string, never> };

