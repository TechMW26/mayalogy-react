import { requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import {
  getKaraokeLevel,
  isAudioRouteReady,
  isKaraokeRunning,
  setKaraokeParams,
  startKaraoke,
  stopKaraoke,
  type KaraokeParams,
} from 'zenova-audio-fx';

import { tapLight, tapMedium, tapSelection } from './haptics';

type Theme = {
  bg: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  line: string;
  surface: string;
  accent: string;
  accentSoft: string;
  selected: string;
};

type IconProps = { size: number; color: string };

type VoicePresetKey =
  | 'clean'
  | 'studio'
  | 'cathedral'
  | 'echo'
  | 'telephone'
  | 'megaphone'
  | 'robot';

type VoicePreset = {
  key: VoicePresetKey;
  label: string;
  caption: string;
  Icon: (p: IconProps) => ReactElement;
  params: KaraokeParams;
};

// ---------------------------------------------------------------------------
// Effect icons \u2014 minimal stroke-only glyphs at 24x24.
// ---------------------------------------------------------------------------

const IconClean = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={2.5} fill={color} />
    <Path
      d="M12 4v3 M12 17v3 M4 12h3 M17 12h3 M6 6l1.8 1.8 M16.2 16.2L18 18 M16.2 7.8L18 6 M6 18l1.8-1.8"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

const IconStudio = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={4} y={4} width={16} height={16} rx={2.5} stroke={color} strokeWidth={1.6} />
    <Circle cx={12} cy={12} r={2.5} fill={color} />
    <Path d="M4 12h3 M17 12h3 M12 4v3 M12 17v3" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
  </Svg>
);

const IconCathedral = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 20V12a7 7 0 0114 0v8" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    <Path d="M9 20v-4a3 3 0 016 0v4" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    <Path d="M3 20h18" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    <Path d="M12 5V3" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
  </Svg>
);

const IconEcho = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={6} cy={12} r={2} fill={color} />
    <Path d="M11 8.2a5 5 0 010 7.6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    <Path d="M14.6 5a9 9 0 010 14" stroke={color} strokeWidth={1.55} strokeLinecap="round" />
    <Path d="M18.2 2a13 13 0 010 20" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

const IconTelephone = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 5l3 1 1 4-2 1a8 8 0 006 6l1-2 4 1 1 3a2 2 0 01-2 2C9.8 21 3 14.2 3 7a2 2 0 012-2z"
      stroke={color}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  </Svg>
);

const IconMegaphone = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 10v4l11 5V5z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    <Path d="M14 8.5a4 4 0 010 7" stroke={color} strokeWidth={1.55} strokeLinecap="round" />
    <Path d="M6 14v4a2 2 0 002 2h2v-4" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
  </Svg>
);

