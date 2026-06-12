import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

type AnimatedSplashProps = {
  bg?: string;
  accent?: string;
  ink?: string;
  onDone: () => void;
};

const iconSource = require('../assets/icon.png');

// Minimal, professional splash:
//   1. Icon springs in (single subtle scale + fade)
//   2. Wordmark "ZENOVA" fades up from below
//   3. Single thin progress sweep at the bottom
//   4. Whole stage cross-fades out
export default function AnimatedSplash({
  bg = '#f4eee2',
  ink = '#1f1c17',
  onDone,
}: AnimatedSplashProps) {
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.92)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordTranslate = useRef(new Animated.Value(8)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(iconScale, {
          toValue: 1,
          tension: 90,
          friction: 9,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(wordOpacity, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(wordTranslate, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(progress, {
        toValue: 1,
        duration: 700,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.delay(180),
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 320,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [
    containerOpacity,
    iconOpacity,
    iconScale,
    wordOpacity,
    wordTranslate,
    progress,
    onDone,
  ]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { backgroundColor: bg, opacity: containerOpacity }]}
    >
      <Animated.View
        style={{
          opacity: iconOpacity,
          transform: [{ scale: iconScale }],
        }}
      >
        <Image source={iconSource} style={styles.iconImage} resizeMode="contain" />
      </Animated.View>

      <Animated.View
        style={{
          opacity: wordOpacity,
          transform: [{ translateY: wordTranslate }],
          marginTop: 20,
        }}
      >
        <Text style={[styles.wordmark, { color: ink }]}>ZENOVA</Text>
      </Animated.View>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { backgroundColor: ink, width: progressWidth }]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  iconImage: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  wordmark: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 8,
  },
  progressWrap: {
    position: 'absolute',
    bottom: 84,
    width: 96,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 1.5,
    borderRadius: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(31, 28, 23, 0.12)',
  },
  progressFill: {
    height: '100%',
  },
});
