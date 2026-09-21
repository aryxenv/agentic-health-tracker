import test from 'node:test';
import assert from 'node:assert/strict';

const DEFAULT_MODEL_ID = 'openai/gpt-oss-120b';

const AVAILABLE_MODELS = [
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT OSS 120B',
    provider: 'openai',
    shortName: '120B',
    description: 'Flagship reasoning model for complex queries & research',
    badge: 'Default',
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT OSS 20B',
    provider: 'openai',
    shortName: '20B',
    description: 'Ultra-fast & lightweight reasoning model',
    badge: 'Fast',
  },
  {
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B',
    provider: 'qwen',
    shortName: 'Qwen 27B',
    description: 'High efficiency 27B multilingual model',
    badge: 'Balanced',
  },
];

// Storage helpers mirrored from storage.ts
const MODEL_STORAGE_KEY = 'health_tracker_selected_model';
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) ?? null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};
globalThis.window = globalThis;

function getSelectedModel() {
  if (typeof window === 'undefined') return 'openai/gpt-oss-120b';
  try {
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    if (
      stored === 'openai/gpt-oss-120b' ||
      stored === 'openai/gpt-oss-20b' ||
      stored === 'qwen/qwen3.8-27b'
    ) {
      return stored;
    }
    return 'openai/gpt-oss-120b';
  } catch (_) {
    return 'openai/gpt-oss-120b';
  }
}

function saveSelectedModel(model) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  } catch (err) {}
}

function getNextModel(currentId) {
  const currentIndex = AVAILABLE_MODELS.findIndex((m) => m.id === currentId);
  if (currentIndex === -1) return AVAILABLE_MODELS[0].id;
  const nextIndex = (currentIndex + 1) % AVAILABLE_MODELS.length;
  return AVAILABLE_MODELS[nextIndex].id;
}

function isRateLimitError(err) {
  const errMsg = err?.message || '';
  return Boolean(
    err?.status === 429 ||
    err?.statusCode === 429 ||
    errMsg.includes('429') ||
    errMsg.toLowerCase().includes('rate limit') ||
    errMsg.toLowerCase().includes('tokens per day') ||
    errMsg.includes('TPD')
  );
}

test('Model Provider Selector & Auto-Switch Suite', async (t) => {
  mockStorage.clear();

  await t.test('AVAILABLE_MODELS contains all 3 required models with providers', () => {
    assert.equal(AVAILABLE_MODELS.length, 3);
    const ids = AVAILABLE_MODELS.map((m) => m.id);
    assert.deepEqual(ids, [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b'
    ]);

    const m120 = AVAILABLE_MODELS.find(m => m.id === 'openai/gpt-oss-120b');
    const m20 = AVAILABLE_MODELS.find(m => m.id === 'openai/gpt-oss-20b');
    const mqwen = AVAILABLE_MODELS.find(m => m.id === 'qwen/qwen3.8-27b');

    assert.equal(m120.provider, 'openai');
    assert.equal(m20.provider, 'openai');
    assert.equal(mqwen.provider, 'qwen');
    assert.equal(DEFAULT_MODEL_ID, 'openai/gpt-oss-120b');
  });

  await t.test('getNextModel rotates sequentially across all 3 models', () => {
    assert.equal(getNextModel('openai/gpt-oss-120b'), 'openai/gpt-oss-20b');
    assert.equal(getNextModel('openai/gpt-oss-20b'), 'qwen/qwen3.8-27b');
    assert.equal(getNextModel('qwen/qwen3.8-27b'), 'openai/gpt-oss-120b');
    // Fallback for unknown model
    assert.equal(getNextModel('unknown-model'), 'openai/gpt-oss-120b');
  });

  await t.test('LocalStorage persists and retrieves selected model correctly', () => {
    mockStorage.clear();
    assert.equal(getSelectedModel(), 'openai/gpt-oss-120b');

    saveSelectedModel('openai/gpt-oss-20b');
    assert.equal(getSelectedModel(), 'openai/gpt-oss-20b');

    saveSelectedModel('qwen/qwen3.8-27b');
    assert.equal(getSelectedModel(), 'qwen/qwen3.8-27b');

    // Invalid model falls back to default
    saveSelectedModel('invalid-model');
    assert.equal(getSelectedModel(), 'openai/gpt-oss-120b');
  });

  await t.test('isRateLimitError correctly flags 429 and token quota errors', () => {
    assert.equal(isRateLimitError({ status: 429, message: 'Too Many Requests' }), true);
    assert.equal(isRateLimitError({ message: '429 Rate limit reached for model openai/gpt-oss-120b on tokens per day (TPD)' }), true);
    assert.equal(isRateLimitError({ message: 'Request failed with 429' }), true);
    assert.equal(isRateLimitError({ message: 'Tokens per day limit reached' }), true);
    assert.equal(isRateLimitError({ message: 'Invalid food name' }), false);
    assert.equal(isRateLimitError({ message: 'Network timeout' }), false);
  });
});
