import assert from 'node:assert';
import test from 'node:test';
import { cosmosService } from '../api/dist/src/services/cosmosService.js';

test('CosmosService: insertEntry and query live Cosmos DB', async () => {
  const testUserId = `test_user_${Date.now()}`;
  const record = await cosmosService.insertEntry(
    {
      type: 'food',
      name: 'Wild Alaskan Salmon',
      calories: 420,
      protein: 44,
      carbs: 0,
      fat: 26,
      fiber: 0,
      sugar: 0,
      sodiumMg: 350,
      mealType: 'dinner',
      durationMin: 0,
      metValue: 0,
      activeCalories: 0,
      modality: 'none',
      intensity: 'none',
      servingInfo: '200g fillet',
      details: 'Rich in omega-3'
    },
    'grilled salmon dinner',
    testUserId
  );

  assert.ok(record.rowKey);
  assert.strictEqual(record.name, 'Wild Alaskan Salmon');
  assert.strictEqual(record.calories, 420);
  assert.strictEqual(record.protein, 44);

  // Retrieve logs for this test user
  const logs = await cosmosService.getLogs(undefined, undefined, testUserId);
  assert.ok(logs.length >= 1);
  const found = logs.find((l) => l.rowKey === record.rowKey);
  assert.ok(found);
  assert.strictEqual(found.name, 'Wild Alaskan Salmon');

  // Clean up
  const deleted = await cosmosService.deleteLog(record.rowKey, testUserId);
  assert.strictEqual(deleted, true);
});

test('CosmosService: batch insert and point delete', async () => {
  const testUserId = `test_user_${Date.now()}`;
  const batch = [
    {
      type: 'food',
      name: 'Greek Yogurt Bowl',
      calories: 180,
      protein: 18,
      carbs: 12,
      fat: 4,
      fiber: 2,
      sugar: 8,
      sodiumMg: 65,
      mealType: 'breakfast',
      durationMin: 0,
      metValue: 0,
      activeCalories: 0,
      modality: 'none',
      intensity: 'none',
      servingInfo: '150g',
      details: ''
    },
    {
      type: 'activity',
      name: 'Tempo Run',
      calories: 380,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodiumMg: 0,
      mealType: 'workout',
      durationMin: 35,
      metValue: 9.0,
      activeCalories: 330,
      modality: 'cardio',
      intensity: 'vigorous',
      servingInfo: '5.5 km',
      details: 'Threshold pace'
    }
  ];

  const inserted = await cosmosService.insertBatch(batch, 'yogurt and run', testUserId);
  assert.strictEqual(inserted.length, 2);

  // Delete first item
  const toDelete = inserted[0];
  const deleted = await cosmosService.deleteLog(toDelete.rowKey, testUserId);
  assert.strictEqual(deleted, true);

  const remaining = await cosmosService.getLogs(undefined, undefined, testUserId);
  const deletedItem = remaining.find((l) => l.rowKey === toDelete.rowKey);
  assert.strictEqual(deletedItem, undefined);

  // Clean up second item
  await cosmosService.deleteLog(inserted[1].rowKey, testUserId);
});

test('CosmosService: Profile upsert and retrieval', async () => {
  const testUserId = `test_user_profile_${Date.now()}`;
  const profilePayload = {
    age: 25,
    sex: 'male',
    weightKg: 76,
    heightCm: 181,
    activityLevel: 'moderate',
    strategy: 'maintain',
    targets: {
      bmr: 1750,
      tdee: 2400,
      targetCalories: 2400,
      targetProtein: 160,
      targetCarbs: 270,
      targetFat: 80,
      sugarCeiling: 60,
      sodiumCeilingMg: 2300
    }
  };

  const saved = await cosmosService.upsertProfile(profilePayload, testUserId);
  assert.strictEqual(saved.userId, testUserId);
  assert.strictEqual(saved.docType, 'profile');
  assert.strictEqual(saved.targets.targetCalories, 2400);

  const fetched = await cosmosService.getProfile(testUserId);
  assert.ok(fetched);
  assert.strictEqual(fetched.targets.targetCalories, 2400);
});
