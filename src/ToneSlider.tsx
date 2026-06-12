import { useMemo, useRef, useState } from 'react';
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

type ToneSliderProps = {
  label: string;
  value: number; // expected -6..+6
  min?: number;
  max?: number;
  step?: number;
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

const THUMB_SIZE = 26;
const TRACK_HEIGHT = 6;
const TICK_HEIGHT = 4;

// Bipolar (-6..+6) horizontal slider with a centre origin and tick marks.
// Drag the thumb or tap anywhere on the track.
export default function ToneSlider({
  label,
  value,
  min = -6,
  max = 6,
  step = 1,
  ink,
  inkSoft,
  trackColor,
  fillColor,
  centerColor,
  onChange,
}: ToneSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const startValueRef = useRef(value);
  const isDraggingRef = useRef(false);
  const thumbScale = useRef(new Animated.Value(1)).current;

  const range = max - min;

  const valueToX = (v: number) => {
    if (trackWidth <= 0) return 0;
    return ((v - min) / range) * trackWidth;
  };
  const xToValue = (x: number) => {
    if (trackWidth <= 0) return min;
    const clamped = clamp(x, 0, trackWidth);
    const raw = (clamped / trackWidth) * range + min;
    return clamp(Math.round(raw / step) * step, min, max);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          startValueRef.current = value;
          isDraggingRef.current = true;
          tapLight();
          Animated.spring(thumbScale, {
            toValue: 1.18,
            useNativeDriver: true,
            tension: 120,
            friction: 7,
          }).start();
          // Jump-to-tap: derive starting value from where the user touched.
          const next = xToValue(e.nativeEvent.locationX);
          if (next !== value) {
            tapSelection();
            onChange(next);
          }
          startValueRef.current = next;
        },
        onPanResponderMove: (_e: GestureResponderEvent, gesture: PanResponderGestureState) => {
          if (trackWidth <= 0) return;
          const startX = valueToX(startValueRef.current);
          const nextX = startX + gesture.dx;
          const next = xToValue(nextX);
          if (next !== value) {
            tapSelection();
            onChange(next);
          }
        },
        onPanResponderRelease: () => {
          isDraggingRef.current = false;
          Animated.spring(thumbScale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 120,
            friction: 8,
          }).start();
        },
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
          thumbScale.setValue(1);
        },
      }),
    [trackWidth, value, range, min, max, step, thumbScale, onChange],
  );

  const centerX = valueToX(0);
  const thumbX = valueToX(value);

  const fillLeft = Math.min(centerX, thumbX);
  const fillWidth = Math.abs(thumbX - centerX);

  const display = value > 0 ? `+${value}` : `${value}`;
  const isZero = value === 0;

  // Tick marks: -6, -3, 0, +3, +6.
  const tickValues = [min, min / 2, 0, max / 2, max];

  return (
    <View style={styles.root}>
      <View style={styles.headRow}>
        <Text style={[styles.label, { color: inkSoft }]}>{label}</Text>
        <Text
          style={[
            styles.value,
            { color: isZero ? inkSoft : ink },
          ]}
        >
          {display} dB
        </Text>
      </View>

      <View style={styles.trackWrap} {...panResponder.panHandlers}>
        <View
          style={[styles.track, { backgroundColor: trackColor }]}
          onLayout={onLayout}
        >
          {/* Centre origin tick */}
          {centerColor ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: centerX - 1,
                top: -TICK_HEIGHT / 2,
                width: 2,
                height: TRACK_HEIGHT + TICK_HEIGHT,
                borderRadius: 1,
                backgroundColor: centerColor,
                opacity: 0.7,
              }}
            />
          ) : null}

          {/* Active fill (from centre to thumb) */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: fillLeft,
              top: 0,
              width: fillWidth,
              height: TRACK_HEIGHT,
              borderRadius: TRACK_HEIGHT / 2,
              backgroundColor: fillColor,
            }}
          />

          {/* Tick dots below the track */}
          <View pointerEvents="none" style={styles.tickRow}>
            {tickValues.map((tv) => {
              const tx = valueToX(tv);
              return (
                <View
                  key={`tick-${tv}`}
                  style={{
                    position: 'absolute',
                    left: tx - 1,
                    top: TRACK_HEIGHT + 6,
                    width: 2,
                    height: TICK_HEIGHT,
                    borderRadius: 1,
                    backgroundColor: trackColor,
                  }}
                />
              );
            })}
          </View>

          {/* Thumb */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                left: thumbX - THUMB_SIZE / 2,
                top: -(THUMB_SIZE - TRACK_HEIGHT) / 2,
                borderColor: fillColor,
                transform: [{ scale: thumbScale }],
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: 8,
    gap: 8,
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 2,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  value: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  trackWrap: {
    paddingVertical: (THUMB_SIZE - TRACK_HEIGHT) / 2 + 6,
    marginBottom: TICK_HEIGHT + 6,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    width: '100%',
  },
  tickRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: TRACK_HEIGHT,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    shadowColor: '#3a2f1f',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});
