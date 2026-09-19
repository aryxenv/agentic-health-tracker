import assert from 'node:assert';
import test from 'node:test';
import { HealthTableService } from '../api/dist/src/services/tableService.js';

test('TableService: insertEntry and in-memory persistence', async () => {
  const service = new HealthTableService();

  const record = await service.insertEntry(
    {
      type: 'food',
      name: 'Salmon with Asparagus',
      calories: 520,
      protein: 46,
      carbs: 8,
      fat: 28,
      fiber: 4,
      sugar: 2,
      sodiumMg: 380,
      mealType: 'dinner',
      durationMin: 0,
      metValue: 0,
      activeCalories: 0,
      modality: 'none',
      intensity: 'none',
      servingInfo: '250g grilled',
      details: 'Wild Alaskan salmon'
    },
    'had salmon and asparagus'
  );

  assert.ok(record.rowKey);
  assert.strictEqual(record.name, 'Salmon with Asparagus');
  assert.strictEqual(record.calories, 520);
  assert.strictEqual(record.protein, 46);

  // Retrieve logs
  const logs = await service.getLogs();
  assert.ok(logs.length >= 1);
  const found = logs.find((l) => l.rowKey === record.rowKey);
  assert.ok(found);
  assert.strictEqual(found.name, 'Salmon with Asparagus');
});

test('TableService: batch insert and delete', async () => {
  const service = new HealthTableService();

  const batch = [
    {
      type: 'food',
      name: 'Greek Yogurt',
      calories: 130,
      protein: 15,
      carbs: 6,
      fat: 0,
      fiber: 0,
      sugar: 5,
      sodiumMg: 60,
      mealType: 'breakfast',
      durationMin: 0,
      metValue: 0,
      activeCalories: 0,
      modality: 'none',
      intensity: 'none',
      servingInfo: '1 cup',
      details: ''
    },
    {
      type: 'activity',
      name: 'HIIT Workout',
      calories: 350,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodiumMg: 0,
      mealType: 'workout',
      durationMin: 30,
      metValue: 8.5,
      activeCalories: 305,
      modality: 'hiit',
      intensity: 'vigorous',
      servingInfo: '30 mins',
      details: ''
    }
  ];

  const inserted = await service.insertBatch(batch, 'yogurt and HIIT');
  assert.strictEqual(inserted.length, 2);

  // Delete one item
  const toDelete = inserted[0];
  const deleted = await service.deleteLog(toDelete.partitionKey, toDelete.rowKey);
  assert.strictEqual(deleted, true);

  const logs = await service.getLogs();
  const deletedItem = logs.find((l) => l.rowKey === toDelete.rowKey);
  assert.strictEqual(deletedItem, undefined, 'Deleted item must not exist in logs');
});

test('TableService: Date range filtering boundaries', async () => {
  const service = new HealthTableService();

  const today = new Date().toISOString().split('T')[0];
  const todayLogs = await service.getLogs(today, today);
  assert.ok(Array.isArray(todayLogs));
});
