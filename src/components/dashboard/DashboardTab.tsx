import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2
} from 'lucide-react';
import type { HealthLogRecord, MacroTargets, UserProfile } from '../../types/health';
import { fetchLogs, deleteLogRecord } from '../../services/api';
import { aggregateLogs } from '../../services/calculations';
import {
  format,
  subDays,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isToday
} from 'date-fns';

interface DashboardTabProps {
  userProfile: UserProfile;
  macroTargets: MacroTargets;
  onDataChanged: () => void;
}

type TimeFilter = 'day' | 'week' | 'month';

export const DashboardTab: React.FC<DashboardTabProps> = ({
  userProfile,
  macroTargets,
  onDataChanged
}) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('day');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [logs, setLogs] = useState<HealthLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const { startDateStr, endDateStr, displayTitle } = useMemo(() => {
    if (timeFilter === 'day') {
      const formatted = format(currentDate, 'yyyy-MM-dd');
      const title = isToday(currentDate) ? 'Today' : format(currentDate, 'EEE, MMM d');
      return { startDateStr: formatted, endDateStr: formatted, displayTitle: title };
    } else if (timeFilter === 'week') {
      const s = startOfWeek(currentDate, { weekStartsOn: 1 });
      const e = endOfWeek(currentDate, { weekStartsOn: 1 });
      const title = `${format(s, 'MMM d')} - ${format(e, 'MMM d')}`;
      return {
        startDateStr: format(s, 'yyyy-MM-dd'),
        endDateStr: format(e, 'yyyy-MM-dd'),
        displayTitle: title
      };
    } else {
      const s = startOfMonth(currentDate);
      const e = endOfMonth(currentDate);
      const title = format(currentDate, 'MMMM yyyy');
      return {
        startDateStr: format(s, 'yyyy-MM-dd'),
        endDateStr: format(e, 'yyyy-MM-dd'),
        displayTitle: title
      };
    }
  }, [timeFilter, currentDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchLogs(startDateStr, endDateStr);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDateStr, endDateStr]);

  const handlePrev = () => {
    if (timeFilter === 'day') setCurrentDate((d) => subDays(d, 1));
    else if (timeFilter === 'week') setCurrentDate((d) => subDays(d, 7));
    else setCurrentDate((d) => subDays(d, 30));
  };

  const handleNext = () => {
    if (timeFilter === 'day') setCurrentDate((d) => addDays(d, 1));
    else if (timeFilter === 'week') setCurrentDate((d) => addDays(d, 7));
    else setCurrentDate((d) => addDays(d, 30));
  };

  const handleDelete = async (record: HealthLogRecord) => {
    if (!confirm(`Delete "${record.name}" from telemetry log?`)) return;
    setDeletingKey(record.rowKey);
    try {
      await deleteLogRecord(record.rowKey, record.partitionKey);
      setLogs((prev) => prev.filter((r) => r.rowKey !== record.rowKey));
      onDataChanged();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    } finally {
      setDeletingKey(null);
    }
  };

  const aggregations = useMemo(() => aggregateLogs(logs), [logs]);

  const multiplier = timeFilter === 'week' ? 7 : timeFilter === 'month' ? 30 : 1;
  const scaledTargetCalories = macroTargets.targetCalories * multiplier;
  const scaledProteinTarget = macroTargets.proteinGrams * multiplier;
  const scaledCarbTarget = macroTargets.carbGrams * multiplier;
  const scaledFatTarget = macroTargets.fatGrams * multiplier;
  const scaledFiberTarget = macroTargets.fiberGrams * multiplier;
  const scaledSugarLimit = (macroTargets.sugarLimitGrams || Math.round((macroTargets.targetCalories * 0.1) / 4)) * multiplier;
  const scaledSodiumLimit = (macroTargets.sodiumLimitMg || 2300) * multiplier;

  const isSugarOver = aggregations.totalSugar > scaledSugarLimit;
  const isSodiumOver = aggregations.totalSodiumMg > scaledSodiumLimit;
  const sugarPercent = Math.min(100, Math.round((aggregations.totalSugar / scaledSugarLimit) * 100));
  const sodiumPercent = Math.min(100, Math.round((aggregations.totalSodiumMg / scaledSodiumLimit) * 100));

  const netCalories = aggregations.netCalories;
  const remainingBudget = scaledTargetCalories - netCalories;
  const caloriePercent = Math.min(
    100,
    Math.max(0, Math.round((netCalories / scaledTargetCalories) * 100))
  );

  return (
    <div className="max-w-2xl mx-auto w-full p-4 sm:p-5 space-y-4">
      {/* Time Filter & Navigator Header (Uniform 34px height controls) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-[5px] border border-[rgba(255,255,255,0.3)] bg-transparent">
        {/* Segmented controls - Equal 3 columns on mobile, compact on desktop */}
        <div className="h-[34px] w-full sm:w-auto grid grid-cols-3 sm:flex items-center p-0.5 border border-[rgba(255,255,255,0.35)] rounded-[5px] bg-transparent">
          {(['day', 'week', 'month'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`h-full px-2 sm:px-3.5 rounded-[3px] text-[0.76rem] uppercase tracking-wider transition-all duration-300 flex items-center justify-center leading-none ${
                timeFilter === filter
                  ? 'border border-white text-white opacity-100 font-medium'
                  : 'text-white opacity-50 hover:opacity-100 border border-transparent'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Date Navigator - Full-width flex on mobile, compact on desktop */}
        <div className="w-full sm:w-auto flex items-center space-x-2">
          {/* Segmented Stepper */}
          <div className="h-[34px] flex-1 sm:flex-initial inline-flex items-stretch border border-[rgba(255,255,255,0.35)] rounded-[5px] overflow-hidden bg-transparent">
            <button
              onClick={handlePrev}
              aria-label="Previous date"
              className="w-[34px] flex items-center justify-center text-white opacity-50 hover:opacity-100 hover:bg-white/5 transition-colors border-r border-[rgba(255,255,255,0.2)]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 flex-1 sm:flex-initial flex items-center justify-center min-w-[100px] sm:min-w-[125px] text-[0.855rem] font-medium text-white tracking-wide select-none leading-none text-center">
              {displayTitle}
            </div>

            <button
              onClick={handleNext}
              aria-label="Next date"
              className="w-[34px] flex items-center justify-center text-white opacity-50 hover:opacity-100 hover:bg-white/5 transition-colors border-l border-[rgba(255,255,255,0.2)]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            title="Refresh telemetry"
            aria-label="Refresh telemetry"
            className="w-[34px] h-[34px] rounded-[5px] border border-[rgba(255,255,255,0.35)] hover:border-white text-white opacity-50 hover:opacity-100 transition-all duration-300 flex items-center justify-center shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Energy Balance Instrument Panel Card */}
      <div className="p-4 sm:p-5 rounded-[5px] border border-[rgba(255,255,255,0.5)] hover:border-white bg-transparent transition-colors duration-300 space-y-4">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.2)] pb-3">
          <div>
            <h3 className="text-[0.95rem] font-medium uppercase tracking-wide text-white">
              Energy Balance Telemetry
            </h3>
            <p className="text-[0.76rem] text-white/50 mt-0.5">
              Net Calorie Target: {scaledTargetCalories} kcal
            </p>
          </div>

          {/* Calorie Left Badge - Uniform h-[24px] */}
          <div className="h-[24px] px-2.5 rounded-[5px] border border-[rgba(255,255,255,0.35)] inline-flex items-center space-x-1.5">
            <div
              className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${
                remainingBudget >= 0 ? 'bg-[#008000]' : 'bg-[#FF0000]'
              }`}
              aria-hidden="true"
            />
            <span className="text-[0.76rem] font-medium text-white whitespace-nowrap leading-none">
              {remainingBudget >= 0 ? `${remainingBudget} kcal left` : `${Math.abs(remainingBudget)} kcal over`}
            </span>
          </div>
        </div>

        {/* 3 Metrics Row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 border border-[rgba(255,255,255,0.2)] rounded-[5px]">
            <span className="text-[0.76rem] uppercase tracking-wider text-white/50 block mb-1">
              Gross Intake
            </span>
            <span className="text-[1.425rem] font-medium text-white leading-none block">
              {aggregations.totalIntakeCalories}
            </span>
            <span className="text-[0.76rem] text-white/40">kcal</span>
          </div>

          <div className="p-3 border border-[rgba(255,255,255,0.2)] rounded-[5px]">
            <span className="text-[0.76rem] uppercase tracking-wider text-white/50 block mb-1">
              Active Burn
            </span>
            <span className="text-[1.425rem] font-medium text-white leading-none block">
              {aggregations.totalActiveCaloriesBurned}
            </span>
            <span className="text-[0.76rem] text-white/40">kcal above BMR</span>
          </div>

          <div className="p-3 border border-[rgba(255,255,255,0.2)] rounded-[5px]">
            <span className="text-[0.76rem] uppercase tracking-wider text-white/50 block mb-1">
              Net Balance
            </span>
            <span className="text-[1.425rem] font-medium text-white leading-none block">
              {netCalories >= 0 ? `+${netCalories}` : netCalories}
            </span>
            <span className="text-[0.76rem] text-white/40">of {scaledTargetCalories}</span>
          </div>
        </div>

        {/* Hairline Progress Gauge */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[0.76rem] text-white/50">
            <span>Utilization: {caloriePercent}%</span>
            <span>Target: {scaledTargetCalories} kcal</span>
          </div>
          <div className="w-full h-[6px] border border-[rgba(255,255,255,0.3)] rounded-[3px] overflow-hidden p-[1px]">
            <div
              className={`h-full transition-all duration-500 rounded-[2px] ${
                netCalories > scaledTargetCalories ? 'bg-[#FF0000]' : 'bg-white'
              }`}
              style={{ width: `${caloriePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Macronutrient Telemetry Panel */}
      <div className="p-4 sm:p-5 rounded-[5px] border border-[rgba(255,255,255,0.5)] hover:border-white bg-transparent transition-colors duration-300 space-y-4">
        <div className="border-b border-[rgba(255,255,255,0.2)] pb-2.5">
          <h3 className="text-[0.95rem] font-medium uppercase tracking-wide text-white">
            Macronutrient Performance
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Protein */}
          <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-3 space-y-2">
            <div className="flex justify-between items-baseline text-[0.855rem]">
              <span className="text-white/70">Protein (ISSN 1.8g/kg)</span>
              <span className="font-medium text-white">
                {Math.round(aggregations.totalProtein)}g / {scaledProteinTarget}g
              </span>
            </div>
            <div className="w-full h-[4px] border border-[rgba(255,255,255,0.25)] rounded-[2px] overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{
                  width: `${Math.min(100, Math.round((aggregations.totalProtein / scaledProteinTarget) * 100))}%`
                }}
              />
            </div>
          </div>

          {/* Carbs */}
          <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-3 space-y-2">
            <div className="flex justify-between items-baseline text-[0.855rem]">
              <span className="text-white/70">Carbohydrates</span>
              <span className="font-medium text-white">
                {Math.round(aggregations.totalCarbs)}g / {scaledCarbTarget}g
              </span>
            </div>
            <div className="w-full h-[4px] border border-[rgba(255,255,255,0.25)] rounded-[2px] overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{
                  width: `${Math.min(100, Math.round((aggregations.totalCarbs / scaledCarbTarget) * 100))}%`
                }}
              />
            </div>
          </div>

          {/* Fat */}
          <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-3 space-y-2">
            <div className="flex justify-between items-baseline text-[0.855rem]">
              <span className="text-white/70">Lipids / Fats (25%)</span>
              <span className="font-medium text-white">
                {Math.round(aggregations.totalFat)}g / {scaledFatTarget}g
              </span>
            </div>
            <div className="w-full h-[4px] border border-[rgba(255,255,255,0.25)] rounded-[2px] overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{
                  width: `${Math.min(100, Math.round((aggregations.totalFat / scaledFatTarget) * 100))}%`
                }}
              />
            </div>
          </div>

          {/* Fiber */}
          <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-3 space-y-2">
            <div className="flex justify-between items-baseline text-[0.855rem]">
              <span className="text-white/70">Dietary Fiber</span>
              <span className="font-medium text-white">
                {Math.round(aggregations.totalFiber)}g / {scaledFiberTarget}g
              </span>
            </div>
            <div className="w-full h-[4px] border border-[rgba(255,255,255,0.25)] rounded-[2px] overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{
                  width: `${Math.min(100, Math.round((aggregations.totalFiber / scaledFiberTarget) * 100))}%`
                }}
              />
            </div>
          </div>
        </div>

        {/* Daily Intake Ceilings (Sugar & Sodium Upper Limits) */}
        <div className="pt-2.5 border-t border-[rgba(255,255,255,0.15)] space-y-2">
          <div className="flex items-center justify-between text-[0.76rem] text-white/50 uppercase tracking-wider">
            <span>Intake Ceilings (Stay Under Limits)</span>
            <span className="text-[0.7rem] text-white/40">Clinical Thresholds</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Total Sugars Limit */}
            <div
              className={`border rounded-[5px] p-3 space-y-2 transition-colors ${
                isSugarOver ? 'border-[#FF0000]/60' : 'border-[rgba(255,255,255,0.2)]'
              }`}
            >
              <div className="flex justify-between items-baseline text-[0.855rem]">
                <div className="flex items-center space-x-1.5">
                  <span className="text-white/70">Total Sugars</span>
                  <span
                    className={`text-[0.7rem] px-1.5 py-0.2 rounded-[3px] border uppercase leading-none ${
                      isSugarOver
                        ? 'border-[#FF0000]/60 text-[#FF0000]'
                        : 'border-[rgba(255,255,255,0.2)] text-white/40'
                    }`}
                  >
                    {isSugarOver ? 'Exceeded' : 'Max Limit'}
                  </span>
                </div>
                <div className="flex items-baseline space-x-1">
                  <span className={`font-medium ${isSugarOver ? 'text-[#FF0000]' : 'text-white'}`}>
                    {Math.round(aggregations.totalSugar)}g
                  </span>
                  <span className="text-white/40 text-[0.76rem]">
                    / {scaledSugarLimit}g max
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-[4px] border border-[rgba(255,255,255,0.25)] rounded-[2px] overflow-hidden">
                <div
                  className={`h-full transition-all ${isSugarOver ? 'bg-[#FF0000]' : 'bg-white'}`}
                  style={{ width: `${sugarPercent}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[0.7rem]">
                <span className="text-white/40">WHO ceiling: &lt;10% calories</span>
                <span className={isSugarOver ? 'text-[#FF0000] font-medium' : 'text-white/50'}>
                  {isSugarOver
                    ? `+${Math.round(aggregations.totalSugar - scaledSugarLimit)}g over limit`
                    : `${Math.round(scaledSugarLimit - aggregations.totalSugar)}g remaining`}
                </span>
              </div>
            </div>

            {/* Sodium Limit */}
            <div
              className={`border rounded-[5px] p-3 space-y-2 transition-colors ${
                isSodiumOver ? 'border-[#FF0000]/60' : 'border-[rgba(255,255,255,0.2)]'
              }`}
            >
              <div className="flex justify-between items-baseline text-[0.855rem]">
                <div className="flex items-center space-x-1.5">
                  <span className="text-white/70">Sodium</span>
                  <span
                    className={`text-[0.7rem] px-1.5 py-0.2 rounded-[3px] border uppercase leading-none ${
                      isSodiumOver
                        ? 'border-[#FF0000]/60 text-[#FF0000]'
                        : 'border-[rgba(255,255,255,0.2)] text-white/40'
                    }`}
                  >
                    {isSodiumOver ? 'Exceeded' : 'Max Limit'}
                  </span>
                </div>
                <div className="flex items-baseline space-x-1">
                  <span className={`font-medium ${isSodiumOver ? 'text-[#FF0000]' : 'text-white'}`}>
                    {Math.round(aggregations.totalSodiumMg)}mg
                  </span>
                  <span className="text-white/40 text-[0.76rem]">
                    / {scaledSodiumLimit}mg max
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-[4px] border border-[rgba(255,255,255,0.25)] rounded-[2px] overflow-hidden">
                <div
                  className={`h-full transition-all ${isSodiumOver ? 'bg-[#FF0000]' : 'bg-white'}`}
                  style={{ width: `${sodiumPercent}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[0.7rem]">
                <span className="text-white/40">AHA/FDA CDRR: &lt;2300mg</span>
                <span className={isSodiumOver ? 'text-[#FF0000] font-medium' : 'text-white/50'}>
                  {isSodiumOver
                    ? `+${Math.round(aggregations.totalSodiumMg - scaledSodiumLimit)}mg over limit`
                    : `${Math.round(scaledSodiumLimit - aggregations.totalSodiumMg)}mg remaining`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chronological Log Journal */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[0.76rem] uppercase tracking-wider text-white/50 font-medium">
            Recorded Telemetry Logs ({logs.length})
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="p-6 text-center rounded-[5px] border border-[rgba(255,255,255,0.25)] text-white/50 space-y-1">
            <p className="text-[0.855rem]">No logs registered for this timeframe.</p>
            <p className="text-[0.76rem] text-white/40">
              Transmit consumption or workout data via the Chat tab.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((item) => {
              const isFood = item.type === 'food';
              return (
                <div
                  key={item.rowKey}
                  className="p-3 rounded-[5px] border border-[rgba(255,255,255,0.25)] hover:border-white transition-colors duration-300 flex items-center justify-between group bg-transparent"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-[8px] h-[8px] rounded-full ${
                        isFood ? 'bg-[#3FB950]' : 'bg-[#E3B341]'
                      }`}
                      aria-hidden="true"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[0.95rem] font-medium text-white capitalize">
                          {item.name}
                        </span>
                        <span className="text-[0.76rem] px-1.5 py-0.2 rounded-[3px] border border-[rgba(255,255,255,0.2)] text-white/50 uppercase">
                          {item.mealType || (isFood ? 'food' : 'activity')}
                        </span>
                      </div>
                      <div className="text-[0.76rem] text-white/50 flex items-center space-x-2 mt-0.5">
                        <span>{item.servingInfo || (item.durationMin ? `${item.durationMin}m` : '')}</span>
                        {isFood ? (
                          <span>
                            • P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g | Fib: {item.fiber}g
                          </span>
                        ) : (
                          <span>
                            • {item.metValue} MET ({item.activeCalories} net kcal)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <span className="text-[0.95rem] font-medium text-white">
                        {isFood ? `+${item.calories}` : `-${item.calories}`}
                      </span>
                      <span className="text-[0.76rem] text-white/50 ml-1">kcal</span>
                    </div>

                    <button
                      onClick={() => handleDelete(item)}
                      disabled={deletingKey === item.rowKey}
                      title="Delete log"
                      aria-label="Delete entry"
                      className="p-1.5 rounded-[5px] border border-[rgba(255,255,255,0.25)] text-white opacity-40 hover:opacity-100 transition-opacity duration-300 disabled:opacity-10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
