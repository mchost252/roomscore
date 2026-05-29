/**
 * useFocusTimer — Focus session countdown logic
 * 
 * Manages the timer state, pause/resume, and completion detection.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export type TimerState = 'idle' | 'running' | 'paused' | 'completed';

interface UseFocusTimerReturn {
  state: TimerState;
  secondsRemaining: number;
  totalSeconds: number;
  progress: number;        // 0-1
  timeDisplay: string;     // "25:00"
  endTime: string;         // "7:15 PM"
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skip: () => void;
}

export function useFocusTimer(durationMinutes: number): UseFocusTimerReturn {
  const totalSeconds = durationMinutes * 60;
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);
  const [state, setState] = useState<TimerState>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef<Date | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Detect completion
  useEffect(() => {
    if (secondsRemaining <= 0 && state === 'running') {
      setState('completed');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [secondsRemaining, state]);

  const start = useCallback(() => {
    setSecondsRemaining(totalSeconds);
    setState('running');
    endTimeRef.current = new Date(Date.now() + totalSeconds * 1000);
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
  }, [totalSeconds]);

  const pause = useCallback(() => {
    setState('paused');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    setState('running');
    endTimeRef.current = new Date(Date.now() + secondsRemaining * 1000);
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
  }, [secondsRemaining]);

  const stop = useCallback(() => {
    setState('idle');
    setSecondsRemaining(totalSeconds);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [totalSeconds]);

  const skip = useCallback(() => {
    setSecondsRemaining(0);
  }, []);

  // Format time
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeDisplay = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  // End time display
  const endDate = endTimeRef.current || new Date(Date.now() + secondsRemaining * 1000);
  const endTime = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Progress (0 = just started, 1 = complete)
  const progress = totalSeconds > 0 ? 1 - (secondsRemaining / totalSeconds) : 0;

  return {
    state,
    secondsRemaining,
    totalSeconds,
    progress,
    timeDisplay,
    endTime,
    start,
    pause,
    resume,
    stop,
    skip,
  };
}
