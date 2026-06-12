import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// All haptics are best-effort. Silently swallow errors so a missing
// vibrator/permission never breaks the UI.

const safe = <T,>(fn: () => Promise<T> | T): void => {
  if (Platform.OS === 'web') return;
  try {
    const out = fn();
    if (out && typeof (out as Promise<unknown>).then === 'function') {
      (out as Promise<unknown>).catch(() => {});
    }
  } catch {
    /* noop */
  }
};

// Subtle tap for tab changes, list-row taps, value bumps.
export const tapLight = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

// Medium tap for primary actions: pair, connect, preset selection.
export const tapMedium = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

// Heavy tap for power / destructive / disconnect actions.
export const tapHeavy = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));

// Selection change (toggles, picker movement).
export const tapSelection = () => safe(() => Haptics.selectionAsync());

// Success / warning / error notifications.
export const notifySuccess = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

export const notifyWarning = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));

export const notifyError = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
