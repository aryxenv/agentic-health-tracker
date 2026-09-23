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

export function getBrusselsNow(refDate: Date = new Date()) {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(refDate);

  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(refDate);

  const dayOfWeek = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Brussels',
    weekday: 'long'
  }).format(refDate);

  return {
    dateStr,
    timeStr,
    dayOfWeek,
    formatted: `${dateStr} ${timeStr} (${dayOfWeek}, Europe/Brussels)`
  };
}

export function getDateRangeForFilter(
  param1?: string,
  param2?: string,
  param3?: string
): { startDateStr?: string; endDateStr?: string } {
  const isDate = (s?: string) => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s.trim()));

  // Direct start_date as first argument: getDateRangeForFilter('2026-09-22', '2026-09-22')
  if (isDate(param1)) {
    const start = param1!.trim();
    const end = isDate(param2) ? param2!.trim() : start;
    return { startDateStr: start, endDateStr: end };
  }

  // start_date as second argument: getDateRangeForFilter(timeFilter, '2026-09-22', '2026-09-22')
  if (isDate(param2)) {
    const start = param2!.trim();
    const end = isDate(param3) ? param3!.trim() : start;
    return { startDateStr: start, endDateStr: end };
  }

  const filter = String(param1 || '').toLowerCase().trim();
  if (filter === 'all') {
    return { startDateStr: undefined, endDateStr: undefined };
  }

  // Default fallback: today in Brussels
  const { dateStr } = getBrusselsNow();
  return { startDateStr: dateStr, endDateStr: dateStr };
}
