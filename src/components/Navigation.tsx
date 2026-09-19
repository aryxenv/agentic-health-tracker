import React from 'react';
import { MessageSquare, BarChart3 } from 'lucide-react';

interface NavigationProps {
  activeTab: 'chat' | 'data';
  onTabChange: (tab: 'chat' | 'data') => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav
      className="h-[56px] sm:h-[60px] flex-shrink-0 z-40 bg-[#000000]/95 backdrop-blur-[10px] border-t border-[rgba(255,255,255,0.35)] transition-colors duration-300"
      aria-label="Instrument Tabs"
    >
      <div className="max-w-2xl mx-auto h-full px-4 sm:px-5 flex items-center">
        <div className="w-full grid grid-cols-2 gap-3">
          {/* Chat Tab Button */}
          <button
            onClick={() => onTabChange('chat')}
            className={`h-[36px] sm:h-[38px] flex items-center justify-center space-x-2 rounded-[5px] border transition-all duration-300 ${
              activeTab === 'chat'
                ? 'border-white text-white opacity-100 bg-transparent font-medium'
                : 'border-[rgba(255,255,255,0.25)] text-white opacity-50 hover:opacity-100 bg-transparent'
            }`}
          >
            <MessageSquare className="w-[18px] h-[18px]" />
            <span className="text-[0.95rem] tracking-wide">Chat</span>
          </button>

          {/* Data Tab Button */}
          <button
            onClick={() => onTabChange('data')}
            className={`h-[36px] sm:h-[38px] flex items-center justify-center space-x-2 rounded-[5px] border transition-all duration-300 ${
              activeTab === 'data'
                ? 'border-white text-white opacity-100 bg-transparent font-medium'
                : 'border-[rgba(255,255,255,0.25)] text-white opacity-50 hover:opacity-100 bg-transparent'
            }`}
          >
            <BarChart3 className="w-[18px] h-[18px]" />
            <span className="text-[0.95rem] tracking-wide">Data</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
