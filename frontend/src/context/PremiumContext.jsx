import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';

const PremiumContext = createContext();

export const usePremium = () => {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
};

// Valid activation codes (in production, these would be validated server-side)
const VALID_GLOBAL_CODES = ['KRIOS-PREMIUM-2024', 'ORBIT-ELITE', 'CONSTELLATION-VIP'];
const VALID_ROOM_CODES = ['ROOM-PREMIUM', 'ORBIT-ROOM-VIP', 'KRIOS-ROOM-ELITE'];

// Storage keys
const GLOBAL_PREMIUM_KEY = 'krios_global_premium';
const ROOM_PREMIUM_KEY = 'krios_room_premium';
const PREMIUM_STATS_KEY = 'krios_premium_stats';

export const PremiumProvider = ({ children }) => {
  // Global Premium State
  const [globalPremium, setGlobalPremium] = useState(() => {
    try {
      const saved = localStorage.getItem(GLOBAL_PREMIUM_KEY);
      return saved ? JSON.parse(saved) : { active: false, activatedAt: null };
    } catch {
      return { active: false, activatedAt: null };
    }
  });

  // Room Premium State (map of roomId -> premium status)
  const [roomPremium, setRoomPremium] = useState(() => {
    try {
      const saved = localStorage.getItem(ROOM_PREMIUM_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Premium transition state (for smooth animations)
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState(null); // 'activate' | 'deactivate'

  // Stats for smart prompting
  const [premiumStats, setPremiumStats] = useState(() => {
    try {
      const saved = localStorage.getItem(PREMIUM_STATS_KEY);
      return saved ? JSON.parse(saved) : {
        nudgesSent: 0,
        dailySummariesViewed: 0,
        promptShownAt: null,
        lastPromptDismissed: null,
      };
    } catch {
      return {
        nudgesSent: 0,
        dailySummariesViewed: 0,
        promptShownAt: null,
        lastPromptDismissed: null,
      };
    }
  });

  // Persist global premium to localStorage
  useEffect(() => {
    localStorage.setItem(GLOBAL_PREMIUM_KEY, JSON.stringify(globalPremium));
  }, [globalPremium]);

  // Persist room premium to localStorage
  useEffect(() => {
    localStorage.setItem(ROOM_PREMIUM_KEY, JSON.stringify(roomPremium));
  }, [roomPremium]);

  // Persist stats to localStorage
  useEffect(() => {
    localStorage.setItem(PREMIUM_STATS_KEY, JSON.stringify(premiumStats));
  }, [premiumStats]);

  // Activate Global Premium with smooth transition
  const activateGlobalPremium = useCallback(async (code) => {
    const upperCode = code?.toUpperCase()?.trim();
    
    if (!VALID_GLOBAL_CODES.includes(upperCode)) {
      return { success: false, message: 'Invalid activation code' };
    }

    // Start transition sequence
    setTransitionType('activate');
    setIsTransitioning(true);

    // Step 1: Soft lock (dim screen) - 300ms
    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 2: Force dark mode for premium UI
    const currentTheme = localStorage.getItem('themeMode');
    if (currentTheme === 'light' || (currentTheme === 'system' && window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      // Save original preference
      localStorage.setItem('theme_before_global_premium', currentTheme || 'system');
      // Force dark mode
      localStorage.setItem('themeMode', 'dark');
      window.location.reload(); // Reload to apply theme
    }

    // Step 3: Update state
    setGlobalPremium({
      active: true,
      activatedAt: new Date().toISOString(),
      code: upperCode,
    });

    // Step 4: Premium reveal animation - 600ms
    await new Promise(resolve => setTimeout(resolve, 600));

    setIsTransitioning(false);
    setTransitionType(null);

    return { success: true, message: 'Premium activated!' };
  }, []);

  // Deactivate Global Premium
  const deactivateGlobalPremium = useCallback(async () => {
    setTransitionType('deactivate');
    setIsTransitioning(true);

    await new Promise(resolve => setTimeout(resolve, 300));

    setGlobalPremium({ active: false, activatedAt: null });

    // Restore original theme when deactivating global premium
    const originalTheme = localStorage.getItem('theme_before_global_premium');
    if (originalTheme) {
      localStorage.setItem('themeMode', originalTheme);
      localStorage.removeItem('theme_before_global_premium');
      window.location.reload(); // Reload to apply theme
    }

    await new Promise(resolve => setTimeout(resolve, 400));

    setIsTransitioning(false);
    setTransitionType(null);

    return { success: true };
  }, []);

  // Activate Room Premium
  const activateRoomPremium = useCallback(async (roomId, code) => {
    const upperCode = code?.toUpperCase()?.trim();
    
    if (!VALID_ROOM_CODES.includes(upperCode)) {
      return { success: false, message: 'Invalid room activation code' };
    }

    setTransitionType('activate');
    setIsTransitioning(true);

    await new Promise(resolve => setTimeout(resolve, 300));

    setRoomPremium(prev => ({
      ...prev,
      [roomId]: {
        active: true,
        activatedAt: new Date().toISOString(),
        code: upperCode,
      }
    }));

    await new Promise(resolve => setTimeout(resolve, 600));

    setIsTransitioning(false);
    setTransitionType(null);

    return { success: true, message: 'Room premium activated!' };
  }, []);

  // Deactivate Room Premium
  const deactivateRoomPremium = useCallback(async (roomId) => {
    setTransitionType('deactivate');
    setIsTransitioning(true);

    await new Promise(resolve => setTimeout(resolve, 300));

    setRoomPremium(prev => {
      const newState = { ...prev };
      delete newState[roomId];
      return newState;
    });

    await new Promise(resolve => setTimeout(resolve, 400));

    setIsTransitioning(false);
    setTransitionType(null);

    return { success: true };
  }, []);

  // Check if a specific room has premium
  const isRoomPremium = useCallback((roomId) => {
    return roomPremium[roomId]?.active || false;
  }, [roomPremium]);

  // Track stats for smart prompting
  const trackNudgeSent = useCallback(() => {
    setPremiumStats(prev => ({
      ...prev,
      nudgesSent: prev.nudgesSent + 1,
    }));
  }, []);

  const trackDailySummaryViewed = useCallback(() => {
    setPremiumStats(prev => ({
      ...prev,
      dailySummariesViewed: prev.dailySummariesViewed + 1,
    }));
  }, []);

  const dismissPrompt = useCallback(() => {
    setPremiumStats(prev => ({
      ...prev,
      lastPromptDismissed: new Date().toISOString(),
    }));
  }, []);

  // Determine if we should show premium prompt
  const shouldShowPremiumPrompt = useCallback(() => {
    // Don't show if already premium
    if (globalPremium.active) return false;

    // Don't show if dismissed recently (within 24 hours)
    if (premiumStats.lastPromptDismissed) {
      const dismissedAt = new Date(premiumStats.lastPromptDismissed);
      const hoursSinceDismissed = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) return false;
    }

    // Show after 3 nudges sent OR 3 daily summaries viewed
    return premiumStats.nudgesSent >= 3 || premiumStats.dailySummariesViewed >= 3;
  }, [globalPremium.active, premiumStats]);

  // Reset stats (for testing)
  const resetPremiumStats = useCallback(() => {
    setPremiumStats({
      nudgesSent: 0,
      dailySummariesViewed: 0,
      promptShownAt: null,
      lastPromptDismissed: null,
    });
  }, []);

  const value = {
    // Global Premium
    globalPremium,
    isGlobalPremium: globalPremium.active,
    activateGlobalPremium,
    deactivateGlobalPremium,

    // Room Premium
    roomPremium,
    isRoomPremium,
    activateRoomPremium,
    deactivateRoomPremium,

    // Transition state
    isTransitioning,
    transitionType,

    // Stats & Prompting
    premiumStats,
    trackNudgeSent,
    trackDailySummaryViewed,
    shouldShowPremiumPrompt,
    dismissPrompt,
    resetPremiumStats,
  };

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
};

export default PremiumContext;
