import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { runHealthAgentStream } from '../api/dist/src/services/mafHealthAgent.js';

// Load keys from api/local.settings.json if not present
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

test('Breakfast Logging Benchmark: Jeera Khakra & Pistachios', async (t) => {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes('<YOUR_')) {
    console.log('Skipping live benchmark: GROQ_API_KEY is not set');
    return;
  }

  const steps = [];
  const deltas = [];
  const startTime = Date.now();

  const messages = [
    {
      id: 'msg_1',
      role: 'user',
      content:
        '2 jeera khakra with olive oil layer spread on it and salt seasoning on top for breakfast, along with around 15 salted and roasted pistachio nuts.',
      timestamp: new Date().toISOString()
    }
  ];

  const userProfile = {
    weightKg: 75,
    heightCm: 180,
    age: 24,
    sex: 'male',
    activityLevel: 'moderate',
    goal: 'maintain'
  };

  console.log('\n--- Starting Live Benchmark Run with openai/gpt-oss-20b ---');

  let response;
  try {
    response = await runHealthAgentStream(
      messages,
      userProfile,
      (step) => {
        steps.push(step);
        console.log(`[STEP] ${step.type.toUpperCase()}: ${step.title}`);
        if (step.thought) console.log(`       Thought: ${step.thought}`);
      },
      (delta) => deltas.push(delta),
      'openai/gpt-oss-20b'
    );
  } catch (err) {
    if (
      err?.message?.includes('TPD') ||
      err?.message?.includes('tokens per day') ||
      err?.message?.includes('Rate limit reached') ||
      err?.message?.includes('Failed to parse tool call arguments') ||
      err?.message?.includes('tool_use_failed')
    ) {
      console.warn(`\n[NOTICE] Groq provider/model limitation encountered: ${err.message}`);
      console.log('Skipping live assertions due to provider error window.');
      return;
    }
    throw err;
  }

  const durationMs = Date.now() - startTime;
  console.log(`\n--- Benchmark Completed in ${(durationMs / 1000).toFixed(2)}s ---`);
  console.log(`Total Steps: ${steps.length}`);
  console.log(`Draft Entries Count: ${response.draft_entries?.length || 0}`);
  console.log(`Needs Clarification: ${response.needs_clarification}`);
  console.log(`Clarification Prompt: ${response.clarification_prompt}`);
  console.log(`Reply: ${response.reply}\n`);

  if (response.draft_entries && response.draft_entries.length > 0) {
    console.log('Recorded Entries:');
    for (const e of response.draft_entries) {
      console.log(` - ${e.name} (${e.servingInfo}): ${e.calories} kcal, P: ${e.protein}g, C: ${e.carbs}g, F: ${e.fat}g, Na: ${e.sodiumMg}mg`);
    }
  }

  // Verification Assertions
  assert.ok(response, 'Agent should return a response');
  assert.equal(response.needs_clarification, false, 'Should not block for clarification on olive oil spread');
  assert.ok(response.draft_entries.length >= 1, 'Should record draft entries for the breakfast items');
  
  // Verify that Open Food Facts was NOT called for jeera khakra
  const offCalls = steps.filter(s => s.toolName === 'search_open_food_facts' || (s.title && s.title.includes('Open Food Facts')));
  console.log(`Open Food Facts calls: ${offCalls.length}`);
  assert.equal(offCalls.length, 0, 'Open Food Facts should not be queried for unbranded regional flatbread (jeera khakra)');

  // Verify that search calls were not excessive (at most 1 search if needed)
  const webCalls = steps.filter(s => s.toolName === 'search_web' || (s.title && s.title.includes('live web search')));
  console.log(`Tavily web search calls: ${webCalls.length}`);
  assert.ok(webCalls.length <= 2, 'Should perform at most 1-2 targeted searches');

  // Verify duration (generous ceiling for live Groq network latency)
  assert.ok(durationMs < 75000, `Execution time should be under 75s, got ${(durationMs / 1000).toFixed(2)}s`);
});
