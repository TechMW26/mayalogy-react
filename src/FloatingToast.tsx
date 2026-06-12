import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

type FloatingToastProps = {
  message: string | null;
  onHide: () => void;
  /** Safe-area inset at the bottom of the screen. */
  bottomInset: number;
  /** ms before auto-hide. Defaults to 3200. */
  durationMs?: number;
};

// A single floating toast that rises up from the bottom of the screen,
// holds, then sinks back down and fades out. Auto-clears its message via
// onHide once the exit animation completes. Mount it ONCE near the root
// and pass it the current message string; it handles the rest.
//
// Designed to be unobtrusive: small pill, soft warm-cream surface, ink text.
export default function FloatingToast({
  message,
  onHide,
  bottomInset,
  durationMs = 3200,
}: FloatingToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMsgRef = useRef<string | null>(null);

  useEffect(() => {
    // Only react when the message identity changes; don't re-trigger the
    // animation on unrelated re-renders.
    if (message === lastMsgRef.current) return;
    lastMsgRef.current = message;

    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }

    if (message) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 120,
          friction: 14,
          useNativeDriver: true,
        }),
      ]).start();

      hideTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 240,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 24,
            duration: 240,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) onHide();
        });
      }, durationMs);
    }

    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
  }, [message, durationMs, opacity, translateY, onHide]);

  if (!message && lastMsgRef.current === null) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          bottom: bottomInset + 16,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.toast}>
        <Text style={styles.text} numberOfLines={3}>
          {message ?? lastMsgRef.current}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 100,
  },
  toast: {
    minHeight: 44,
    maxWidth: '100%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#1f1c17',
    justifyContent: 'center',
    shadowColor: '#1f1c17',
    shadowOpacity: Platform.OS === 'ios' ? 0.22 : 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
