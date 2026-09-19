import React from 'react';
import { User, Plus } from 'lucide-react';
import type { DailyAggregations, MacroTargets } from '../types/health';

interface HeaderProps {
  aggregations: DailyAggregations;
  targets: MacroTargets;
  isServerOnline?: boolean;
  onOpenProfile: () => void;
  onNewChat?: () => void;
  hasMessages?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  aggregations,
  targets,
  onOpenProfile,
  onNewChat,
  hasMessages = false
}) => {
  const { totalIntakeCalories, totalActiveCaloriesBurned, netCalories } = aggregations;

  return (
    <header className="h-[60px] flex-shrink-0 z-40 bg-[#000000]/90 backdrop-blur-[10px] border-b border-[rgba(255,255,255,0.35)] transition-colors duration-300">
      <div className="max-w-2xl mx-auto h-full px-4 sm:px-5 flex items-center justify-between">
        {/* Left: Net Energy Readout */}
        <div className="flex items-baseline space-x-1.5">
          <span className="text-[1.5rem] sm:text-[1.7rem] font-medium tracking-tight text-white leading-none">
            {netCalories >= 0 ? `+${netCalories}` : netCalories}
            <span className="text-[0.8rem] sm:text-[0.855rem] font-normal text-white/50 ml-1">kcal</span>
          </span>
          <span className="text-[0.76rem] sm:text-[0.855rem] text-white/50 leading-none">
            / {targets.targetCalories} target
          </span>
        </div>

        {/* Right: New Chat Button, In/Burn Readout & Profile Button (All uniform h-[34px]) */}
        <div className="flex items-center space-x-2">
          {/* + New Chat Button - Only visible when an active conversation exists */}
          {hasMessages && onNewChat && (
            <button
              type="button"
              onClick={onNewChat}
              title="Start new chat session"
              aria-label="New Chat"
              className="h-[34px] px-3 rounded-[5px] border border-[rgba(255,255,255,0.35)] hover:border-white bg-transparent text-white opacity-60 hover:opacity-100 transition-all duration-300 inline-flex items-center space-x-1.5 cursor-pointer select-none"
            >
              <Plus className="w-[14px] h-[14px]" />
              <span className="text-[0.76rem] tracking-wider uppercase font-medium whitespace-nowrap leading-none">
                New Chat
              </span>
            </button>
          )}

          {/* Quick Intake/Burn Readout - Exactly h-[34px] */}
          <div className="hidden sm:inline-flex h-[34px] items-center space-x-2.5 text-[0.76rem] px-3 rounded-[5px] border border-[rgba(255,255,255,0.35)] bg-transparent text-white/70 whitespace-nowrap leading-none">
            <span className="flex items-center space-x-1">
              <span className="text-white/40">In:</span>
              <span className="text-white font-medium">{totalIntakeCalories}</span>
            </span>
            <span className="text-white/20">|</span>
            <span className="flex items-center space-x-1">
              <span className="text-white/40">Burn:</span>
              <span className="text-white font-medium">{totalActiveCaloriesBurned}</span>
            </span>
          </div>

          {/* Profile Trigger Button - Exactly w-[34px] h-[34px] */}
          <button
            onClick={onOpenProfile}
            title="Biometric Settings & Targets"
            aria-label="Open Profile"
            className="w-[34px] h-[34px] rounded-[5px] border border-[rgba(255,255,255,0.35)] hover:border-white bg-transparent text-white opacity-60 hover:opacity-100 transition-all duration-300 flex items-center justify-center flex-shrink-0"
          >
            <User className="w-[16px] h-[16px]" />
          </button>
        </div>
      </div>
    </header>
  );
};
