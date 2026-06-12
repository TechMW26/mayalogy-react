import {
  AudioPlayer,
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  getMusicVolume,
  setKeepScreenOn,
  setMusicVolume,
} from 'zenova-audio-fx';
import { useVideoPlayer, VideoView } from 'expo-video';

import BlobVisualizer from './BlobVisualizer';
import { notifySuccess, tapLight, tapMedium } from './haptics';
import { refineTerraformEqWithAI } from './ai';

type EqShape = {
  subBass: number;
  bass: number;
  mid: number;
  presence: number;
  treble: number;
};

type AutoTuneModalProps = {
  visible: boolean;
  bg: string;
  ink: string;
  inkSoft: string;
  line: string;
  surface: string;
  accent: string;
  accentSoft?: string;
  onClose: () => void;
  onApply: (eq: EqShape) => void;
};

type Phase =
  | 'intro'
  | 'requesting'
  | 'countdown'
  | 'denied'
  | 'baseline'
  | 'measuring'
  | 'done'
  | 'error';

// We play "Dream Is Collapsing" by Hans Zimmer (Inception OST) through the
// speaker during terraforming and bucket mic samples into windows that
// match the song's natural per-band content:
//   - 0:05 - 0:18  the first BRRRAAAM — sustained low brass, sub-bass
//                  dominant. Hans Zimmer's signature "BRAAAM" sits around
//                  30-60 Hz, perfect for sub measurement.
//   - 0:20 - 0:35  second BRAAAM + bass drums, primarily bass band.
//   - 0:40 - 0:55  strings begin entering the build, mid band.
//   - 1:00 - 1:18  string + brass mid section, presence band content.
//   - 1:20 - 1:38  full orchestral climax — cymbals + high strings
//                  provide treble band energy.
//
// The file is the user's personal copy; in-app disclaimer makes the rights
// situation explicit. Asset is bundled for personal device tuning only.
const SWEEP_ASSET = require('../assets/tones/terraform_song.mp3');
const SWEEP_DURATION_MS = 95000;

// Short looping clip showing the correct phone-to-speaker placement.
// Played silently, no controls, on the intro card.
const EXPLAINER_VIDEO = require('../assets/videos/terraform_explainer.mp4');

// Per-band [start, end] window into the song in milliseconds. Tuned to the
// natural spectral structure of "Dream Is Collapsing" (see SWEEP_ASSET
// comment above). Each band's window captures roughly the time when that
// frequency range dominates the mix — imperfect but the best we can do
// without on-device FFT.
const BAND_WINDOWS: { key: keyof EqShape; label: string; from: number; to: number }[] = [
  { key: 'subBass',  label: 'Sub bass',  from:  5000,  to: 18000 },
  { key: 'bass',     label: 'Bass',      from: 20000, to: 35000 },
  { key: 'mid',      label: 'Mid',       from: 40000, to: 55000 },
  { key: 'presence', label: 'Presence',  from: 60000, to: 78000 },
  { key: 'treble',   label: 'Treble',    from: 80000, to: 95000 },
];

const RECORD_OPTIONS = {
  ...RecordingPresets.LOW_QUALITY,
  isMeteringEnabled: true,
};

const average = (xs: number[]) =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// Metering on Android is roughly dBFS-ish: 0 ≈ max, -120 ≈ silence.
// Normalise into a 0..1 range for the blob.
function meterToIntensity(metering: number) {
  const norm = (metering + 60) / 60; // -60..0 dBFS → 0..1
  return clamp(norm, 0, 1);
}

