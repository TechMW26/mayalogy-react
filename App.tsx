import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { createAudioPlayer, preload, setAudioModeAsync, setIsAudioActiveAsync, type AudioPlayer } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { cloneElement, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle as SvgCircle,
  Path as SvgPath,
  Polyline as SvgPolyline,
} from 'react-native-svg';

import AnimatedPage from './src/AnimatedPage';
import AutoTuneModal from './src/AutoTuneModal';
import FloatingToast from './src/FloatingToast';
import KaraokePage from './src/KaraokePage';
import NowPlayingScreen from './src/NowPlayingScreen';
import SavePresetModal from './src/SavePresetModal';
import VerticalSlider from './src/VerticalSlider';
import RadarScan from './src/RadarScan';
import PairingOverlay from './src/PairingOverlay';
import RoomScreen from './src/RoomScreen';
import {
  notifyError,
  notifySuccess,
  notifyWarning,
  tapHeavy,
  tapLight,
  tapMedium,
  tapSelection,
} from './src/haptics';
import {
  getConnectedAudioAddresses,
  getMusicVolume,
  isAudioFxAvailable,
  isAudioRouteReady,
  setAudioFxEnabled,
  setAudioFxMakeupGain,
  setMusicVolume,
  setSystemBandLevels,
  setSystemBassBoost,
  setSystemReverbPreset,
  setSystemVirtualizer,
  startAudioFxBackground,
  stopAudioFxBackground,
} from 'zenova-audio-fx';
import {
  CicadaDevice,
  connectToSpeaker,
  disconnectFromSpeaker,
  discoverCicadaDevices,
  discoverCicadaDevicesStream,
  ensureBluetoothReady,
  getBluetoothClassic,
  getBondedCicadaDevices,
  isAndroidBluetoothRuntimeReady,
  isSpeakerConnected,
  mergeBluetoothDevices,
  pairCicadaDevice,
  unpairCicadaDevice,
} from './src/bluetooth';

type PageName = 'welcome' | 'home' | 'devices' | 'speaker' | 'karaoke' | 'rooms' | 'scan';
type SoundMode = string;
type EqBandKey = 'subBass' | 'bass' | 'mid' | 'presence' | 'treble';
type EqState = Record<EqBandKey, number>;
type SpeakerPreset = { name: SoundMode; eq: EqState };

type CustomPreset = {
  id: string;
  name: string;
  eq: EqState;
  createdAt: number;
};

const cicadaImage: ImageSourcePropType = require('./assets/cicada/Cicada Speaker.png');
const appIconImage: ImageSourcePropType = require('./assets/icon.png');

const eqBandLabels: Record<EqBandKey, string> = {
  subBass: 'Sub',
  bass: 'Bass',
  mid: 'Mid',
  presence: 'Vocal',
  treble: 'Treble',
};

const SCREEN_W = Dimensions.get('window').width;

// Apply the rounded Nunito family across every <Text> in the app without
// touching individual styles: map the requested fontWeight to the matching
// Nunito face once, via a render interceptor.
function nunitoFaceForWeight(weight?: string | number): string {
  let w = 400;
  if (typeof weight === 'number') w = weight;
  else if (typeof weight === 'string') {
    if (weight === 'bold') w = 700;
    else if (weight === 'normal') w = 400;
    else w = parseInt(weight, 10) || 400;
  }
  if (w >= 800) return 'Nunito_800ExtraBold';
  if (w >= 700) return 'Nunito_700Bold';
  if (w >= 500) return 'Nunito_600SemiBold';
  return 'Nunito_400Regular';
}

const TextAny = Text as unknown as {
  render?: (...args: unknown[]) => ReactElement;
  __zvRounded?: boolean;
};
if (TextAny.render && !TextAny.__zvRounded) {
  const originalRender = TextAny.render;
  TextAny.render = function patchedRender(...args: unknown[]) {
    const element = originalRender.apply(this, args) as ReactElement<{ style?: unknown }>;
    const flat = (StyleSheet.flatten(element.props.style as never) ?? {}) as {
      fontWeight?: string | number;
    };
    return cloneElement(element, {
      style: [
        { fontFamily: nunitoFaceForWeight(flat.fontWeight) },
        element.props.style,
        { fontWeight: undefined },
      ] as never,
    });
  };
  TextAny.__zvRounded = true;
}

// Light-mode Echofy palette: bone background, near-white subtle off-white cards,
// sage accent. Cards intentionally sit on bone without shadows for a flatter,
// more modern look — the very subtle tint is what defines them.
const t = {
  bg: '#f4eee2',
  bgDeep: '#ebe1cc',
  surface: '#fcf8ee',
  surfaceMuted: '#f1eadb',
  ink: '#1f1c17',
  inkSoft: '#6c6557',
  inkMuted: '#a59c8b',
  line: '#e3d9c5',
  lineSoft: '#ece3d0',
  accent: '#6f9b80',
  accentDeep: '#4d806a',
  accentSoft: '#cfe0d4',
  accentTint: '#e3eee1',
  // Deep on-brand fill for selected primary states (preset cards, toggles).
  // A richer forest tone than accentDeep — reads as a confident "active"
  // surface without resorting to pure black. Pairs with #fff text/glyphs.
  selected: '#2f5a48',
  warn: '#c98e6b',
  danger: '#b56b62',
  shadow: 'rgba(60, 50, 30, 0.07)',
};

const presets: SpeakerPreset[] = [
  { name: 'Balanced', eq: { subBass: 1, bass: 1, mid: 0, presence: 1, treble: 1 } },
  { name: 'Bass Boost', eq: { subBass: 5, bass: 4, mid: -1, presence: 0, treble: 1 } },
  { name: 'Rock', eq: { subBass: 3, bass: 3, mid: 1, presence: 2, treble: 3 } },
  { name: 'Night', eq: { subBass: -1, bass: 0, mid: 2, presence: 2, treble: -1 } },
];

// Visual metadata for the 2x2 preset grid: icon component + tinted background.
// Keyed by preset name. Anything not in here falls back to a sensible default.
const presetMeta: Record<
  string,
  {
    Icon: (props: { size?: number; color?: string }) => React.JSX.Element;
    tint: string;
    ink: string;
  }
> = {
  Balanced:    { Icon: IconBalance, tint: '#e3eee1', ink: '#3a6453' },
  'Bass Boost':{ Icon: IconWave,    tint: '#f1e5da', ink: '#a36a45' },
  Rock:        { Icon: IconBolt,    tint: '#efe6d3', ink: '#7b6f55' },
  Night:       { Icon: IconMoon,    tint: '#dde3ec', ink: '#3a4763' },
};

const PRESET_CHIME = require('./assets/tones/mode.mp3');
const UNPAIR_SOUND = require('./assets/tones/unpair.mp3');
const PAIR_SOUND = require('./assets/tones/pair.mp3');

const runtimeHint =
  Platform.OS === 'android'
    ? 'Bluetooth Classic needs a dev build on Android.'
    : 'Cicada is built for Android first.';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Bluetooth hiccup. Try again.';
}

// Some BT stack errors are noisy and not actionable for the user.
function isSilentBluetoothError(error: unknown) {
  const msg = (getErrorMessage(error) || '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('read failed') ||
    msg.includes('socket closed') ||
    msg.includes('socket might closed') ||
    msg.includes('socket might be closed') ||
    msg.includes('socket might closed or timeout') ||
    msg.includes('read ret: -1') ||
    msg.includes('connection reset') ||
    msg.includes('broken pipe')
  );
}

function reportError(setter: (m: string | null) => void, error: unknown) {
  if (isSilentBluetoothError(error)) {
    setter(null);
    return;
  }
  setter(getErrorMessage(error));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

// ----------------------------------------------------------------------------
// Small icon primitives (no external dep) — composed from Views + glyphs
// ----------------------------------------------------------------------------

function IconWifi({ size = 18, color = t.ink }: { size?: number; color?: string }) {
  const arcThickness = Math.max(1.5, size * 0.1);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          width: size,
          height: size * 0.55,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          borderWidth: arcThickness,
          borderColor: color,
          borderBottomWidth: 0,
          opacity: 0.9,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.22,
          width: size * 0.65,
          height: size * 0.45,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          borderWidth: arcThickness,
          borderColor: color,
          borderBottomWidth: 0,
          opacity: 0.9,
        }}
      />
      <View
        style={{
          width: arcThickness * 2.2,
          height: arcThickness * 2.2,
          borderRadius: arcThickness * 2,
          backgroundColor: color,
          marginBottom: arcThickness * 0.4,
        }}
      />
    </View>
  );
}

