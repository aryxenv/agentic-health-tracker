import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.GROQ_API_KEY) {
  try {
    const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  } catch (_) {}
}

// Import compiled MAF health agent
const { runHealthAgentStream } = await import('../api/dist/src/services/mafHealthAgent.js');

test('Live MAF Health Agent End-to-End Suite with Groq gpt-oss-20b', async (t) => {
  const apiKey = process.env.GROQ_API_KEY;
  assert.ok(apiKey, 'GROQ_API_KEY must be defined in environment');
  assert.ok(apiKey.startsWith('gsk_'), 'GROQ_API_KEY should start with gsk_');

  const testProfile = {
    weightKg: 75,
    heightCm: 180,
    age: 28,
    sex: 'male',
    activityLevel: 'moderate',
    goal: 'cut'
  };

  await t.test('Scenario 1: Food logging with USDA FoodData Central tool calls', async () => {
    const steps = [];
    const messages = [
      { role: 'user', content: 'I had 150g grilled chicken breast and 1 cup white rice for lunch' }
    ];

    console.log('\n--- Running Scenario 1: Food Logging ---');
    const result = await runHealthAgentStream(messages, testProfile, (step) => {
      steps.push(step);
      console.log(`  [Agentic Step: ${step.type.toUpperCase()}] ${step.title}`);
    });

    console.log('Result Reply:', result.reply);
    console.log('Draft Entries:', JSON.stringify(result.draft_entries, null, 2));

    assert.ok(result.reply, 'Result must have reply');
    assert.ok(Array.isArray(result.draft_entries), 'Result must have draft_entries');
    assert.ok(result.draft_entries.length >= 1, 'Should have produced at least 1 food entry');

    // Verify tool calls occurred
    const toolCallSteps = steps.filter((s) => s.type === 'tool_call');
    assert.ok(toolCallSteps.length > 0, 'Agent should have executed tool calls');
    console.log(`  Total agentic steps emitted: ${steps.length} (${toolCallSteps.length} tool calls)`);
  });

  await t.test('Scenario 2: Physical Activity logging with 2024 Adult Compendium MET tool calls', async () => {
    const steps = [];
    const messages = [
      { role: 'user', content: 'Did a 45 minute brisk walk in the park' }
    ];

    console.log('\n--- Running Scenario 2: Physical Activity Logging ---');
    const result = await runHealthAgentStream(messages, testProfile, (step) => {
      steps.push(step);
      console.log(`  [Agentic Step: ${step.type.toUpperCase()}] ${step.title}`);
    });

    console.log('Result Reply:', result.reply);
    console.log('Draft Entries:', JSON.stringify(result.draft_entries, null, 2));

    assert.ok(result.reply, 'Result must have reply');
    assert.ok(Array.isArray(result.draft_entries), 'Result must have draft_entries');
    const activityEntry = result.draft_entries.find((e) => e.type === 'activity');
    assert.ok(activityEntry, 'Should produce an activity draft entry');
    assert.ok(activityEntry.calories > 0, 'Activity calories must be > 0');
    assert.ok(activityEntry.durationMin >= 40, 'Duration should reflect ~45 mins');
  });

  await t.test('Scenario 3: Multi-Turn Context Resolution across stateless turns', async () => {
    const steps = [];
    // Simulating Turn 1 followed by user Turn 2 modification
    const messages = [
      { role: 'user', content: 'I ate 2 boiled eggs for breakfast' },
      {
        role: 'assistant',
        content: 'Logged 2 boiled eggs (~144 kcal, 12.6g protein, 0.8g carbs, 9.6g fat). Would you like to confirm this entry?'
      },
      {
        role: 'user',
        content: 'Actually make that 3 boiled eggs, and add 1 medium banana'
      }
    ];

    console.log('\n--- Running Scenario 3: Multi-turn Context Resolution ---');
    const result = await runHealthAgentStream(messages, testProfile, (step) => {
      steps.push(step);
      console.log(`  [Agentic Step: ${step.type.toUpperCase()}] ${step.title}`);
    });

    console.log('Result Reply:', result.reply);
    console.log('Draft Entries:', JSON.stringify(result.draft_entries, null, 2));

    assert.ok(result.reply, 'Result must have reply');
    assert.ok(Array.isArray(result.draft_entries), 'Result must have draft_entries');

    // Find egg entry
    const eggEntry = result.draft_entries.find((e) =>
      e.name.toLowerCase().includes('egg')
    );
    assert.ok(eggEntry, 'Should identify egg in updated telemetry');
    // Calories for 3 eggs ~ 3 * 72 = 216 kcal
    assert.ok(eggEntry.calories >= 180, `Egg calories should reflect 3 eggs (~216 kcal), got ${eggEntry.calories}`);

    // Find banana entry
    const bananaEntry = result.draft_entries.find((e) =>
      e.name.toLowerCase().includes('banana')
    );
    assert.ok(bananaEntry, 'Should identify added banana in multi-turn request');
  });
});
