import React, { useState } from 'react';
import { Check, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import type { DraftEntry } from '../../types/health';

interface DraftCardProps {
  draftEntries: DraftEntry[];
  isConfirmed?: boolean;
  onConfirm: (entries: DraftEntry[]) => Promise<void>;
}

export const DraftCard: React.FC<DraftCardProps> = ({
  draftEntries: initialEntries,
  isConfirmed = false,
  onConfirm
}) => {
  const [entries, setEntries] = useState<DraftEntry[]>(initialEntries);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleUpdateField = (index: number, field: keyof DraftEntry, value: any) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onConfirm(entries);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={`rounded-[5px] border my-3 transition-colors duration-300 overflow-hidden ${
        isConfirmed
          ? 'border-[rgba(255,255,255,0.25)] bg-transparent'
          : 'border-[rgba(255,255,255,0.5)] hover:border-white bg-transparent'
      }`}
    >
      {/* Header Rule */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[rgba(255,255,255,0.25)] bg-transparent">
        <div className="flex items-center space-x-2">
          <span className="text-[0.76rem] uppercase tracking-wider text-white/50 font-medium">
            {isConfirmed ? 'Recorded Entry' : 'Draft Payload'}
          </span>
          <span className="text-[0.76rem] text-white/40">
            ({entries.length} item{entries.length > 1 ? 's' : ''})
          </span>
        </div>

        {isConfirmed ? (
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-[5px] border border-[rgba(255,255,255,0.25)] text-[0.76rem] text-white font-medium">
            <div className="w-[8px] h-[8px] rounded-full bg-[#008000]" aria-hidden="true" />
            <span>LOGGED</span>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-[0.76rem] text-white opacity-50 hover:opacity-100 flex items-center space-x-1 transition-opacity duration-300"
          >
            <Edit2 className="w-3 h-3" />
            <span>{isEditing ? 'Done' : 'Edit'}</span>
          </button>
        )}
      </div>

      {/* Items Body */}
      <div className="p-3.5 space-y-4">
        {entries.map((entry, idx) => {
          const isFood = entry.type === 'food';
          const netCarbs = Math.max(0, (entry.carbs || 0) - (entry.fiber || 0));

          return (
            <div
              key={idx}
              className="space-y-2.5 pb-3 border-b border-[rgba(255,255,255,0.15)] last:border-b-0 last:pb-0"
            >
              {/* Title & Calories */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-[7px] h-[7px] rounded-full ${
                        isFood ? 'bg-[#3FB950]' : 'bg-[#E3B341]'
                      }`}
                      aria-hidden="true"
                    />
                    {isEditing ? (
                      <input
                        type="text"
                        value={entry.name}
                        onChange={(e) => handleUpdateField(idx, 'name', e.target.value)}
                        className="bg-transparent border border-[rgba(255,255,255,0.5)] rounded-[5px] px-2 py-0.5 text-[0.95rem] text-white font-medium focus:outline-none focus:border-white"
                      />
                    ) : (
                      <span className="text-[0.95rem] font-medium text-white capitalize">
                        {entry.name}
                      </span>
                    )}
                  </div>
                  <div className="text-[0.76rem] text-white/50 pl-3.5">
                    {entry.servingInfo || entry.mealType}
                  </div>
                </div>

                {/* Calorie Readout */}
                <div className="text-right">
                  {isEditing ? (
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        value={entry.calories}
                        onChange={(e) =>
                          handleUpdateField(idx, 'calories', parseFloat(e.target.value) || 0)
                        }
                        className="w-16 bg-transparent border border-[rgba(255,255,255,0.5)] rounded-[5px] px-1 py-0.5 text-[0.855rem] text-white text-right focus:outline-none focus:border-white"
                      />
                      <span className="text-[0.76rem] text-white/50">kcal</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[1.14rem] font-medium text-white">
                        {isFood ? `+${entry.calories}` : `-${entry.calories}`}
                      </span>
                      <span className="text-[0.76rem] text-white/50 ml-1">kcal</span>
                      {!isFood && entry.activeCalories > 0 && (
                        <div className="text-[0.76rem] text-white/50">
                          ({entry.activeCalories} net active)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Nutrition or Activity Grid */}
              {isFood ? (
                <div className="grid grid-cols-4 gap-2 text-center text-[0.855rem]">
                  <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                    <span className="text-[0.76rem] text-white/50 block">Protein</span>
                    {isEditing ? (
                      <input
                        type="number"
                        value={entry.protein}
                        onChange={(e) =>
                          handleUpdateField(idx, 'protein', parseFloat(e.target.value) || 0)
                        }
                        className="w-full bg-transparent text-center text-[0.855rem] text-white border-none focus:outline-none"
                      />
                    ) : (
                      <span className="font-medium text-white">{entry.protein}g</span>
                    )}
                  </div>

                  <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                    <span className="text-[0.76rem] text-white/50 block">Carbs</span>
                    {isEditing ? (
                      <input
                        type="number"
                        value={entry.carbs}
                        onChange={(e) =>
                          handleUpdateField(idx, 'carbs', parseFloat(e.target.value) || 0)
                        }
                        className="w-full bg-transparent text-center text-[0.855rem] text-white border-none focus:outline-none"
                      />
                    ) : (
                      <span className="font-medium text-white">{entry.carbs}g</span>
                    )}
                  </div>

                  <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                    <span className="text-[0.76rem] text-white/50 block">Fat</span>
                    {isEditing ? (
                      <input
                        type="number"
                        value={entry.fat}
                        onChange={(e) =>
                          handleUpdateField(idx, 'fat', parseFloat(e.target.value) || 0)
                        }
                        className="w-full bg-transparent text-center text-[0.855rem] text-white border-none focus:outline-none"
                      />
                    ) : (
                      <span className="font-medium text-white">{entry.fat}g</span>
                    )}
                  </div>

                  <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                    <span className="text-[0.76rem] text-white/50 block">Fiber</span>
                    {isEditing ? (
                      <input
                        type="number"
                        value={entry.fiber}
                        onChange={(e) =>
                          handleUpdateField(idx, 'fiber', parseFloat(e.target.value) || 0)
                        }
                        className="w-full bg-transparent text-center text-[0.855rem] text-white border-none focus:outline-none"
                      />
                    ) : (
                      <span className="font-medium text-white">{entry.fiber}g</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-center text-[0.855rem]">
                  <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                    <span className="text-[0.76rem] text-white/50 block">Duration</span>
                    <span className="font-medium text-white">{entry.durationMin}m</span>
                  </div>
                  <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                    <span className="text-[0.76rem] text-white/50 block">Intensity</span>
                    <span className="font-medium text-white capitalize">{entry.intensity}</span>
                  </div>
                  <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                    <span className="text-[0.76rem] text-white/50 block">Compendium</span>
                    <span className="font-medium text-white">{entry.metValue} MET</span>
                  </div>
                </div>
              )}

              {/* Expandable Net Carbs, Sugar & Sodium */}
              {isFood && (
                <div>
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-[0.76rem] text-white/50 hover:text-white flex items-center space-x-1 transition-colors"
                  >
                    <span>{expanded ? 'Hide detail telemetry' : 'Show Net Carbs, Sugar & Sodium'}</span>
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {expanded && (
                    <div className="mt-2 grid grid-cols-3 gap-2 p-2 rounded-[5px] border border-[rgba(255,255,255,0.15)] text-[0.855rem] text-white">
                      <div>
                        <span className="text-[0.76rem] text-white/50 block">Net Carbs</span>
                        <span className="font-medium">{netCarbs.toFixed(1)}g</span>
                      </div>
                      <div>
                        <span className="text-[0.76rem] text-white/50 block">Sugar</span>
                        <span className="font-medium">{entry.sugar}g</span>
                      </div>
                      <div>
                        <span className="text-[0.76rem] text-white/50 block">Sodium</span>
                        <span className="font-medium">{entry.sodiumMg}mg</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Actions */}
      {!isConfirmed && (
        <div className="px-3.5 py-2.5 border-t border-[rgba(255,255,255,0.25)] flex items-center justify-between">
          <span className="text-[0.76rem] text-white/50">Confirm entry telemetry</span>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-[5px] border border-[rgba(255,255,255,0.5)] hover:border-white text-[0.855rem] font-medium text-white bg-transparent opacity-75 hover:opacity-100 transition-all duration-300 disabled:opacity-30"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Logging...' : 'Confirm & Save'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
