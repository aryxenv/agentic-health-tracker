import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node.js test environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) ?? null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};
globalThis.window = globalThis;

const CHAT_STORAGE_KEY = 'health_tracker_chat_messages';

const INITIAL_WELCOME_MESSAGE = {
  id: 'welcome',
  sender: 'health_agent',
  text: "Health Agent initialized. Enter food consumption or physical activity data (e.g., '200g chicken breast and rice' or '30 min brisk walk').",
  timestamp: new Date().toISOString(),
};

function getStoredChatMessages() {
  if (typeof window === 'undefined') {
    return [INITIAL_WELCOME_MESSAGE];
  }
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [INITIAL_WELCOME_MESSAGE];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [INITIAL_WELCOME_MESSAGE];
  } catch (err) {
    return [INITIAL_WELCOME_MESSAGE];
  }
}

function saveStoredChatMessages(messages) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch (err) {}
}

function clearStoredChatMessages() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch (err) {}
}

test('Chat LocalStorage Persistence Suite', async (t) => {
  mockStorage.clear();

  await t.test('Initial load returns default welcome message when storage is empty', () => {
    const messages = getStoredChatMessages();
    assert.equal(messages.length, 1);
    assert.equal(messages[0].id, 'welcome');
    assert.equal(messages[0].sender, 'health_agent');
  });

  await t.test('Saving messages persists full message history including draft cards and steps', () => {
    const testMessages = [
      INITIAL_WELCOME_MESSAGE,
      {
        id: 'msg_1',
        sender: 'user',
        text: 'I ate 150g chicken breast and 1 cup rice',
        timestamp: '2026-09-20T00:00:00.000Z'
      },
      {
        id: 'msg_2',
        sender: 'health_agent',
        text: 'Logged your chicken and rice.',
        timestamp: '2026-09-20T00:00:02.000Z',
        draftEntries: [
          { type: 'food', name: 'chicken breast', calories: 248, protein: 46.5 }
        ],
        agenticSteps: [
          { id: 'step_1', type: 'thought', title: 'Deconstructing request...' }
        ],
        isConfirmed: true
      }
    ];

    saveStoredChatMessages(testMessages);
    const retrieved = getStoredChatMessages();

    assert.equal(retrieved.length, 3);
    assert.equal(retrieved[1].text, 'I ate 150g chicken breast and 1 cup rice');
    assert.equal(retrieved[2].draftEntries.length, 1);
    assert.equal(retrieved[2].draftEntries[0].calories, 248);
    assert.equal(retrieved[2].isConfirmed, true);
    assert.equal(retrieved[2].agenticSteps.length, 1);
  });

  await t.test('+ New Chat clears stored messages and restores fresh welcome state', () => {
    // Verify storage currently has 3 messages
    assert.equal(getStoredChatMessages().length, 3);

    // Trigger New Chat clear
    clearStoredChatMessages();

    // Pulled messages should now be fresh welcome message
    const reset = getStoredChatMessages();
    assert.equal(reset.length, 1);
    assert.equal(reset[0].id, 'welcome');
  });

  await t.test('Corrupted localStorage JSON falls back gracefully without throwing', () => {
    globalThis.localStorage.setItem('health_tracker_chat_messages', 'INVALID_JSON_CORRUPTED');
    const fallback = getStoredChatMessages();
    assert.equal(fallback.length, 1);
    assert.equal(fallback[0].id, 'welcome');
  });
});
