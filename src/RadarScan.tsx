import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle as SvgCircle,
  Path as SvgPath,
  Polyline as SvgPolyline,
} from 'react-native-svg';

import type { CicadaDevice } from './bluetooth';
import { tapLight, tapMedium } from './haptics';

type RadarScanProps = {
  bg: string;
  ink: string;
  inkSoft: string;
  accent: string;
  accentSoft: string;
  line: string;
  surface: string;
  isScanning: boolean;
  devices: CicadaDevice[];
  speakerImage: ImageSourcePropType;
  onClose: () => void;
  onSelectDevice: (d: CicadaDevice) => void;
  onRescan: () => void;
};

// Stable polar position for each discovered device, derived from address hash.
function positionFor(address: string, radius: number, index: number) {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) & 0xffffffff;
  }
  const baseAngle = ((Math.abs(hash) % 360) / 360) * Math.PI * 2;
  const ringIndex = index % 2;
  const distance = radius * (ringIndex === 0 ? 0.62 : 0.92);
  return {
    x: Math.cos(baseAngle) * distance,
    y: Math.sin(baseAngle) * distance,
  };
}

function BluetoothGlyph({ size, color }: { size: number; color: string }) {
  // Classic bluetooth rune — same shape used elsewhere in the app.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPath
        d="M7 8 L17 16 L12 20 L12 4 L17 8 L7 16"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronLeftIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPolyline
        points="15 6 8 12 15 18"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function RefreshIcon({ size, color }: { size: number; color: string }) {
  // Circular arrow — a stroked 3/4 circle with a small arrowhead.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPath
        d="M20 12 A 8 8 0 1 1 16 5.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      <SvgPolyline
        points="20 3 20 7 16 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export default function RadarScan({
  bg,
  ink,
  inkSoft,
  line,
  surface,
  isScanning,
  devices,
  speakerImage,
  onClose,
  onSelectDevice,
  onRescan,
}: RadarScanProps) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const centerPulse = useRef(new Animated.Value(0)).current;
  const bubbleAnims = useRef<Record<string, Animated.Value>>({}).current;

  useEffect(() => {
    const pulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 2600,
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

    const centerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(centerPulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(centerPulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    pulse(ring1, 0).start();
    pulse(ring2, 850).start();
    pulse(ring3, 1700).start();
    centerLoop.start();

    return () => {
      ring1.stopAnimation();
      ring2.stopAnimation();
      ring3.stopAnimation();
      centerPulse.stopAnimation();
    };
  }, [ring1, ring2, ring3, centerPulse]);

  useEffect(() => {
    devices.forEach((d) => {
      if (!bubbleAnims[d.address]) {
        bubbleAnims[d.address] = new Animated.Value(0);
        Animated.spring(bubbleAnims[d.address], {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [devices, bubbleAnims]);

  const radius = 140;
  const stageSize = radius * 2 + 80;

  const ringStyle = (val: Animated.Value) => ({
    transform: [
      {
        scale: val.interpolate({
          inputRange: [0, 1],
          outputRange: [0.25, 1],
        }),
      },
    ],
    opacity: val.interpolate({
      inputRange: [0, 0.6, 1],
      outputRange: [0, 0.45, 0],
    }),
  });

  const centerScale = centerPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const cicadaDevices = useMemo(
    () => devices.filter((d) => d.matchedAsCicada),
    [devices],
  );
  const otherDevices = useMemo(
    () => devices.filter((d) => !d.matchedAsCicada),
    [devices],
  );
  const sortedDevices = useMemo(
    () => [...cicadaDevices, ...otherDevices],
    [cicadaDevices, otherDevices],
  );

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => { tapLight(); onClose(); }}
          hitSlop={8}
          style={[styles.iconCircle, { borderColor: line, backgroundColor: surface }]}
        >
          <ChevronLeftIcon size={18} color={ink} />
        </Pressable>
        <Text style={[styles.title, { color: ink }]}>Find a Cicada</Text>
        <Pressable
          onPress={() => { tapLight(); onRescan(); }}
          hitSlop={8}
          style={[styles.iconCircle, { borderColor: line, backgroundColor: surface }]}
        >
          <RefreshIcon size={18} color={ink} />
        </Pressable>
      </View>

      <View style={styles.centeredStage}>
        <View style={styles.copyBlock}>
          {(() => {
            // Headline + sub adapt to scan state. We only ever surface
            // Cicadas (the discovery filter rejects everything else), so
            // copy is purely about Cicada count + scanning state.
            const cicadaCount = cicadaDevices.length;
            let title: string;
            let sub: string;
            if (isScanning && cicadaCount === 0) {
              title = 'Listening for Cicadas';
              sub = 'Sweeping the airwaves nearby…';
            } else if (isScanning && cicadaCount > 0) {
              title =
                cicadaCount === 1
                  ? '1 Cicada in range'
                  : `${cicadaCount} Cicadas in range`;
              sub = 'Still listening for more…';
            } else if (cicadaCount > 0) {
              title =
                cicadaCount === 1
                  ? 'Cicada found'
                  : `${cicadaCount} Cicadas found`;
              sub = 'Pick one to pair, or sweep again.';
            } else {
              title = 'No Cicadas nearby';
              sub = 'Make sure your Cicada is on, then sweep again.';
            }
            return (
              <>
                <Text style={[styles.tapTitle, { color: ink }]}>{title}</Text>
                <Text style={[styles.tapSubtitle, { color: inkSoft }]}>{sub}</Text>
              </>
            );
          })()}
        </View>

        <View style={styles.stageWrap}>
          <View
            style={{
              width: stageSize,
              height: stageSize,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {[1, 0.72, 0.46].map((scale) => (
              <View
                key={`guide-${scale}`}
                style={{
                  position: 'absolute',
                  width: radius * 2 * scale,
                  height: radius * 2 * scale,
                  borderRadius: radius,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: line,
                  opacity: 0.9,
                }}
              />
            ))}

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

            {sortedDevices.map((d, i) => {
              const pos = positionFor(d.address, radius, i);
              const anim = bubbleAnims[d.address] ?? new Animated.Value(1);
              const isCicada = d.matchedAsCicada;
              return (
                <Animated.View
                  key={d.address}
                  style={{
                    position: 'absolute',
                    left: stageSize / 2 + pos.x - 26,
                    top: stageSize / 2 + pos.y - 26,
                    transform: [{ scale: anim }],
                    opacity: anim,
                  }}
                >
                  <Pressable onPress={() => { tapMedium(); onSelectDevice(d); }}>
                    {isCicada ? (
                      <View style={styles.cicadaBubble}>
                        <Image
                          source={speakerImage}
                          style={{ width: 44, height: 44 }}
                          resizeMode="contain"
                        />
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.audioBubble,
                          { backgroundColor: surface, borderColor: line },
                        ]}
                      >
                        <BluetoothGlyph size={14} color={inkSoft} />
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}

            <Pressable onPress={() => { tapLight(); onRescan(); }} hitSlop={8}>
              <Animated.View
                style={[
                  styles.centerChip,
                  {
                    backgroundColor: ink,
                    shadowColor: ink,
                    transform: [{ scale: centerScale }],
                  },
                ]}
              >
                <BluetoothGlyph size={28} color="#fff" />
              </Animated.View>
            </Pressable>
          </View>
        </View>

        <View style={styles.footerPillWrap}>
          <Pressable
            style={[styles.footerPill, { borderColor: line, backgroundColor: surface }]}
            onPress={() => { tapLight(); onRescan(); }}
          >
            <Text style={[styles.footerPillLabel, { color: ink }]}>
              Can’t see yours?
            </Text>
          </Pressable>

          {sortedDevices.length > 0 ? (
            <View style={styles.foundListWrap}>
              <Text style={[styles.eyebrow, { color: inkSoft }]}>
                Found ({sortedDevices.length})
              </Text>
              <View style={{ gap: 10, width: '100%' }}>
                {sortedDevices.slice(0, 3).map((d) => {
                  const isCicada = d.matchedAsCicada;
                  return (
                    <Pressable
                      key={`row-${d.address}`}
                      onPress={() => { tapMedium(); onSelectDevice(d); }}
                      style={[
                        styles.row,
                        { backgroundColor: surface, borderColor: line },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: ink, fontSize: 14, fontWeight: '700' }}>
                          {isCicada ? 'Cicada' : 'Audio device'}
                        </Text>
                        <Text
                          style={{ color: inkSoft, fontSize: 12, marginTop: 2 }}
                        >
                          {isCicada
                            ? 'Cicada · ready to pair'
                            : 'Bluetooth audio device'}
                        </Text>
                      </View>
                      <View
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderRadius: 999,
                          backgroundColor: isCicada ? ink : surface,
                          borderWidth: isCicada ? 0 : 1,
                          borderColor: line,
                        }}
                      >
                        <Text
                          style={{
                            color: isCicada ? '#fff' : ink,
                            fontSize: 12,
                            fontWeight: '700',
                          }}
                        >
                          Pair
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chevron: {
    fontSize: 26,
    fontWeight: '600',
    lineHeight: 26,
  },
  refresh: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  copyBlock: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  tapTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  tapSubtitle: {
    fontSize: 12,
    marginTop: 6,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  centeredStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  stageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerChip: {
    width: 70,
    height: 70,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cicadaBubble: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerPillWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  footerPill: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  footerPillLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  foundListWrap: {
    width: '100%',
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