function IconBluetooth({ size = 18, color = t.ink }: { size?: number; color?: string }) {
  // Classic bluetooth rune: vertical spine with two crossed triangles.
  // viewBox 24x24, stroke around 2 looks consistent with our other icons.
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

function IconMic({ size = 18, color = t.ink }: { size?: number; color?: string }) {
  const w = size * 0.45;
  const h = size * 0.7;
  const stroke = Math.max(1.5, size * 0.09);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: w,
          height: h,
          borderRadius: w / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          marginTop: stroke,
          width: w * 1.4,
          height: stroke,
          borderRadius: stroke / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function IconPower({ size = 18, color = t.ink }: { size?: number; color?: string }) {
  const stroke = Math.max(1.5, size * 0.12);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: stroke,
          width: size - stroke,
          height: size - stroke,
          borderRadius: (size - stroke) / 2,
          borderWidth: stroke,
          borderColor: color,
          borderTopColor: 'transparent',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          width: stroke,
          height: size * 0.5,
          borderRadius: stroke / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function IconPlus({ size = 18, color = t.ink }: { size?: number; color?: string }) {
  const stroke = Math.max(1.8, size * 0.14);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.7,
          height: stroke,
          borderRadius: stroke / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: stroke,
          height: size * 0.7,
          borderRadius: stroke / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function IconChevronLeft({ size = 18, color = t.ink }: { size?: number; color?: string }) {
  const stroke = Math.max(1.5, size * 0.13);
  const arm = size * 0.42;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: arm,
          height: stroke,
          backgroundColor: color,
          borderRadius: stroke / 2,
          transform: [{ rotate: '-45deg' }, { translateY: -arm * 0.35 }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: arm,
          height: stroke,
          backgroundColor: color,
          borderRadius: stroke / 2,
          transform: [{ rotate: '45deg' }, { translateY: arm * 0.35 }],
        }}
      />
    </View>
  );
}

function IconChevronDouble({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  // Two stacked right-chevrons. Used on the welcome CTA.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPolyline
        points="7 5 14 12 7 19"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <SvgPolyline
        points="14 5 21 12 14 19"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function IconChevronRight({ size = 18, color = t.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPolyline
        points="9 6 16 12 9 18"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function IconSparkle({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  // 4-point sparkle / diamond — the brand mark used in the hero badge.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPath
        d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"
        fill={color}
      />
    </Svg>
  );
}

function IconMusic({ size = 19, color = t.ink }: { size?: number; color?: string }) {
  // Eighth-note pair — marks the "identify what's playing" action.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPath
        d="M9 18V6l11-2v12"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <SvgCircle cx={6} cy={18} r={3} stroke={color} strokeWidth={2} fill="none" />
      <SvgCircle cx={17} cy={16} r={3} stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

function IconBalance({ size = 22, color = t.ink }: { size?: number; color?: string }) {
  // Symmetric triangle — represents the Balanced preset.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPath
        d="M12 4 L20 20 L4 20 Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <SvgPath
        d="M12 4 L12 20"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function IconWave({ size = 22, color = t.ink }: { size?: number; color?: string }) {
  // Five vertical bars — the EQ / Bass Boost icon.
  const bars = [
    { x: 3,  h: 8 },
    { x: 7,  h: 14 },
    { x: 11, h: 20 },
    { x: 15, h: 14 },
    { x: 19, h: 8 },
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {bars.map((b) => (
        <SvgPath
          key={`bar-${b.x}`}
          d={`M${b.x} ${12 - b.h / 2} L${b.x} ${12 + b.h / 2}`}
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

function IconBolt({ size = 22, color = t.ink }: { size?: number; color?: string }) {
  // Lightning bolt — the Rock preset.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPath
        d="M13 2 L4 14 L11 14 L11 22 L20 10 L13 10 Z"
        fill={color}
      />
    </Svg>
  );
}

function IconMoon({ size = 22, color = t.ink }: { size?: number; color?: string }) {
  // Crescent moon — the Night preset.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPath
        d="M20 14.5 A 8.5 8.5 0 1 1 9.5 4 A 6.5 6.5 0 0 0 20 14.5 Z"
        fill={color}
      />
    </Svg>
  );
}

function IconDot({ size = 10, color = t.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10" fill="none">
      <SvgCircle cx={5} cy={5} r={3.2} fill={color} />
    </Svg>
  );
}

function IconPlay({ size = 18, color = t.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPath d="M7 4 L20 12 L7 20 Z" fill={color} />
    </Svg>
  );
}

function IconPause({ size = 18, color = t.ink }: { size?: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.18 }}>
      <View style={{ width: size * 0.22, height: size, borderRadius: 2, backgroundColor: color }} />
      <View style={{ width: size * 0.22, height: size, borderRadius: 2, backgroundColor: color }} />
    </View>
  );
}

function IconSkip({
  direction,
  size = 18,
  color = t.ink,
}: {
  direction: 'next' | 'prev';
  size?: number;
  color?: string;
}) {
  const tri = direction === 'next'
    ? 'M4 5 L14 12 L4 19 Z'
    : 'M20 5 L10 12 L20 19 Z';
  const barX = direction === 'next' ? 17 : 4;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPath d={tri} fill={color} />
      <SvgPath
        d={`M${barX} 5 L${barX} 19`}
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function IconSpeakerSmall({ size = 16, color = t.ink }: { size?: number; color?: string }) {
  // Two concentric circles — the speaker cone.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={12} cy={12} r={8} stroke={color} strokeWidth={2} fill="none" />
      <SvgCircle cx={12} cy={12} r={3} fill={color} />
    </Svg>
  );
}

function IconHome({ size = 20, color = t.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPath
        d="M4 11 L12 4 L20 11 V20 H15 V14 H9 V20 H4 Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconDevices({ size = 20, color = t.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPath
        d="M7 5 H17 A2 2 0 0 1 19 7 V17 A2 2 0 0 1 17 19 H7 A2 2 0 0 1 5 17 V7 A2 2 0 0 1 7 5 Z"
        stroke={color}
        strokeWidth={2}
      />
      <SvgPath d="M9 9 H15 M9 13 H13" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function IconRooms({ size = 20, color = t.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={12} cy={12} r={3} fill={color} />
      <SvgPath
        d="M4 12 A8 8 0 0 1 20 12 M7 12 A5 5 0 0 1 17 12 M4 16 A8 8 0 0 0 20 16"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ----------------------------------------------------------------------------
// Reusable building blocks
// ----------------------------------------------------------------------------

function SoftCard({
  children,
  style,
  onPress,
  tinted,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  tinted?: boolean;
}) {
  const baseStyle: ViewStyle[] = [
    styles.softCard,
    { backgroundColor: tinted ? t.accentTint : t.surface },
  ];
  const flatStyle = Array.isArray(style) ? style : style ? [style] : [];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[...baseStyle, ...flatStyle]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[...baseStyle, ...flatStyle]}>{children}</View>;
}

function Eyebrow({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

// ----------------------------------------------------------------------------
// App
// ----------------------------------------------------------------------------

function AppScreen() {
  const insets = useSafeAreaInsets();

  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const [currentPage, setCurrentPage] = useState<PageName>('welcome');
  const [roomsMounted, setRoomsMounted] = useState(false);

  // Load persisted intro flag on mount; show welcome only on the very first launch.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem('zenova.introSeen')
      .then((value) => {
        if (cancelled) return;
        const seen = value === '1';
        setIntroSeen(seen);
        if (seen) setCurrentPage('home');
      })
      .catch(() => {
        if (!cancelled) setIntroSeen(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const completeIntro = () => {
    tapMedium();
    setIntroSeen(true);
    setCurrentPage('home');
    AsyncStorage.setItem('zenova.introSeen', '1').catch(() => {});
  };

  const goto = (page: PageName) => {
    if (page === currentPage) return;
    tapLight();
    setCurrentPage(page);
  };

  useEffect(() => {
    if (currentPage === 'rooms') setRoomsMounted(true);
  }, [currentPage]);

  const [selectedMode, setSelectedMode] = useState<SoundMode>('Balanced');
  const [eq, setEq] = useState<EqState>(presets[0].eq);
  const [voiceModeOn, setVoiceModeOn] = useState(false);
  const [hqAudioOn, setHqAudioOn] = useState(true);
  const [bluetoothToggleOn, setBluetoothToggleOn] = useState(true);
  const [battery] = useState(92);
  const [audioFxAvailable, setAudioFxAvailable] = useState(false);
  const [eqView, setEqView] = useState<'tone' | 'fine'>('tone');
  const eqViewAnim = useRef(new Animated.Value(0)).current;

  // Extended spatial controls.
  const [reverbPreset, setReverbPreset] = useState(0); // 0..6
  const [virtualizerStrength, setVirtualizerStrength] = useState(0); // 0..1000
  const [bassBoostStrength, setBassBoostStrength] = useState(0); // 0..1000

  // Custom user-saved presets + modal visibility.
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [autoTuneVisible, setAutoTuneVisible] = useState(false);
  const [nowPlayingVisible, setNowPlayingVisible] = useState(false);

  // Throttle native EQ pushes so a fast slider drag can't hammer the bridge.
  const eqPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Plays a sound effect to completion. Creates a FRESH AudioPlayer per call
  // instead of re-using a cached one — reusing players across calls causes
  // the head of the next playback to be clipped on Android because the
  // previous seekTo(0) doesn't always commit before play() starts.
  //
  // WAITS FOR isLoaded BEFORE PLAY — expo-audio's createAudioPlayer() is
  // synchronous-looking but the file isn't actually decoded yet. Calling
  // play() before the player reports isLoaded causes the call to be
  // silently dropped on Android (the sound never starts).
  //
  // Waits for the player to report it actually finished (or for a generous
  // hard ceiling) before resolving, so the caller can safely tear down
  // routing / volume state afterwards.
  const playOneShot = (
    asset: number,
    opts: { ceilingMs?: number } = {},
  ): Promise<void> =>
    new Promise<void>((resolve) => {
      let player: AudioPlayer | null = null;
      try {
        player = createAudioPlayer(asset);
      } catch {
        resolve();
        return;
      }
      const ceiling = opts.ceilingMs ?? 12000;
      let settled = false;
      let pollHandle: ReturnType<typeof setInterval> | null = null;
      let hardTimer: ReturnType<typeof setTimeout> | null = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (pollHandle) clearInterval(pollHandle);
        if (hardTimer) clearTimeout(hardTimer);
        try {
          (player as unknown as { remove?: () => void })?.remove?.();
        } catch {
          /* noop */
        }
        resolve();
      };

      // Hard ceiling so a player that never reports completion can't hang.
      hardTimer = setTimeout(finish, ceiling);

      // Re-assert playback-only mode before each play. The terraform flow
      // temporarily switches to recording + mixWithOthers, which disables
      // audio focus and prevents Android from routing to A2DP. Without
      // re-asserting doNotMix here, any sound played AFTER a terraform
      // session silently fails to reach the BT speaker.
      setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
        interruptionMode: 'doNotMix',
      }).catch(() => {});
      // Ensure the audio session is active and the player is at full volume
      // before we start. setIsAudioActiveAsync is idempotent and fast.
      setIsAudioActiveAsync(true).catch(() => {});
      try {
        (player as unknown as { volume?: number }).volume = 1.0;
      } catch {
        /* noop */
      }

      // Wait up to 2 s for the player to finish loading the asset, then
      // start playback. Polls quickly so we don't add audible latency.
      const loadStart = Date.now();
      const startPlayback = () => {
        try {
          (player as unknown as { volume?: number }).volume = 1.0;
        } catch {
          /* noop */
        }
        try {
          player?.play();
        } catch {
          finish();
          return;
        }

        // Poll currentTime/duration on a short interval and resolve when:
        //   - duration is known AND currentTime has reached duration (with a
        //     small tolerance), or
        //   - playback was running and currentTime stopped advancing for
        //     ~350 ms past a known duration (didJustFinish equivalent).
        let lastTime = 0;
        let lastTimeChangedAt = Date.now();
        pollHandle = setInterval(() => {
          const p = player as unknown as {
            currentTime?: number;
            duration?: number;
          } | null;
          if (!p) return finish();
          const cur = typeof p.currentTime === 'number' ? p.currentTime : 0;
          const dur = typeof p.duration === 'number' ? p.duration : 0;
          if (cur !== lastTime) {
            lastTime = cur;
            lastTimeChangedAt = Date.now();
          }
          if (dur > 0) {
            if (cur >= dur - 0.1) {
              finish();
              return;
            }
            if (cur > 0 && Date.now() - lastTimeChangedAt > 350) {
              finish();
              return;
            }
          }
        }, 100);
      };

      const loadPoll = setInterval(() => {
        const p = player as unknown as { isLoaded?: boolean } | null;
        if (!p) {
          clearInterval(loadPoll);
          finish();
          return;
        }
        if (p.isLoaded || Date.now() - loadStart > 2000) {
          clearInterval(loadPoll);
          startPlayback();
        }
      }, 50);
    });

  const playPresetChime = () => {
    // Fire-and-forget; UI doesn't wait.
    playOneShot(PRESET_CHIME, { ceilingMs: 4000 }).catch(() => {});
  };

  // Pushes the system music volume to max, plays the pair-success sound to
  // completion on the speaker, then restores the user's previous volume.
  // Best-effort throughout — if anything fails we still resolve so the
  // connection flow can finish.
  const playPairSound = async (deviceAddress: string) => {
    // Re-verify A2DP is still connected. The device may have dropped
    // between connect-confirmed and now.
    try {
      const addrs = await getConnectedAudioAddresses();
      const upper = deviceAddress.toUpperCase();
      if (!addrs.some((a) => a.toUpperCase() === upper)) {
        // Not actually routed via A2DP — don't play to a non-existent
        // sink (the sound would just disappear).
        return;
      }
    } catch {
      /* If we can't verify, attempt to play anyway. */
    }

    let savedVolume: number | null = null;
    let maxVolume = 0;
    try {
      const [cur, max] = await getMusicVolume();
      savedVolume = cur;
      maxVolume = max;
      if (max > 0) await setMusicVolume(max);
    } catch {
      /* noop */
    }

    // Re-assert audio session before play — forces Android to refresh the
    // routing decision and honour the current BT sink.
    try {
      await setIsAudioActiveAsync(true);
    } catch {
      /* noop */
    }

    await playOneShot(PAIR_SOUND, { ceilingMs: 10000 });
    if (savedVolume !== null && maxVolume > 0) {
      try {
        await setMusicVolume(savedVolume);
      } catch {
        /* noop */
      }
    }
  };

  const [pairedDevices, setPairedDevices] = useState<CicadaDevice[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<CicadaDevice[]>([]);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(isAndroidBluetoothRuntimeReady());
  const [isScanning, setIsScanning] = useState(false);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);
  const [pairingAddress, setPairingAddress] = useState<string | null>(null);
  const [unpairingAddress, setUnpairingAddress] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<CicadaDevice | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep refs of latest lists so async BT event handlers see fresh data.
  const pairedRef = useRef<CicadaDevice[]>([]);
  const discoveredRef = useRef<CicadaDevice[]>([]);
  pairedRef.current = pairedDevices;
  discoveredRef.current = discoveredDevices;

  const knownDevices = useMemo(
    () => mergeBluetoothDevices(pairedDevices, discoveredDevices),
    [pairedDevices, discoveredDevices],
  );

  const connectedAddress = connectedDevice?.address ?? null;

  const [activeSpeakerAddress, setActiveSpeakerAddress] = useState<string | null>(null);

  // A speaker is "active" only when a Cicada is actually paired AND connected.
  // Browsing settings of an offline / non-Cicada device is intentionally blocked.
  const activeSpeaker = useMemo<CicadaDevice | null>(() => {
    if (connectedDevice && connectedDevice.matchedAsCicada) {
      return connectedDevice;
    }
    return null;
  }, [connectedDevice]);

  const cicadaConnected = activeSpeaker !== null;

  // Song ID requires a connected Zenova speaker. If the speaker drops while
  // the screen is open, dismiss it so the feature is never shown without a
  // live connection.
  useEffect(() => {
    if (!cicadaConnected && nowPlayingVisible) setNowPlayingVisible(false);
  }, [cicadaConnected, nowPlayingVisible]);

  // Auto-navigate to the Speaker page whenever a Cicada becomes connected
  // (whether via the user's connect tap, the periodic A2DP sweep, or the
  // native onDeviceConnected event — anywhere we transition from "no
  // connection" to "connected"). Excludes the welcome page so the
  // first-launch flow isn't interrupted, and excludes the bootstrap path
  // (handled by skipping when the very first render already had a
  // connected device).
  const prevConnectedAddressRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevConnectedAddressRef.current;
    const next = activeSpeaker?.address ?? null;
    prevConnectedAddressRef.current = next;
    if (!next || prev === next) return;
    if (currentPage === 'welcome') return;
    if (currentPage === 'speaker') return;
    setCurrentPage('speaker');
    // currentPage intentionally omitted — we only want to react to the
    // address transition, not to incidental page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpeaker]);

  // Probe the native AudioFx module + push initial tone whenever the engine
  // is toggled or the EQ values change.
  useEffect(() => {
    setAudioFxAvailable(isAudioFxAvailable());
    // Configure audio mode so the preset chime + pair/unpair sounds route
    // to the active output (the connected Bluetooth speaker).
    //
    // CRITICAL: interruptionMode must be 'doNotMix' on Android. The default
    // 'mixWithOthers' does NOT request audio focus, which means the OS
    // may not route the audio stream to the connected A2DP sink — the
    // sound just disappears. 'doNotMix' takes proper focus and forces the
    // OS to honour the current media routing (i.e. the BT speaker).
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'doNotMix',
      allowsRecording: false,
    }).catch(() => {});
    // Activate the audio session so play() actually streams audio rather
    // than being silently dropped on Android.
    setIsAudioActiveAsync(true).catch(() => {});
    // Preload the three sound effects so the first play has no cold-start
    // latency. Without this, the first preset chime / pair / unpair sound
    // has to wait for the asset to load before audio starts — which
    // routinely takes longer than the head of the sound itself, so the
    // first 200–400 ms gets clipped.
    preload(PRESET_CHIME).catch(() => {});
    preload(UNPAIR_SOUND).catch(() => {});
    preload(PAIR_SOUND).catch(() => {});
  }, []);

  useEffect(() => {
    // Only engage the system EQ when a Cicada is live; bypass otherwise.
    const engineOn = cicadaConnected && bluetoothToggleOn;
    setAudioFxEnabled(engineOn);
    // Conservative make-up gain. The equaliser already reserves headroom; if
    // we add too much loudness here it clips and crackles. Default 0 (let the
    // EQ run flat), HQ mode adds a modest +4 dB lift.
    const gain = engineOn ? (hqAudioOn ? 400 : 0) : 0;
    setAudioFxMakeupGain(gain);
    if (engineOn) {
      startAudioFxBackground();
    } else {
      stopAudioFxBackground();
    }
  }, [bluetoothToggleOn, cicadaConnected, hqAudioOn]);

  useEffect(() => {
    if (!cicadaConnected || !bluetoothToggleOn) return;
    // Coalesce rapid slider changes into a single native call ~100ms after
    // the last update. We use only setSystemBandLevels (5-band) as the
    // single source of truth — calling both setTone and setBandLevels would
    // race and double-tax the audio bridge.
    // Step is 180 mB (1.8 dB) per slider unit, so max boost is ±1080 mB
    // (±10.8 dB). This sits well under the equaliser's clipping ceiling.
    if (eqPushTimerRef.current) {
      clearTimeout(eqPushTimerRef.current);
    }
    eqPushTimerRef.current = setTimeout(() => {
      const bandLevels = [eq.subBass, eq.bass, eq.mid, eq.presence, eq.treble].map(
        (v) => v * 180,
      );
      setSystemBandLevels(bandLevels);
    }, 100);
    return () => {
      if (eqPushTimerRef.current) {
        clearTimeout(eqPushTimerRef.current);
      }
    };
  }, [eq, bluetoothToggleOn, cicadaConnected]);

  // Push spatial controls when they change (lightweight, no need to throttle).
  // Spatial effects are INDEPENDENT of the EQ engine — they keep working
  // even when the equaliser is bypassed. The only requirement is that a
  // Cicada is actually connected.
  useEffect(() => {
    if (!cicadaConnected) return;
    setSystemReverbPreset(reverbPreset);
  }, [reverbPreset, cicadaConnected]);

  useEffect(() => {
    if (!cicadaConnected) return;
    setSystemVirtualizer(virtualizerStrength);
  }, [virtualizerStrength, cicadaConnected]);

  useEffect(() => {
    if (!cicadaConnected) return;
    setSystemBassBoost(bassBoostStrength);
  }, [bassBoostStrength, cicadaConnected]);

  // Crossfade between the Tone and Fine equaliser views.
  useEffect(() => {
    Animated.timing(eqViewAnim, {
      toValue: eqView === 'tone' ? 0 : 1,
      duration: 260,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [eqView, eqViewAnim]);

  // Keep the active preset chip in sync with the EQ shape. Whenever the EQ
  // matches a built-in or saved preset exactly, highlight that chip; if the
  // user drifts away from any known shape via the sliders, mark it as
  // "Custom" so no chip stays falsely highlighted.
  useEffect(() => {
    const matches = (a: EqState, b: EqState) =>
      a.subBass === b.subBass &&
      a.bass === b.bass &&
      a.mid === b.mid &&
      a.presence === b.presence &&
      a.treble === b.treble;
    const builtIn = presets.find((p) => matches(p.eq, eq));
    if (builtIn) {
      if (selectedMode !== builtIn.name) setSelectedMode(builtIn.name);
      return;
    }
    const custom = customPresets.find((p) => matches(p.eq, eq));
    if (custom) {
      if (selectedMode !== custom.name) setSelectedMode(custom.name);
      return;
    }
    if (selectedMode !== 'Custom' && selectedMode !== 'Terraformed') {
      setSelectedMode('Custom');
    }
    // selectedMode intentionally excluded to avoid feedback loops; we only
    // react to the EQ itself changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eq, customPresets]);

  // Load custom EQ presets on mount.
  useEffect(() => {
    AsyncStorage.getItem('zenova.customPresets')
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as CustomPreset[];
          if (Array.isArray(parsed)) setCustomPresets(parsed);
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
  }, []);

  // Persist custom EQ presets whenever they change.
  useEffect(() => {
    AsyncStorage.setItem(
      'zenova.customPresets',
      JSON.stringify(customPresets),
    ).catch(() => {});
  }, [customPresets]);

  // Load per-device settings whenever the active speaker changes.
  useEffect(() => {
    if (!activeSpeaker) return;
    let cancelled = false;
    AsyncStorage.getItem(`zenova.deviceSettings.${activeSpeaker.address}`)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const parsed = JSON.parse(raw) as {
            volume?: number;
            eq?: EqState;
            mode?: SoundMode;
            voiceMode?: boolean;
            bluetoothToggle?: boolean;
            reverbPreset?: number;
            virtualizer?: number;
            bassBoost?: number;
          };
          if (parsed.eq) setEq(parsed.eq);
          if (parsed.mode) setSelectedMode(parsed.mode);
          if (typeof parsed.voiceMode === 'boolean') setVoiceModeOn(parsed.voiceMode);
          if (typeof (parsed as { hqAudio?: boolean }).hqAudio === 'boolean')
            setHqAudioOn((parsed as { hqAudio: boolean }).hqAudio);
          if (typeof parsed.bluetoothToggle === 'boolean')
            setBluetoothToggleOn(parsed.bluetoothToggle);
          if (typeof parsed.reverbPreset === 'number')
            setReverbPreset(clamp(parsed.reverbPreset, 0, 6));
          if (typeof parsed.virtualizer === 'number')
            setVirtualizerStrength(clamp(parsed.virtualizer, 0, 1000));
          if (typeof parsed.bassBoost === 'number')
            setBassBoostStrength(clamp(parsed.bassBoost, 0, 1000));
        } catch {
          // ignore corrupted settings
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeSpeaker]);

  // Persist settings whenever they change for the active speaker.
  // Debounced ~500ms after the last change so rapid slider drags don't
  // hammer AsyncStorage (which would saturate the bridge and crash).
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeSpeaker) return;
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      const payload = JSON.stringify({
        eq,
        mode: selectedMode,
        voiceMode: voiceModeOn,
        hqAudio: hqAudioOn,
        bluetoothToggle: bluetoothToggleOn,
        reverbPreset,
        virtualizer: virtualizerStrength,
        bassBoost: bassBoostStrength,
      });
      AsyncStorage.setItem(
        `zenova.deviceSettings.${activeSpeaker.address}`,
        payload,
      ).catch(() => {});
    }, 500);
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [
    activeSpeaker,
    eq,
    selectedMode,
    voiceModeOn,
    hqAudioOn,
    bluetoothToggleOn,
    reverbPreset,
    virtualizerStrength,
    bassBoostStrength,
  ]);

  // Live-poll the actual connection state for every paired Cicada so the UI
  // reflects connections that happened outside the app (e.g. via system
  // Bluetooth settings, auto-reconnect after power-on, etc).
  useEffect(() => {
    if (!isSupported) return;
    let cancelled = false;

    const sweep = async () => {
      const candidates = pairedRef.current.filter((d) => d.matchedAsCicada);
      if (candidates.length === 0) {
        if (!cancelled) {
          setConnectedDevice((current) => (current ? null : current));
        }
        return;
      }

      let connected: CicadaDevice | null = null;

      // 1. Primary: query the A2DP profile proxy. Audio-only speakers connect
      //    via A2DP and don't open an SPP socket, so this catches them.
      try {
        const addrs = await getConnectedAudioAddresses();
        if (addrs.length > 0) {
          const set = new Set(addrs.map((a) => a.toUpperCase()));
          connected =
            candidates.find((c) => set.has(c.address.toUpperCase())) ?? null;
        }
      } catch {
        // proxy not ready yet, fall through to SPP probe
      }

      // 2. Fallback: SPP socket probe (handles speakers that DO open one).
      if (!connected) {
        for (const d of candidates) {
          try {
            if (await isSpeakerConnected(d)) {
              connected = d;
              break;
            }
          } catch {
            // probe failed - try next device
          }
        }
      }

      if (cancelled) return;
      setConnectedDevice((current) => {
        if (connected) {
          if (current?.address !== connected.address) return connected;
          return current;
        }
        return current ? null : current;
      });
    };

    sweep();
    const id = setInterval(sweep, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isSupported, pairedDevices.length]);

  // Kick off a scan automatically when the radar opens.
  useEffect(() => {
    if (currentPage !== 'scan') return;
    scanNearby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // BT bootstrap and event subscriptions — runs ONCE.
  useEffect(() => {
    const module = getBluetoothClassic();
    if (!isAndroidBluetoothRuntimeReady() || !module) {
      setIsSupported(false);
      return;
    }

    const stateSub = module.onStateChanged((event) => {
      setBluetoothEnabled(event.enabled);
      setBluetoothToggleOn(event.enabled);
      if (!event.enabled) setConnectedDevice(null);
    });

    const connSub = module.onDeviceConnected((event) => {
      const address = event.device?.address;
      if (!address) return;
      const found =
        pairedRef.current.find((d) => d.address === address) ??
        discoveredRef.current.find((d) => d.address === address) ??
        null;
      if (found) {
        setConnectedDevice(found);
      }
    });

    const discSub = module.onDeviceDisconnected((event) => {
      const address = event.device?.address;
      setConnectedDevice((current) => {
        if (!current) return null;
        if (!address || address === current.address) return null;
        return current;
      });
    });

    const errSub = module.onError(() => setErrorMessage('Bluetooth hiccup. Try again.'));

    const bootstrap = async () => {
      try {
        const ready = await ensureBluetoothReady();
        const enabled = await ready.isBluetoothEnabled();
        setBluetoothEnabled(enabled);
        setBluetoothToggleOn(enabled);
        setIsSupported(true);
        const bonded = await getBondedCicadaDevices();
        setPairedDevices(bonded);
        let active: CicadaDevice | null = null;
        for (const d of bonded) {
          try {
            if (await isSpeakerConnected(d)) {
              active = d;
              break;
            }
          } catch {
            // Probing a sleeping speaker can throw a socket IOException; ignore.
          }
        }
        if (active) setConnectedDevice(active);
      } catch (e) {
        setIsSupported(false);
        reportError(setErrorMessage, e);
      }
    };
    bootstrap();

    return () => {
      stateSub.remove();
      connSub.remove();
      discSub.remove();
      errSub.remove();
    };
  }, []);

  const scanNearby = async () => {
    // Streaming scan: bonded audio devices appear instantly, then live
    // discoveries stream in as the radio finds them. The native
    // startDiscovery() takes ~12 s so without streaming we'd appear
    // unresponsive for the whole sweep.
    setIsScanning(true);
    setErrorMessage(null);

    // Pre-load bonded devices so paired Cicadas appear instantly even if
    // the user toggled the scan view before the bootstrap finished.
    try {
      const bonded = await getBondedCicadaDevices();
      setPairedDevices(bonded);
    } catch {
      /* non-fatal */
    }

    discoverCicadaDevicesStream(
      (device) => {
        setDiscoveredDevices((current) => {
          if (current.some((d) => d.address === device.address)) return current;
          return mergeBluetoothDevices(current, [device]);
        });
      },
      (err) => {
        setIsScanning(false);
        if (err) reportError(setErrorMessage, err);
      },
    );
  };

  const handlePair = async (device: CicadaDevice) => {
    try {
      setPairingAddress(device.address);
      setErrorMessage(null);
      tapMedium();
      const paired = await pairCicadaDevice(device);
      setPairedDevices(await getBondedCicadaDevices());
      setDiscoveredDevices((current) =>
        mergeBluetoothDevices(current.filter((d) => d.address !== paired.address), [paired]),
      );
      notifySuccess();
    } catch (e) {
      reportError(setErrorMessage, e);
      notifyError();
    } finally {
      setPairingAddress(null);
    }
  };

  const handleUnpair = async (device: CicadaDevice) => {
    try {
      setUnpairingAddress(device.address);
      setErrorMessage(null);
      tapHeavy();
      // Play the goodbye sound to the speaker first (only if it's currently
      // connected — otherwise it would just play on the phone). Wait for
      // the sound to ACTUALLY finish before tearing down the connection.
      const wasConnected = connectedDevice?.address === device.address;
      if (wasConnected) {
        await playOneShot(UNPAIR_SOUND, { ceilingMs: 6000 });
        try {
          await disconnectFromSpeaker(device);
        } catch {}
        setConnectedDevice(null);
      }
      await unpairCicadaDevice(device);
      setPairedDevices(await getBondedCicadaDevices());
    } catch (e) {
      reportError(setErrorMessage, e);
      notifyError();
    } finally {
      setUnpairingAddress(null);
    }
  };

  const handleToggleConnect = async (device: CicadaDevice) => {
    try {
      setConnectingAddress(device.address);
      setErrorMessage(null);
      tapMedium();
      if (connectedDevice?.address === device.address) {
        try {
          await disconnectFromSpeaker(device);
        } catch (e) {
          if (!isSilentBluetoothError(e)) throw e;
        }
        setConnectedDevice(null);
        tapHeavy();
        return;
      }
      // Pair first if needed. handlePair already swallows its own errors
      // and surfaces them via the error banner; if it fails the device
      // simply won't be bonded and connectToSpeaker will then fail too.
      if (!device.bonded) {
        try {
          await handlePair(device);
        } catch {
          // pairing failure is already reported by handlePair
        }
      }
      // Smart connect: A2DP probe first, SPP attempt with timeout, then
      // A2DP poll fallback. Tolerant of speakers that don't expose SPP.
      await connectToSpeaker(device);
      setConnectedDevice(device);
      setCurrentPage('speaker');
      notifySuccess();
      // Welcome chime through the speaker at max volume (the user's level
      // is saved and restored). Poll the native audio router until it
      // reports the speaker is actually READY to accept a stream — BT
      // speakers take 1–3+ s after "connected" before A2DP routing,
      // codec negotiation, and amplifier wake-up are all complete.
      // Without this wait the audio session opens before the speaker
      // can accept it and the sound is dropped entirely.
      const targetAddress = device.address;
      (async () => {
        // 200 ms before the first probe — enough for the connection event
        // to settle on the native side.
        await new Promise<void>((r) => setTimeout(r, 200));
        // Poll every 250 ms for up to 10 s.
        const start = Date.now();
        while (Date.now() - start < 10000) {
          if (await isAudioRouteReady(targetAddress)) break;
          await new Promise<void>((r) => setTimeout(r, 250));
        }
        // Extra 300 ms after readiness signal — some speakers ACK the
        // route before their amp is actually pushing samples through.
        await new Promise<void>((r) => setTimeout(r, 300));
        await playPairSound(targetAddress);
      })().catch(() => {});
    } catch (e) {
      if (!isSilentBluetoothError(e)) {
        reportError(setErrorMessage, e);
        notifyError();
      }
    } finally {
      setConnectingAddress(null);
    }
  };

  const applyPreset = (preset: SpeakerPreset) => {
    tapSelection();
    playPresetChime();
    setSelectedMode(preset.name);
    setEq(preset.eq);
  };

  const applyCustomPreset = (preset: CustomPreset) => {
    tapSelection();
    playPresetChime();
    setSelectedMode(preset.name);
    setEq(preset.eq);
  };

  const handleSaveCustomPreset = (name: string) => {
    const preset: CustomPreset = {
      id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      eq,
      createdAt: Date.now(),
    };
    setCustomPresets((cur) => [...cur, preset]);
    setSelectedMode(name);
    setSaveModalVisible(false);
    notifySuccess();
  };

  const handleDeleteCustomPreset = (id: string) => {
    tapHeavy();
    setCustomPresets((cur) => {
      const next = cur.filter((p) => p.id !== id);
      // If the deleted preset was active, revert to Balanced.
      const deleted = cur.find((p) => p.id === id);
      if (deleted && selectedMode === deleted.name) {
        setSelectedMode('Balanced');
      }
      return next;
    });
  };

  const handleAutoTuneApply = (newEq: EqState) => {
    setEq(newEq);
    setSelectedMode('Terraformed');
  };

  const adjustEq = (band: EqBandKey, delta: number) =>
    setEq((c) => ({ ...c, [band]: clamp(c[band] + delta, -6, 6) }));

  // --------------------------------------------------------------------------
  // Pages
  // --------------------------------------------------------------------------

  const renderWelcome = () => (
    <View style={styles.welcomeRoot}>
      <View style={styles.welcomeHeader}>
        <Image source={appIconImage} style={styles.brandIcon} resizeMode="contain" />
        <Text style={styles.brandWord}>ZENOVA</Text>
      </View>

      <View style={styles.welcomeHeroWrap}>
        <Image source={cicadaImage} style={styles.welcomeHero} resizeMode="contain" />
      </View>

      <View style={styles.welcomeBottom}>
        <Text style={styles.welcomeTitleLight}>Sound,</Text>
        <Text style={styles.welcomeTitleBold}>shaped by you.</Text>
        <Text style={styles.welcomeLede}>
          Pair your Cicada. Tune your room. Done.
        </Text>

        <View style={styles.welcomeDots}>
          <View style={[styles.welcomeDot, styles.welcomeDotActive]} />
          <View style={styles.welcomeDot} />
          <View style={styles.welcomeDot} />
        </View>

        <Pressable
          onPress={completeIntro}
          style={({ pressed }) => [
            styles.welcomeCta,
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <IconChevronDouble size={28} color="#fff" />
        </Pressable>
      </View>
    </View>
  );

  const renderHomeHeader = () => (
    <View style={styles.homeHeader}>
      <View style={styles.profileChip}>
        <Image source={appIconImage} style={styles.profileAvatarImage} resizeMode="contain" />
        <Text style={styles.profileName}>Zenova</Text>
      </View>
      {/* Song ID listens to what's playing on the connected Zenova speaker, so
          the entry point only appears once a speaker is actually connected. */}
      {cicadaConnected && (
        <Pressable
          onPress={() => {
            tapLight();
            setNowPlayingVisible(true);
          }}
          hitSlop={10}
          style={({ pressed }) => [
            styles.musicBtn,
            {
              backgroundColor: pressed ? t.accentSoft : t.surface,
              borderColor: t.line,
            },
          ]}
          accessibilityLabel="Identify the song"
        >
          <IconMusic size={19} color={t.ink} />
        </Pressable>
      )}
    </View>
  );

  const renderHome = () => {
    const paired = knownDevices.filter((d) => d.bonded && d.matchedAsCicada);
    return (
      <>
        {renderHomeHeader()}

        <View style={styles.titleBlock}>
          <Text style={styles.h1Light}>
            {connectedDevice ? 'On air' : 'Hello,'}
          </Text>
          <Text style={styles.h1Bold}>
            {connectedDevice ? `${connectedDevice.displayName}.` : 'meet Cicada.'}
          </Text>
          <Text style={styles.lede}>
            {connectedDevice
              ? `${selectedMode} \u00b7 ${battery}% battery`
              : paired.length > 0
                ? 'Pick a speaker to take control.'
                : 'Pair a Cicada to get started.'}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <SoftCard style={styles.statCard}>
            <View style={styles.statIcon}>
              <IconWifi size={20} color={connectedDevice ? t.accentDeep : t.inkSoft} />
            </View>
            <Text style={styles.statLabel}>Signal</Text>
            <Text
              style={[
                styles.statValue,
                { color: connectedDevice ? t.accentDeep : t.inkSoft },
              ]}
            >
              {connectedDevice ? 'Live' : paired.length > 0 ? 'Paired' : 'Idle'}
            </Text>
          </SoftCard>

          <SoftCard
            tinted
            style={styles.statCard}
            onPress={() => goto('devices')}
          >
            <View style={[styles.statIcon, { backgroundColor: t.accent }]}>
              <IconPlus size={20} color="#fff" />
            </View>
            <Text style={styles.statLabel}>Add</Text>
            <Text style={[styles.statValue, { color: t.accentDeep }]}>Cicada</Text>
          </SoftCard>
        </View>

        <View style={styles.sectionHead}>
          <Eyebrow>My Cicadas</Eyebrow>
          <Pressable onPress={() => goto('devices')} hitSlop={8}>
            <Text style={styles.sectionAction}>See all</Text>
          </Pressable>
        </View>

        {paired.length === 0 ? (
          <SoftCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>None yet</Text>
            <Text style={styles.emptyCopy}>
              Add a Cicada to start tuning.
            </Text>
          </SoftCard>
        ) : (
          <View style={{ gap: 14 }}>
            {paired.map((device) => {
              const isConnected = connectedDevice?.address === device.address;
              const isBusy = connectingAddress === device.address;
              return (
                <SoftCard
                  key={device.address}
                  style={styles.deviceCard}
                  onPress={() => {
                    tapLight();
                    setActiveSpeakerAddress(device.address);
                    if (isConnected) {
                      setCurrentPage('speaker');
                    } else {
                      handleToggleConnect(device);
                    }
                  }}
                >
                  <View style={styles.deviceTopRow}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.deviceName} numberOfLines={2}>
                        {device.displayName}
                      </Text>
                      <View style={styles.batteryPill}>
                        <View style={[styles.batteryDot, { backgroundColor: t.accentDeep }]} />
                        <Text style={styles.batteryText}>
                          {isConnected ? `${battery}%` : 'Cicada'}
                        </Text>
                      </View>
                    </View>
                    <Image
                      source={cicadaImage}
                      style={styles.deviceCardImage}
                      resizeMode="contain"
                    />
                  </View>

                  <View style={styles.deviceBottomRow}>
                    <View style={styles.deviceBottomLeft}>
                      <IconBluetooth size={14} color={isConnected ? t.accentDeep : t.inkSoft} />
                      <Text
                        style={[
                          styles.deviceBottomLabel,
                          isConnected && { color: t.accentDeep },
                        ]}
                      >
                        {isBusy ? 'Connecting' : isConnected ? 'Connected' : 'Connect'}
                      </Text>
                    </View>
                    <IconChevronRight size={16} color={t.inkMuted} />
                  </View>
                </SoftCard>
              );
            })}
          </View>
        )}
      </>
    );
  };

  const renderDevices = () => {
    const paired = knownDevices.filter((d) => d.bonded && d.matchedAsCicada);
    return (
      <>
        {renderHomeHeader()}

        <View style={styles.devicesHero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1Light}>My</Text>
            <Text style={styles.h1Bold}>Cicadas.</Text>
            <Text style={styles.lede}>
              {paired.length === 0
                ? 'None paired yet.'
                : paired.length === 1
                  ? '1 paired'
                  : `${paired.length} paired`}
            </Text>
          </View>
          <Pressable
            onPress={() => goto('scan')}
            style={({ pressed }) => [
              styles.addFab,
              pressed && { transform: [{ scale: 0.94 }] },
            ]}
            hitSlop={8}
          >
            <Text style={styles.addFabPlus}>+</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHead}>
          <Eyebrow>Paired ({paired.length})</Eyebrow>
        </View>

        {paired.length === 0 ? (
          <SoftCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyCopy}>Hit + to find your Cicada.</Text>
          </SoftCard>
        ) : (
          <View style={{ gap: 12 }}>
            {paired.map((d) => {
              const isConnected = connectedDevice?.address === d.address;
              return (
                <SoftCard
                  key={d.address}
                  style={styles.devListCard}
                  onPress={() => {
                    tapLight();
                    setActiveSpeakerAddress(d.address);
                    if (isConnected) {
                      setCurrentPage('speaker');
                    } else {
                      handleToggleConnect(d);
                    }
                  }}
                >
                  <Image
                    source={cicadaImage}
                    style={styles.devListImage}
                    resizeMode="contain"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deviceListTitle}>{d.displayName}</Text>
                    <Text style={styles.deviceListSub}>
                      {isConnected
                        ? `Live · ${battery}%`
                        : d.matchedAsCicada
                          ? 'Paired · Tap to open'
                          : 'Paired audio device'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleUnpair(d)}
                    hitSlop={6}
                    style={styles.unpairBtn}
                  >
                    <Text style={styles.unpairLabel}>
                      {unpairingAddress === d.address ? '…' : 'Unpair'}
                    </Text>
                  </Pressable>
                </SoftCard>
              );
            })}
          </View>
        )}
      </>
    );
  };

  const renderSpeaker = () => {
    const speaker = activeSpeaker;
    if (!speaker) {
      return (
        <>
          {renderHomeHeader()}
          <View style={styles.titleBlock}>
            <Text style={styles.h1Light}>Nothing</Text>
            <Text style={styles.h1Bold}>connected.</Text>
            <Text style={styles.lede}>
              Pair a Cicada to start tuning.
            </Text>
          </View>
          <Pressable
            onPress={() => goto('devices')}
            style={[styles.primaryAction, { alignSelf: 'flex-start' }]}
          >
            <Text style={styles.primaryActionLabel}>Open Devices</Text>
          </Pressable>
        </>
      );
    }

    const isLive = connectedDevice?.address === speaker.address;

    return (
      <>
        {/* HERO: pure white slab. Bleeds past the ScrollView's horizontal
            padding so it spans the full screen width. The system status bar
            area is painted white separately via an absolute slab in the
            page root so it reads as one continuous element. */}
        <View style={styles.heroSlab}>
          <View style={styles.heroChrome}>
            <Pressable
              onPress={() => goto('home')}
              style={styles.heroBackBtn}
              hitSlop={8}
            >
              <IconChevronLeft size={18} color={t.ink} />
            </Pressable>
            <View style={styles.heroTitleBlock}>
              <Text style={styles.heroTitleEyebrow}>
                {isLive ? 'ON AIR' : 'PAIRED'}
              </Text>
              <Text style={styles.heroTitleName} numberOfLines={1}>
                {speaker.displayName}
              </Text>
            </View>
            {/* Song ID is only offered while this speaker is the live
                connection; a merely-paired speaker hides it (placeholder keeps
                the title centered). */}
            {isLive ? (
              <Pressable
                onPress={() => {
                  tapLight();
                  setNowPlayingVisible(true);
                }}
                style={styles.heroBackBtn}
                hitSlop={8}
                accessibilityLabel="Identify the song"
              >
                <IconMusic size={18} color={t.ink} />
              </Pressable>
            ) : (
              <View style={styles.heroBackBtnPlaceholder} />
            )}
          </View>

          <Image
            source={cicadaImage}
            style={styles.heroImage}
            resizeMode="contain"
          />
        </View>

        {/* WAVE PLATE: a separate section placed AFTER the hero. Its
            background is the page bone; the SVG paints a WHITE shape at
            its TOP that extends the hero's white down through a soft
            concave curve into the bone bg below. */}
        <View style={styles.heroWavePlate}>
          <Svg
            width="100%"
            height={48}
            viewBox="0 0 100 48"
            preserveAspectRatio="none"
            style={styles.heroWaveSvg}
          >
            <SvgPath
              d="M0,0 L0,18 C25,56 75,56 100,18 L100,0 Z"
              fill="#ffffff"
            />
          </Svg>
        </View>

        {/* Terraform pill, pulled up to straddle the wave seam. */}
        <Pressable
          onPress={() => {
            tapMedium();
            setAutoTuneVisible(true);
          }}
          style={({ pressed }) => [
            styles.heroAutoTune,
            pressed && styles.heroAutoTunePressed,
          ]}
          hitSlop={6}
        >
          <View style={styles.heroAutoTuneIcon}>
            <IconSparkle size={16} color="#fff" />
          </View>
          <Text style={styles.heroAutoTuneLabel}>Terraform your space</Text>
          <IconChevronRight size={18} color="rgba(255,255,255,0.65)" />
        </Pressable>

        {/* 2x2 grid of factory presets, each with a tinted background and
            an icon. Custom presets appear in a horizontal row underneath. */}
        <View style={styles.presetGrid}>
          {presets.map((p) => {
            const active = selectedMode === p.name;
            const meta = presetMeta[p.name] ?? {
              Icon: IconBalance,
              tint: t.surface,
              ink: t.inkSoft,
            };
            const PresetIcon = meta.Icon;
            return (
              <Pressable
                key={p.name}
                onPress={() => applyPreset(p)}
                style={({ pressed }) => [
                  styles.presetCard,
                  { backgroundColor: active ? t.selected : meta.tint },
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
              >
                <View
                  style={[
                    styles.presetGlyphBox,
                    { backgroundColor: active ? 'rgba(255,255,255,0.14)' : '#ffffff' },
                  ]}
                >
                  <PresetIcon size={20} color={active ? '#ffffff' : meta.ink} />
                </View>
                <Text
                  style={[
                    styles.presetCardLabel,
                    { color: active ? '#ffffff' : t.ink },
                  ]}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
                <Text
                  style={[
                    styles.presetCardHint,
                    { color: active ? 'rgba(255,255,255,0.65)' : t.inkMuted },
                  ]}
                  numberOfLines={1}
                >
                  {active ? 'Playing' : 'Tap'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHead}>
          <Eyebrow>Sound</Eyebrow>
        </View>
        <View style={styles.toggleRow}>
          <SoftCard style={styles.toggleCard}>
            <View style={styles.toggleTopRow}>
              <View style={[styles.toggleIconBox, { backgroundColor: t.accent }]}>
                <IconBluetooth size={18} color="#fff" />
              </View>
              <Switch
                value={bluetoothToggleOn}
                onValueChange={(v) => {
                  tapSelection();
                  setBluetoothToggleOn(v);
                }}
                trackColor={{ false: t.surfaceMuted, true: t.accentSoft }}
                thumbColor={bluetoothToggleOn ? t.accent : '#fff'}
              />
            </View>
            <Text style={styles.toggleTitle}>Equaliser</Text>
            <Text style={styles.toggleState}>{bluetoothToggleOn ? 'On' : 'Off'}</Text>
          </SoftCard>

          <SoftCard style={styles.toggleCard}>
            <View style={styles.toggleTopRow}>
              <View style={[styles.toggleIconBox, { backgroundColor: t.ink }]}>
                <IconMic size={18} color="#fff" />
              </View>
              <Switch
                value={hqAudioOn}
                onValueChange={(v) => {
                  tapSelection();
                  setHqAudioOn(v);
                }}
                trackColor={{ false: t.surfaceMuted, true: t.accentSoft }}
                thumbColor={hqAudioOn ? t.accent : '#fff'}
              />
            </View>
            <Text style={styles.toggleTitle}>Studio gain</Text>
            <Text style={styles.toggleState}>{hqAudioOn ? 'On' : 'Off'}</Text>
          </SoftCard>
        </View>

        <View style={styles.sectionHead}>
          <Eyebrow>Spatial</Eyebrow>
          <Text style={styles.sectionAction}>Room feel</Text>
        </View>
        <SoftCard style={styles.spatialCard}>
          <View style={styles.spatialRow}>
            <Text style={styles.spatialLabel}>Reverb</Text>
            <View style={styles.spatialSegmented}>
              {[
                { value: 0, label: 'Off' },
                { value: 2, label: 'Room' },
                { value: 5, label: 'Hall' },
                { value: 6, label: 'Plate' },
              ].map((opt) => {
                const active = reverbPreset === opt.value;
                return (
                  <Pressable
                    key={`reverb-${opt.value}`}
                    onPress={() => {
                      if (reverbPreset === opt.value) return;
                      tapSelection();
                      setReverbPreset(opt.value);
                    }}
                    style={[
                      styles.spatialPill,
                      active && { backgroundColor: t.selected },
                    ]}
                    hitSlop={4}
                  >
                    <Text
                      style={[
                        styles.spatialPillLabel,
                        { color: active ? '#fff' : t.inkSoft },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.spatialDivider} />

          <View style={styles.spatialRow}>
            <Text style={styles.spatialLabel}>Stage</Text>
            <View style={styles.spatialSegmented}>
              {[
                { value: 0, label: 'Off' },
                { value: 333, label: 'Narrow' },
                { value: 666, label: 'Wide' },
                { value: 1000, label: 'Max' },
              ].map((opt) => {
                const active = virtualizerStrength === opt.value;
                return (
                  <Pressable
                    key={`virt-${opt.value}`}
                    onPress={() => {
                      if (virtualizerStrength === opt.value) return;
                      tapSelection();
                      setVirtualizerStrength(opt.value);
                    }}
                    style={[
                      styles.spatialPill,
                      active && { backgroundColor: t.selected },
                    ]}
                    hitSlop={4}
                  >
                    <Text
                      style={[
                        styles.spatialPillLabel,
                        { color: active ? '#fff' : t.inkSoft },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.spatialDivider} />

          <View style={styles.spatialRow}>
            <Text style={styles.spatialLabel}>Punch</Text>
            <View style={styles.spatialSegmented}>
              {[
                { value: 0, label: 'Off' },
                { value: 333, label: 'Low' },
                { value: 666, label: 'Mid' },
                { value: 1000, label: 'High' },
              ].map((opt) => {
                const active = bassBoostStrength === opt.value;
                return (
                  <Pressable
                    key={`bass-${opt.value}`}
                    onPress={() => {
                      if (bassBoostStrength === opt.value) return;
                      tapSelection();
                      setBassBoostStrength(opt.value);
                    }}
                    style={[
                      styles.spatialPill,
                      active && { backgroundColor: t.selected },
                    ]}
                    hitSlop={4}
                  >
                    <Text
                      style={[
                        styles.spatialPillLabel,
                        { color: active ? '#fff' : t.inkSoft },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SoftCard>

        <View style={styles.sectionHead}>
          <Eyebrow>Equaliser</Eyebrow>
          <View style={styles.eqSegmented}>
            {(['tone', 'fine'] as const).map((id) => {
              const active = eqView === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    if (eqView === id) return;
                    tapSelection();
                    setEqView(id);
                  }}
                  style={[
                    styles.eqSegmentItem,
                    active && { backgroundColor: t.selected },
                  ]}
                  hitSlop={4}
                >
                  <Text
                    style={[
                      styles.eqSegmentLabel,
                      { color: active ? '#fff' : t.inkSoft },
                    ]}
                  >
                    {id === 'tone' ? 'Tone' : 'Fine'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <SoftCard style={styles.eqStageCard}>
          {/* Tone view (3 bands) */}
          <Animated.View
            pointerEvents={eqView === 'tone' ? 'auto' : 'none'}
            style={[
              styles.eqStageLayer,
              {
                opacity: eqViewAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
                transform: [
                  {
                    translateY: eqViewAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -8],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sliderRow}>
              <VerticalSlider
                label="Bass"
                value={Math.round((eq.subBass + eq.bass) / 2)}
                onChange={(next) =>
                  setEq((c) => ({ ...c, subBass: next, bass: next }))
                }
                ink={t.ink}
                inkSoft={t.inkSoft}
                trackColor={t.surfaceMuted}
                fillColor={t.accent}
                centerColor={t.line}
              />
              <VerticalSlider
                label="Mids"
                value={eq.mid}
                onChange={(next) => setEq((c) => ({ ...c, mid: next }))}
                ink={t.ink}
                inkSoft={t.inkSoft}
                trackColor={t.surfaceMuted}
                fillColor={t.accent}
                centerColor={t.line}
              />
              <VerticalSlider
                label="Treble"
                value={Math.round((eq.presence + eq.treble) / 2)}
                onChange={(next) =>
                  setEq((c) => ({ ...c, presence: next, treble: next }))
                }
                ink={t.ink}
                inkSoft={t.inkSoft}
                trackColor={t.surfaceMuted}
                fillColor={t.accent}
                centerColor={t.line}
              />
            </View>
          </Animated.View>

          {/* Fine view (5 bands) */}
          <Animated.View
            pointerEvents={eqView === 'fine' ? 'auto' : 'none'}
            style={[
              styles.eqStageLayer,
              {
                opacity: eqViewAnim,
                transform: [
                  {
                    translateY: eqViewAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sliderRow}>
              {(Object.keys(eqBandLabels) as EqBandKey[]).map((band) => (
                <VerticalSlider
                  key={band}
                  label={eqBandLabels[band]}
                  value={eq[band]}
                  onChange={(next) => setEq((c) => ({ ...c, [band]: next }))}
                  ink={t.ink}
                  inkSoft={t.inkSoft}
                  trackColor={t.surfaceMuted}
                  fillColor={t.accent}
                  centerColor={t.line}
                  height={140}
                />
              ))}
            </View>
          </Animated.View>
        </SoftCard>

        <View style={styles.eqActionsRow}>
          <Pressable
            onPress={() => {
              tapLight();
              setSaveModalVisible(true);
            }}
            style={styles.eqActionBtn}
            hitSlop={4}
          >
            <Text style={[styles.eqActionLabel, { color: t.ink }]}>Save shape</Text>
          </Pressable>
        </View>

        {/* Custom presets live UNDER the equaliser — they are saved EQ
            shapes, so they belong next to the EQ controls rather than
            alongside the factory grid at the top. */}
        {customPresets.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetRow}
          >
            {customPresets.map((cp) => {
              const active = selectedMode === cp.name;
              return (
                <Pressable
                  key={cp.id}
                  onPress={() => applyCustomPreset(cp)}
                  onLongPress={() => handleDeleteCustomPreset(cp.id)}
                  delayLongPress={500}
                  style={[
                    styles.presetPill,
                    styles.customPresetPill,
                    active && styles.presetPillActive,
                  ]}
                >
                  <IconDot size={8} color={active ? '#fff' : t.accent} />
                  <Text
                    style={[
                      styles.presetLabel,
                      { color: active ? '#fff' : t.inkSoft },
                    ]}
                    numberOfLines={1}
                  >
                    {cp.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        {customPresets.length > 0 ? (
          <Text style={styles.eqHelperText}>
            Long-press a custom preset to remove.
          </Text>
        ) : null}
      </>
    );
  };

  // --------------------------------------------------------------------------
  // Tab bar
  // --------------------------------------------------------------------------

  const tabs: { id: PageName; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'devices', label: 'Devices' },
    { id: 'speaker', label: 'Speaker' },
    { id: 'karaoke', label: 'Karaoke' },
    { id: 'rooms', label: 'Rooms' },
  ];
  const tabIcons: Record<string, (props: { size?: number; color?: string }) => React.JSX.Element> = {
    home: IconHome,
    devices: IconDevices,
    speaker: IconSpeakerSmall,
    karaoke: IconMic,
    rooms: IconRooms,
  };

  const showChrome = currentPage !== 'welcome' && currentPage !== 'scan';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* On the speaker page, paint a white slab behind the status bar so
          the system inset reads as one continuous white surface with the
          hero below it. The rest of the page stays bone. */}
      {currentPage === 'speaker' ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: '#ffffff',
            zIndex: 1,
          }}
        />
      ) : null}
      <StatusBar style="dark" />
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        {introSeen === null ? (
          <View style={{ flex: 1 }} />
        ) : currentPage === 'welcome' ? (
          <AnimatedPage pageKey="welcome">{renderWelcome()}</AnimatedPage>
        ) : currentPage === 'scan' ? (
          <AnimatedPage pageKey="scan">
            <RadarScan
              bg={t.bg}
              ink={t.ink}
              inkSoft={t.inkSoft}
              accent={t.accent}
              accentSoft={t.accentSoft}
              line={t.line}
              surface={t.surface}
              isScanning={isScanning}
              devices={knownDevices.filter((d) => !d.bonded)}
              speakerImage={cicadaImage}
              onClose={() => goto('devices')}
              onRescan={scanNearby}
              onSelectDevice={(d) => {
                tapMedium();
                handlePair(d).then(() => {
                  setActiveSpeakerAddress(d.address);
                  setCurrentPage('speaker');
                });
              }}
            />
          </AnimatedPage>
        ) : currentPage === 'karaoke' ? (
          // Karaoke renders OUTSIDE the vertical ScrollView so the mic can
          // anchor to the actual screen bottom (flush to 0). The mic image
          // visually passes BEHIND the floating tab bar — that's the
          // desired "emerging from the bottom" effect, so we don't reserve
          // space for the tab bar here.
          <AnimatedPage pageKey={currentPage}>
            <View style={{ flex: 1 }}>
              <KaraokePage
                theme={t}
                cicadaConnected={cicadaConnected}
                activeSpeakerAddress={activeSpeakerAddress}
                onError={setErrorMessage}
              />
            </View>
          </AnimatedPage>
        ) : currentPage === 'rooms' ? (
          <View style={{ flex: 1 }} />
        ) : (
          <AnimatedPage pageKey={currentPage}>
            <ScrollView
              contentContainerStyle={[
                styles.scroll,
                // Bottom buffer: room for the floating tab bar that now
                // overlays the bottom of the screen. Floating pill is
                // ~62 px tall, plus 14 px top padding, plus safe-area
                // inset, plus 16 px breathing room.
                { paddingBottom: 96 + insets.bottom },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {!isSupported ? (
                <Text style={styles.warningText}>{runtimeHint}</Text>
              ) : null}

              {currentPage === 'home' ? renderHome() : null}
              {currentPage === 'devices' ? renderDevices() : null}
              {currentPage === 'speaker' ? renderSpeaker() : null}
            </ScrollView>
          </AnimatedPage>
        )}
        {roomsMounted ? (
          <View
            pointerEvents={currentPage === 'rooms' ? 'auto' : 'none'}
            style={[
              styles.roomKeepAlive,
              { top: insets.top },
              currentPage === 'rooms' ? styles.roomKeepAliveVisible : styles.roomKeepAliveHidden,
            ]}
          >
            <RoomScreen
              theme={t}
              onBack={() => goto('home')}
            />
          </View>
        ) : null}
      </SafeAreaView>

      {/* Truly floating tab bar: lives OUTSIDE SafeAreaView, anchored to
          the very bottom of the screen. Content scrolls underneath it so
          the BlurView frosts whatever is behind \u2014 the actual liquid
          glass effect. */}
      {showChrome ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.tabBarWrap,
            { paddingBottom: Math.max(14, insets.bottom + 4) },
          ]}
        >
          <View style={styles.tabBar}>
            {/* Liquid glass stack:
                1. BlurView \u2014 frosted backdrop (frosts the scrolled
                   content behind the pill, since the pill is over content).
                2. Two linear gradients \u2014 a top-down sheen and a diagonal
                   highlight that suggests refraction / warp.
                3. Top edge stroke \u2014 the bright "glass rim" highlight.
                4. Tab row sits on top of all of that. */}
            <BlurView
              intensity={70}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(255,255,255,0.55)',
                'rgba(255,255,255,0.10)',
                'rgba(255,255,255,0.30)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(255,255,255,0.40)',
                'rgba(255,255,255,0)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.85 }}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.tabBarRim} />

            {tabs.map((tab) => {
              const active = currentPage === tab.id;
              const TabIcon = tabIcons[tab.id];
              // Both Speaker and Karaoke need a live Cicada connection.
              const requiresConnection =
                tab.id === 'speaker' || tab.id === 'karaoke';
              const isUnreachable = requiresConnection && !cicadaConnected;
              return (
                <Pressable
                  key={tab.id}
                  disabled={isUnreachable}
                  accessibilityRole="button"
                  accessibilityLabel={tab.label}
                  onPress={() => {
                    if (isUnreachable) return;
                    goto(tab.id);
                  }}
                  style={[
                    styles.tabItem,
                    active && styles.tabItemActive,
                    isUnreachable && { opacity: 0.45 },
                  ]}
                >
                  {active ? (
                    <LinearGradient
                      pointerEvents="none"
                      colors={[
                        'rgba(255,255,255,0.18)',
                        'rgba(255,255,255,0)',
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : null}
                  <TabIcon
                    size={22}
                    color={active ? '#fff' : isUnreachable ? t.inkMuted : t.ink}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <FloatingToast
        message={errorMessage}
        onHide={() => setErrorMessage(null)}
        bottomInset={showChrome ? insets.bottom + 78 : insets.bottom}
      />

      <PairingOverlay
        visible={Boolean(pairingAddress || connectingAddress)}
        bg={t.bg}
        ink={t.ink}
        inkSoft={t.inkSoft}
        line={t.line}
        surface={t.surface}
        speakerImage={cicadaImage}
        title={pairingAddress ? 'Pairing Cicada' : 'Waking Cicada'}
        subtitle={
          pairingAddress
            ? 'Trading handshakes\u2026'
            : 'Opening the line\u2026'
        }
      />

      <SavePresetModal
        visible={saveModalVisible}
        bg={t.bg}
        ink={t.ink}
        inkSoft={t.inkSoft}
        line={t.line}
        surface={t.surface}
        accent={t.accent}
        existingNames={[
          ...presets.map((p) => p.name),
          ...customPresets.map((c) => c.name),
        ]}
        onCancel={() => setSaveModalVisible(false)}
        onSave={handleSaveCustomPreset}
      />

      {autoTuneVisible ? (
        <AutoTuneModal
          visible={autoTuneVisible}
          bg={t.bg}
          ink={t.ink}
          inkSoft={t.inkSoft}
          line={t.line}
          surface={t.surface}
          accent={t.accent}
          accentSoft={t.accentSoft}
          onClose={() => setAutoTuneVisible(false)}
          onApply={handleAutoTuneApply}
        />
      ) : null}

      <NowPlayingScreen
        visible={nowPlayingVisible}
        theme={t}
        onClose={() => setNowPlayingVisible(false)}
      />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AppScreen />
    </SafeAreaProvider>
  );
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const styles = StyleSheet.create({
  // ---- Scroll & generic ----
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 18,
  },
  warningText: {
    color: t.warn,
    fontSize: 12,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: '#f4dcd8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  errorText: {
    color: t.danger,
    fontSize: 12,
    lineHeight: 18,
  },

  // ---- Typography ----
  eyebrow: {
    color: t.inkSoft,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  h1Light: {
    color: t.ink,
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  h1Bold: {
    color: t.ink,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 38,
    marginTop: -4,
  },
  lede: {
    color: t.inkSoft,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },

  // ---- Welcome page ----
  welcomeRoot: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
  },
  welcomeHeader: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  brandWord: {
    color: t.ink,
    fontSize: 13,
    letterSpacing: 6,
    fontWeight: '800',
    marginTop: 6,
  },
  brandIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
  },
  welcomeHeroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  welcomeHaloOuter: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: t.accent,
    opacity: 0.16,
  },
  welcomeHaloInner: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: t.accentSoft,
    opacity: 0.85,
  },
  welcomeHero: {
    width: '88%',
    height: 320,
  },
  welcomeBottom: {
    alignItems: 'center',
    paddingTop: 6,
  },
  welcomeTitleLight: {
    color: t.ink,
    fontSize: 26,
    fontWeight: '300',
    letterSpacing: -0.3,
  },
  welcomeTitleBold: {
    color: t.ink,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  welcomeLede: {
    color: t.inkSoft,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 32,
  },
  welcomeDots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
  },
  welcomeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.line,
  },
  welcomeDotActive: {
    width: 18,
    backgroundColor: t.accent,
  },
  welcomeCta: {
    marginTop: 22,
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: t.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: t.accentDeep,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  // ---- Home header / profile ----
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 4,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileAvatarImage: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  profileName: {
    color: t.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  musicBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCirclePlaceholder: {
    width: 40,
    height: 40,
  },
  iconCirclePower: {
    backgroundColor: t.accent,
    borderColor: t.accent,
  },

  // ---- Section heads ----
  titleBlock: { paddingVertical: 4 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 6,
  },
  sectionAction: {
    color: t.accentDeep,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '700',
  },

  // ---- Soft card base ----
  softCard: {
    borderRadius: 26,
    padding: 18,
    backgroundColor: t.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.lineSoft,
  },
  emptyCard: {
    paddingVertical: 22,
  },
  emptyTitle: {
    color: t.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyCopy: {
    color: t.inkSoft,
    fontSize: 13,
    marginTop: 4,
  },

  // ---- Stat tiles ----
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    gap: 8,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: t.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    color: t.inkSoft,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  statValue: {
    color: t.ink,
    fontSize: 16,
    fontWeight: '800',
  },

  // ---- Device cards (Home) ----
  deviceCard: {
    padding: 16,
    gap: 14,
  },
  deviceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceName: {
    color: t.ink,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  batteryPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: t.accentTint,
  },
  batteryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  batteryText: {
    color: t.accentDeep,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  deviceCardImage: {
    width: 92,
    height: 72,
  },
  deviceBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.line,
    paddingTop: 12,
  },
  deviceBottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceBottomLabel: {
    color: t.inkSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  deviceOpenChevron: {
    color: t.inkSoft,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '600',
  },

  // ---- Devices page ----
  devicesHero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingBottom: 8,
  },
  addFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: t.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: t.ink,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  addFabPlus: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryAction: {
    backgroundColor: t.ink,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryActionLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  ghostAction: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.line,
    backgroundColor: t.surface,
  },
  ghostActionLabel: {
    color: t.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  devListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  devListImage: {
    width: 56,
    height: 56,
  },
  deviceListTitle: {
    color: t.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  deviceListSub: {
    color: t.inkSoft,
    fontSize: 12,
    marginTop: 2,
  },
  devListTrail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unpairBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.line,
    backgroundColor: t.surface,
  },
  unpairLabel: {
    color: t.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pairBtn: {
    backgroundColor: t.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pairBtnLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ---- Speaker header / presets ----
  speakerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  speakerHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color: t.ink,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  presetRow: {
    paddingVertical: 4,
    paddingRight: 12,
    gap: 8,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    columnGap: 12,
  },
  presetCard: {
    width: '48%',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.lineSoft,
  },
  presetGlyphBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetGlyph: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '700',
  },
  presetCardLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  presetCardHint: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: -4,
  },
  presetPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
  },
  customPresetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 180,
  },
  customDot: {
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  // Update selected tab/preset and other primary states to the same
  // selected token rather than pure ink black.
  presetPillActive: {
    backgroundColor: t.selected,
    borderColor: t.selected,
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  eqActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  eqActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
  },
  eqActionPrimary: {
    backgroundColor: t.ink,
    borderColor: t.ink,
  },
  eqActionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  eqHelperText: {
    fontSize: 11,
    color: t.inkMuted,
    marginTop: 4,
    letterSpacing: 0.2,
  },

  // ---- Hero (full-bleed white slab + separate wave plate + terraform pill)
  // The hero is intentionally split into TWO stacked white blocks so the
  // curve carving the bottom of the white belongs to its own section,
  // separate from the speaker's photographic plate. Both blocks bleed past
  // the ScrollView's 20px horizontal padding via negative margins.
  heroSlab: {
    width: SCREEN_W,
    marginLeft: -20,
    marginRight: -20,
    marginTop: -8,
    backgroundColor: '#ffffff',
    paddingTop: 18,
    paddingBottom: 28,
    alignItems: 'center',
  },
  heroChrome: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  heroBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: t.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBackBtnPlaceholder: {
    width: 38,
    height: 38,
  },
  heroTitleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  heroTitleEyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    color: '#a59c8b',
    marginBottom: 4,
  },
  heroTitleName: {
    fontSize: 17,
    fontWeight: '800',
    color: t.ink,
    letterSpacing: 0.2,
  },
  heroImage: {
    width: '88%',
    height: 280,
    marginTop: 12,
  },
  heroWavePlate: {
    width: SCREEN_W,
    marginLeft: -20,
    marginRight: -20,
    marginTop: -18,
    height: 48,
    backgroundColor: t.bg,
    position: 'relative',
  },
  heroWaveSvg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  heroAutoTune: {
    alignSelf: 'center',
    marginTop: -28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 8,
    paddingRight: 20,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: t.ink,
    borderWidth: 4,
    borderColor: '#ffffff',
    shadowColor: '#1f1c17',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  heroAutoTunePressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: '#2e2922',
  },
  heroAutoTuneIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAutoTuneSpark: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '900',
  },
  heroAutoTuneLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  heroAutoTuneChevron: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '700',
    marginLeft: -4,
  },

  // ---- Volume card ----
  volumeCard: { padding: 18, gap: 12 },

  // ---- EQ section (segmented + crossfade) ----
  eqSegmented: {
    flexDirection: 'row',
    backgroundColor: t.surface,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.line,
    padding: 3,
  },
  eqSegmentItem: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  eqSegmentLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // ---- Spatial card ----
  spatialCard: {
    padding: 14,
    gap: 0,
  },
  spatialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12,
  },
  spatialLabel: {
    color: t.ink,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  spatialSegmented: {
    flexDirection: 'row',
    flex: 1,
    backgroundColor: t.surfaceMuted,
    borderRadius: 999,
    padding: 3,
    marginLeft: 12,
  },
  spatialPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spatialPillLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  spatialDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.line,
    marginVertical: 4,
    opacity: 0.7,
  },
  eqStageCard: {
    paddingVertical: 22,
    paddingHorizontal: 18,
    minHeight: 240,
    overflow: 'hidden',
  },
  eqStageLayer: {
    position: 'absolute',
    top: 22,
    left: 18,
    right: 18,
    bottom: 22,
  },
  sliderRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  volumeSlider: { flex: 1 },
  volumeTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: t.surfaceMuted,
    position: 'relative',
  },
  volumeFill: {
    height: '100%',
    backgroundColor: t.accent,
    borderRadius: 3,
  },
  volumeThumb: {
    position: 'absolute',
    top: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: t.accent,
    marginLeft: -9,
  },
  volumeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: t.accentTint,
  },
  volumeChipText: {
    color: t.accentDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  volumeStepsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  volumeStepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: t.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeStepLabel: {
    color: t.ink,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },

  // ---- Toggle cards ----
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleCard: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  toggleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleIconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTitle: {
    color: t.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  toggleState: {
    color: t.inkSoft,
    fontSize: 12,
    fontWeight: '600',
  },

  // ---- Now Playing ----
  nowPlaying: {
    padding: 14,
    gap: 12,
  },
  nowPlayingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nowArtBare: {
    width: 52,
    height: 52,
  },
  nowTitle: {
    color: t.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  nowArtist: {
    color: t.inkSoft,
    fontSize: 12,
    marginTop: 2,
  },
  nowMore: {
    color: t.inkSoft,
    fontSize: 18,
    fontWeight: '700',
  },
  nowScrubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nowTime: {
    color: t.inkSoft,
    fontSize: 11,
    fontWeight: '600',
  },
  nowScrubTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.surfaceMuted,
    position: 'relative',
  },
  nowScrubFill: {
    height: '100%',
    backgroundColor: t.accent,
    borderRadius: 2,
  },
  nowScrubThumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: t.accent,
    marginLeft: -6,
  },
  nowControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 4,
  },
  nowPlayBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: t.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- EQ ----
  eqRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 8,
  },
  eqCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  eqTrack: {
    width: '46%',
    height: 96,
    backgroundColor: t.surfaceMuted,
    borderRadius: 999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  eqFill: {
    width: '100%',
    backgroundColor: t.accent,
    borderRadius: 999,
  },
  eqValue: {
    color: t.inkSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  eqStepRow: { flexDirection: 'row', gap: 4 },
  eqStep: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eqStepLabel: {
    color: t.ink,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
  },
  eqLabel: {
    color: t.ink,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  roomKeepAlive: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: t.bg,
  },
  roomKeepAliveVisible: {
    opacity: 1,
    zIndex: 3,
  },
  roomKeepAliveHidden: {
    opacity: 0,
    zIndex: 0,
  },

  // ---- Tab bar (liquid glass) ----
  tabBarWrap: {
    // Absolutely positioned so scrolled content passes BEHIND the pill —
    // that's what makes the BlurView frost actual content (proper liquid
    // glass), not just the page background.
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 5,
    overflow: 'hidden',
    // Glass shadow — a soft, broader drop than a flat card so the pill
    // feels detached from the surface beneath it.
    shadowColor: '#1f1c17',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  tabBarRim: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
    opacity: 0.9,
  },
  tabItem: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabItemActive: {
    backgroundColor: t.selected,
  },
});
