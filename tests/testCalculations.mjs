import assert from 'node:assert';
import test from 'node:test';

// Mathematical functions mirrored for verification
function calculateBMR(profile) {
  const { weightKg, heightCm, age, sex } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? Math.round(base + 5) : Math.round(base - 161);
}

function calculateTDEE(profile) {
  const bmr = calculateBMR(profile);
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very_active: 1.725
  };
  const multiplier = multipliers[profile.activityLevel] || 1.2;
  return Math.round(bmr * multiplier);
}

const PROTEIN_MULTIPLIERS = {
  cardio: 1.3,
  balanced: 1.5,
  strength: 1.8,
  athletic_cut: 2.2
};

function calculateMacroTargets(profile) {
  const bmr = calculateBMR(profile);
  const sedentaryTDEE = Math.round(bmr * 1.2);

  const goalDeltas = {
    cut: -500,
    maintain: 0,
    bulk: 300
  };

  const delta = goalDeltas[profile.goal] ?? 0;
  const minFloor = profile.sex === 'male' ? 1500 : 1200;
  const targetCalories = Math.max(minFloor, sedentaryTDEE + delta);

  const proteinMultiplier = profile.trainingFocus
    ? (PROTEIN_MULTIPLIERS[profile.trainingFocus] ?? 1.8)
    : 1.8;
  const proteinGrams = Math.round(proteinMultiplier * profile.weightKg);
  const proteinKcal = proteinGrams * 4;

  const fatKcal = Math.round(targetCalories * 0.25);
  const fatGrams = Math.max(Math.round(0.6 * profile.weightKg), Math.round(fatKcal / 9));
  const actualFatKcal = fatGrams * 9;

  const remainingKcal = Math.max(120, targetCalories - (proteinKcal + actualFatKcal));
  const carbGrams = Math.round(remainingKcal / 4);
  const fiberGrams = Math.round((targetCalories / 1000) * 14);
  const sugarLimitGrams = Math.round((targetCalories * 0.1) / 4);
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

function calculateActiveCalories(met, weightKg, durationMin) {
  if (met <= 1 || durationMin <= 0) return 0;
  return Math.round((met - 1) * weightKg * (durationMin / 60));
}

function calculateTotalCaloriesBurned(met, weightKg, durationMin) {
  if (met <= 0 || durationMin <= 0) return 0;
  return Math.round(met * weightKg * (durationMin / 60));
}

function aggregateLogs(logs) {
  return logs.reduce(
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

test('Mifflin-St Jeor BMR for Male (75kg, 180cm, 24yo)', () => {
  const bmr = calculateBMR({ weightKg: 75, heightCm: 180, age: 24, sex: 'male', activityLevel: 'moderate', goal: 'maintain' });
  assert.strictEqual(bmr, 1760);
});

test('Mifflin-St Jeor BMR for Female (60kg, 165cm, 30yo)', () => {
  const bmr = calculateBMR({ weightKg: 60, heightCm: 165, age: 30, sex: 'female', activityLevel: 'light', goal: 'cut' });
  assert.strictEqual(bmr, 1320);
});

test('Dynamic Net Targets: Cut, Maintain, Bulk', () => {
  const profile = {
    weightKg: 75,
    heightCm: 180,
    age: 24,
    sex: 'male',
    activityLevel: 'moderate',
    goal: 'maintain'
  };

  const maintain = calculateMacroTargets(profile);
  assert.strictEqual(maintain.targetCalories, 2112);
  assert.strictEqual(maintain.proteinGrams, 135);
  assert.strictEqual(maintain.fatGrams, 59);
  assert.strictEqual(maintain.sugarLimitGrams, 53); // Math.round((2112 * 0.1) / 4)
  assert.strictEqual(maintain.sodiumLimitMg, 2300);

  const cut = calculateMacroTargets({ ...profile, goal: 'cut' });
  assert.strictEqual(cut.targetCalories, 1612);
  assert.strictEqual(cut.proteinGrams, 135);

  const bulk = calculateMacroTargets({ ...profile, goal: 'bulk' });
  assert.strictEqual(bulk.targetCalories, 2412);

  // Training Focus routine presets testing
  const cardio = calculateMacroTargets({ ...profile, trainingFocus: 'cardio' });
  assert.strictEqual(cardio.proteinMultiplier, 1.3);
  assert.strictEqual(cardio.proteinGrams, Math.round(1.3 * 75)); // 98g
  // Carbs should be higher because protein is lower:
  assert.ok(cardio.carbGrams > maintain.carbGrams);

  const balanced = calculateMacroTargets({ ...profile, trainingFocus: 'balanced' });
  assert.strictEqual(balanced.proteinMultiplier, 1.5);
  assert.strictEqual(balanced.proteinGrams, Math.round(1.5 * 75)); // 113g

  const strength = calculateMacroTargets({ ...profile, trainingFocus: 'strength' });
  assert.strictEqual(strength.proteinMultiplier, 1.8);
  assert.strictEqual(strength.proteinGrams, 135);

  const athleticCut = calculateMacroTargets({ ...profile, trainingFocus: 'athletic_cut' });
  assert.strictEqual(athleticCut.proteinMultiplier, 2.2);
  assert.strictEqual(athleticCut.proteinGrams, Math.round(2.2 * 75)); // 165g
});

test('Active MET Burn Formula vs Total Burn (No double counting)', () => {
  const total = calculateTotalCaloriesBurned(10, 75, 60);
  const active = calculateActiveCalories(10, 75, 60);

  assert.strictEqual(total, 750);
  assert.strictEqual(active, 675);
  assert.strictEqual(total - active, 75);
});

test('Macro Non-Negative Safety Guardrails', () => {
  const extreme = calculateMacroTargets({
    weightKg: 120,
    heightCm: 170,
    age: 50,
    sex: 'female',
    activityLevel: 'sedentary',
    goal: 'cut'
  });
  assert.ok(extreme.targetCalories >= 1200);
  assert.ok(extreme.carbGrams >= 30, 'Carbs must never be negative or below 30g safety floor');
});

test('Aggregate Logs: Net Balance and Macronutrient Sums', () => {
  const records = [
    {
      type: 'food',
      name: 'Oatmeal & Protein',
      calories: 450,
      protein: 35,
      carbs: 55,
      fat: 10,
      fiber: 8,
      sugar: 6,
      sodiumMg: 150
    },
    {
      type: 'activity',
      name: 'Cycling',
      calories: 300,
      activeCalories: 250
    }
  ];

  const agg = aggregateLogs(records);
  assert.strictEqual(agg.totalIntakeCalories, 450);
  assert.strictEqual(agg.totalActiveCaloriesBurned, 250);
  assert.strictEqual(agg.netCalories, 200);
  assert.strictEqual(agg.totalProtein, 35);
  assert.strictEqual(agg.totalFiber, 8);
});
