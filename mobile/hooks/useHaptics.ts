/**
 * useHaptics — Haptic feedback hook for Krios
 *
 * Uses a dynamic require so the app works gracefully whether or not
 * expo-haptics is installed. All methods are fully async and wrapped
 * in try/catch so they never throw on unsupported devices.
 */

// Safe dynamic import — expo-haptics may not be installed yet.
// Using `any` to avoid TS errors when the package is absent.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Haptics: any = null;
try {
  Haptics = require('expo-haptics');
} catch {
  // expo-haptics not installed — all haptic calls will be silent no-ops
}

export function useHaptics() {
  /** Light impact — general UI tap / button press */
  const tap = async (): Promise<void> => {
    try {
      await Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Not supported — fail silently
    }
  };

  /** Medium impact — secondary actions, drag handles */
  const medium = async (): Promise<void> => {
    try {
      await Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Not supported — fail silently
    }
  };

  /** Heavy impact — dramatic press, modal open/close, long-press confirm */
  const heavy = async (): Promise<void> => {
    try {
      await Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // Not supported — fail silently
    }
  };

  /** Notification success — task completed, positive confirmation */
  const success = async (): Promise<void> => {
    try {
      await Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Not supported — fail silently
    }
  };

  /** Notification warning — caution, soft alert, premium gate */
  const warning = async (): Promise<void> => {
    try {
      await Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // Not supported — fail silently
    }
  };

  /** Notification error — destructive action, failure state */
  const error = async (): Promise<void> => {
    try {
      await Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Not supported — fail silently
    }
  };

  /** Selection changed — picker wheels, tab switch, toggle, mood selector */
  const selection = async (): Promise<void> => {
    try {
      await Haptics?.selectionAsync?.();
    } catch {
      // Not supported — fail silently
    }
  };

  return {
    tap,
    medium,
    heavy,
    success,
    warning,
    error,
    selection,
  };
}

export default useHaptics;
