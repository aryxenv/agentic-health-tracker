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
});
