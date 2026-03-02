import { useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { PersonalTask } from '../services/taskService';

// Stub aiBehaviorEngine until implemented
const aiBehaviorEngine = {
  trackAppOpen: () => {},
  trackTaskCreated: (_task: PersonalTask) => {},
  trackTaskCompleted: (_task: PersonalTask) => {},
  trackMoodSelection: (_mood: string) => {},
};

export function useBehaviorTracking() {
  useEffect(() => {
    aiBehaviorEngine.trackAppOpen();
    
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        aiBehaviorEngine.trackAppOpen();
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, []);

  const trackTaskCreated = useCallback((task: PersonalTask) => {
    aiBehaviorEngine.trackTaskCreated(task);
  }, []);

  const trackTaskCompleted = useCallback((task: PersonalTask) => {
    aiBehaviorEngine.trackTaskCompleted(task);
  }, []);

  const trackMoodSelected = useCallback((mood: string) => {
    aiBehaviorEngine.trackMoodSelection(mood);
  }, []);

  return {
    trackTaskCreated,
    trackTaskCompleted,
    trackMoodSelected,
  };
}

export default useBehaviorTracking;
