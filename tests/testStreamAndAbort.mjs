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

const { chatHandler } = await import('../api/dist/src/functions/chat.js');

test('Chat Handler SSE Streaming and Abort Suite', async (t) => {
  await t.test('Full SSE Stream with real-time step emission', async () => {
    const mockRequest = {
      method: 'POST',
      url: 'http://localhost:7071/api/chat',
      headers: new Headers({
        'content-type': 'application/json',
        'accept': 'text/event-stream'
      }),
      query: new URLSearchParams(),
      json: async () => ({
        messages: [{ role: 'user', content: '100g oatmeal with 1 cup milk for breakfast' }],
        userProfile: { weightKg: 75, heightCm: 180, age: 28, sex: 'male', activityLevel: 'moderate', goal: 'maintain' },
        stream: true
      })
    };

    const mockContext = {
      log: (...args) => console.log('  [MockLog]', ...args),
      warn: (...args) => console.warn('  [MockWarn]', ...args),
      error: (...args) => console.error('  [MockError]', ...args)
    };

    const response = await chatHandler(mockRequest, mockContext);
    assert.equal(response.status, 200);
    assert.ok(response.headers['Content-Type'].includes('text/event-stream'));

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const events = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = 'message';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.slice(6).trim();
        } else if (trimmed.startsWith('data:')) {
          const rawData = trimmed.slice(5).trim();
          try {
            const data = JSON.parse(rawData);
            events.push({ event: currentEvent, data });
          } catch (_) {}
        }
      }
    }

    const stepEvents = events.filter((e) => e.event === 'step');
    const messageEvents = events.filter((e) => e.event === 'message');
    const doneEvents = events.filter((e) => e.event === 'done');

    console.log(`  Stream emitted: ${stepEvents.length} steps, ${messageEvents.length} message, ${doneEvents.length} done`);
    assert.ok(stepEvents.length > 0, 'Must emit at least one step event');
    assert.equal(messageEvents.length, 1, 'Must emit exactly one final message event');
    assert.equal(doneEvents.length, 1, 'Must emit done event');

    const finalResult = messageEvents[0]?.data;
    console.log('  Final Result:', JSON.stringify(finalResult, null, 2));
    assert.ok(finalResult, 'Must have received a finalResult');
    assert.ok(finalResult.reply, 'Result must contain reply');
    assert.ok(Array.isArray(finalResult.draft_entries), 'Result must contain draft_entries');
    assert.ok(finalResult.draft_entries.length >= 1, 'Must have at least 1 drafted entry');
  });

  await t.test('Client reader cancellation (abort) mid-stream', async () => {
    const mockRequest = {
      method: 'POST',
      url: 'http://localhost:7071/api/chat',
      headers: new Headers({
        'content-type': 'application/json',
        'accept': 'text/event-stream'
      }),
      query: new URLSearchParams(),
      json: async () => ({
        messages: [{ role: 'user', content: '45 minute high intensity circuit training' }],
        userProfile: { weightKg: 75, heightCm: 180, age: 28, sex: 'male', activityLevel: 'moderate', goal: 'maintain' },
        stream: true
      })
    };

    const mockContext = {
      log: () => {},
      warn: () => {},
      error: () => {}
    };

    const response = await chatHandler(mockRequest, mockContext);
    assert.equal(response.status, 200);

    const reader = response.body.getReader();
    // Read the first chunk (first step), then cancel reader to simulate client aborting
    const firstChunk = await reader.read();
    assert.ok(!firstChunk.done, 'Should receive initial chunk');

    // Cancel the stream from client side
    await reader.cancel('User stopped stream');

    // Subsequent read should immediately return done
    const nextChunk = await reader.read();
    assert.equal(nextChunk.done, true, 'Stream should be terminated immediately upon cancel');
    console.log('  Stream successfully aborted mid-stream without crashing.');
  });
});
