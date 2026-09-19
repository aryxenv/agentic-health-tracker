import test from 'node:test';
import assert from 'node:assert/strict';

// Test MAF agent tools and logic in TypeScript compiled module
import { createHealthAgentSystem } from '../api/dist/src/services/mafHealthAgent.js';

test('MAF Health Agent System Initialization and Tool Execution', async (t) => {
  // Mock GROQ_API_KEY for tool testing
  process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'mock-groq-api-key';

  const collectedSteps = [];
  const system = createHealthAgentSystem(
    {
      weightKg: 75,
      heightCm: 180,
      age: 24,
      sex: 'male',
      activityLevel: 'moderate',
      goal: 'maintain'
    },
    (step) => collectedSteps.push(step)
  );

  assert.ok(system.healthAgent, 'HealthAgent instance should exist');
  assert.equal(system.healthAgent.name, 'HealthAgent');

  await t.test('USDA Nutrition lookup tool scales portions properly', async () => {
    const nutritionTool = system.tools.usdaNutritionTool;
    assert.ok(nutritionTool, 'lookup_usda_nutrition tool must be registered');

    const result = await nutritionTool.execute({
      foodItem: 'chicken breast',
      amount: 200,
      unit: 'grams'
    });

    assert.equal(result.foodItem, 'chicken breast');
    assert.equal(result.protein, 62); // 31g per 100g * 2 = 62g
    assert.equal(result.calories, 330); // 165 * 2 = 330 kcal
    assert.equal(result.carbs, 0);
    assert.ok(collectedSteps.length > 0, 'Steps should be emitted during tool execution');
  });

  await t.test('2024 Adult Compendium MET calculation tool computes active and total burn', async () => {
    const metTool = system.tools.metExpenditureTool;
    assert.ok(metTool, 'calculate_met_expenditure tool must be registered');

    const result = await metTool.execute({
      activityName: 'running',
      durationMinutes: 60,
      intensity: 'vigorous'
    });

    // 75kg user, 60 min, MET ~ 9.8 * 1.25 = 12.25 -> 12.3
    // Total Burn = 12.3 * 75 * 1 = ~923 kcal
    // Net Active = (12.3 - 1) * 75 * 1 = ~848 kcal
    assert.equal(result.activityName, 'running');
    assert.ok(result.totalCalories > 800, `Total calories should exceed 800, got ${result.totalCalories}`);
    assert.ok(result.activeCalories < result.totalCalories, 'Active calories must be less than total calories');
    assert.equal(result.compendiumVersion, '2024 Adult Compendium of Physical Activities');
  });

  await t.test('Draft entry recording tool sanitizes fields strictly', async () => {
    const recordTool = system.tools.recordHealthLogTool;
    assert.ok(recordTool, 'record_health_log tool must be registered');

    const result = await recordTool.execute({
      reply: 'Logged items',
      draft_entries: [
        {
          type: 'food',
          name: 'grilled chicken',
          calories: 330,
          protein: 62,
          carbs: 0,
          fat: 7.2,
          fiber: 0,
          sugar: 0,
          sodiumMg: 148,
          // invalid exercise fields on food should be zeroed
          durationMin: 30,
          metValue: 5,
          activeCalories: 200
        },
        {
          type: 'activity',
          name: 'running',
          calories: 900,
          // invalid food fields on exercise should be zeroed
          protein: 20,
          carbs: 10,
          fat: 5,
          durationMin: 60,
          metValue: 12.3,
          activeCalories: 825,
          modality: 'cardio',
          intensity: 'vigorous'
        }
      ],
      needs_clarification: false
    });

    assert.equal(result.status, 'recorded_successfully');
    assert.equal(result.count, 2);

    const recorded = system.agentRunState.recordedResult;
    assert.ok(recorded, 'Telemetry should be recorded in agentRunState');
    assert.equal(recorded.draft_entries.length, 2);

    // Check food sanitization
    const food = recorded.draft_entries[0];
    assert.equal(food.durationMin, 0);
    assert.equal(food.metValue, 0);
    assert.equal(food.activeCalories, 0);
    assert.equal(food.protein, 62);

    // Check activity sanitization
    const act = recorded.draft_entries[1];
    assert.equal(act.protein, 0);
    assert.equal(act.carbs, 0);
    assert.equal(act.fat, 0);
    assert.equal(act.activeCalories, 825);
  });
});
