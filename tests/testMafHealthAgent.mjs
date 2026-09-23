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

  await t.test('Specialist subagents are registered as tools', async () => {
    assert.ok(system.tools.consultNutritionTool, 'consult_nutrition_specialist tool must be registered');
    assert.equal(system.tools.consultNutritionTool.name, 'consult_nutrition_specialist');
    assert.ok(system.tools.consultActivityTool, 'consult_activity_specialist tool must be registered');
    assert.equal(system.tools.consultActivityTool.name, 'consult_activity_specialist');
    assert.ok(system.tools.consultDataExplorerTool, 'consult_data_explorer tool must be registered');
    assert.equal(system.tools.consultDataExplorerTool.name, 'consult_data_explorer');
  });

  await t.test('Open Food Facts tool is registered and exposes search_open_food_facts', async () => {
    const offTool = system.tools.openFoodFactsTool;
    assert.ok(offTool, 'search_open_food_facts tool must be registered');
    assert.equal(offTool.name, 'search_open_food_facts');
  });

  await t.test('Tavily Web Search tool is registered and executes queries', async () => {
    const searchTool = system.tools.webSearchTool;
    assert.ok(searchTool, 'search_web tool must be registered');
    assert.equal(searchTool.name, 'search_web');

    const result = await searchTool.execute({
      query: 'Melkunie protein drink strawberry nutrition facts calories protein'
    });

    assert.ok(result, 'Search result should be returned');
    assert.equal(result.query, 'Melkunie protein drink strawberry nutrition facts calories protein');
    if (result.results) {
      assert.ok(Array.isArray(result.results), 'Results should be an array');
      assert.equal(result.source, 'Tavily Live Web Search');
    }
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

  await t.test('User Profile tool retrieves calibrated biometric profile and ISSN macro targets', async () => {
    const profileTool = system.tools.getUserProfileTool;
    assert.ok(profileTool, 'get_user_profile tool must be registered');
    assert.equal(profileTool.name, 'get_user_profile');

    const result = await profileTool.execute({});
    assert.ok(result.profile, 'Result must include profile data');
    assert.equal(result.profile.weightKg, 75);
    assert.equal(result.profile.heightCm, 180);

    assert.ok(result.calculatedTargets, 'Result must include calculatedTargets');
    assert.ok(result.calculatedTargets.bmrKcal > 0, 'BMR should be > 0');
    assert.ok(result.calculatedTargets.dailyTargetCalories > 0, 'Target calories should be > 0');
    assert.ok(result.calculatedTargets.targetProteinGrams > 0, 'Target protein should be > 0');
    assert.ok(result.calculatedTargets.bmi > 0, 'BMI should be > 0');
  });

  await t.test('User Data tool retrieves and efficiently filters collection telemetry and aggregations', async () => {
    const dataTool = system.tools.getUserDataTool;
    assert.ok(dataTool, 'get_user_data tool must be registered');
    assert.equal(dataTool.name, 'get_user_data');

    // Test time_filter: 'today'
    const todayResult = await dataTool.execute({ time_filter: 'today' });
    assert.ok(todayResult, 'Should return result for today');
    assert.equal(todayResult.filterApplied.time_filter, 'today');
    assert.ok(todayResult.aggregations, 'Should compute aggregations');
    assert.equal(typeof todayResult.aggregations.totalIntakeCalories, 'number');
    assert.equal(typeof todayResult.aggregations.netCalories, 'number');
    assert.ok(Array.isArray(todayResult.entries), 'Entries should be an array');

    // Test type filtering
    const foodOnly = await dataTool.execute({ time_filter: 'all', type: 'food' });
    assert.equal(foodOnly.filterApplied.type, 'food');
    for (const e of foodOnly.entries) {
      assert.equal(e.type, 'food');
    }

    // Test search_query filtering
    const searchResult = await dataTool.execute({ time_filter: 'all', search_query: 'nuts' });
    assert.ok(searchResult, 'Search query should execute');
    assert.equal(searchResult.filterApplied.search_query, 'nuts');

    // Test dynamic model-driven start_date and end_date
    const dateRangeResult = await dataTool.execute({
      start_date: '2026-09-20',
      end_date: '2026-09-21'
    });
    assert.ok(dateRangeResult, 'Dynamic date range should execute');
    assert.equal(dateRangeResult.filterApplied.startDate, '2026-09-20');
    assert.equal(dateRangeResult.filterApplied.endDate, '2026-09-21');
  });

  await t.test('Brussels calendar context helper returns valid local timezone data', async () => {
    const { getBrusselsNow } = await import('../api/dist/src/services/calculations.js');
    const brussels = getBrusselsNow();
    assert.ok(brussels.dateStr, 'dateStr must exist');
    assert.match(brussels.dateStr, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(brussels.timeStr, 'timeStr must exist');
    assert.ok(brussels.dayOfWeek, 'dayOfWeek must exist');
    assert.ok(brussels.formatted.includes('Europe/Brussels'));
  });
});

