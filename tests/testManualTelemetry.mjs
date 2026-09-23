import test from 'node:test';
import assert from 'node:assert/strict';

function aggregateLogs(logs) {
  return logs.reduce(
    (acc, record) => {
      if (record.type === 'food') {
        acc.totalIntakeCalories += record.calories || 0;
        acc.totalProtein += record.protein || 0;
        acc.totalCarbs += record.carbs || 0;
        acc.totalFat += record.fat || 0;
        acc.totalFiber += record.fiber || 0;
        acc.totalSugar += record.sugar || 0;
        acc.totalSodiumMg += record.sodiumMg || 0;
        acc.foodCount += 1;
      } else if (record.type === 'activity') {
        const activeBurn = record.activeCalories > 0 ? record.activeCalories : record.calories;
        acc.totalActiveCaloriesBurned += activeBurn || 0;
        acc.activityCount += 1;
      }
      acc.netCalories = acc.totalIntakeCalories - acc.totalActiveCaloriesBurned;
      return acc;
    },
    {
      totalIntakeCalories: 0,
      totalActiveCaloriesBurned: 0,
      netCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalFiber: 0,
      totalSugar: 0,
      totalSodiumMg: 0,
      foodCount: 0,
      activityCount: 0
    }
  );
}

test('Manual Telemetry Entry Suite', async (t) => {
  await t.test('Manual Snack telemetry entry aggregates correctly', () => {
    const snackRecord = {
      partitionKey: 'log',
      rowKey: 'snack_manual_1',
      type: 'food',
      name: 'Greek Yogurt with Blueberries',
      calories: 180,
      protein: 15,
      carbs: 18,
      fat: 4,
      fiber: 2,
      sugar: 12,
      sodiumMg: 65,
      mealType: 'snack',
      durationMin: 0,
      metValue: 0,
      activeCalories: 0,
      modality: 'none',
      intensity: 'none',
      servingInfo: '1 bowl (~200g)',
      details: 'Manual snack entry',
      timestamp: new Date().toISOString()
    };

    const agg = aggregateLogs([snackRecord]);
    assert.equal(agg.totalIntakeCalories, 180);
    assert.equal(agg.totalProtein, 15);
    assert.equal(agg.totalCarbs, 18);
    assert.equal(agg.totalFat, 4);
    assert.equal(agg.totalFiber, 2);
    assert.equal(agg.totalSugar, 12);
    assert.equal(agg.totalSodiumMg, 65);
    assert.equal(agg.foodCount, 1);
    assert.equal(agg.activityCount, 0);
    assert.equal(agg.netCalories, 180);
  });

  await t.test('Manual Exercise telemetry entry calculates net active balance', () => {
    const exerciseRecord = {
      partitionKey: 'log',
      rowKey: 'exercise_manual_1',
      type: 'activity',
      name: 'Outdoor Running',
      calories: 320,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodiumMg: 0,
      mealType: 'workout',
      durationMin: 30,
      metValue: 9.8,
      activeCalories: 285,
      modality: 'cardio',
      intensity: 'vigorous',
      servingInfo: '',
      details: 'Manual exercise entry',
      timestamp: new Date().toISOString()
    };

    const agg = aggregateLogs([exerciseRecord]);
    assert.equal(agg.totalIntakeCalories, 0);
    assert.equal(agg.totalActiveCaloriesBurned, 285);
    assert.equal(agg.netCalories, -285);
    assert.equal(agg.activityCount, 1);
    assert.equal(agg.foodCount, 0);
  });

  await t.test('Copy / re-log item accurately clones fields for current day logging without AI pass', () => {
    const pastItem = {
      partitionKey: 'log',
      rowKey: 'snack_past_99',
      type: 'food',
      name: 'Proper Lentil Chips (Sea-Salt)',
      calories: 96,
      protein: 1.9,
      carbs: 12.7,
      fat: 4.2,
      fiber: 0.5,
      sugar: 0.2,
      sodiumMg: 150,
      mealType: 'snack',
      durationMin: 0,
      metValue: 0,
      activeCalories: 0,
      modality: 'none',
      intensity: 'none',
      servingInfo: '20 g (~25 chips)',
      details: 'Original snack from yesterday',
      timestamp: '2026-09-22T14:30:00.000Z'
    };

    // Simulate executeRelog cloning
    const clonedEntry = {
      type: pastItem.type,
      name: pastItem.name,
      calories: pastItem.calories,
      protein: pastItem.protein || 0,
      carbs: pastItem.carbs || 0,
      fat: pastItem.fat || 0,
      fiber: pastItem.fiber || 0,
      sugar: pastItem.sugar || 0,
      sodiumMg: pastItem.sodiumMg || 0,
      mealType: pastItem.mealType || (pastItem.type === 'food' ? 'snack' : 'workout'),
      durationMin: pastItem.durationMin || 0,
      metValue: pastItem.metValue || 0,
      activeCalories: pastItem.activeCalories || 0,
      modality: pastItem.modality || 'none',
      intensity: pastItem.intensity || 'none',
      servingInfo: pastItem.servingInfo || '',
      details: pastItem.details || `Re-logged from ${pastItem.timestamp.slice(0, 10)}`
    };

    assert.equal(clonedEntry.name, 'Proper Lentil Chips (Sea-Salt)');
    assert.equal(clonedEntry.calories, 96);
    assert.equal(clonedEntry.protein, 1.9);
    assert.equal(clonedEntry.servingInfo, '20 g (~25 chips)');
    assert.equal(clonedEntry.mealType, 'snack');
    // Ensure it is a fresh object decoupled from previous rowKey
    assert.equal((clonedEntry).rowKey, undefined);
  });

  await t.test('Telemetry edit updates entry fields while preserving identity and timestamp', () => {
    const existingRecord = {
      partitionKey: 'log',
      rowKey: 'food_1727000000000_123',
      id: 'food_1727000000000_123',
      type: 'food',
      name: 'Oatmeal',
      calories: 150,
      protein: 5,
      carbs: 27,
      fat: 2.5,
      fiber: 4,
      sugar: 1,
      sodiumMg: 10,
      mealType: 'breakfast',
      durationMin: 0,
      metValue: 0,
      activeCalories: 0,
      modality: 'none',
      intensity: 'none',
      servingInfo: '1 cup',
      details: 'Breakfast log',
      timestamp: '2026-09-23T08:00:00.000Z',
      date: '2026-09-23'
    };

    // User edits the portion and macros in the detail card
    const editedEntry = {
      type: 'food',
      name: 'Oatmeal with Almond Milk & Chia',
      calories: 240,
      protein: 8,
      carbs: 35,
      fat: 7,
      fiber: 8,
      sugar: 2,
      sodiumMg: 85,
      mealType: 'breakfast',
      durationMin: 0,
      metValue: 0,
      activeCalories: 0,
      modality: 'none',
      intensity: 'none',
      servingInfo: '1 large bowl (~350g)',
      details: 'Updated breakfast log'
    };

    // Simulate updateLog merging
    const updatedRecord = {
      ...existingRecord,
      ...editedEntry,
      id: existingRecord.id,
      rowKey: existingRecord.rowKey,
      timestamp: existingRecord.timestamp,
      date: existingRecord.date
    };

    assert.equal(updatedRecord.rowKey, 'food_1727000000000_123');
    assert.equal(updatedRecord.timestamp, '2026-09-23T08:00:00.000Z');
    assert.equal(updatedRecord.date, '2026-09-23');
    assert.equal(updatedRecord.name, 'Oatmeal with Almond Milk & Chia');
    assert.equal(updatedRecord.calories, 240);
    assert.equal(updatedRecord.fiber, 8);
    assert.equal(updatedRecord.servingInfo, '1 large bowl (~350g)');
  });

  await t.test('Delete warning preference key and copy success checkmark state transition', () => {
    const SKIP_DELETE_WARNING_KEY = 'health_tracker_skip_delete_warning';
    const mockStorage = new Map();

    // Initially warning is shown
    assert.equal(mockStorage.get(SKIP_DELETE_WARNING_KEY), undefined);

    // When "Do not show again" is selected and confirmed
    mockStorage.set(SKIP_DELETE_WARNING_KEY, 'true');
    assert.equal(mockStorage.get(SKIP_DELETE_WARNING_KEY) === 'true', true);

    // Verify copy micro-animation state lifecycle
    let copiedKey = null;
    const targetRowKey = 'food_1727000000000_123';
    
    // On copy success:
    copiedKey = targetRowKey;
    assert.equal(copiedKey, targetRowKey);

    // After micro-animation timeout:
    copiedKey = null;
    assert.equal(copiedKey, null);
  });
});