const IconRobot = ({ size, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={5} y={8} width={14} height={11} rx={2.5} stroke={color} strokeWidth={1.6} />
    <Circle cx={9.4} cy={13} r={1.2} fill={color} />
    <Circle cx={14.6} cy={13} r={1.2} fill={color} />
    <Path d="M12 8V5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    <Circle cx={12} cy={4.2} r={0.9} fill={color} />
    <Path d="M9 16.2h6" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
  </Svg>
);

// ---------------------------------------------------------------------------
// Effect presets
// ---------------------------------------------------------------------------

const VOICE_PRESETS: VoicePreset[] = [
  {
    key: 'clean',
    label: 'Clean',
    caption: 'Just your voice, gently lifted.',
    Icon: IconClean,
    params: { gain: 1.1, reverb: 0, echo: 0, lowpassHz: 0, highpassHz: 80, ringHz: 0, distortion: 0 },
  },
  {
    key: 'studio',
    label: 'Studio',
    caption: 'A touch of room. Tight and warm.',
    Icon: IconStudio,
    params: { gain: 1.15, reverb: 0.18, echo: 0, lowpassHz: 0, highpassHz: 90, ringHz: 0, distortion: 0 },
  },
  {
    key: 'cathedral',
    label: 'Cathedral',
    caption: 'Long, glassy reverb tail.',
    Icon: IconCathedral,
    params: { gain: 1.0, reverb: 0.55, echo: 0, lowpassHz: 0, highpassHz: 100, ringHz: 0, distortion: 0 },
  },
  {
    key: 'echo',
    label: 'Echo',
    caption: 'Slap-back delay with feedback.',
    Icon: IconEcho,
    params: {
      gain: 1.1,
      reverb: 0.15,
      echo: 0.4,
      echoDelayMs: 350,
      echoFeedback: 0.45,
      lowpassHz: 0,
      highpassHz: 90,
      ringHz: 0,
      distortion: 0,
    },
  },
  {
    key: 'telephone',
    label: 'Telephone',
    caption: 'Narrow band, like an old phone.',
    Icon: IconTelephone,
    params: { gain: 1.3, reverb: 0.05, echo: 0, lowpassHz: 2800, highpassHz: 300, ringHz: 0, distortion: 0 },
  },
  {
    key: 'megaphone',
    label: 'Megaphone',
    caption: 'Crunchy, mid-forward, in-your-face.',
    Icon: IconMegaphone,
    params: { gain: 1.4, reverb: 0.08, echo: 0, lowpassHz: 3500, highpassHz: 500, ringHz: 0, distortion: 0.5 },
  },
  {
    key: 'robot',
    label: 'Robot',
    caption: 'Ring-modulated synth voice.',
    Icon: IconRobot,
    params: { gain: 1.1, reverb: 0.1, echo: 0, lowpassHz: 0, highpassHz: 80, ringHz: 80, distortion: 0 },
  },
];

// ---------------------------------------------------------------------------
// Mic image + button geometry. Constants are normalized fractions of the
// rendered image so the talk button always lands centred on the mic body
// regardless of screen size.
// ---------------------------------------------------------------------------

const MIC_ASPECT_W_OVER_H = 2 / 3; // 1080 x 1620 source ~ 2:3
// The mic image is anchored flush to the bottom of the page (0 space),
// so its full body — grille, yoke, body, stand connector, stand —
// is visible. Any portion that lands behind the floating tab bar is
// intentional ("emerging from the bottom").
const MIC_PEEK_FRAC = 0;
// Vertical centre of the toggle as a fraction of the FULL image height
// from the top. 0.62 lands on the yoke band so the switch reads as
// mounted on the mic body itself.
const BUTTON_TARGET_FRAC = 0.62;

// Compact switch dimensions — sized to sit cleanly on the mic body.
const SWITCH_PLATE_W = 54;
const SWITCH_PLATE_H = 84;

// ---------------------------------------------------------------------------
// Karaoke page
// ---------------------------------------------------------------------------

type KaraokePageProps = {
  theme: Theme;
  cicadaConnected: boolean;
  activeSpeakerAddress: string | null;
  onError: (msg: string) => void;
};

export default function KaraokePage({
  theme,
  cicadaConnected,
  activeSpeakerAddress,
  onError,
}: KaraokePageProps) {
  const t = theme;
  const { width: windowW } = useWindowDimensions();

  const [presetKey, setPresetKey] = useState<VoicePresetKey>('studio');
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0);

  const levelAnim = useRef(new Animated.Value(0)).current;

  // Card carousel layout.
  const CARD_W = 132;
  const CARD_GAP = 12;
  const SNAP = CARD_W + CARD_GAP;
  const sidePad = (windowW - CARD_W) / 2;
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<Animated.LegacyRef<typeof Animated.ScrollView> | null>(null);

  // Re-sync with native engine on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await isKaraokeRunning();
      if (!cancelled) setRunning(r);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Position carousel at the initial preset on mount.
  useEffect(() => {
    const idx = VOICE_PRESETS.findIndex((p) => p.key === presetKey);
    if (idx < 0) return;
    requestAnimationFrame(() => {
      // @ts-ignore  Animated.ScrollView refs expose scrollTo at runtime.
      scrollRef.current?.scrollTo?.({ x: idx * SNAP, animated: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll the native peak meter while running.
  useEffect(() => {
    if (!running) {
      setLevel(0);
      Animated.timing(levelAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
      return;
    }
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const v = await getKaraokeLevel();
        if (!cancelled) {
          setLevel(v);
          Animated.timing(levelAnim, {
            toValue: Math.min(1, v),
            duration: 80,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }).start();
        }
      } catch {
        /* noop */
      }
    };
    const id = setInterval(tick, 80);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [running, levelAnim]);

  // Drop the engine if the speaker disconnects mid-session.
  useEffect(() => {
    if (running && !cicadaConnected) {
      stopKaraoke();
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicadaConnected]);

  // Active preset DSP params \u2014 pushed live to native any time it changes.
  const activePreset = useMemo(
    () => VOICE_PRESETS.find((p) => p.key === presetKey) ?? VOICE_PRESETS[0],
    [presetKey],
  );

  useEffect(() => {
    setKaraokeParams(activePreset.params);
  }, [activePreset]);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.max(
      0,
      Math.min(VOICE_PRESETS.length - 1, Math.round(x / SNAP)),
    );
    const next = VOICE_PRESETS[idx].key;
    if (next !== presetKey) {
      tapSelection();
      setPresetKey(next);
    }
  };

  const handleCardTap = (i: number) => {
    // @ts-ignore  Animated.ScrollView ref exposes scrollTo at runtime.
    scrollRef.current?.scrollTo?.({ x: i * SNAP, animated: true });
  };

  const handleToggle = async () => {
    if (busy) return;
    if (running) {
      setBusy(true);
      tapLight();
      try {
        await stopKaraoke();
        setRunning(false);
        try {
          await setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
            shouldRouteThroughEarpiece: false,
            interruptionMode: 'doNotMix',
          });
        } catch {
          /* noop */
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!cicadaConnected) {
      onError('Connect to your Cicada first.');
      return;
    }
    setBusy(true);
    tapMedium();
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        onError('Mic permission was denied.');
        return;
      }
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          shouldRouteThroughEarpiece: false,
          interruptionMode: 'doNotMix',
        });
      } catch {
        /* noop */
      }
      if (activeSpeakerAddress) {
        const ready = await isAudioRouteReady(activeSpeakerAddress);
        if (!ready) {
          onError(
            'Audio isn’t routed to your Cicada yet — give it a moment and retry.',
          );
          return;
        }
      }
      await setKaraokeParams(activePreset.params);
      await startKaraoke();
      setRunning(true);
    } finally {
      setBusy(false);
    }
  };

  // Mic geometry. 95% of device width so the mic dominates the page;
  // height follows the natural 2:3 aspect ratio of the source asset.
  const micW = windowW * 0.95;
  const micH = micW / MIC_ASPECT_W_OVER_H;
  const peekPx = micH * MIC_PEEK_FRAC;
  // Distance of the switch centre from the karaoke page bottom.
  const buttonAboveContentBottom = (1 - BUTTON_TARGET_FRAC - MIC_PEEK_FRAC) * micH;

  const hint = !cicadaConnected
    ? 'Connect to your Cicada first'
    : running
      ? level > 0.02
        ? 'Hearing you'
        : 'Listening…'
      : 'Tap the mic to sing';

  return (
    <View style={styles.page}>
      {/* --- Effect carousel -------------------------------------- */}
      <Animated.ScrollView
        ref={scrollRef as any}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: sidePad,
          paddingVertical: 14,
          gap: CARD_GAP,
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.cardsScroll}
      >
        {VOICE_PRESETS.map((p, i) => {
          const inputRange = [(i - 1) * SNAP, i * SNAP, (i + 1) * SNAP];
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.84, 1, 0.84],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.45, 1, 0.45],
            extrapolate: 'clamp',
          });
          const isActive = p.key === presetKey;
          return (
            <Pressable key={p.key} onPress={() => handleCardTap(i)}>
              <Animated.View
                style={[
                  styles.effectCard,
                  {
                    width: CARD_W,
                    backgroundColor: isActive ? t.ink : t.surface,
                    borderColor: isActive ? t.ink : t.line,
                    transform: [{ scale }],
                    opacity,
                  },
                ]}
              >
                <View style={styles.effectIconWrap}>
                  <p.Icon size={36} color={isActive ? '#fff' : t.ink} />
                </View>
                <Text
                  style={[
                    styles.effectLabel,
                    { color: isActive ? '#fff' : t.ink },
                  ]}
                >
                  {p.label}
                </Text>
                <Text
                  style={[
                    styles.effectMeta,
                    {
                      color: isActive
                        ? 'rgba(255,255,255,0.7)'
                        : t.inkMuted,
                    },
                  ]}
                >
                  {isActive ? 'Active' : `Preset ${i + 1}`}
                </Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </Animated.ScrollView>

      {/* --- Caption + status --------------------------------------- */}
      <View style={styles.captionWrap}>
        <Text style={[styles.captionText, { color: t.inkSoft }]} numberOfLines={1}>
          {activePreset.caption}
        </Text>
        <Text style={[styles.statusHint, { color: t.inkMuted }]}>{hint}</Text>
      </View>

      {/* --- Mic image --------------------------------------------- */}
      <View
        pointerEvents="none"
        style={[styles.micLayer, { bottom: -peekPx, height: micH }]}
      >
        <Image
          source={require('../assets/karaoke/mic.png')}
          style={{ width: micW, height: micH }}
          resizeMode="contain"
        />
      </View>

      {/* --- Mic switch + audio-reactive halo --------------------- */}
      <View
        pointerEvents="box-none"
        style={[
          styles.btnLayer,
          {
            bottom: buttonAboveContentBottom - SWITCH_PLATE_H / 2,
            height: SWITCH_PLATE_H,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: SWITCH_PLATE_W + 60,
            height: SWITCH_PLATE_H + 50,
            borderRadius: 22,
            backgroundColor: t.accent,
            opacity: levelAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.24],
            }),
            transform: [
              {
                scale: levelAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.78, 1.06],
                }),
              },
            ],
          }}
        />
        <MicSwitch
          on={running}
          disabled={busy || (!cicadaConnected && !running)}
          onToggle={handleToggle}
          accent={t.accent}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Vertical "light switch" toggle — a port of the cream/red light-switch
