import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  Plus,
  Activity,
  Utensils,
  Check,
  Copy,
  Loader2
} from 'lucide-react';
import type { HealthLogRecord, MacroTargets, UserProfile, DraftEntry } from '../../types/health';
import { fetchLogs, deleteLogRecord, saveLogEntries } from '../../services/api';
import { aggregateLogs } from '../../services/calculations';
import { ManualTelemetryCard } from './ManualTelemetryCard';
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
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [manualEntryType, setManualEntryType] = useState<'food' | 'activity' | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const [reloggingKey, setReloggingKey] = useState<string | null>(null);
  const [pendingRelogItem, setPendingRelogItem] = useState<HealthLogRecord | null>(null);
  const [dontShowRelogWarning, setDontShowRelogWarning] = useState<boolean>(false);
  const [editingLogKey, setEditingLogKey] = useState<string | null>(null);

  const SKIP_RELOG_WARNING_KEY = 'health_tracker_skip_relog_warning';

  const executeRelog = async (item: HealthLogRecord) => {
    setReloggingKey(item.rowKey);
    try {
      const entry: DraftEntry = {
        type: item.type,
        name: item.name,
        calories: item.calories,
        protein: item.protein || 0,
        carbs: item.carbs || 0,
        fat: item.fat || 0,
        fiber: item.fiber || 0,
        sugar: item.sugar || 0,
        sodiumMg: item.sodiumMg || 0,
        mealType: item.mealType || (item.type === 'food' ? 'snack' : 'workout'),
        durationMin: item.durationMin || 0,
        metValue: item.metValue || 0,
        activeCalories: item.activeCalories || 0,
        modality: item.modality || 'none',
        intensity: item.intensity || 'none',
        servingInfo: item.servingInfo || '',
        details: item.details || `Re-logged from ${item.timestamp ? String(item.timestamp).slice(0, 10) : 'previous entry'}`
      };

      await saveLogEntries([entry]);
      loadData();
      onDataChanged();
    } catch (err: any) {
      console.error('Failed to re-log item:', err);
      alert(`Re-log failure: ${err.message || 'Unknown error'}`);
    } finally {
      setReloggingKey(null);
    }
  };

  const handleRelogClick = (item: HealthLogRecord) => {
    let skipWarning = false;
    try {
      skipWarning = localStorage.getItem(SKIP_RELOG_WARNING_KEY) === 'true';
    } catch (_) {}

    if (skipWarning) {
      executeRelog(item);
    } else {
      setPendingRelogItem(item);
      setDontShowRelogWarning(false);
    }
  };

  const handleConfirmRelog = () => {
    if (!pendingRelogItem) return;
    if (dontShowRelogWarning) {
      try {
        localStorage.setItem(SKIP_RELOG_WARNING_KEY, 'true');
      } catch (_) {}
    }
    const itemToRelog = pendingRelogItem;
    setPendingRelogItem(null);
    executeRelog(itemToRelog);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingRelogItem) {
          setPendingRelogItem(null);
        } else if (isAddMenuOpen) {
          setIsAddMenuOpen(false);
        } else if (editingLogKey) {
          setEditingLogKey(null);
        }
      }
    };

    if (isAddMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    if (isAddMenuOpen || pendingRelogItem || editingLogKey) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddMenuOpen, pendingRelogItem, editingLogKey]);

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
              Net Calorie Target: {Math.round(scaledTargetCalories)} kcal
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
              {Math.round(remainingBudget) >= 0 ? `${Math.round(remainingBudget)} kcal left` : `${Math.abs(Math.round(remainingBudget))} kcal over`}
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
              {Math.round(aggregations.totalIntakeCalories)}
            </span>
            <span className="text-[0.76rem] text-white/40">kcal</span>
          </div>

          <div className="p-3 border border-[rgba(255,255,255,0.2)] rounded-[5px]">
            <span className="text-[0.76rem] uppercase tracking-wider text-white/50 block mb-1">
              Active Burn
            </span>
            <span className="text-[1.425rem] font-medium text-white leading-none block">
              {Math.round(aggregations.totalActiveCaloriesBurned)}
            </span>
            <span className="text-[0.76rem] text-white/40">kcal above BMR</span>
          </div>

          <div className="p-3 border border-[rgba(255,255,255,0.2)] rounded-[5px]">
            <span className="text-[0.76rem] uppercase tracking-wider text-white/50 block mb-1">
              Net Balance
            </span>
            <span className="text-[1.425rem] font-medium text-white leading-none block">
              {Math.round(netCalories) >= 0 ? `+${Math.round(netCalories)}` : Math.round(netCalories)}
            </span>
            <span className="text-[0.76rem] text-white/40">of {Math.round(scaledTargetCalories)}</span>
          </div>
        </div>

        {/* Hairline Progress Gauge */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[0.76rem] text-white/50">
            <span>Utilization: {caloriePercent}%</span>
            <span>Target: {Math.round(scaledTargetCalories)} kcal</span>
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
              <span className="text-white/70">
                Protein (ISSN {macroTargets.proteinMultiplier || 1.8}g/kg)
              </span>
              <span className="font-medium text-white">
                {Math.round(aggregations.totalProtein)}g / {Math.round(scaledProteinTarget)}g
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
                {Math.round(aggregations.totalCarbs)}g / {Math.round(scaledCarbTarget)}g
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
                {Math.round(aggregations.totalFat)}g / {Math.round(scaledFatTarget)}g
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
                {Math.round(aggregations.totalFiber)}g / {Math.round(scaledFiberTarget)}g
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
                    / {Math.round(scaledSugarLimit)}g max
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
                    / {Math.round(scaledSodiumLimit)}mg max
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

          <div className="relative" ref={addMenuRef}>
            <button
              type="button"
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              aria-label="Add manual telemetry entry"
              aria-haspopup="listbox"
              aria-expanded={isAddMenuOpen}
              title="Add manual entry • Click to select"
              className={`w-7 h-7 text-white transition-opacity duration-300 cursor-pointer flex items-center justify-center ${
                isAddMenuOpen ? "opacity-100" : "opacity-50 hover:opacity-100"
              }`}
            >
              <Plus className="w-4 h-4" />
            </button>

            {isAddMenuOpen && (
              <div
                role="listbox"
                aria-label="Select entry type"
                className="absolute right-0 top-full mt-1.5 w-44 sm:w-48 rounded-[5px] bg-black border border-[rgba(255,255,255,0.5)] p-1 z-50 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="space-y-0.5">
                  <button
                    type="button"
                    role="option"
                    aria-selected={manualEntryType === 'activity'}
                    onClick={() => {
                      setManualEntryType('activity');
                      setIsAddMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-[5px] flex items-center justify-between text-[0.855rem] tracking-normal transition-colors duration-300 cursor-pointer ${
                      manualEntryType === 'activity'
                        ? "bg-white/10 text-white font-medium"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="shrink-0 flex items-center justify-center w-5 h-5 text-current">
                        <Activity className="w-4 h-4" />
                      </span>
                      <span className="truncate">Exercise</span>
                    </div>

                    {manualEntryType === 'activity' && (
                      <Check className="w-3.5 h-3.5 shrink-0 text-white ml-2" />
                    )}
                  </button>

                  <button
                    type="button"
                    role="option"
                    aria-selected={manualEntryType === 'food'}
                    onClick={() => {
                      setManualEntryType('food');
                      setIsAddMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-[5px] flex items-center justify-between text-[0.855rem] tracking-normal transition-colors duration-300 cursor-pointer ${
                      manualEntryType === 'food'
                        ? "bg-white/10 text-white font-medium"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="shrink-0 flex items-center justify-center w-5 h-5 text-current">
                        <Utensils className="w-4 h-4" />
                      </span>
                      <span className="truncate">Snack</span>
                    </div>

                    {manualEntryType === 'food' && (
                      <Check className="w-3.5 h-3.5 shrink-0 text-white ml-2" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Manual Telemetry Entry Card */}
        {manualEntryType && (
          <ManualTelemetryCard
            type={manualEntryType}
            userProfile={userProfile}
            onSaved={() => {
              setManualEntryType(null);
              loadData();
              onDataChanged();
            }}
            onCancel={() => setManualEntryType(null)}
          />
        )}

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
              if (editingLogKey === item.rowKey) {
                return (
                  <ManualTelemetryCard
                    key={item.rowKey}
                    type={item.type}
                    userProfile={userProfile}
                    initialRecord={item}
                    onSaved={() => {
                      setEditingLogKey(null);
                      loadData();
                      onDataChanged();
                    }}
                    onCancel={() => setEditingLogKey(null)}
                  />
                );
              }

              const isFood = item.type === 'food';
              return (
                <div
                  key={item.rowKey}
                  onClick={() => setEditingLogKey(item.rowKey)}
                  className="p-3 rounded-[5px] border border-[rgba(255,255,255,0.25)] hover:border-white transition-colors duration-300 flex items-center justify-between group bg-transparent cursor-pointer"
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
                        <span>{item.servingInfo || (item.durationMin ? `${Math.round(item.durationMin)}m` : '')}</span>
                        {isFood ? (
                          <span>
                            • P: {Math.round(item.protein)}g | C: {Math.round(item.carbs)}g | F: {Math.round(item.fat)}g | Fib: {Math.round(item.fiber)}g
                          </span>
                        ) : (
                          <span>
                            • {item.metValue} MET ({Math.round(item.activeCalories)} net kcal)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="text-right mr-1">
                      <span className="text-[0.95rem] font-medium text-white">
                        {isFood ? `+${Math.round(item.calories)}` : `-${Math.round(item.calories)}`}
                      </span>
                      <span className="text-[0.76rem] text-white/50 ml-1">kcal</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRelogClick(item);
                      }}
                      disabled={reloggingKey === item.rowKey || deletingKey === item.rowKey}
                      title="Copy item to today"
                      aria-label="Copy item to today"
                      className="p-1.5 rounded-[5px] border border-[rgba(255,255,255,0.25)] text-white opacity-40 hover:opacity-100 transition-opacity duration-300 disabled:opacity-10 cursor-pointer"
                    >
                      {reloggingKey === item.rowKey ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item);
                      }}
                      disabled={deletingKey === item.rowKey || reloggingKey === item.rowKey}
                      title="Delete log"
                      aria-label="Delete entry"
                      className="p-1.5 rounded-[5px] border border-[rgba(255,255,255,0.25)] text-white opacity-40 hover:opacity-100 transition-opacity duration-300 disabled:opacity-10 cursor-pointer"
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

      {/* Re-log / Copy to Today Confirmation Warning Modal */}
      {pendingRelogItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="relog-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
        >
          <div className="bg-black border border-[rgba(255,255,255,0.5)] rounded-[5px] p-5 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-[8px] h-[8px] rounded-full ${
                    pendingRelogItem.type === 'food' ? 'bg-[#3FB950]' : 'bg-[#E3B341]'
                  }`}
                  aria-hidden="true"
                />
                <h3 id="relog-modal-title" className="text-[0.95rem] font-medium text-white">
                  Copy to Today's Telemetry
                </h3>
              </div>
              <p className="text-[0.855rem] text-white/70 leading-[1.6]">
                This will immediately copy and log{' '}
                <span className="font-semibold text-white">{pendingRelogItem.name}</span>{' '}
                ({pendingRelogItem.type === 'food' ? `+${Math.round(pendingRelogItem.calories)} kcal` : `-${Math.round(pendingRelogItem.calories)} kcal`}){' '}
                into today's recorded telemetry logs without running an AI agent pass.
              </p>
            </div>

            {/* Do not show again checkbox */}
            <label className="flex items-center space-x-2.5 text-[0.76rem] text-white/60 hover:text-white cursor-pointer select-none transition-colors duration-300">
              <input
                type="checkbox"
                checked={dontShowRelogWarning}
                onChange={(e) => setDontShowRelogWarning(e.target.checked)}
                className="w-3.5 h-3.5 rounded-[3px] border border-[rgba(255,255,255,0.4)] bg-transparent accent-white cursor-pointer"
              />
              <span>Do not show again</span>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[rgba(255,255,255,0.15)]">
              <button
                type="button"
                onClick={() => setPendingRelogItem(null)}
                className="px-3 py-1.5 rounded-[5px] text-[0.855rem] text-white/50 hover:text-white transition-colors duration-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRelog}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-[5px] border border-[rgba(255,255,255,0.5)] hover:border-white text-[0.855rem] font-medium text-white bg-transparent opacity-80 hover:opacity-100 transition-all duration-300 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy to Today</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
