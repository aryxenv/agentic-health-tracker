import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { runHealthAgentStream } from '../api/dist/src/services/mafHealthAgent.js';

// Load keys from api/local.settings.json or .env if present
const localSettingsPath = path.resolve('api/local.settings.json');
if (fs.existsSync(localSettingsPath)) {
  try {
    const settings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
    if (settings.Values) {
      for (const [k, v] of Object.entries(settings.Values)) {
        if (!process.env[k]) process.env[k] = v;
      }
    }
  } catch (_) {}
}

const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch (_) {}
}

const userProfile = {
  weightKg: 75,
  heightCm: 180,
  age: 24,
  sex: 'male',
  activityLevel: 'moderate',
  goal: 'maintain',
  trainingFocus: 'cardio'
};

const MODEL_UNDER_TEST = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

function isProviderRateLimit(err) {
  const msg = (err?.message || '').toLowerCase();
  return Boolean(
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('tpd') ||
    msg.includes('tokens per day') ||
    msg.includes('tokens per minute') ||
    msg.includes('otpm')
  );
}

test('MAF Health Agent: Core Live Model Suite (5 Key End-to-End Tests)', async (suite) => {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes('<YOUR_')) {
    console.log('Skipping live model suite: GROQ_API_KEY is not configured');
    return;
  }

  // Helper to prevent rapid burst rate limiting on Groq
  const pause = (ms = 2500) => new Promise((r) => setTimeout(r, ms));

  // 1. One-Shot Nutritional: Branded Supermarket Grocery Intake (Open Food Facts integration)
  await suite.test('1. One-Shot Nutritional: Branded grocery product lookup', async () => {
    await pause(1000);
    const steps = [];
    const messages = [
      {
        id: 'msg_nutri_1',
        role: 'user',
        content: 'I had 1 bottle (330ml) of Melkunie strawberry protein drink for my afternoon snack.',
        timestamp: new Date().toISOString()
      }
    ];

    try {
      const response = await runHealthAgentStream(
        messages,
        userProfile,
        (step) => steps.push(step),
        () => {},
        MODEL_UNDER_TEST
      );

      assert.ok(response, 'Agent must return a response');
      assert.equal(response.needs_clarification, false, 'Should not block clear portion');
      assert.ok(Array.isArray(response.draft_entries), 'draft_entries must be an array');
      assert.ok(response.draft_entries.length >= 1, 'Should emit at least 1 food draft entry');

      const food = response.draft_entries[0];
      assert.equal(food.type, 'food');
      assert.ok(food.calories > 0, `Calories should be > 0, got ${food.calories}`);
      assert.ok(food.protein > 0, `Protein should be > 0, got ${food.protein}`);
    } catch (err) {
      if (isProviderRateLimit(err)) {
        console.warn(`[NOTICE] Provider rate limit encountered in Test 1: ${err.message}`);
        return;
      }
      throw err;
    }
  });

  // 2. One-Shot Physical: 2024 Adult Compendium MET Activity Logging
  await suite.test('2. One-Shot Physical: 2024 Adult Compendium MET exercise calculation', async () => {
    await pause();
    const steps = [];
    const messages = [
      {
        id: 'msg_phys_1',
        role: 'user',
        content: 'Did a 45 minute brisk walk in the park at a moderate pace.',
        timestamp: new Date().toISOString()
      }
    ];

    try {
      const response = await runHealthAgentStream(
        messages,
        userProfile,
        (step) => steps.push(step),
        () => {},
        MODEL_UNDER_TEST
      );

      assert.ok(response, 'Agent must return a response');
      assert.equal(response.needs_clarification, false, 'Should not request clarification for 45 min walk');
      assert.ok(Array.isArray(response.draft_entries), 'draft_entries must be an array');
      assert.ok(response.draft_entries.length >= 1, 'Should emit an activity draft entry');

      const act = response.draft_entries.find((e) => e.type === 'activity') || response.draft_entries[0];
      assert.equal(act.type, 'activity');
      assert.ok(act.durationMin >= 35, `Duration should be ~45 mins, got ${act.durationMin}`);
      assert.ok(act.calories > 0, `Total burned calories must be > 0, got ${act.calories}`);
      assert.ok(act.activeCalories > 0, `Active burned calories must be > 0, got ${act.activeCalories}`);
    } catch (err) {
      if (isProviderRateLimit(err)) {
        console.warn(`[NOTICE] Provider rate limit encountered in Test 2: ${err.message}`);
        return;
      }
      throw err;
    }
  });

  // 3. One-Shot Data Explore: Historical Telemetry & Aggregation Query Routing
  await suite.test('3. One-Shot Data Explore: Historical telemetry query routing without logging', async () => {
    await pause();
    const steps = [];
    const messages = [
      {
        id: 'msg_explore_1',
        role: 'user',
        content: 'What is my total calorie intake and net balance for today according to my logs?',
        timestamp: new Date().toISOString()
      }
    ];

    try {
      const response = await runHealthAgentStream(
        messages,
        userProfile,
        (step) => steps.push(step),
        () => {},
        MODEL_UNDER_TEST
      );

      assert.ok(response, 'Agent must return a response');
      assert.equal(response.needs_clarification, false);
      // Historical exploration questions should NOT generate new food or activity entries
      assert.equal(response.draft_entries.length, 0, 'Data explore query should not draft new entries');
      assert.ok(response.reply && response.reply.length > 10, 'Agent should provide an informative reply');

      // Check that data explorer or get_user_data was consulted
      const dataExplorerCalls = steps.filter(
        (s) =>
          s.toolName === 'consult_data_explorer' ||
          s.toolName === 'get_user_data' ||
          (s.title && s.title.toLowerCase().includes('data explorer'))
      );
      assert.ok(dataExplorerCalls.length >= 1, 'Should consult Data Explorer for historical stats');
    } catch (err) {
      if (isProviderRateLimit(err)) {
        console.warn(`[NOTICE] Provider rate limit encountered in Test 3: ${err.message}`);
        return;
      }
      throw err;
    }
  });

  // 4. 2-Shot Conversational Edit: Modifying and Appending Active Session Drafts
  await suite.test('4. 2-Shot Conversational Edit: Multi-turn draft refinement and appending', async () => {
    await pause();
    const steps = [];
    const messages = [
      {
        id: 'msg_edit_1',
        role: 'user',
        content: 'I ate 2 boiled eggs for breakfast',
        timestamp: new Date(Date.now() - 60000).toISOString()
      },
      {
        id: 'msg_edit_2',
        role: 'assistant',
        content: 'Drafted 2 boiled eggs (~144 kcal, 12.6g protein, 0.8g carbs, 9.6g fat). Ready to confirm?',
        timestamp: new Date(Date.now() - 30000).toISOString()
      },
      {
        id: 'msg_edit_3',
        role: 'user',
        content: 'Actually make that 3 boiled eggs, and add 1 medium banana',
        timestamp: new Date().toISOString()
      }
    ];

    try {
      const response = await runHealthAgentStream(
        messages,
        userProfile,
        (step) => steps.push(step),
        () => {},
        MODEL_UNDER_TEST
      );

      assert.ok(response, 'Agent must return a response');
      assert.equal(response.needs_clarification, false);
      assert.ok(Array.isArray(response.draft_entries), 'draft_entries must be an array');
      assert.ok(response.draft_entries.length >= 2, 'Should have entries for both updated eggs and added banana');

      // Verify eggs were updated to 3 (~216 kcal instead of 144)
      const eggEntry = response.draft_entries.find((e) => e.name.toLowerCase().includes('egg'));
      assert.ok(eggEntry, 'Draft entries must contain eggs');
      assert.ok(eggEntry.calories >= 180, `3 eggs should be >= 180 kcal, got ${eggEntry.calories}`);

      // Verify banana was added
      const bananaEntry = response.draft_entries.find((e) => e.name.toLowerCase().includes('banana'));
      assert.ok(bananaEntry, 'Draft entries must contain added banana');
      assert.ok(bananaEntry.calories >= 70, `Banana should be >= 70 kcal, got ${bananaEntry.calories}`);
    } catch (err) {
      if (isProviderRateLimit(err)) {
        console.warn(`[NOTICE] Provider rate limit encountered in Test 4: ${err.message}`);
        return;
      }
      throw err;
    }
  });

  // 5. One-Shot Multi-Item Meal Decomposition (Crucial Agent Separation Protocol)
  await suite.test('5. One-Shot Multi-Item Decomposition: Separating compound meal into distinct entries', async () => {
    await pause();
    const steps = [];
    const messages = [
      {
        id: 'msg_decomp_1',
        role: 'user',
        content: 'Had 1 scoop whey protein powder mixed in 300ml whole milk for breakfast',
        timestamp: new Date().toISOString()
      }
    ];

    try {
      const response = await runHealthAgentStream(
        messages,
        userProfile,
        (step) => steps.push(step),
        () => {},
        MODEL_UNDER_TEST
      );

      assert.ok(response, 'Agent must return a response');
      assert.equal(response.needs_clarification, false);
      assert.ok(Array.isArray(response.draft_entries), 'draft_entries must be an array');
      assert.ok(
        response.draft_entries.length >= 2,
        `Compound meal should be decomposed into at least 2 distinct entries, got ${response.draft_entries.length}`
      );

      // Verify both protein powder and milk exist separately
      const hasWhey = response.draft_entries.some((e) =>
        e.name.toLowerCase().includes('whey') || e.name.toLowerCase().includes('protein')
      );
      const hasMilk = response.draft_entries.some((e) =>
        e.name.toLowerCase().includes('milk')
      );
      assert.ok(hasWhey, 'Decomposed items should contain whey/protein entry');
      assert.ok(hasMilk, 'Decomposed items should contain milk entry');
    } catch (err) {
      if (isProviderRateLimit(err)) {
        console.warn(`[NOTICE] Provider rate limit encountered in Test 5: ${err.message}`);
        return;
      }
      throw err;
    }
  });
});
