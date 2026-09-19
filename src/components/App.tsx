import React, { useState, useEffect, useCallback } from 'react';
import type { UserProfile, DailyAggregations, MacroTargets } from '../types/health';
import { getUserProfile, saveUserProfile } from '../services/storage';
import { calculateMacroTargets, aggregateLogs } from '../services/calculations';
import { fetchLogs, checkServerHealth } from '../services/api';
import { Header } from './Header';
import { Navigation } from './Navigation';
import { ChatTab } from './chat/ChatTab';
import { DashboardTab } from './dashboard/DashboardTab';
import { ProfileModal } from './profile/ProfileModal';
import { format } from 'date-fns';

export const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(getUserProfile);
  const [activeTab, setActiveTab] = useState<'chat' | 'data'>('chat');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isServerOnline, setIsServerOnline] = useState<boolean>(true);
  const [todayAggregations, setTodayAggregations] = useState<DailyAggregations>({
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
  });

  const macroTargets: MacroTargets = calculateMacroTargets(profile);

  // Health ping
  const pingServer = useCallback(async () => {
    const online = await checkServerHealth();
    setIsServerOnline(online);
  }, []);

  const refreshTodayData = useCallback(async () => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const logs = await fetchLogs(todayStr, todayStr);
      setTodayAggregations(aggregateLogs(logs));
      setIsServerOnline(true);
    } catch (err) {
      console.error('Telemetry refresh error:', err);
      pingServer();
    }
  }, [pingServer]);

  useEffect(() => {
    refreshTodayData();
    pingServer();

    // Heartbeat every 15s
    const interval = setInterval(pingServer, 15000);

    const handleFocus = () => {
      pingServer();
      refreshTodayData();
    };
    window.addEventListener('focus', handleFocus);

    const handleProfileUpdated = (e: any) => {
      if (e.detail) setProfile(e.detail);
    };
    window.addEventListener('user_profile_updated', handleProfileUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('user_profile_updated', handleProfileUpdated);
    };
  }, [refreshTodayData, pingServer]);

  const [chatKey, setChatKey] = useState<number>(0);
  const [hasUserMessages, setHasUserMessages] = useState<boolean>(false);

  const handleSaveProfile = (newProfile: UserProfile) => {
    saveUserProfile(newProfile);
    setProfile(newProfile);
  };

  const handleNewChat = useCallback(() => {
    setChatKey((k) => k + 1);
    setHasUserMessages(false);
    setActiveTab('chat');
  }, []);

  return (
    <div className="h-full h-[100dvh] bg-[#000000] text-white flex flex-col font-['Manrope','Segoe_UI',sans-serif] overflow-hidden">
      {/* Cockpit Top Header */}
      <Header
        aggregations={todayAggregations}
        targets={macroTargets}
        isServerOnline={isServerOnline}
        onOpenProfile={() => setIsProfileOpen(true)}
        onNewChat={handleNewChat}
        hasMessages={hasUserMessages}
      />

      {/* Main Viewport Plane */}
      <main
        className={`flex-1 min-h-0 flex flex-col no-scrollbar ${
          activeTab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        <div className={`h-full flex-1 min-h-0 flex flex-col ${activeTab === 'chat' ? '' : 'hidden'}`}>
          <ChatTab
            key={chatKey}
            userProfile={profile}
            onEntrySaved={refreshTodayData}
            onHasMessagesChange={setHasUserMessages}
          />
        </div>
        <div className={`h-full flex-1 min-h-0 flex flex-col ${activeTab === 'data' ? '' : 'hidden'}`}>
          <DashboardTab
            userProfile={profile}
            macroTargets={macroTargets}
            onDataChanged={refreshTodayData}
          />
        </div>
      </main>

      {/* Bottom Cockpit Nav */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Calibration Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentProfile={profile}
        onSave={handleSaveProfile}
      />
    </div>
  );
};