// plate (TLB/light-switch.html) for turning the karaoke mic on and off.
// ---------------------------------------------------------------------------

function MicSwitch({
  on,
  disabled,
  onToggle,
  accent,
}: {
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
  accent: string;
}) {
  const anim = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: on ? 1 : 0,
      duration: 220,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [on, anim]);

  // ON half (top): cool grey when off → silver-white when on.
  const onBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#d9d4c5', '#f1ede0'],
  });
  const onDimOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const onLitOpacity = anim;

  // OFF half (bottom): warm-cream face when off → muted silver when on.
  const offBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#f4ebcd', '#ebe6d6'],
  });
  const offDimOpacity = anim;
  const offLitOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      hitSlop={10}
      style={[
        switchStyles.plate,
        {
          width: SWITCH_PLATE_W,
          height: SWITCH_PLATE_H,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      {/* Top brass screw */}
      <View style={[switchStyles.screw, { top: 5 }]}>
        <View style={switchStyles.screwSlot} />
      </View>

      {/* Bottom brass screw */}
      <View style={[switchStyles.screw, { bottom: 5 }]}>
        <View style={switchStyles.screwSlot} />
      </View>

      {/* Rocker piece */}
      <View style={switchStyles.rocker}>
        {/* ON half (top) */}
        <Animated.View
          style={[
            switchStyles.half,
            { backgroundColor: onBg, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
          ]}
        >
          <Animated.Text
            style={[switchStyles.labelDim, { opacity: onDimOpacity }]}
          >
            ON
          </Animated.Text>
          <Animated.Text
            style={[
              switchStyles.labelLit,
              {
                color: accent,
                textShadowColor: accent,
                opacity: onLitOpacity,
              },
            ]}
          >
            ON
          </Animated.Text>
        </Animated.View>

        {/* OFF half (bottom) */}
        <Animated.View
          style={[
            switchStyles.half,
            {
              backgroundColor: offBg,
              borderBottomLeftRadius: 5,
              borderBottomRightRadius: 5,
            },
          ]}
        >
          <Animated.Text
            style={[switchStyles.labelDim, { color: '#a99e7d', opacity: offDimOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]}
          >
            OFF
          </Animated.Text>
          <Animated.Text
            style={[
              switchStyles.labelLit,
              { color: '#a4441a', textShadowColor: '#ff4e00', opacity: offLitOpacity },
            ]}
          >
            OFF
          </Animated.Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
    paddingTop: 24,
  },

  cardsScroll: {
    flexGrow: 0,
    marginTop: 4,
  },
  effectCard: {
    height: 156,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#1f1c17',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  effectIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effectLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  effectMeta: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  captionWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 4,
    gap: 4,
  },
  captionText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  statusHint: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  micLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  btnLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  talkBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  talkBtnLabel: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  talkBtnSub: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

// ---------------------------------------------------------------------------
// Mic-switch styles — silver plate, brass screws, rocker with ON / OFF.
// Colours are tuned to sit on the bone-white mic body so the switch reads
// as mounted hardware rather than a floating cream tile.
// ---------------------------------------------------------------------------

const switchStyles = StyleSheet.create({
  plate: {
    backgroundColor: '#e7e1d2',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(31,28,23,0.18)',
  },
  screw: {
    position: 'absolute',
    left: '50%',
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c9c2af',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screwSlot: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  rocker: {
    width: 32,
    height: 58,
    borderRadius: 4,
    backgroundColor: '#f1ede0',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.22)',
    overflow: 'hidden',
    shadowColor: '#1f1c17',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  half: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelDim: {
    position: 'absolute',
    color: '#b3a987',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  labelLit: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});
