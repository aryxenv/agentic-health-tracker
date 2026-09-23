import React, { useState, useEffect } from 'react';
import { X, Save, Calculator } from 'lucide-react';
import type { TrainingFocus, UserProfile } from '../../types/health';
import { calculateBMR, calculateMacroTargets, calculateTDEE } from '../../services/calculations';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: UserProfile;
  onSave: (newProfile: UserProfile) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onSave
}) => {
  const [formData, setFormData] = useState<UserProfile>(currentProfile);

  useEffect(() => {
    setFormData(currentProfile);
  }, [currentProfile, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const bmr = calculateBMR(formData);
  const tdee = calculateTDEE(formData);
  const targets = calculateMacroTargets(formData);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/85 backdrop-blur-[10px] animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#000000] border border-[rgba(255,255,255,0.5)] rounded-[5px] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] cursor-default"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(255,255,255,0.25)]">
          <h2 className="text-[0.95rem] uppercase tracking-wider font-medium text-white">
            Biometric Calibration & Target
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-[5px] text-white opacity-50 hover:opacity-100 transition-opacity duration-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5 flex-1">
          {/* Target telemetry card */}
          <div className="p-4 rounded-[5px] border border-[rgba(255,255,255,0.25)] space-y-3 bg-transparent">
            <div className="flex items-center justify-between text-[0.76rem] text-white/50">
              <span className="uppercase tracking-wider">ISSN Clinical Targets</span>
              <span>BMR: {Math.round(bmr)} kcal</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[1.7rem] font-medium text-white leading-none">
                  {Math.round(targets.targetCalories)}
                </span>
                <span className="text-[0.855rem] text-white/50 ml-1.5">kcal/day</span>
              </div>
              <div className="text-[0.76rem] text-white/50">
                TDEE estimate: {Math.round(tdee)} kcal
              </div>
            </div>

            {/* Macro pills */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[rgba(255,255,255,0.15)] text-center text-[0.855rem]">
              <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                <div className="text-[0.76rem] text-white/50 uppercase">
                  Protein ({targets.proteinMultiplier}g)
                </div>
                <div className="font-medium text-white">{Math.round(targets.proteinGrams)}g</div>
              </div>
              <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                <div className="text-[0.76rem] text-white/50 uppercase">Carbs</div>
                <div className="font-medium text-white">{Math.round(targets.carbGrams)}g</div>
              </div>
              <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                <div className="text-[0.76rem] text-white/50 uppercase">Fat</div>
                <div className="font-medium text-white">{Math.round(targets.fatGrams)}g</div>
              </div>
              <div className="border border-[rgba(255,255,255,0.2)] rounded-[5px] p-1.5">
                <div className="text-[0.76rem] text-white/50 uppercase">Fiber</div>
                <div className="font-medium text-white">{Math.round(targets.fiberGrams)}g</div>
              </div>
            </div>

            {/* Ceiling limits row */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[rgba(255,255,255,0.15)] text-[0.76rem]">
              <div className="flex justify-between px-2.5 py-1 rounded-[5px] border border-[rgba(255,255,255,0.15)]">
                <span className="text-white/50">Sugar Ceiling:</span>
                <span className="font-medium text-white">&lt;{Math.round(targets.sugarLimitGrams || 50)}g</span>
              </div>
              <div className="flex justify-between px-2.5 py-1 rounded-[5px] border border-[rgba(255,255,255,0.15)]">
                <span className="text-white/50">Sodium Ceiling:</span>
                <span className="font-medium text-white">&lt;{Math.round(targets.sodiumLimitMg || 2300)}mg</span>
              </div>
            </div>
          </div>

          {/* Inputs Grid */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[0.76rem] uppercase tracking-wider text-white/50 mb-1">
                Weight (kg)
              </label>
              <input
                type="number"
                step="0.5"
                min="30"
                max="250"
                required
                value={formData.weightKg}
                onChange={(e) =>
                  setFormData({ ...formData, weightKg: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-transparent border border-[rgba(255,255,255,0.5)] rounded-[5px] px-3 py-2 text-[0.95rem] text-white focus:outline-none focus:border-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-[0.76rem] uppercase tracking-wider text-white/50 mb-1">
                Height (cm)
              </label>
              <input
                type="number"
                min="100"
                max="250"
                required
                value={formData.heightCm}
                onChange={(e) =>
                  setFormData({ ...formData, heightCm: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-transparent border border-[rgba(255,255,255,0.5)] rounded-[5px] px-3 py-2 text-[0.95rem] text-white focus:outline-none focus:border-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-[0.76rem] uppercase tracking-wider text-white/50 mb-1">
                Age
              </label>
              <input
                type="number"
                min="12"
                max="120"
                required
                value={formData.age}
                onChange={(e) =>
                  setFormData({ ...formData, age: parseInt(e.target.value) || 0 })
                }
                className="w-full bg-transparent border border-[rgba(255,255,255,0.5)] rounded-[5px] px-3 py-2 text-[0.95rem] text-white focus:outline-none focus:border-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-[0.76rem] uppercase tracking-wider text-white/50 mb-1">
                Biological Sex
              </label>
              <select
                value={formData.sex}
                onChange={(e) =>
                  setFormData({ ...formData, sex: e.target.value as 'male' | 'female' })
                }
                className="w-full bg-[#000000] border border-[rgba(255,255,255,0.5)] rounded-[5px] px-3 py-2 text-[0.95rem] text-white focus:outline-none focus:border-white transition-colors"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          {/* Activity Level & Goal */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-[0.76rem] uppercase tracking-wider text-white/50 mb-1">
                Weekly Activity Frequency
              </label>
              <select
                value={formData.activityLevel}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    activityLevel: e.target.value as UserProfile['activityLevel']
                  })
                }
                className="w-full bg-[#000000] border border-[rgba(255,255,255,0.5)] rounded-[5px] px-3 py-2 text-[0.95rem] text-white focus:outline-none focus:border-white transition-colors"
              >
                <option value="sedentary">Sedentary (minimal exercise)</option>
                <option value="light">Light (1-3 days/week)</option>
                <option value="moderate">Moderate (3-5 days/week)</option>
                <option value="very_active">Very Active (6-7 days/week)</option>
              </select>
            </div>

            <div>
              <label className="block text-[0.76rem] uppercase tracking-wider text-white/50 mb-1">
                Caloric Delta Goal
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['cut', 'maintain', 'bulk'] as const).map((goalOption) => (
                  <button
                    type="button"
                    key={goalOption}
                    onClick={() => setFormData({ ...formData, goal: goalOption })}
                    className={`py-2 px-3 rounded-[5px] text-[0.855rem] font-medium capitalize border transition-all duration-300 ${
                      formData.goal === goalOption
                        ? 'border-white text-white opacity-100 bg-transparent'
                        : 'border-[rgba(255,255,255,0.25)] text-white opacity-50 hover:opacity-100 bg-transparent'
                    }`}
                  >
                    {goalOption === 'cut'
                      ? 'Cut (-500)'
                      : goalOption === 'maintain'
                      ? 'Maintain'
                      : 'Bulk (+300)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Training Routine Focus (ISSN Protein Multiplier) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[0.76rem] uppercase tracking-wider text-white/50">
                  Training Routine (ISSN Target)
                </label>
                <span className="text-[0.76rem] text-white/50">
                  {targets.proteinMultiplier}g / kg
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'cardio', label: 'Cardio & Endurance', sub: '1.3g/kg' },
                    { id: 'balanced', label: 'Balanced Fitness', sub: '1.5g/kg' },
                    { id: 'strength', label: 'Strength & Hypertrophy', sub: '1.8g/kg' },
                    { id: 'athletic_cut', label: 'Athletic Cut', sub: '2.2g/kg' }
                  ] as const
                ).map((item) => {
                  const isSelected = (formData.trainingFocus || 'cardio') === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          trainingFocus: item.id as TrainingFocus
                        })
                      }
                      className={`p-2.5 rounded-[5px] text-left border transition-all duration-300 flex flex-col justify-between ${
                        isSelected
                          ? 'border-white text-white opacity-100 bg-transparent'
                          : 'border-[rgba(255,255,255,0.25)] text-white opacity-50 hover:opacity-100 bg-transparent'
                      }`}
                    >
                      <span className="text-[0.825rem] font-medium leading-tight mb-1">
                        {item.label}
                      </span>
                      <span className="text-[0.72rem] text-white/60">{item.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[rgba(255,255,255,0.25)] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-[5px] text-[0.855rem] text-white opacity-50 hover:opacity-100 transition-opacity duration-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-[5px] border border-[rgba(255,255,255,0.5)] hover:border-white text-[0.855rem] font-medium text-white bg-transparent opacity-80 hover:opacity-100 transition-all duration-300"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Telemetry</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
