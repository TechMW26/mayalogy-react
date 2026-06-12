import { useMemo, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type KnobProps = {
  label: string;
  value: number; // expected range: [-6, 6]
  min?: number;
  max?: number;
  size?: number;
  ringColor?: string;
  trackColor?: string;
  fillColor?: string;
  ink?: string;
  inkSoft?: string;
  surface?: string;
  onChange: (next: number) => void;
};

// Map an integer value to a -135deg..135deg sweep (a full 270deg arc, leaving the bottom 90deg open).
const SWEEP = 270;
const START_ANGLE = -135; // degrees, where the indicator points at min

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function Knob({
  label,
  value,
  min = -6,
  max = 6,
  size = 96,
  ringColor = '#e3d9c5',
  trackColor = '#efe6d3',
  fillColor = '#6f9b80',
  ink = '#1f1c17',
  inkSoft = '#6c6557',
  surface = '#fbf6ea',
  onChange,
}: KnobProps) {
  // Convert numeric value -> normalised 0..1
  const normalised = (value - min) / (max - min);
  const angleDeg = START_ANGLE + normalised * SWEEP;

  // Track drag start with a ref so we can apply a delta from where the user grabbed.
  const startValueRef = useRef(value);

  // Pulse animation for the active indicator dot
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startValueRef.current = value;
          indicatorAnim.setValue(1);
        },
        onPanResponderMove: (_e: GestureResponderEvent, gesture: PanResponderGestureState) => {
          // Vertical drag: up = increase, down = decrease.
          // 80px = full sweep across the whole range.
          const sensitivity = 80;
          const range = max - min;
          const delta = -(gesture.dy / sensitivity) * range;
          const next = clamp(Math.round(startValueRef.current + delta), min, max);
          if (next !== value) {
            onChange(next);
          }
        },
        onPanResponderRelease: () => {
          Animated.spring(indicatorAnim, {
            toValue: 0,
            tension: 60,
            friction: 7,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          indicatorAnim.setValue(0);
        },
      }),
    [value, min, max, indicatorAnim, onChange],
  );

  const ringStroke = Math.max(2, size * 0.05);
  const innerSize = size - ringStroke * 2;
  const indicatorLength = size * 0.22;
  const indicatorThickness = Math.max(2, size * 0.07);

  // Arc fill width — using a clipped overlay isn't trivial in pure RN without SVG.
  // We approximate the arc with twelve tick marks around the perimeter.
  const tickCount = 13;
  const ticks = [];
  for (let i = 0; i < tickCount; i++) {
    const fraction = i / (tickCount - 1);
    const isActive = fraction <= normalised;
    const tickAngle = START_ANGLE + fraction * SWEEP;
    ticks.push({ fraction, isActive, tickAngle });
  }

  const tickRadius = (size - ringStroke) / 2;
  const innerCircleSize = size - ringStroke * 4;
  const indicatorScale = indicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const displayValue = value > 0 ? `+${value}` : `${value}`;

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.outerRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: ringColor,
              borderWidth: ringStroke,
              backgroundColor: trackColor,
              transform: [{ scale: indicatorScale }],
            },
          ]}
        >
          {/* Tick marks distributed around the ring */}
          {ticks.map((tk, i) => {
            const radians = (tk.tickAngle - 90) * (Math.PI / 180);
            const tickLength = size * 0.07;
            const tickWidth = Math.max(1.5, size * 0.025);
            const cx = size / 2 + Math.cos(radians) * (tickRadius - tickLength * 0.6);
            const cy = size / 2 + Math.sin(radians) * (tickRadius - tickLength * 0.6);
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: cx - tickWidth / 2,
                  top: cy - tickLength / 2,
                  width: tickWidth,
                  height: tickLength,
                  borderRadius: tickWidth / 2,
                  backgroundColor: tk.isActive ? fillColor : ringColor,
                  transform: [{ rotate: `${tk.tickAngle}deg` }],
                }}
              />
            );
          })}

          {/* Inner dial */}
          <View
            style={{
              position: 'absolute',
              top: ringStroke * 2,
              left: ringStroke * 2,
              width: innerCircleSize,
              height: innerCircleSize,
              borderRadius: innerCircleSize / 2,
              backgroundColor: surface,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Text style={{ color: ink, fontSize: size * 0.18, fontWeight: '800' }}>
              {displayValue}
            </Text>
          </View>

          {/* Indicator notch */}
          <View
            style={{
              position: 'absolute',
              top: size / 2 - indicatorLength / 2,
              left: size / 2 - indicatorThickness / 2,
              width: indicatorThickness,
              height: indicatorLength,
              transform: [
                { rotate: `${angleDeg}deg` },
                { translateY: -(innerCircleSize / 2 - indicatorLength * 0.6) },
              ],
            }}
            pointerEvents="none"
          >
            <View
              style={{
                width: indicatorThickness,
                height: indicatorLength * 0.55,
                borderRadius: indicatorThickness / 2,
                backgroundColor: fillColor,
              }}
            />
          </View>
        </Animated.View>
      </View>

      <Text
        style={{
          color: inkSoft,
          fontSize: 11,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outerRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
