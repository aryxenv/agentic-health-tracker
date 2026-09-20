import { HealthLogRecord, TrainingFocus, UserProfile } from '../types/apiTypes';

export const PROTEIN_MULTIPLIERS: Record<TrainingFocus, number> = {
  cardio: 1.3,
  balanced: 1.5,
  strength: 1.8,
  athletic_cut: 2.2
};

export function calculateBMR(profile: UserProfile): number {
  const { weightKg, heightCm, age, sex } = profile;
  if (sex === 'male') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  } else {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
  }
}

export function calculateTDEE(profile: UserProfile): number {
  const bmr = calculateBMR(profile);
  const multipliers: Record<UserProfile['activityLevel'], number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very_active: 1.725
  };
  return Math.round(bmr * (multipliers[profile.activityLevel] || 1.2));
}

export function calculateMacroTargets(profile: UserProfile) {
  const bmr = calculateBMR(profile);
  const sedentaryTDEE = Math.round(bmr * 1.2);
  const goalDeltas: Record<UserProfile['goal'], number> = {
    cut: -500,
    maintain: 0,
    bulk: 300
  };
  const delta = goalDeltas[profile.goal] || 0;
  const minFloor = profile.sex === 'male' ? 1500 : 1200;
  const targetCalories = Math.max(minFloor, sedentaryTDEE + delta);

  const trainingFocus = profile.trainingFocus || 'cardio';
  const proteinMultiplier = PROTEIN_MULTIPLIERS[trainingFocus] ?? 1.8;
  const proteinGrams = Math.round(proteinMultiplier * profile.weightKg);
  const proteinKcal = proteinGrams * 4;

  const fatKcal = Math.round(targetCalories * 0.25);
  const minFatGrams = Math.round(profile.weightKg * 0.6);
  const fatGrams = Math.max(minFatGrams, Math.round(fatKcal / 9));

  const remainingKcal = Math.max(0, targetCalories - proteinKcal - (fatGrams * 9));
  const carbGrams = Math.round(remainingKcal / 4);

  const fiberGrams = Math.max(25, Math.round((targetCalories / 1000) * 14));
  const sugarMaxGrams = Math.round((targetCalories * 0.10) / 4);
  const sodiumMaxMg = 2300;

  const heightM = (profile.heightCm || 180) / 100;
  const bmi = Number((profile.weightKg / (heightM * heightM)).toFixed(1));

  return {
    bmr,
    sedentaryTDEE,
    activeTDEE: calculateTDEE(profile),
    targetCalories,
    proteinGrams,
    proteinMultiplier,
    fatGrams,
    carbGrams,
    fiberGrams,
    sugarMaxGrams,
    sodiumMaxMg,
    bmi
  };
}

export function aggregateLogs(logs: HealthLogRecord[]) {
  let totalIntakeCalories = 0;
  let totalActiveCaloriesBurned = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;
  let totalSugar = 0;
  let totalSodiumMg = 0;
  let foodCount = 0;
  let activityCount = 0;

  for (const log of logs) {
    if (log.type === 'food') {
      foodCount++;
      totalIntakeCalories += Number(log.calories || 0);
      totalProtein += Number(log.protein || 0);
      totalCarbs += Number(log.carbs || 0);
      totalFat += Number(log.fat || 0);
      totalFiber += Number(log.fiber || 0);
      totalSugar += Number(log.sugar || 0);
      totalSodiumMg += Number(log.sodiumMg || 0);
    } else if (log.type === 'activity') {
      activityCount++;
      totalActiveCaloriesBurned += Number(log.activeCalories || 0);
    }
  }

  return {
    totalIntakeCalories: Math.round(totalIntakeCalories),
    totalActiveCaloriesBurned: Math.round(totalActiveCaloriesBurned),
    netCalories: Math.round(totalIntakeCalories - totalActiveCaloriesBurned),
    totalProteinGrams: Number(totalProtein.toFixed(1)),
    totalCarbGrams: Number(totalCarbs.toFixed(1)),
    totalFatGrams: Number(totalFat.toFixed(1)),
    totalFiberGrams: Number(totalFiber.toFixed(1)),
    totalSugarGrams: Number(totalSugar.toFixed(1)),
    totalSodiumMg: Math.round(totalSodiumMg),
    foodCount,
    activityCount
  };
}

export function getDateRangeForFilter(
  filter?: string,
  customStart?: string,
  customEnd?: string
): { startDateStr?: string; endDateStr?: string } {
  if (customStart) {
    return {
      startDateStr: customStart,
      endDateStr: customEnd || customStart
    };
  }

  const now = new Date();
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

  if (filter === 'yesterday') {
    const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yStr = toDateStr(y);
    return { startDateStr: yStr, endDateStr: yStr };
  }
  if (filter === 'this_week') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    return { startDateStr: toDateStr(d), endDateStr: toDateStr(now) };
  }
  if (filter === 'last_7_days') {
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { startDateStr: toDateStr(past), endDateStr: toDateStr(now) };
  }
  if (filter === 'this_month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDateStr: toDateStr(firstDay), endDateStr: toDateStr(now) };
  }
  if (filter === 'all') {
    return { startDateStr: undefined, endDateStr: undefined };
  }
  // Default: 'today'
  const todayStr = toDateStr(now);
  return { startDateStr: todayStr, endDateStr: todayStr };
}
