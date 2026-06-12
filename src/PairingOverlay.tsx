import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type PairingOverlayProps = {
  visible: boolean;
  bg: string;
  ink: string;
  inkSoft: string;
  line: string;
  surface: string;
  speakerImage: ImageSourcePropType;
  title: string;
  subtitle: string;
  onCancel?: () => void;
};

export default function PairingOverlay({
  visible,
  bg,
  ink,
  inkSoft,
  line,
  surface,
  speakerImage,
  title,
  subtitle,
  onCancel,
}: PairingOverlayProps) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const dots = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    if (!visible) return;

    const pulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    const dotLoop = Animated.loop(
      Animated.stagger(
        200,
        dots.map((d) =>
          Animated.sequence([
            Animated.timing(d, {
              toValue: 1,
              duration: 380,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(d, {
              toValue: 0,
              duration: 380,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ),
      ),
    );

    pulse(ring1, 0).start();
    pulse(ring2, 700).start();
    pulse(ring3, 1400).start();
    bobLoop.start();
    dotLoop.start();

    return () => {
      ring1.stopAnimation();
      ring2.stopAnimation();
      ring3.stopAnimation();
      bob.stopAnimation();
      dots.forEach((d) => d.stopAnimation());
    };
  }, [visible, ring1, ring2, ring3, bob, dots]);

  const ringStyle = (val: Animated.Value) => ({
    transform: [
      {
        scale: val.interpolate({
          inputRange: [0, 1],
          outputRange: [0.4, 1.05],
        }),
      },
    ],
    opacity: val.interpolate({
      inputRange: [0, 0.6, 1],
      outputRange: [0, 0.5, 0],
    }),
  });

  const bobTranslate = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const radius = 130;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={[styles.root, { backgroundColor: bg }]}>
        <View style={styles.body}>
          <View
            style={{
              width: radius * 2 + 40,
              height: radius * 2 + 40,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Static guide ring */}
            <View
              style={{
                position: 'absolute',
                width: radius * 2,
                height: radius * 2,
                borderRadius: radius,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: line,
                opacity: 0.9,
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: radius * 1.4,
                height: radius * 1.4,
                borderRadius: radius,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: line,
                opacity: 0.9,
              }}
            />

            {/* Pulsing rings */}
            {([ring1, ring2, ring3] as Animated.Value[]).map((val, i) => (
              <Animated.View
                key={`pulse-${i}`}
                style={[
                  {
                    position: 'absolute',
                    width: radius * 2,
                    height: radius * 2,
                    borderRadius: radius,
                    borderWidth: 1.2,
                    borderColor: ink,
                  },
                  ringStyle(val),
                ]}
              />
            ))}

            {/* Bobbing speaker hero */}
            <Animated.View style={{ transform: [{ translateY: bobTranslate }] }}>
              <Image
                source={speakerImage}
                style={{ width: 140, height: 140 }}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          <View style={styles.copyBlock}>
            <Text style={[styles.title, { color: ink }]}>{title}</Text>
            <View style={styles.subtitleRow}>
              <Text style={[styles.subtitle, { color: inkSoft }]}>{subtitle}</Text>
              <View style={styles.dotsRow}>
                {dots.map((d, i) => (
                  <Animated.View
                    key={`dot-${i}`}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: ink,
                        opacity: d.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.2, 1],
                        }),
                        transform: [
                          {
                            scale: d.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.7, 1.1],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>

        {onCancel ? (
          <View style={styles.footer}>
            <Pressable
              onPress={onCancel}
              hitSlop={8}
              style={[
                styles.cancelBtn,
                { borderColor: line, backgroundColor: surface },
              ]}
            >
              <Text style={[styles.cancelLabel, { color: ink }]}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  body: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBlock: {
    alignItems: 'center',
    marginTop: 28,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subtitle: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cancelBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  cancelLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
