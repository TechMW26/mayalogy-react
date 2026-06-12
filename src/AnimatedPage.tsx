import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

type AnimatedPageProps = {
  pageKey: string;
  children: React.ReactNode;
};

// Cross-fade + slight drop transition keyed off pageKey. The new page
// enters from slightly ABOVE its final position and settles downward,
// giving a calmer "unfolding from the top" feel.
export default function AnimatedPage({ pageKey, children }: AnimatedPageProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(-12)).current;

  // Track which page is currently mounted so we re-trigger animation on key change.
  const previousKey = useRef(pageKey);
  const childrenRef = useRef<React.ReactNode>(children);
  const memoChildren = useMemo(() => children, [children]);
  childrenRef.current = memoChildren;

  useEffect(() => {
    opacity.setValue(0);
    translate.setValue(-12);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    previousKey.current = pageKey;
  }, [pageKey, opacity, translate]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        { opacity, transform: [{ translateY: translate }] },
      ]}
    >
      <View style={{ flex: 1 }}>{memoChildren}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
});
