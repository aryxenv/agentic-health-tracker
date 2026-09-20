import type { DailyAggregations, HealthLogRecord, MacroTargets, TrainingFocus, UserProfile } from '../types/health';

/**
 * Multiplier dictionary (g protein per kg body weight) based on ISSN guidelines and training focus.
 */
export const PROTEIN_MULTIPLIERS: Record<TrainingFocus, number> = {
  cardio: 1.3,
  balanced: 1.5,
  strength: 1.8,
  athletic_cut: 2.2
};

/**
 * Calculates Basal Metabolic Rate (BMR) using the Mifflin-St Jeor equation.
 */
export function calculateBMR(profile: UserProfile): number {
  const { weightKg, heightCm, age, sex } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? Math.round(base + 5) : Math.round(base - 161);
}

/**
 * Calculates standard Total Daily Energy Expenditure (TDEE).
 */
export function calculateTDEE(profile: UserProfile): number {
  const bmr = calculateBMR(profile);
  const multipliers: Record<UserProfile['activityLevel'], number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very_active: 1.725
  };
  const multiplier = multipliers[profile.activityLevel] || 1.2;
  return Math.round(bmr * multiplier);
}

/**
 * Calculates baseline calorie and macronutrient targets using ISSN standards
 * and dynamic net tracking (Sedentary baseline + Net Active Exercise Burn).
 */
export function calculateMacroTargets(profile: UserProfile): MacroTargets {
  const bmr = calculateBMR(profile);
  const sedentaryTDEE = Math.round(bmr * 1.2);

  const goalDeltas: Record<UserProfile['goal'], number> = {
    cut: -500,
    maintain: 0,
    bulk: 300
  };

  const delta = goalDeltas[profile.goal] ?? 0;
  const minFloor = profile.sex === 'male' ? 1500 : 1200;
  const targetCalories = Math.max(minFloor, sedentaryTDEE + delta);

  // ISSN Protein Standard: Determined by training focus routine (defaults to 1.8 if unspecified)
  const proteinMultiplier = profile.trainingFocus
    ? (PROTEIN_MULTIPLIERS[profile.trainingFocus] ?? 1.8)
    : 1.8;
  const proteinGrams = Math.round(proteinMultiplier * profile.weightKg);
  const proteinKcal = proteinGrams * 4;

  // Healthy Fat: 25% of target calories (minimum 0.6g per kg)
  const fatKcal = Math.round(targetCalories * 0.25);
  const fatGrams = Math.max(Math.round(0.6 * profile.weightKg), Math.round(fatKcal / 9));
  const actualFatKcal = fatGrams * 9;

  // Carbs: Remainder of calories with a 30g minimum safety floor
  const remainingKcal = Math.max(120, targetCalories - (proteinKcal + actualFatKcal));
  const carbGrams = Math.round(remainingKcal / 4);

  // Dietary Fiber: 14g per 1000 kcal intake
  const fiberGrams = Math.round((targetCalories / 1000) * 14);

  // WHO & Dietary Guidelines Ceiling: Free / Added Sugar < 10% of total calories (4 kcal/g)
  const sugarLimitGrams = Math.round((targetCalories * 0.1) / 4);

  // AHA / FDA Chronic Disease Risk Reduction (CDRR) Daily Sodium Ceiling: 2300mg
  const sodiumLimitMg = 2300;

  return {
    bmr,
    tdee: calculateTDEE(profile),
    targetCalories,
    proteinGrams,
    proteinMultiplier,
    fatGrams,
    carbGrams,
    fiberGrams,
    sugarLimitGrams,
    sodiumLimitMg
  };
}

/**
 * Computes active calories burned above resting BMR.
 * Formula: (MET - 1) * weightKg * (durationMin / 60)
 */
export function calculateActiveCalories(met: number, weightKg: number, durationMin: number): number {
  if (met <= 1 || durationMin <= 0) return 0;
  return Math.round((met - 1) * weightKg * (durationMin / 60));
}

/**
 * Computes total calories burned during activity.
 * Formula: MET * weightKg * (durationMin / 60)
 */
export function calculateTotalCaloriesBurned(met: number, weightKg: number, durationMin: number): number {
  if (met <= 0 || durationMin <= 0) return 0;
  return Math.round(met * weightKg * (durationMin / 60));
}

/**
 * Aggregates logs for a given set of records.
 */
export function aggregateLogs(logs: HealthLogRecord[]): DailyAggregations {
  return logs.reduce<DailyAggregations>(
    (acc, record) => {
      if (record.type === 'food') {
        acc.totalIntakeCalories += record.calories || 0;
        acc.totalProtein += record.protein || 0;
        acc.totalCarbs += record.carbs || 0;
        acc.totalFat += record.fat || 0;
        acc.totalFiber += record.fiber || 0;
        acc.totalSugar += record.sugar || 0;
        acc.totalSodiumMg += record.sodiumMg || 0;
        acc.foodCount += 1;
      } else if (record.type === 'activity') {
        const activeBurn = record.activeCalories > 0 ? record.activeCalories : record.calories;
        acc.totalActiveCaloriesBurned += activeBurn || 0;
        acc.activityCount += 1;
      }
      acc.netCalories = acc.totalIntakeCalories - acc.totalActiveCaloriesBurned;
      return acc;
    },
    {
      totalIntakeCalories: 0,
      totalActiveCaloriesBurned: 0,
      netCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalFiber: 0,
      totalSugar: 0,
      totalSodiumMg: 0,
      foodCount: 0,
      activityCount: 0
    }
  );
}