export default function AutoTuneModal({
  visible,
  bg,
  ink,
  inkSoft,
  line,
  surface,
  accent,
  accentSoft,
  onClose,
  onApply,
}: AutoTuneModalProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stepLabel, setStepLabel] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [corrections, setCorrections] = useState<EqShape | null>(null);
  const [countdownValue, setCountdownValue] = useState(3);

  // Live mic intensity (0..1) for the BlobVisualizer.
  const [intensity, setIntensity] = useState(0);

  const cancelledRef = useRef(false);
  const samplesRef = useRef<number[]>([]);
  const playerRef = useRef<AudioPlayer | null>(null);

  // Saved music-stream volume so we can restore it when the calibration ends.
  const savedVolumeRef = useRef<number | null>(null);
  const volumeMaxRef = useRef<number>(0);

  // Polled on a setInterval while measuring. Captures both into samplesRef
  // (for analysis) and intensity state (for the blob).
  const recorder = useAudioRecorder(RECORD_OPTIONS);

  // Silent explainer video on the intro card. Auto-plays once on mount,
  // muted, no controls — just shows the correct phone placement and
  // stops at the end of the clip (no loop).
  const explainerPlayer = useVideoPlayer(EXPLAINER_VIDEO, (p) => {
    p.muted = true;
    p.loop = false;
    p.play();
  });

  // Card-mode pulse (intro/done/error/denied).
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  // 3-2-1 countdown number scale/opacity, retriggered on each tick.
  const countdownAnim = useRef(new Animated.Value(0)).current;

  const { width: windowW, height: windowH } = useWindowDimensions();

  useEffect(() => {
    if (!visible) {
      cancelledRef.current = true;
      teardown();
      restoreVolume();
      setPhase('intro');
      setErrorMsg(null);
      setStepLabel('');
      setStepIndex(0);
      setCorrections(null);
      setIntensity(0);
      return;
    }
    cancelledRef.current = false;
  }, [visible]);

  // Pop animation each time the countdown number changes.
  useEffect(() => {
    if (phase !== 'countdown') return;
    countdownAnim.setValue(0);
    Animated.spring(countdownAnim, {
      toValue: 1,
      tension: 90,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [countdownValue, phase, countdownAnim]);

  useEffect(() => {
    if (phase !== 'baseline' && phase !== 'measuring') return;
    const pulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 1800,
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
    const a = pulse(ring1, 0);
    const b = pulse(ring2, 700);
    a.start();
    b.start();
    return () => {
      ring1.stopAnimation();
      ring2.stopAnimation();
    };
  }, [phase, ring1, ring2]);

  const teardown = async () => {
    try {
      await recorder.stop();
    } catch {
      /* noop */
    }
    const p = playerRef.current;
    playerRef.current = null;
    if (p) {
      try {
        p.pause();
      } catch {
        /* noop */
      }
      try {
        (p as unknown as { release?: () => void }).release?.();
      } catch {
        /* noop */
      }
    }
    // CRITICAL: reset the audio mode back to playback-only ('doNotMix').
    // While terraforming we set `allowsRecording: true` + `mixWithOthers`,
    // which disables audio focus requests. If we leave the session in that
    // state, the next preset chime / pair sound silently fails to route
    // to the Bluetooth speaker because Android won't grant the stream
    // to A2DP without focus.
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
    // Allow the screen to sleep again now the read is done. Cheap to
    // call repeatedly — native side just clears the window flag.
    try { await setKeepScreenOn(false); } catch { /* noop */ }
  };

  const pushVolumeMax = async () => {
    try {
      const [current, max] = await getMusicVolume();
      if (max > 0) {
        savedVolumeRef.current = current;
        volumeMaxRef.current = max;
        await setMusicVolume(max);
      }
    } catch {
      /* noop */
    }
  };

  const restoreVolume = async () => {
    const saved = savedVolumeRef.current;
    savedVolumeRef.current = null;
    if (saved !== null) {
      try {
        await setMusicVolume(saved);
      } catch {
        /* noop */
      }
    }
  };

  const measureFor = async (durationMs: number): Promise<number> => {
    samplesRef.current = [];
    try {
      await recorder.prepareToRecordAsync(RECORD_OPTIONS);
      recorder.record();
    } catch {
      return 0;
    }

    const sampler = setInterval(() => {
      try {
        const s = recorder.getStatus();
        if (
          s &&
          s.isRecording &&
          typeof s.metering === 'number' &&
          Number.isFinite(s.metering)
        ) {
          samplesRef.current.push(s.metering);
          setIntensity(meterToIntensity(s.metering));
        }
      } catch {
        /* noop */
      }
    }, 50);

    const start = Date.now();
    while (Date.now() - start < durationMs) {
      if (cancelledRef.current) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    clearInterval(sampler);

    try {
      await recorder.stop();
    } catch {
      /* noop */
    }

    return average(samplesRef.current);
  };

  const playToneAndMeasure = async (asset: number, ms: number): Promise<number> => {
    let player: AudioPlayer | null = null;
    try {
      player = createAudioPlayer(asset);
      playerRef.current = player;
    } catch {
      return 0;
    }
    try {
      player.play();
    } catch {
      /* noop */
    }
    const measured = await measureFor(ms);
    try {
      player.pause();
    } catch {
      /* noop */
    }
    try {
      (player as unknown as { release?: () => void }).release?.();
    } catch {
      /* noop */
    }
    playerRef.current = null;
    return measured;
  };

  // Plays the full sweep ONCE and returns per-band measurements collected
  // during each band's time window. The mic samples are bucketed by the
  // current sweep position (Date.now() - sweepStart).
  const playSweepAndMeasure = async (): Promise<number[]> => {
    // Bucket arrays of mic samples, one per band, plus a baseline bucket.
    const buckets: number[][] = BAND_WINDOWS.map(() => []);
    const baseline: number[] = [];
    let player: AudioPlayer | null = null;
    try {
      player = createAudioPlayer(SWEEP_ASSET);
      playerRef.current = player;
    } catch {
      return BAND_WINDOWS.map(() => 0);
    }

    // Force-stop any leftover recording state from a prior measureFor()
    // call — on Android, calling prepareToRecordAsync() while the
    // recorder is in a 'stopped-but-not-released' state silently produces
    // a recording with no metering data (all zeros), which is exactly the
    // failure mode we saw.
    try { await recorder.stop(); } catch { /* recorder was idle, fine */ }

    // Start recorder fresh. Polling pushes each metering reading into the
    // bucket whose time window contains the current sweep position.
    let recorderReady = false;
    try {
      await recorder.prepareToRecordAsync(RECORD_OPTIONS);
      recorder.record();
      recorderReady = true;
    } catch {
      recorderReady = false;
    }

    // Give Android's mic a moment to actually start delivering frames —
    // without this, the first ~150 ms of polling returns metering = -160
    // (silence) even though the sweep is already playing.
    await new Promise((r) => setTimeout(r, 250));

    const sweepStart = Date.now();
    try {
      // Wait for the audio file to actually be ready before play()
      // (createAudioPlayer is synchronous-looking but loads in the
      // background). Without this the head of the sweep is dropped on
      // some devices, costing us the sub-bass measurement window.
      const loadStart = Date.now();
      while (Date.now() - loadStart < 1500) {
        const isLoaded = (player as unknown as { isLoaded?: boolean }).isLoaded;
        if (isLoaded) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      (player as unknown as { volume?: number }).volume = 1.0;
      player.play();
    } catch {
      /* noop */
    }

    // Step UI through the bands as the sweep enters each window.
    let lastBandIdx = -1;
    const sampler = setInterval(() => {
      if (!recorderReady) return;
      try {
        const elapsed = Date.now() - sweepStart;
        const s = recorder.getStatus();
        // Validate the metering value — must be a finite number, NOT -160
        // (Android's "silence floor" placeholder), and NOT 0 (a sign that
        // metering is disabled or not yet attached).
        const raw = typeof s.metering === 'number' ? s.metering : null;
        const m = raw !== null && Number.isFinite(raw) && raw > -120 ? raw : null;
        if (m !== null) {
          setIntensity(meterToIntensity(m));
          // Find the bucket whose window contains the current elapsed time.
          let placed = false;
          for (let i = 0; i < BAND_WINDOWS.length; i++) {
            const w = BAND_WINDOWS[i];
            if (elapsed >= w.from && elapsed < w.to) {
              buckets[i].push(m);
              if (lastBandIdx !== i) {
                lastBandIdx = i;
                setStepIndex(i + 1);
                setStepLabel(w.label);
              }
              placed = true;
              break;
            }
          }
          if (!placed && elapsed < BAND_WINDOWS[0].from) {
            baseline.push(m);
          }
        }
      } catch {
        /* noop */
      }
    }, 40);

    // Wait for the sweep to finish (with a small tail for the release).
    while (Date.now() - sweepStart < SWEEP_DURATION_MS + 150) {
      if (cancelledRef.current) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    clearInterval(sampler);

    try { player.pause(); } catch { /* noop */ }
    try { (player as unknown as { release?: () => void }).release?.(); } catch { /* noop */ }
    playerRef.current = null;
    try { await recorder.stop(); } catch { /* noop */ }

    // Use baseline = lowest 10% of all band readings if we didn't capture
    // any leading-silence baseline samples (which is the common case with
    // a song that starts immediately, like Dream Is Collapsing).
    let baselineAvg: number;
    if (baseline.length > 5) {
      baselineAvg = average(baseline);
    } else {
      const allReadings = buckets.flat();
      const sortedAll = [...allReadings].sort((a, b) => a - b);
      const tenPct = Math.max(1, Math.floor(sortedAll.length * 0.10));
      baselineAvg = sortedAll.length > 0
        ? average(sortedAll.slice(0, tenPct))
        : -60;
    }
    return buckets.map((b) => (b.length > 5 ? average(b) - baselineAvg : 0));
  };

  const runCalibration = async () => {
    cancelledRef.current = false;
    setErrorMsg(null);
    setCorrections(null);
    tapMedium();

    // Keep the screen awake for the entire run — the song is ~95s and
    // the default screen-off timeout (often 30s) would pause playback /
    // kill the recorder mid-measurement. Cleared in teardown().
    try { await setKeepScreenOn(true); } catch { /* noop */ }

    setPhase('requesting');
    setStepLabel('Asking for microphone access');
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setPhase('denied');
        return;
      }
    } catch {
      setPhase('error');
      setErrorMsg('Mic permission was denied.');
      return;
    }

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
        interruptionMode: 'mixWithOthers',
      });
    } catch {
      /* noop */
    }

    // Push system music volume to max for accurate readings.
    await pushVolumeMax();

    // 3-2-1 countdown so the user has time to settle the phone in
    // the right place before the song starts. Each tick haptics.
    setPhase('countdown');
    for (let n = 3; n >= 1; n--) {
      if (cancelledRef.current) break;
      setCountdownValue(n);
      tapMedium();
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (cancelledRef.current) {
      await teardown();
      await restoreVolume();
      return;
    }

    setPhase('baseline');
    setStepIndex(0);
    setStepLabel('Reading your room');
    try {
      // 600 ms of ambient mic for the room-tone phase. The measurement
      // baseline is recomputed from the leading silence of the sweep itself,
      // so we discard this reading — it's just to populate the blob with
      // some movement during the "reading" phase.
      await measureFor(600);
    } catch {
      setPhase('error');
      setErrorMsg('Couldn’t open the mic.');
      await teardown();
      await restoreVolume();
      return;
    }
    if (cancelledRef.current) {
      await teardown();
      await restoreVolume();
      return;
    }

    setPhase('measuring');
    setStepIndex(0);
    let measurements: number[] = [];
    try {
      measurements = await playSweepAndMeasure();
    } catch {
      setPhase('error');
      setErrorMsg('The read was cut short. Try again.');
      await teardown();
      await restoreVolume();
      return;
    }

    if (cancelledRef.current) {
      await teardown();
      await restoreVolume();
      return;
    }

    // ----------------------------------------------------------------
    // Correction formula
    //
    // The previous formula was `step = round(-delta / 2)` against the
    // band MEAN. The mean of 5 numbers sits in the middle by definition,
    // and band measurements typically cluster within ~1 dB of each other
    // (because the song has broadband content, not isolated per-band
    // tones), so most deltas were 0.3-0.8 dB → all bands rounded to 0.
    //
    // The new formula:
    //   1. Builds (idx, value) pairs of all valid measurements.
    //   2. Computes MEDIAN (more robust to outliers than mean) and the
    //      total spread (max - min).
    //   3. Auto-scales so that the most-extreme band relative to the
    //      median always maps to a meaningful correction. The maximum
    //      correction grows with the spread:
    //         spread < 0.4 dB → balanced room, no EQ change
    //         spread ≈ 1 dB   → ±3 max
    //         spread ≈ 3 dB   → ±5 max
    //         spread ≥ 5 dB   → ±6 max
    //   4. Rounds + clamps to [-6, +6].
    //
    // Loud bands (positive delta from median) get a NEGATIVE correction
    // (cut). Quiet bands (negative delta) get a POSITIVE correction
    // (boost). That counter-tilts the room's natural emphasis.
    // ----------------------------------------------------------------

    type IndexedReading = { idx: number; value: number };
    const valid: IndexedReading[] = [];
    BAND_WINDOWS.forEach((_, i) => {
      const m = measurements[i];
      if (Number.isFinite(m) && Math.abs(m) > 0.001) {
        valid.push({ idx: i, value: m });
      }
    });

    if (valid.length === 0) {
      // Nothing useful captured — surface a real error so the user knows
      // to retry rather than silently applying a no-op EQ.
      setPhase('error');
      setErrorMsg('We couldn\u2019t hear the speaker. Move closer and try again.');
      await teardown();
      await restoreVolume();
      return;
    }

    const sorted = [...valid].sort((a, b) => a.value - b.value);
    const minVal = sorted[0].value;
    const maxVal = sorted[sorted.length - 1].value;
    const median = sorted[Math.floor(sorted.length / 2)].value;
    const spread = maxVal - minVal;

    const result: EqShape = {
      subBass: 0,
      bass: 0,
      mid: 0,
      presence: 0,
      treble: 0,
    };

    // Auto-scale: targetMax grows with spread but caps at 6.
    const targetMax = spread < 0.4
      ? 0
      : clamp(Math.round(2 + spread * 0.9), 2, 6);

    // Scale so the band furthest from median gets close to ±targetMax.
    const halfSpread = Math.max(spread / 2, 0.5);
    const scale = targetMax > 0 ? targetMax / halfSpread : 0;

    valid.forEach(({ idx, value }) => {
      const delta = value - median;
      const step = Math.round(-delta * scale);
      result[BAND_WINDOWS[idx].key] = clamp(step, -6, 6);
    });

    // Safety net: even if the auto-scale produced all zeros (e.g. all
    // valid bands collapsed to the median), still apply a soft tilt so
    // the user sees the run produced *something*. Loudest band gets -1,
    // quietest gets +1.
    const allZero = Object.values(result).every((v) => v === 0);
    if (allZero && spread > 0.15 && valid.length >= 2) {
      const quietest = sorted[0];
      const loudest = sorted[sorted.length - 1];
      result[BAND_WINDOWS[quietest.idx].key] = 1;
      result[BAND_WINDOWS[loudest.idx].key] = -1;
    }

    // Restore user's original volume immediately on success and reset
    // the audio session out of recording mode so subsequent app sounds
    // (preset chime, pair sound) route correctly to the BT speaker.
    await teardown();
    await restoreVolume();

    // AI refinement: hand the measured per-band deltas + the heuristic
    // correction to Groq for a more musical, balanced tuning. Falls back to
    // the heuristic on any failure so Terraform always produces a result.
    let finalEq = result;
    if (!cancelledRef.current) {
      try {
        setStepLabel('Refining with AI');
        const readings = valid.map(({ idx, value }) => ({
          key: BAND_WINDOWS[idx].key,
          label: BAND_WINDOWS[idx].label,
          deltaDb: value,
        }));
        const refined = await refineTerraformEqWithAI(readings, result);
        if (refined && !cancelledRef.current) finalEq = refined;
      } catch {
        /* keep the heuristic correction */
      }
    }

    setIntensity(0);
    setCorrections(finalEq);
    setPhase('done');
    notifySuccess();
  };

  const handleApply = () => {
    if (!corrections) return;
    tapMedium();
    onApply(corrections);
    onClose();
  };

  const handleCancel = async () => {
    tapLight();
    cancelledRef.current = true;
    await teardown();
    await restoreVolume();
    onClose();
  };

  const handleRetry = () => {
    tapLight();
    runCalibration();
  };

  // ----- Card-mode body (intro/denied/error/done) -----

  const renderResultBars = () => {
    if (!corrections) return null;
    const order: (keyof EqShape)[] = ['subBass', 'bass', 'mid', 'presence', 'treble'];
    return (
      <View style={styles.resultRow}>
        {order.map((key, i) => {
          const v = corrections[key];
          const h = clamp(Math.abs(v) / 6, 0, 1) * 60;
          const isCut = v < 0;
          return (
            <View key={key} style={styles.resultCol}>
              <View style={styles.resultBarWrap}>
                <View
                  style={{
                    width: 6,
                    height: h,
                    borderRadius: 3,
                    backgroundColor: isCut ? '#c98e6b' : accent,
                  }}
                />
              </View>
              <Text style={[styles.resultValue, { color: ink }]}>
                {v > 0 ? `+${v}` : v}
              </Text>
              <Text style={[styles.resultLabel, { color: inkSoft }]}>
                {BAND_WINDOWS[i].label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const cardBody = useMemo(() => {
    switch (phase) {
      case 'intro':
        return (
          <>
            <View style={styles.explainerWrap}>
              <VideoView
                player={explainerPlayer}
                style={styles.explainerVideo}
                contentFit="cover"
                nativeControls={false}
                allowsPictureInPicture={false}
              />
            </View>
            <Text style={[styles.eyebrow, { color: inkSoft }]}>Terraform</Text>
            <Text style={[styles.title, { color: ink }]}>Shape your room.</Text>
            <Text style={[styles.body, { color: inkSoft }]}>
              Phone 30 cm from your Cicada. We’ll play a track and tune
              the EQ to match the room.
            </Text>
            <Text style={[styles.duration, { color: ink }]}>
              Takes about a minute and a half. Sit still and let it listen.
            </Text>
            <Text style={[styles.disclaimer, { color: inkSoft }]}>
              Track: “Dream Is Collapsing” © WaterTower Music / Warner
              Bros. Personal use only.
            </Text>
            <View style={styles.actions}>
              <Pressable
                onPress={handleCancel}
                style={[styles.btnGhost, { borderColor: line, backgroundColor: surface }]}
                hitSlop={6}
              >
                <Text style={[styles.btnGhostLabel, { color: ink }]}>Not now</Text>
              </Pressable>
              <Pressable
                onPress={runCalibration}
                style={[styles.btnPrimary, { backgroundColor: ink }]}
                hitSlop={6}
              >
                <Text style={styles.btnPrimaryLabel}>Start</Text>
              </Pressable>
            </View>
          </>
        );
      case 'denied':
        return (
          <>
            <Text style={[styles.eyebrow, { color: inkSoft }]}>Mic needed</Text>
            <Text style={[styles.title, { color: ink }]}>No mic access</Text>
            <Text style={[styles.body, { color: inkSoft }]}>
              Terraform reads the room through your phone’s mic. Turn it on
              in Settings to continue.
            </Text>
            <View style={styles.actions}>
              <Pressable
                onPress={handleCancel}
                style={[styles.btnPrimary, { backgroundColor: ink }]}
                hitSlop={6}
              >
                <Text style={styles.btnPrimaryLabel}>Close</Text>
              </Pressable>
            </View>
          </>
        );
      case 'error':
        return (
          <>
            <Text style={[styles.eyebrow, { color: inkSoft }]}>Stopped</Text>
            <Text style={[styles.title, { color: ink }]}>Couldn’t finish</Text>
            <Text style={[styles.body, { color: inkSoft }]}>
              {errorMsg ?? 'Something interrupted the read. Try again.'}
            </Text>
            <View style={styles.actions}>
              <Pressable
                onPress={handleCancel}
                style={[styles.btnGhost, { borderColor: line, backgroundColor: surface }]}
                hitSlop={6}
              >
                <Text style={[styles.btnGhostLabel, { color: ink }]}>Close</Text>
              </Pressable>
              <Pressable
                onPress={handleRetry}
                style={[styles.btnPrimary, { backgroundColor: ink }]}
                hitSlop={6}
              >
                <Text style={styles.btnPrimaryLabel}>Try again</Text>
              </Pressable>
            </View>
          </>
        );
      case 'done':
        return (
          <>
            <Text style={[styles.eyebrow, { color: inkSoft }]}>Done</Text>
            <Text style={[styles.title, { color: ink }]}>Tuned to your room</Text>
            <Text style={[styles.body, { color: inkSoft }]}>
              Here’s the EQ shape that suits your room. Apply it, or run
              again if you’ve moved.
            </Text>
            {renderResultBars()}
            <View style={styles.actions}>
              <Pressable
                onPress={handleRetry}
                style={[styles.btnGhost, { borderColor: line, backgroundColor: surface }]}
                hitSlop={6}
              >
                <Text style={[styles.btnGhostLabel, { color: ink }]}>Re-run</Text>
              </Pressable>
              <Pressable
                onPress={handleApply}
                style={[styles.btnPrimary, { backgroundColor: ink }]}
                hitSlop={6}
              >
                <Text style={styles.btnPrimaryLabel}>Apply</Text>
              </Pressable>
            </View>
          </>
        );
      case 'requesting':
        return (
          <>
            <Text style={[styles.eyebrow, { color: inkSoft }]}>Terraform</Text>
            <Text style={[styles.title, { color: ink }]}>{stepLabel || 'Getting ready…'}</Text>
          </>
        );
      case 'countdown':
        return (
          <>
            <Text style={[styles.eyebrow, { color: inkSoft }]}>Hold still</Text>
            <Text style={[styles.title, { color: ink }]}>Get ready</Text>
            <Text style={[styles.body, { color: inkSoft }]}>
              Keep the phone 30 cm from your Cicada. The reading starts in…
            </Text>
            <View style={styles.countdownWrap}>
              <Animated.Text
                style={[
                  styles.countdownNumber,
                  {
                    color: ink,
                    opacity: countdownAnim,
                    transform: [
                      {
                        scale: countdownAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.4, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {countdownValue}
              </Animated.Text>
            </View>
          </>
        );
      default:
        return null;
    }
  }, [
    phase,
    stepLabel,
    corrections,
    errorMsg,
    ink,
    inkSoft,
    line,
    surface,
    accent,
    countdownValue,
    countdownAnim,
  ]);

  const isFullScreen = phase === 'baseline' || phase === 'measuring';

  // Reserve space for header + footer; whatever's left becomes the blob
  // canvas so the burst isn't clipped on top or sides.
  const blobCanvasHeight = Math.max(280, windowH - 360);
  const blobSphereSize = Math.min(windowW, blobCanvasHeight) * 0.85;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      {isFullScreen ? (
        // ----- Full-screen tuning view -----
        <View style={[styles.fullScreen, { backgroundColor: bg }]}>
          <View style={styles.fullHeader}>
            <Text style={[styles.eyebrow, { color: inkSoft }]}>
              {phase === 'baseline' ? 'Reading' : 'Tuning'}
            </Text>
            <Text style={[styles.fullTitle, { color: ink }]}>
              {stepLabel || 'Listening…'}
            </Text>
          </View>

          <View style={styles.fullBody}>
            <BlobVisualizer
              width={windowW}
              height={blobCanvasHeight}
              size={blobSphereSize}
              intensity={intensity}
              accent={accent}
              accentSoft={accentSoft ?? accent}
              ink={ink}
            />
          </View>

          <View style={styles.fullFooter}>
            <View style={[styles.progressTrack, { backgroundColor: 'rgba(31,28,23,0.10)' }]}>
              <View
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: accent,
                  width: `${(stepIndex / BAND_WINDOWS.length) * 100}%`,
                }}
              />
            </View>
            <Text style={[styles.fullMeta, { color: inkSoft }]}>
              {phase === 'measuring'
                ? `${Math.max(stepIndex, 0)} of ${BAND_WINDOWS.length}`
                : 'Sampling the room…'}
            </Text>
            <Text style={[styles.fullHint, { color: inkSoft }]}>
              Volume is at max for the read. We’ll put it back when we’re done.
            </Text>
            <Pressable
              onPress={handleCancel}
              style={[styles.btnGhost, { borderColor: line, backgroundColor: surface, marginTop: 18 }]}
              hitSlop={6}
            >
              <Text style={[styles.btnGhostLabel, { color: ink }]}>Stop</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        // ----- Card view (intro/denied/error/done/requesting) -----
        <View style={[styles.scrim, { backgroundColor: 'rgba(31,28,23,0.45)' }]}>
          <View style={[styles.card, { backgroundColor: '#ffffff', borderColor: line }]}>
            {cardBody}
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  // --- Card mode ---
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 22,
    gap: 12,
  },

  // --- Full-screen tuning ---
  fullScreen: {
    flex: 1,
    paddingTop: 64,
    paddingBottom: 36,
    justifyContent: 'space-between',
  },
  fullHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  fullTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 8,
    textAlign: 'center',
  },
  fullBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullFooter: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  fullMeta: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  fullHint: {
    fontSize: 11,
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 4,
  },

  // --- Shared text styles ---
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
  duration: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: -2,
  },
  disclaimer: {
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
    opacity: 0.85,
    marginTop: -4,
  },
  // --- Intro explainer video ---
  explainerWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    marginBottom: 4,
  },
  explainerVideo: {
    width: '100%',
    height: '100%',
  },

  // --- Buttons ---
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  btnGhost: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  btnGhostLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  btnPrimary: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  btnPrimaryLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // --- Progress + result bars ---
  progressTrack: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  resultCol: {
    alignItems: 'center',
    gap: 4,
    minWidth: 44,
  },
  resultBarWrap: {
    width: 6,
    height: 60,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  resultValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  resultLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },

  // --- 3-2-1 countdown card ---
  countdownWrap: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  countdownNumber: {
    fontSize: 120,
    fontWeight: '900',
    letterSpacing: -4,
    lineHeight: 132,
  },
});
