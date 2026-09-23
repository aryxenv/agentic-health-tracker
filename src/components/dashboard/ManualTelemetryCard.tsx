import React, { useState } from 'react';
import { Check, X, Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type {
  DraftEntry,
  ActivityIntensity,
  ActivityModality,
  UserProfile
} from '../../types/health';
import { saveLogEntries, sendChatMessageStream } from '../../services/api';
import { getSelectedModel } from '../../services/storage';

interface ManualTelemetryCardProps {
  type: 'food' | 'activity';
  userProfile: UserProfile;
  onSaved: () => void;
  onCancel: () => void;
}

export const ManualTelemetryCard: React.FC<ManualTelemetryCardProps> = ({
  type,
  userProfile,
  onSaved,
  onCancel
}) => {
  const isFood = type === 'food';

  // Form state
  const [name, setName] = useState('');
  const [calories, setCalories] = useState<string>('');
  
  // Food specific fields
  const [servingInfo, setServingInfo] = useState('');
  const [protein, setProtein] = useState<string>('');
  const [carbs, setCarbs] = useState<string>('');
  const [fat, setFat] = useState<string>('');
  const [fiber, setFiber] = useState<string>('');
  const [sugar, setSugar] = useState<string>('');
  const [sodiumMg, setSodiumMg] = useState<string>('');

  // Activity specific fields
  const [durationMin, setDurationMin] = useState<string>('');
  const [intensity, setIntensity] = useState<ActivityIntensity>('moderate');
  const [modality, setModality] = useState<ActivityModality>('cardio');
  const [metValue, setMetValue] = useState<string>('');
  const [activeCalories, setActiveCalories] = useState<string>('');

  // UI state
  const [expanded, setExpanded] = useState(false);
  const [isInferring, setIsInferring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const netCarbs = Math.max(
    0,
    (parseFloat(carbs) || 0) - (parseFloat(fiber) || 0)
  );

  const handleInferWithAI = async () => {
    if (!name.trim()) {
      setErrorMessage('Please enter an item name first to infer telemetry.');
      return;
    }

    setIsInferring(true);
    setErrorMessage(null);
    setStatusMessage('Analyzing telemetry with Health Agent...');

    try {
      const selectedModel = getSelectedModel();

      let prompt = '';
      if (isFood) {
        prompt = `Infer and calculate the scientific nutritional values for the following manually logged snack. Fill in all missing/blank fields based on verified nutritional facts and the values already provided:
Food name: ${name.trim()}
${servingInfo ? `Serving: ${servingInfo}` : ''}
${calories ? `Calories: ${calories} kcal` : ''}
${protein ? `Protein: ${protein}g` : ''}
${carbs ? `Carbs: ${carbs}g` : ''}
${fat ? `Fat: ${fat}g` : ''}
${fiber ? `Fiber: ${fiber}g` : ''}
${sugar ? `Sugar: ${sugar}g` : ''}
${sodiumMg ? `Sodium: ${sodiumMg}mg` : ''}
Please infer all the blank fields and generate the draft entry with exact numbers. Do not ask for clarification; make reasonable scientific estimates for any blanks.`;
      } else {
        prompt = `Infer and calculate the scientific biomechanical values for the following manually logged exercise. Fill in all missing/blank fields based on the 2024 Adult Compendium of Physical Activities and the values already provided:
Exercise name: ${name.trim()}
${durationMin ? `Duration: ${durationMin} minutes` : ''}
${intensity && intensity !== 'none' ? `Intensity: ${intensity}` : ''}
${calories ? `Calories burned: ${calories} kcal` : ''}
${metValue ? `MET: ${metValue}` : ''}
Please infer all the blank fields and generate the draft entry with exact numbers. Do not ask for clarification; make reasonable scientific estimates for any blanks.`;
      }

      const res = await sendChatMessageStream(
        [{ role: 'user', content: prompt }],
        userProfile,
        (step) => {
          if (step.title) {
            setStatusMessage(step.title);
          }
        },
        undefined,
        undefined,
        selectedModel
      );

      if (res.draft_entries && res.draft_entries.length > 0) {
        const inferred = res.draft_entries[0];

        if (isFood) {
          if (!calories && inferred.calories !== undefined) {
            setCalories(String(inferred.calories));
          }
          if (!protein && inferred.protein !== undefined) {
            setProtein(String(inferred.protein));
          }
          if (!carbs && inferred.carbs !== undefined) {
            setCarbs(String(inferred.carbs));
          }
          if (!fat && inferred.fat !== undefined) {
            setFat(String(inferred.fat));
          }
          if (!fiber && inferred.fiber !== undefined) {
            setFiber(String(inferred.fiber));
          }
          if (!sugar && inferred.sugar !== undefined) {
            setSugar(String(inferred.sugar));
          }
          if (!sodiumMg && inferred.sodiumMg !== undefined) {
            setSodiumMg(String(inferred.sodiumMg));
          }
          if (!servingInfo && inferred.servingInfo) {
            setServingInfo(inferred.servingInfo);
          }
        } else {
          if (!calories && inferred.calories !== undefined) {
            setCalories(String(inferred.calories));
          }
          if (!durationMin && inferred.durationMin !== undefined) {
            setDurationMin(String(inferred.durationMin));
          }
          if (!metValue && inferred.metValue !== undefined) {
            setMetValue(String(inferred.metValue));
          }
          if (!activeCalories && inferred.activeCalories !== undefined) {
            setActiveCalories(String(inferred.activeCalories));
          }
          if (inferred.intensity && inferred.intensity !== 'none') {
            setIntensity(inferred.intensity);
          }
          if (inferred.modality && inferred.modality !== 'none') {
            setModality(inferred.modality);
          }
        }
        setStatusMessage('Values inferred successfully.');
      } else {
        setStatusMessage(res.reply ? 'AI response received.' : 'Inference complete.');
      }
    } catch (err: any) {
      console.error('Error inferring with AI:', err);
      setErrorMessage(err.message || 'Failed to infer telemetry with AI.');
      setStatusMessage(null);
    } finally {
      setIsInferring(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMessage('Please provide an item name.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const parsedCalories = Math.max(0, parseFloat(calories) || 0);

    const entry: DraftEntry = {
      type: isFood ? 'food' : 'activity',
      name: name.trim(),
      calories: parsedCalories,
      protein: isFood ? Math.max(0, parseFloat(protein) || 0) : 0,
      carbs: isFood ? Math.max(0, parseFloat(carbs) || 0) : 0,
      fat: isFood ? Math.max(0, parseFloat(fat) || 0) : 0,
      fiber: isFood ? Math.max(0, parseFloat(fiber) || 0) : 0,
      sugar: isFood ? Math.max(0, parseFloat(sugar) || 0) : 0,
      sodiumMg: isFood ? Math.max(0, parseFloat(sodiumMg) || 0) : 0,
      mealType: isFood ? 'snack' : 'workout',
      durationMin: !isFood ? Math.max(0, parseFloat(durationMin) || 0) : 0,
      metValue: !isFood ? Math.max(0, parseFloat(metValue) || 1.0) : 0,
      activeCalories: !isFood
        ? Math.max(0, parseFloat(activeCalories) || parsedCalories)
        : 0,
      modality: !isFood ? modality : 'none',
      intensity: !isFood ? intensity : 'none',
      servingInfo: isFood ? (servingInfo.trim() || '1 serving') : '',
      details: isFood ? 'Manual snack entry' : 'Manual exercise entry'
    };

    try {
      await saveLogEntries([entry]);
      onSaved();
    } catch (err: any) {
      console.error('Failed to save manual log entry:', err);
      setErrorMessage(err.message || 'Failed to record telemetry.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-[5px] border border-[rgba(255,255,255,0.5)] hover:border-white transition-colors duration-300 overflow-hidden bg-transparent mb-3">
      {/* Header Rule */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[rgba(255,255,255,0.25)] bg-transparent">
        <div className="flex items-center space-x-2">
          <div
            className={`w-[8px] h-[8px] rounded-full ${
              isFood ? 'bg-[#3FB950]' : 'bg-[#E3B341]'
            }`}
            aria-hidden="true"
          />
          <span className="text-[0.76rem] uppercase tracking-wider text-white/50 font-medium">
            Manual Telemetry Payload
          </span>
          <span className="text-[0.76rem] px-1.5 py-0.2 rounded-[3px] border border-[rgba(255,255,255,0.2)] text-white/50 uppercase">
            {isFood ? 'Snack' : 'Exercise'}
          </span>
        </div>

        <button
          onClick={onCancel}
          disabled={isSaving || isInferring}
          className="text-white/50 hover:text-white transition-colors duration-300 p-1"
          aria-label="Cancel manual entry"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Items Body */}
      <div className="p-3.5 space-y-4">
        {/* Title & Calories Row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder={isFood ? "Snack name (e.g. Greek yogurt, Almonds)" : "Exercise name (e.g. 5km Running, HIIT)"}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full bg-transparent border border-[rgba(255,255,255,0.3)] hover:border-white/60 focus:border-white rounded-[5px] px-2.5 py-1 text-[0.95rem] text-white font-medium focus:outline-none transition-colors duration-300 placeholder:text-white/30"
              />
            </div>
            {isFood ? (
              <input
                type="text"
                placeholder="Portion / serving (e.g. 1 cup, 30g, 1 piece)"
                value={servingInfo}
                onChange={(e) => setServingInfo(e.target.value)}
                className="w-full sm:w-72 text-[0.76rem] bg-transparent border border-[rgba(255,255,255,0.2)] hover:border-white/50 focus:border-white rounded-[5px] px-2 py-0.5 text-white/80 focus:outline-none transition-colors duration-300 placeholder:text-white/30"
              />
            ) : (
              <div className="flex items-center space-x-2">
                <select
                  value={modality}
                  onChange={(e) => setModality(e.target.value as ActivityModality)}
                  className="bg-black text-[0.76rem] border border-[rgba(255,255,255,0.2)] hover:border-white/50 focus:border-white rounded-[5px] px-2 py-0.5 text-white/80 focus:outline-none transition-colors duration-300"
                >
                  <option value="cardio">Cardio</option>
                  <option value="strength_training">Strength</option>
                  <option value="hiit">HIIT</option>
                  <option value="walking">Walking</option>
                  <option value="sports">Sports</option>
                </select>
              </div>
            )}
          </div>

          {/* Calorie Readout */}
          <div className="flex items-center sm:justify-end space-x-1.5 self-start">
            <span className="text-[1.14rem] font-medium text-white">
              {isFood ? '+' : '-'}
            </span>
            <input
              type="number"
              placeholder="0"
              min="0"
              step="any"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="w-20 bg-transparent border border-[rgba(255,255,255,0.3)] hover:border-white/60 focus:border-white rounded-[5px] px-2 py-1 text-[0.855rem] text-white text-right focus:outline-none transition-colors duration-300"
            />
            <span className="text-[0.76rem] text-white/50">kcal</span>
          </div>
        </div>

        {/* Nutrition or Activity Grid */}
        {isFood ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center text-[0.855rem]">
              <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                <span className="text-[0.76rem] text-white/50 block">Protein</span>
                <div className="flex items-center justify-center space-x-0.5 mt-0.5">
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="any"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    className="w-full bg-transparent text-center text-[0.855rem] text-white border-b border-[rgba(255,255,255,0.2)] focus:border-white focus:outline-none"
                  />
                  <span className="text-[0.76rem] text-white/50">g</span>
                </div>
              </div>

              <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                <span className="text-[0.76rem] text-white/50 block">Carbs</span>
                <div className="flex items-center justify-center space-x-0.5 mt-0.5">
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="any"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    className="w-full bg-transparent text-center text-[0.855rem] text-white border-b border-[rgba(255,255,255,0.2)] focus:border-white focus:outline-none"
                  />
                  <span className="text-[0.76rem] text-white/50">g</span>
                </div>
              </div>

              <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                <span className="text-[0.76rem] text-white/50 block">Fat</span>
                <div className="flex items-center justify-center space-x-0.5 mt-0.5">
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="any"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    className="w-full bg-transparent text-center text-[0.855rem] text-white border-b border-[rgba(255,255,255,0.2)] focus:border-white focus:outline-none"
                  />
                  <span className="text-[0.76rem] text-white/50">g</span>
                </div>
              </div>

              <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                <span className="text-[0.76rem] text-white/50 block">Fiber</span>
                <div className="flex items-center justify-center space-x-0.5 mt-0.5">
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="any"
                    value={fiber}
                    onChange={(e) => setFiber(e.target.value)}
                    className="w-full bg-transparent text-center text-[0.855rem] text-white border-b border-[rgba(255,255,255,0.2)] focus:border-white focus:outline-none"
                  />
                  <span className="text-[0.76rem] text-white/50">g</span>
                </div>
              </div>
            </div>

            {/* Expandable Net Carbs, Sugar & Sodium */}
            <div>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-[0.76rem] text-white/50 hover:text-white flex items-center space-x-1 transition-colors"
              >
                <span>{expanded ? 'Hide detail telemetry' : 'Show Net Carbs, Sugar & Sodium'}</span>
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {expanded && (
                <div className="mt-2 grid grid-cols-3 gap-2 p-2.5 rounded-[5px] border border-[rgba(255,255,255,0.15)] text-[0.855rem] text-white">
                  <div>
                    <span className="text-[0.76rem] text-white/50 block">Net Carbs</span>
                    <span className="font-medium">{Math.round(netCarbs)}g</span>
                  </div>
                  <div>
                    <span className="text-[0.76rem] text-white/50 block">Sugar</span>
                    <div className="flex items-center space-x-1 mt-0.5">
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        step="any"
                        value={sugar}
                        onChange={(e) => setSugar(e.target.value)}
                        className="w-16 bg-transparent border-b border-[rgba(255,255,255,0.2)] focus:border-white focus:outline-none text-[0.855rem] text-white"
                      />
                      <span className="text-[0.76rem] text-white/50">g</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[0.76rem] text-white/50 block">Sodium</span>
                    <div className="flex items-center space-x-1 mt-0.5">
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        step="any"
                        value={sodiumMg}
                        onChange={(e) => setSodiumMg(e.target.value)}
                        className="w-16 bg-transparent border-b border-[rgba(255,255,255,0.2)] focus:border-white focus:outline-none text-[0.855rem] text-white"
                      />
                      <span className="text-[0.76rem] text-white/50">mg</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center text-[0.855rem]">
            <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
              <span className="text-[0.76rem] text-white/50 block">Duration</span>
              <div className="flex items-center justify-center space-x-0.5 mt-0.5">
                <input
                  type="number"
                  placeholder="30"
                  min="0"
                  step="any"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  className="w-full bg-transparent text-center text-[0.855rem] text-white border-b border-[rgba(255,255,255,0.2)] focus:border-white focus:outline-none"
                />
                <span className="text-[0.76rem] text-white/50">m</span>
              </div>
            </div>

            <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
              <span className="text-[0.76rem] text-white/50 block">Intensity</span>
              <select
                value={intensity}
                onChange={(e) => setIntensity(e.target.value as ActivityIntensity)}
                className="w-full bg-black text-center text-[0.855rem] text-white border-b border-[rgba(255,255,255,0.2)] focus:border-white focus:outline-none capitalize mt-0.5"
              >
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="vigorous">Vigorous</option>
                <option value="near_max">Near Max</option>
              </select>
            </div>

            <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
              <span className="text-[0.76rem] text-white/50 block">Compendium</span>
              <div className="flex items-center justify-center space-x-0.5 mt-0.5">
                <input
                  type="number"
                  placeholder="7.0"
                  min="0"
                  step="any"
                  value={metValue}
                  onChange={(e) => setMetValue(e.target.value)}
                  className="w-full bg-transparent text-center text-[0.855rem] text-white border-b border-[rgba(255,255,255,0.2)] focus:border-white focus:outline-none"
                />
                <span className="text-[0.76rem] text-white/50">MET</span>
              </div>
            </div>
          </div>
        )}

        {/* Live Status or Error Message */}
        {errorMessage && (
          <div className="text-[0.76rem] text-[#FF0000] border border-[#FF0000]/30 rounded-[5px] p-2 bg-transparent">
            {errorMessage}
          </div>
        )}
        {statusMessage && !errorMessage && (
          <div className="text-[0.76rem] text-white/50 flex items-center space-x-1.5">
            {isInferring && <Loader2 className="w-3 h-3 animate-spin text-white/70" />}
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Confirmation & Action Controls */}
      <div className="px-3.5 py-2.5 border-t border-[rgba(255,255,255,0.25)] flex flex-wrap items-center justify-between gap-2 bg-transparent">
        <button
          type="button"
          onClick={handleInferWithAI}
          disabled={isInferring || isSaving}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[5px] border border-[rgba(255,255,255,0.3)] hover:border-white text-[0.76rem] text-white/70 hover:text-white bg-transparent transition-all duration-300 disabled:opacity-40"
          title="Infer blank metrics based on filled in values using Health Agent"
        >
          {isInferring ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>{isInferring ? 'Inferring...' : 'Infer with AI'}</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving || isInferring}
            className="px-3 py-1.5 rounded-[5px] text-[0.76rem] text-white/50 hover:text-white transition-colors duration-300 disabled:opacity-30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isInferring}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-[5px] border border-[rgba(255,255,255,0.5)] hover:border-white text-[0.855rem] font-medium text-white bg-transparent opacity-75 hover:opacity-100 transition-all duration-300 disabled:opacity-30"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? 'Logging...' : 'Confirm & Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
