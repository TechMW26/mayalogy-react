import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  PanResponderGestureState,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { tapLight, tapSelection } from './haptics';

type VerticalSliderProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  height?: number;
  ink: string;
  inkSoft: string;
  trackColor: string;
  fillColor: string;
  centerColor?: string;
  onChange: (next: number) => void;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

const TRACK_WIDTH = 6;
const THUMB_SIZE = 26;

// Bipolar vertical slider with stable PanResponder and defensive handlers.
//
// Design notes for crash-resistance:
//   - PanResponder is built ONCE via useRef and reads live state via refs.
//     Recreating the responder mid-gesture causes the native gesture handler
//     to lose its state, which on Android Fabric manifests as a hard crash.
//   - The thumb is driven by an Animated.Value on the JS thread, so visual
//     smoothness doesn't depend on React re-renders.
//   - onChange is throttled to ~12 Hz during drag and always emitted on
//     release. Without this, every drag tick re-renders the entire 2000-line
//     AppScreen, which saturates the JS thread and triggers ANR.
//   - Haptic feedback is also throttled — firing Vibrator.vibrate() at 60 Hz
//     can crash some OEM haptic services.
//   - Every handler is wrapped in try/catch so a transient exception cannot
//     escape into the bridge and tear down the JS runtime.
export default function VerticalSlider({
  label,
  value,
  min = -6,
  max = 6,
  step = 1,
  height = 160,
  ink,
  inkSoft,
  trackColor,
  fillColor,
  centerColor,
  onChange,
}: VerticalSliderProps) {
  const [trackHeight, setTrackHeight] = useState(height);
  const [displayValue, setDisplayValue] = useState(value);
  const range = max - min;

  const fracAnim = useRef(new Animated.Value((value - min) / range)).current;
  const thumbScale = useRef(new Animated.Value(1)).current;

  // Live refs read by the PanResponder handlers.
  const valueRef = useRef(value);
  const trackHeightRef = useRef(trackHeight);
  const onChangeRef = useRef(onChange);
  const minRef = useRef(min);
  const maxRef = useRef(max);
  const rangeRef = useRef(range);
  const stepRef = useRef(step);
  const lastCommittedRef = useRef(value);
  const pendingValueRef = useRef(value);
  const startValueRef = useRef(value);
  const isDraggingRef = useRef(false);

  // Throttled emitters.
  const lastEmitAtRef = useRef(0);
  const lastHapticAtRef = useRef(0);
  // Timestamp of the most recent gesture event (grant/move). Used to tell a
  // genuinely active drag apart from a stale isDraggingRef flag that some
  // Android gesture terminations can leave stuck — which previously froze the
  // thumb in place while the numeric reading updated on a mode/preset change.
  const lastGestureAtRef = useRef(0);

  // Sync refs every render — these are reads, never writes.
  valueRef.current = value;
  trackHeightRef.current = trackHeight;
  onChangeRef.current = onChange;
  minRef.current = min;
  maxRef.current = max;
  rangeRef.current = range;
  stepRef.current = step;

  // External value changes (preset applied, auto-tune, mode switch, etc.) spring
  // the thumb into place. Skip only while a drag is GENUINELY active (a gesture
  // event fired very recently); a stale isDraggingRef must never freeze the
  // thumb, otherwise switching modes updates the reading but not the thumb.
  useEffect(() => {
    lastCommittedRef.current = value;
    pendingValueRef.current = value;
    setDisplayValue(value);
    const gestureActive =
      isDraggingRef.current && Date.now() - lastGestureAtRef.current < 250;
    if (gestureActive) return;
    isDraggingRef.current = false;
    try {
      Animated.spring(fracAnim, {
        toValue: (value - min) / range,
        tension: 200,
        friction: 22,
        useNativeDriver: false,
      }).start();
    } catch {
      // ignore animation failures
    }
  }, [value, min, range, fracAnim]);

  const onLayout = (e: LayoutChangeEvent) => {
    try {
      const h = e.nativeEvent.layout.height;
      if (h > 0 && Number.isFinite(h)) setTrackHeight(h);
    } catch {
      /* ignore */
    }
  };

  // Emit pending value to parent, throttled. `force` always emits.
  const emitChange = (force: boolean) => {
    try {
      const pending = pendingValueRef.current;
      if (pending === lastCommittedRef.current) return;
      const now = Date.now();
      if (!force && now - lastEmitAtRef.current < 80) return;
      lastEmitAtRef.current = now;
      lastCommittedRef.current = pending;
      onChangeRef.current(pending);
    } catch {
      /* ignore */
    }
  };

  const maybeHaptic = () => {
    try {
      const now = Date.now();
      if (now - lastHapticAtRef.current < 60) return;
      lastHapticAtRef.current = now;
      tapSelection();
    } catch {
      /* ignore */
    }
  };

  // Build PanResponder ONCE on mount. All live state is read through refs.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: (e: GestureResponderEvent) => {
        try {
          const h = trackHeightRef.current;
          if (h <= 0) return;
          isDraggingRef.current = true;
          lastGestureAtRef.current = Date.now();
          startValueRef.current = valueRef.current;
          pendingValueRef.current = valueRef.current;
          lastEmitAtRef.current = 0;
          lastHapticAtRef.current = 0;
          try {
            tapLight();
          } catch { /* ignore */ }
          try {
            Animated.spring(thumbScale, {
              toValue: 1.2,
              useNativeDriver: true,
              tension: 200,
              friction: 9,
            }).start();
          } catch { /* ignore */ }

          // Jump-to-tap.
          const localY = e.nativeEvent.locationY;
          if (!Number.isFinite(localY)) return;
          const y = clamp(localY, 0, h);
          const frac = 1 - y / h;
          const minLocal = minRef.current;
          const rangeLocal = rangeRef.current;
          const stepLocal = stepRef.current;
          const raw = frac * rangeLocal + minLocal;
          const next = clamp(
            Math.round(raw / stepLocal) * stepLocal,
            minLocal,
            maxRef.current,
          );
          pendingValueRef.current = next;
          startValueRef.current = next;
          try { fracAnim.setValue((next - minLocal) / rangeLocal); } catch { /* ignore */ }
          if (next !== lastCommittedRef.current) {
            maybeHaptic();
            try { setDisplayValue(next); } catch { /* ignore */ }
            emitChange(true);
          }
        } catch {
          isDraggingRef.current = false;
        }
      },

      onPanResponderMove: (_e: GestureResponderEvent, gesture: PanResponderGestureState) => {
        try {
          const h = trackHeightRef.current;
          if (h <= 0) return;
          lastGestureAtRef.current = Date.now();
          const minLocal = minRef.current;
          const rangeLocal = rangeRef.current;
          const stepLocal = stepRef.current;
          const maxLocal = maxRef.current;

          const startFrac = (startValueRef.current - minLocal) / rangeLocal;
          const startY = (1 - startFrac) * h;
          const dy = gesture.dy;
          if (!Number.isFinite(dy)) return;
          const rawY = clamp(startY + dy, 0, h);
          const rawFrac = 1 - rawY / h;
          try { fracAnim.setValue(rawFrac); } catch { /* ignore */ }

          const raw = rawFrac * rangeLocal + minLocal;
          const next = clamp(
            Math.round(raw / stepLocal) * stepLocal,
            minLocal,
            maxLocal,
          );
          if (next !== pendingValueRef.current) {
            pendingValueRef.current = next;
            maybeHaptic();
            try { setDisplayValue(next); } catch { /* ignore */ }
          }
          emitChange(false);
        } catch {
          /* swallow */
        }
      },

      onPanResponderRelease: () => {
        try {
          isDraggingRef.current = false;
          emitChange(true);
          const v = lastCommittedRef.current;
          try {
            Animated.spring(thumbScale, {
              toValue: 1,
              useNativeDriver: true,
              tension: 200,
              friction: 9,
            }).start();
          } catch { /* ignore */ }
          try {
            Animated.spring(fracAnim, {
              toValue: (v - minRef.current) / rangeRef.current,
              tension: 220,
              friction: 22,
              useNativeDriver: false,
            }).start();
          } catch { /* ignore */ }
        } catch {
          /* swallow */
        }
      },

      onPanResponderTerminate: () => {
        try {
          isDraggingRef.current = false;
          emitChange(true);
          try { thumbScale.setValue(1); } catch { /* ignore */ }
          try {
            fracAnim.setValue(
              (lastCommittedRef.current - minRef.current) / rangeRef.current,
            );
          } catch { /* ignore */ }
        } catch {
          /* swallow */
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ).current;

  const display = displayValue > 0 ? `+${displayValue}` : `${displayValue}`;
  const isZero = displayValue === 0;

  // Guard against degenerate trackHeight before first layout.
  const safeTrackHeight = trackHeight > 0 ? trackHeight : height;

  const thumbTop = fracAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [safeTrackHeight - THUMB_SIZE / 2, -THUMB_SIZE / 2],
  });
  const centerY = safeTrackHeight / 2;
  const fillTop = fracAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [centerY, centerY, 0],
  });
  const fillHeight = fracAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [centerY, 0, centerY],
  });

  const tickFractions = [0, 0.25, 0.5, 0.75, 1];

  return (
    <View style={styles.root}>
      <Text style={[styles.value, { color: isZero ? inkSoft : ink }]}>{display}</Text>

      <View style={styles.trackWrap} {...panResponder.panHandlers}>
        <View
          style={{
            height,
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingRight: 6,
          }}
        >
          {tickFractions.map((tf) => (
            <View
              key={`tick-${tf}`}
              style={{
                width: 6,
                height: 1,
                backgroundColor: trackColor,
                opacity: 0.9,
              }}
            />
          ))}
        </View>

        <View
          style={[styles.track, { height, backgroundColor: trackColor }]}
          onLayout={onLayout}
        >
          {centerColor ? (
            <View
              style={{
                position: 'absolute',
                left: -3,
                right: -3,
                top: centerY - 1,
                height: 2,
                borderRadius: 1,
                backgroundColor: centerColor,
                opacity: 0.85,
                pointerEvents: 'none',
              }}
            />
          ) : null}

          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: fillTop,
              height: fillHeight,
              backgroundColor: fillColor,
              borderRadius: TRACK_WIDTH / 2,
              pointerEvents: 'none',
            }}
          />

          <Animated.View
            style={[
              styles.thumb,
              {
                top: thumbTop,
                left: -(THUMB_SIZE - TRACK_WIDTH) / 2,
                borderColor: fillColor,
                transform: [{ scale: thumbScale }],
              },
            ]}
          />
        </View>
      </View>

      <Text style={[styles.label, { color: inkSoft }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: 10,
  },
  value: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  trackWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  track: {
    width: TRACK_WIDTH,
    borderRadius: TRACK_WIDTH / 2,
    overflow: 'visible',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    shadowColor: '#3a2f1f',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
});
