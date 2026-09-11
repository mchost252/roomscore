/**
 * useFocusTimer — Focus session countdown logic
 * 
 * Manages the timer state, pause/resume, and completion detection.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';

export type TimerState = 'idle' | 'running' | 'paused' | 'completed';

interface UseFocusTimerReturn {
  state: TimerState;
  secondsRemaining: number;
  totalSeconds: number;
  progress: number;        // 0-1
  timeDisplay: string;     // "25:00" (remaining)
  elapsedDisplay: string;  // "00:17" (elapsed, HH:MM)
  elapsedMinutes: number;
  remainingPercent: number;
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
  // Wall-clock target — setInterval is throttled/killed in background, so every
  // tick recomputes from this instead of trusting accumulated decrements.
  const targetRef = useRef<number>(0);

  const computeRemaining = useCallback(() => {
    if (!targetRef.current) return 0;
    return Math.max(0, Math.round((targetRef.current - Date.now()) / 1000));
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Re-sync when returning from background/lock while running.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && intervalRef.current) {
        setSecondsRemaining(computeRemaining());
      }
    });
    return () => sub.remove();
  }, [computeRemaining]);

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
    targetRef.current = Date.now() + totalSeconds * 1000;
    setSecondsRemaining(totalSeconds);
    setState('running');
    endTimeRef.current = new Date(targetRef.current);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSecondsRemaining(computeRemaining());
    }, 500);
  }, [totalSeconds, computeRemaining]);

  const pause = useCallback(() => {
    setSecondsRemaining(computeRemaining());
    setState('paused');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [computeRemaining]);

  const resume = useCallback(() => {
    targetRef.current = Date.now() + secondsRemaining * 1000;
    setState('running');
    endTimeRef.current = new Date(targetRef.current);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSecondsRemaining(computeRemaining());
    }, 500);
  }, [secondsRemaining, computeRemaining]);

  const stop = useCallback(() => {
    targetRef.current = 0;
    setState('idle');
    setSecondsRemaining(totalSeconds);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [totalSeconds]);

  const skip = useCallback(() => {
    targetRef.current = Date.now();
    setSecondsRemaining(0);
  }, []);

  // Format time (remaining countdown)
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeDisplay = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  // Elapsed display — ticks every second (MM:SS, H:MM:SS past an hour).
  // NOTE: the mock shows a static HH:MM ("00:17"), but a live HH:MM looks
  // frozen for 60s at a time — that read as "timer not counting".
  const elapsedSeconds = Math.max(0, totalSeconds - secondsRemaining);
  const eH = Math.floor(elapsedSeconds / 3600);
  const eM = Math.floor((elapsedSeconds % 3600) / 60);
  const eS = elapsedSeconds % 60;
  const elapsedDisplay = eH > 0
    ? `${eH}:${eM.toString().padStart(2, '0')}:${eS.toString().padStart(2, '0')}`
    : `${eM.toString().padStart(2, '0')}:${eS.toString().padStart(2, '0')}`;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const remainingPercent = totalSeconds > 0 ? Math.round((secondsRemaining / totalSeconds) * 100) : 0;

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
    elapsedDisplay,
    elapsedMinutes,
    remainingPercent,
    endTime,
    start,
    pause,
    resume,
    stop,
    skip,
  };
}
