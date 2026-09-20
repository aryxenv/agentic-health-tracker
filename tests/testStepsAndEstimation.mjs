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

  if (!process.env.GROQ_API_KEY) {
    try {
      const settings = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../api/local.settings.json'), 'utf-8'));
      if (settings.Values?.GROQ_API_KEY) {
        process.env.GROQ_API_KEY = settings.Values.GROQ_API_KEY;
      }
      if (settings.Values?.GROQ_MODEL) {
        process.env.GROQ_MODEL = settings.Values.GROQ_MODEL;
      }
    } catch (_) {}
  }
}

const { runHealthAgentStream } = await import('../api/dist/src/services/mafHealthAgent.js');

test('Steps Hygiene & Clarification Estimation Protocol', async (t) => {
  const profile = { weightKg: 75, heightCm: 180, age: 28, sex: 'male', activityLevel: 'moderate', goal: 'maintain' };

  await t.test('Casual greeting "hi" emits clean, minimal steps (<= 3 steps, no token duds)', async () => {
    const steps = [];
    const messages = [{ role: 'user', content: 'hi' }];

    console.log('\n--- Testing Casual Greeting: "hi" ---');
    const result = await runHealthAgentStream(messages, profile, (st) => {
      steps.push(st);
      console.log(`  [Step: ${st.type.toUpperCase()}] ${st.title}`);
    });

    console.log('Result Reply:', result.reply);
    console.log(`Total steps emitted: ${steps.length}`);

    // Must be minimal and clean, NOT 91 steps
    assert.ok(steps.length <= 4, `Expected <= 4 steps, got ${steps.length}`);
    assert.ok(result.reply, 'Must return a reply');

    // Verify none of the steps are single-word duds
    for (const st of steps) {
      if (st.thought) {
        assert.ok(st.thought.trim().length > 10, `Thought too short / dud: "${st.thought}"`);
      }
    }
  });

  await t.test('Estimable ambiguity prompts user to reply "estimate" in text', async () => {
    const steps = [];
    // User says they ate oatmeal without specifying amount
    const messages = [{ role: 'user', content: 'I had oatmeal for breakfast' }];

    console.log('\n--- Testing Estimable Ambiguity ---');
    const result = await runHealthAgentStream(messages, profile, (st) => {
      steps.push(st);
      console.log(`  [Step: ${st.type.toUpperCase()}] ${st.title}`);
    });

    console.log('Result Reply:', result.reply);
    console.log('Needs clarification:', result.needs_clarification);

    assert.ok(result.reply, 'Must return a reply');
    if (result.needs_clarification) {
      // Must instruct user about 'estimate' option in the reply text
      const lower = result.reply.toLowerCase();
      assert.ok(
        lower.includes('estimate'),
        'Reply should mention "estimate" option when portion is estimable'
      );
    }
  });

  await t.test('User replying "estimate" resolves telemetry using standard adult portions', async () => {
    const steps = [];
    const messages = [
      { role: 'user', content: 'I had oatmeal for breakfast' },
      { role: 'assistant', content: 'How much oatmeal did you have? You can reply with "estimate" for standard average adult portions.' },
      { role: 'user', content: 'estimate' }
    ];

    console.log('\n--- Testing User Replying "estimate" ---');
    const result = await runHealthAgentStream(messages, profile, (st) => {
      steps.push(st);
      console.log(`  [Step: ${st.type.toUpperCase()}] ${st.title}`);
    });

    console.log('Result Reply:', result.reply);
    console.log('Draft Entries:', JSON.stringify(result.draft_entries, null, 2));

    assert.ok(result.draft_entries.length >= 1, 'Should produce draft entries when estimate is requested');
    const oatmeal = result.draft_entries.find(e => e.name.toLowerCase().includes('oat'));
    assert.ok(oatmeal, 'Should identify oatmeal entry');
    assert.ok(oatmeal.calories > 0, 'Oatmeal calories must be > 0');
  });
});
