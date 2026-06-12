import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, Platform, StatusBar, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { recordMicSnippet } from 'zenova-audio-fx';

import { decodePcmBase64, recognizePcmBase64, type ShazamMatch } from './shazam';
import { fetchLyrics, findActiveLineIndex, type LyricsResult } from './lyrics';
import { generateLyricsWithAI } from './ai';
import { NOW_PLAYING_HTML } from './nowPlayingHtml';

type Theme = {
  bg: string;
  surface: string;
  surfaceMuted?: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  line: string;
  accent: string;
  accentSoft: string;
  accentDeep?: string;
  selected: string;
};

type NowPlayingScreenProps = {
  visible: boolean;
  theme: Theme;
  onClose: () => void;
};

type Phase = 'idle' | 'listening' | 'identifying' | 'result' | 'nomatch' | 'denied' | 'error';

const RECORD_MS = 6000;
const REDETECT_BUFFER_MS = 3000;
const OUTRO_PAD_MS = 8000;
const SAFETY_REDETECT_MS = 20000;
const SYNC_LOOKAHEAD_MS = 180;
// Negative bias (ms) pulling the reported lyric position slightly behind the
// computed clock to compensate for Bluetooth audio output latency + render
// lead, so highlighted lyrics line up with what the listener actually hears
// instead of running ahead of the music.
const SYNC_BIAS_MS = -650;

const MAX_CALIBRATION_MS = 2800;
// Fast watchdog: a short, cheap mic snippet on a tight cadence purely to notice
// a pause/stop (silence) or that audio resumed — so the UI reacts within ~2s.
const WATCHDOG_MS = 1200;
const WATCHDOG_SNIPPET_MS = 700;
// Full recognition cadence (drift correction + song-change detection).
const RESYNC_NORMAL_MS = 5000;
const RESYNC_SLOW_MS = 9000;
const RESYNC_SNIPPET_MS = 3200;
const RESYNC_APPLY_THRESHOLD_MS = 120;
const HARD_RESYNC_THRESHOLD_MS = 2400;
const SILENCE_RMS_THRESHOLD = 0.006;
// Two consecutive silent watchdog reads (~3-4s) means the music was paused or
// stopped -> bounce the user back to the scanner to detect the next track.
const SILENCE_STREAK_TO_REDETECT = 2;

const LYRICS_KEEP_AWAKE_TAG = 'zenova-now-playing-lyrics';

const SCREEN_WIDTH = Dimensions.get('window').width;

function rmsLevel(pcmBase64: string): number {
  const samples = decodePcmBase64(pcmBase64);
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

function sameSong(a: ShazamMatch | null, b: ShazamMatch | null): boolean {
  if (!a || !b) return false;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return norm(a.title) === norm(b.title) && norm(a.artist) === norm(b.artist);
}

function songKeyOf(match: ShazamMatch | null): string | null {
  if (!match) return null;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return `${norm(match.artist)}::${norm(match.title)}`;
}

export default function NowPlayingScreen({ visible, theme, onClose }: NowPlayingScreenProps) {
  const insets = useSafeAreaInsets();
  const topPad =
    Platform.OS === 'android'
      ? Math.max(insets.top, StatusBar.currentHeight ?? 0, 24)
      : Math.max(insets.top, 44);
  const bottomPad = Math.max(insets.bottom, 18);

  const [phase, setPhase] = useState<Phase>('idle');
  const [match, setMatch] = useState<ShazamMatch | null>(null);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [activeLine, setActiveLine] = useState(-1);
  const [rendered, setRendered] = useState(visible);

  const slide = useRef(new Animated.Value(0)).current;

  const webRef = useRef<WebView>(null);
  const webReadyRef = useRef(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncRafRef = useRef<number | null>(null);
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resyncRunningRef = useRef(false);
  const syncStartAtRef = useRef(0);
  const syncBaseMsRef = useRef(0);
  const syncCalibrationMsRef = useRef(0);
  const syncFrozenRef = useRef(false);
  const syncFrozenPosMsRef = useRef(0);
  const hasReliableOffsetRef = useRef(false);
  const silenceStreakRef = useRef(0);
  const stableResyncStreakRef = useRef(0);
  const lastFullResyncAtRef = useRef(0);

  const songCalibrationsRef = useRef<Map<string, number>>(new Map());
  const syncResultRef = useRef<LyricsResult | null>(null);
  const matchRef = useRef<ShazamMatch | null>(null);

  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordStartRef = useRef(0);

  const mountedRef = useRef(true);
  const runningRef = useRef(false);
  const runIdentifyRef = useRef<() => void>(() => {});
  const applyNewSongRef = useRef<(heard: ShazamMatch, sampleStartAt: number) => void>(() => {});
  const startResyncRef = useRef<() => void>(() => {});

  const clearSyncClock = useCallback(() => {
    if (syncRafRef.current != null) {
      cancelAnimationFrame(syncRafRef.current);
      syncRafRef.current = null;
    }
  }, []);

  const clearResyncLoop = useCallback(() => {
    if (resyncTimerRef.current) {
      clearTimeout(resyncTimerRef.current);
      resyncTimerRef.current = null;
    }
    resyncRunningRef.current = false;
  }, []);

  const injectJs = useCallback((js: string) => {
    if (!webReadyRef.current) return;
    webRef.current?.injectJavaScript(js + ';true;');
  }, []);

  const currentSyncedPosMs = useCallback((now = Date.now()): number => {
    if (syncFrozenRef.current) return syncFrozenPosMsRef.current;
    const elapsed = now - syncStartAtRef.current;
    return Math.max(0, syncBaseMsRef.current + elapsed + syncCalibrationMsRef.current);
  }, []);

  // Position actually shown to the listener: the canonical clock pulled back by
  // SYNC_BIAS_MS to compensate for output latency. Drift correction keeps using
  // currentSyncedPosMs (the canonical clock) so this bias is never "corrected away".
  const presentationPosMs = useCallback(
    (now = Date.now()): number => Math.max(0, currentSyncedPosMs(now) + SYNC_BIAS_MS),
    [currentSyncedPosMs],
  );

  const applyCalibrationDelta = useCallback((deltaMs: number) => {
    if (!Number.isFinite(deltaMs)) return;
    const abs = Math.abs(deltaMs);
    if (abs < RESYNC_APPLY_THRESHOLD_MS) return;
    const gain = abs >= HARD_RESYNC_THRESHOLD_MS ? 1 : 0.38;
    const next = Math.max(
      -MAX_CALIBRATION_MS,
      Math.min(MAX_CALIBRATION_MS, syncCalibrationMsRef.current + deltaMs * gain),
    );
    syncCalibrationMsRef.current = next;
    const key = songKeyOf(matchRef.current);
    if (key) songCalibrationsRef.current.set(key, next);
  }, []);

  const rebaseSyncClock = useCallback((absolutePosMs: number) => {
    syncStartAtRef.current = Date.now();
    syncBaseMsRef.current = Math.max(0, absolutePosMs);
    syncCalibrationMsRef.current = 0;
    syncFrozenRef.current = false;
    syncFrozenPosMsRef.current = 0;
    hasReliableOffsetRef.current = true;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSyncClock();
      clearResyncLoop();
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
    };
  }, [clearResyncLoop, clearSyncClock]);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  useEffect(() => {
    syncResultRef.current = lyrics;
  }, [lyrics]);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.timing(slide, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return undefined;
    }

    Animated.timing(slide, {
      toValue: 0,
      duration: 300,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && mountedRef.current) setRendered(false);
    });

    const id = setTimeout(() => {
      if (!mountedRef.current) return;
      setPhase('idle');
      setMatch(null);
      setLyrics(null);
      setActiveLine(-1);
      clearResyncLoop();
      clearSyncClock();
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
    }, 320);
    return () => clearTimeout(id);
  }, [clearResyncLoop, clearSyncClock, slide, visible]);

  const startSyncClock = useCallback(
    (result: LyricsResult, startingPositionMs: number, hasReliableOffset: boolean) => {
      clearSyncClock();
      if (!result.synced) {
        setActiveLine(-1);
        return;
      }

      syncResultRef.current = result;
      const key = songKeyOf(matchRef.current);
      syncCalibrationMsRef.current = key
        ? songCalibrationsRef.current.get(key) ?? 0
        : 0;
      hasReliableOffsetRef.current = hasReliableOffset;
      syncFrozenRef.current = false;
      syncFrozenPosMsRef.current = 0;

      syncStartAtRef.current = Date.now();
      syncBaseMsRef.current = Math.max(0, startingPositionMs);

      injectJs(
        'window.ZV&&ZV.sync({posMs:' +
          Math.round(presentationPosMs(Date.now())) +
          ',playing:true});',
      );
    },
    [clearSyncClock, presentationPosMs, injectJs],
  );

  const startAudibleResyncLoop = useCallback(() => {
    clearResyncLoop();
    stableResyncStreakRef.current = 0;
    lastFullResyncAtRef.current = 0;

    const schedule = (delayMs: number) => {
      resyncTimerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        let shouldReschedule = true;
        let nextDelayMs = WATCHDOG_MS;

        if (runningRef.current || resyncRunningRef.current) {
          schedule(WATCHDOG_MS);
          return;
        }
        if (!matchRef.current) {
          schedule(WATCHDOG_MS);
          return;
        }

        // Run a full recognition (drift + song-change) only every few ticks; the
        // rest of the time this is a lightweight pause/resume watchdog.
        const fullResyncGapMs =
          stableResyncStreakRef.current >= 3 ? RESYNC_SLOW_MS : RESYNC_NORMAL_MS;
        const needFullResync =
          Date.now() - lastFullResyncAtRef.current >= fullResyncGapMs;

        resyncRunningRef.current = true;
        try {
          // --- Fast watchdog: a short snippet just to read the audio level. ---
          const watchPcm = await recordMicSnippet(WATCHDOG_SNIPPET_MS);
          if (!mountedRef.current) return;
          if (watchPcm && rmsLevel(watchPcm) < SILENCE_RMS_THRESHOLD) {
            // Audio dropped out -> the track was paused/stopped.
            silenceStreakRef.current += 1;
            stableResyncStreakRef.current = 0;
            if (silenceStreakRef.current >= SILENCE_STREAK_TO_REDETECT) {
              // Confirmed silence: bounce back to the scanner for the next track.
              shouldReschedule = false;
              silenceStreakRef.current = 0;
              runIdentifyRef.current();
              return;
            }
            nextDelayMs = WATCHDOG_MS;
            return;
          }
          // Audio present.
          silenceStreakRef.current = 0;

          if (!needFullResync) {
            nextDelayMs = WATCHDOG_MS;
            return;
          }

          // --- Full recognition pass: detect song change + correct drift. ---
          lastFullResyncAtRef.current = Date.now();
          const sampleStartAt = Date.now();
          const pcm = await recordMicSnippet(RESYNC_SNIPPET_MS);
          if (!mountedRef.current || !pcm) {
            stableResyncStreakRef.current = 0;
            nextDelayMs = WATCHDOG_MS;
            return;
          }

          if (rmsLevel(pcm) < SILENCE_RMS_THRESHOLD) {
            silenceStreakRef.current += 1;
            stableResyncStreakRef.current = 0;
            if (silenceStreakRef.current >= SILENCE_STREAK_TO_REDETECT) {
              shouldReschedule = false;
              silenceStreakRef.current = 0;
              runIdentifyRef.current();
              return;
            }
            nextDelayMs = WATCHDOG_MS;
            return;
          }
          silenceStreakRef.current = 0;

          let heard: ShazamMatch | null = null;
          try {
            heard = await recognizePcmBase64(pcm);
          } catch {
            heard = null;
          }

          if (!mountedRef.current || !heard) {
            stableResyncStreakRef.current = 0;
            nextDelayMs = WATCHDOG_MS;
            return;
          }

          const current = matchRef.current;
          if (current && !sameSong(current, heard)) {
            // Song changed -> swap song + lyrics in place via Shazam, no scanner flash.
            shouldReschedule = false;
            applyNewSongRef.current(heard, sampleStartAt);
            return;
          }

          if (typeof heard.offsetSeconds === 'number') {
            const heardNowMs = heard.offsetSeconds * 1000 + (Date.now() - sampleStartAt);
            const localNowMs = currentSyncedPosMs(Date.now());
            const driftMs = heardNowMs - localNowMs;
            const absDrift = Math.abs(driftMs);

            if (!hasReliableOffsetRef.current || absDrift >= HARD_RESYNC_THRESHOLD_MS) {
              rebaseSyncClock(heardNowMs);
              stableResyncStreakRef.current = 0;
            } else {
              applyCalibrationDelta(driftMs);
              if (absDrift >= RESYNC_APPLY_THRESHOLD_MS) {
                stableResyncStreakRef.current = 0;
              } else {
                stableResyncStreakRef.current += 1;
              }
            }

            const synced = syncResultRef.current;
            if (synced?.synced) {
              const idx = findActiveLineIndex(
                synced.lines,
                presentationPosMs(Date.now()) + SYNC_LOOKAHEAD_MS,
              );
              setActiveLine((prev) => (prev === idx ? prev : idx));
            }
          } else {
            stableResyncStreakRef.current = 0;
          }
          nextDelayMs = WATCHDOG_MS;
        } finally {
          resyncRunningRef.current = false;
          if (mountedRef.current && shouldReschedule) schedule(nextDelayMs);
        }
      }, delayMs);
    };

    schedule(WATCHDOG_MS);
  }, [
    applyCalibrationDelta,
    clearResyncLoop,
    currentSyncedPosMs,
    presentationPosMs,
    rebaseSyncClock,
  ]);

  const scheduleAutoRedetect = useCallback((result: LyricsResult | null, currentPosMs: number) => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    if (!result) return;

    let endMs = result.durationMs ?? null;
    if (!endMs && result.synced && result.lines.length > 0) {
      const lastMs = result.lines[result.lines.length - 1].ms;
      if (lastMs > 0) endMs = lastMs + OUTRO_PAD_MS;
    }
    if (!endMs) return;

    const remaining = endMs - currentPosMs;
    const delay = remaining > 0 ? remaining + REDETECT_BUFFER_MS : SAFETY_REDETECT_MS;

    endTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      runIdentifyRef.current();
    }, delay);
  }, []);

  const runIdentify = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    setMatch(null);
    setLyrics(null);
    setActiveLine(-1);
    clearResyncLoop();
    clearSyncClock();
    if (endTimerRef.current) clearTimeout(endTimerRef.current);

    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        if (mountedRef.current) setPhase('denied');
        return;
      }

      setPhase('listening');
      recordStartRef.current = Date.now();
      const pcm = await recordMicSnippet(RECORD_MS);
      if (!mountedRef.current) return;
      if (!pcm) {
        setPhase('error');
        return;
      }

      setPhase('identifying');
      let found: ShazamMatch | null = null;
      try {
        found = await recognizePcmBase64(pcm);
      } catch {
        found = null;
      }

      if (!mountedRef.current) return;
      if (!found) {
        setPhase('nomatch');
        return;
      }

      setMatch(found);
      setPhase('result');

      const instant: LyricsResult | null =
        found.shazamLyrics && found.shazamLyrics.length > 0
          ? {
              synced: false,
              lines: found.shazamLyrics.map((text) => ({ ms: -1, text })),
              plain: found.shazamLyrics.join('\n'),
              durationMs: null,
            }
          : null;

      if (instant) {
        setLyrics(instant);
        setActiveLine(-1);
      }
      setLyricsLoading(!instant);

      const offset = found.offsetSeconds ?? null;
      const hasOffset = typeof offset === 'number' && offset >= 0;

      void (async () => {
        let res: LyricsResult | null = null;
        try {
          res = await fetchLyrics(found.artist, found.title, found.album);
        } catch {
          res = null;
        }
        if (!mountedRef.current) return;

        const currentPosMs = hasOffset
          ? Math.max(0, (offset as number) * 1000 + (Date.now() - recordStartRef.current))
          : 0;

        let result = res && (res.synced || !instant) ? res : instant;

        // Nothing usable from LRCLIB or Shazam -> generate lyrics with AI.
        if (!result || result.lines.length === 0) {
          const ai = await generateLyricsWithAI(found.artist, found.title);
          if (!mountedRef.current) return;
          if (ai) result = ai;
        }

        setLyrics(result);
        if (result && result.synced) {
          startSyncClock(result, currentPosMs, hasOffset);
        } else {
          setActiveLine(-1);
        }
        scheduleAutoRedetect(result, currentPosMs);
        if (mountedRef.current) setLyricsLoading(false);
      })();
    } finally {
      runningRef.current = false;
    }
  }, [clearResyncLoop, clearSyncClock, scheduleAutoRedetect, startSyncClock]);

  useEffect(() => {
    runIdentifyRef.current = runIdentify;
  }, [runIdentify]);

  // Seamlessly swap to a newly-detected song without flashing the scanner: update
  // the header + album art, fetch the new lyrics (showing the loader), restart the
  // sync clock from the heard offset, then resume the watchdog for the new track.
  const applyNewSong = useCallback(
    async (heard: ShazamMatch, sampleStartAt: number) => {
      if (!mountedRef.current) return;
      clearResyncLoop();
      clearSyncClock();
      if (endTimerRef.current) clearTimeout(endTimerRef.current);

      setMatch(heard);
      matchRef.current = heard;
      setActiveLine(-1);

      const instant: LyricsResult | null =
        heard.shazamLyrics && heard.shazamLyrics.length > 0
          ? {
              synced: false,
              lines: heard.shazamLyrics.map((text) => ({ ms: -1, text })),
              plain: heard.shazamLyrics.join('\n'),
              durationMs: null,
            }
          : null;
      setLyrics(instant);
      setLyricsLoading(!instant);

      const offset = heard.offsetSeconds ?? null;
      const hasOffset = typeof offset === 'number' && offset >= 0;

      try {
        const res = await fetchLyrics(heard.artist, heard.title, heard.album);
        if (!mountedRef.current) return;
        const currentPosMs = hasOffset
          ? Math.max(0, (offset as number) * 1000 + (Date.now() - sampleStartAt))
          : 0;
        let result = res && (res.synced || !instant) ? res : instant;
        if (!result || result.lines.length === 0) {
          const ai = await generateLyricsWithAI(heard.artist, heard.title);
          if (!mountedRef.current) return;
          if (ai) result = ai;
        }
        setLyrics(result);
        if (result && result.synced) {
          startSyncClock(result, currentPosMs, hasOffset);
        } else {
          setActiveLine(-1);
        }
        scheduleAutoRedetect(result, currentPosMs);
      } catch {
        /* keep whatever lyrics we already have */
      } finally {
        if (mountedRef.current) {
          setLyricsLoading(false);
          startResyncRef.current();
        }
      }
    },
    [clearResyncLoop, clearSyncClock, scheduleAutoRedetect, startSyncClock],
  );

  useEffect(() => {
    applyNewSongRef.current = applyNewSong;
  }, [applyNewSong]);

  useEffect(() => {
    startResyncRef.current = startAudibleResyncLoop;
  }, [startAudibleResyncLoop]);

  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (visible) {
      if (!autoStartedRef.current) {
        autoStartedRef.current = true;
        runIdentify();
      }
    } else {
      autoStartedRef.current = false;
      webReadyRef.current = false;
      clearResyncLoop();
    }
  }, [clearResyncLoop, runIdentify, visible]);

  useEffect(() => {
    if (visible && phase === 'result') {
      startAudibleResyncLoop();
      return () => clearResyncLoop();
    }
    clearResyncLoop();
    return undefined;
  }, [clearResyncLoop, phase, startAudibleResyncLoop, visible]);

  useEffect(() => {
    const shouldKeepAwake = visible && phase === 'result';
    if (shouldKeepAwake) {
      activateKeepAwakeAsync(LYRICS_KEEP_AWAKE_TAG).catch(() => {});
    }
    return () => {
      deactivateKeepAwake(LYRICS_KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [phase, visible]);

  const phaseStatus = useCallback((p: Phase): string => {
    switch (p) {
      case 'listening':
        return 'Listening to your room';
      case 'identifying':
        return 'Finding this song';
      case 'nomatch':
        return 'No match yet';
      case 'denied':
        return 'Microphone access needed';
      case 'error':
        return 'Try again';
      default:
        return 'Tap to detect music';
    }
  }, []);

  const pushPhase = useCallback(
    (p: Phase) => {
      if (p === 'result') {
        injectJs('window.ZV&&(ZV.setRetry(false),ZV.setMode("lyrics"));');
        return;
      }
      const energetic = p === 'identifying';
      const listening = p === 'listening';
      const energy = energetic ? 1 : listening ? 0.85 : 0.5;
      const speed = energetic ? 1.4 : listening ? 1.1 : 0.85;
      const showRetry = p === 'nomatch' || p === 'error' || p === 'denied';
      injectJs(
        'window.ZV&&(ZV.setMode("detect"),ZV.setStatus(' +
          JSON.stringify(phaseStatus(p)) +
          '),ZV.setEnergy(' +
          energy +
          ',' +
          speed +
          '),ZV.setRetry(' +
          showRetry.toString() +
          '));',
      );
    },
    [injectJs, phaseStatus],
  );

  const pushSong = useCallback(
    (m: ShazamMatch | null) => {
      const payload = JSON.stringify({
        title: m?.title ?? 'Zenova',
        artist: m?.artist ?? 'Song Detection',
        art: m?.coverArt ?? '',
      });
      injectJs('window.ZV&&ZV.setSong(' + payload + ');');
    },
    [injectJs],
  );

  const pushLyrics = useCallback(
    (lx: LyricsResult | null) => {
      if (!lx || lx.lines.length === 0) {
        injectJs('window.ZV&&ZV.setLyrics({synced:false,lines:[]});');
        return;
      }
      const synced = !!lx.synced;
      const lines = synced
        ? lx.lines.map((ln) => ({ ms: ln.ms, text: ln.text }))
        : lx.lines.map((ln) => ({ text: ln.text }));
      injectJs('window.ZV&&ZV.setLyrics(' + JSON.stringify({ synced, lines }) + ');');
    },
    [injectJs],
  );

  const pushSync = useCallback(() => {
    injectJs(
      'window.ZV&&ZV.sync({posMs:' +
        Math.round(presentationPosMs(Date.now())) +
        ',playing:' +
        (!syncFrozenRef.current).toString() +
        '});',
    );
  }, [presentationPosMs, injectJs]);

  const pushInsets = useCallback(() => {
    injectJs(
      'window.ZV&&ZV.setInsets({top:' +
        Math.round(topPad) +
        ',bottom:' +
        Math.round(bottomPad) +
        '});',
    );
  }, [bottomPad, injectJs, topPad]);

  useEffect(() => {
    pushPhase(phase);
  }, [phase, pushPhase]);

  useEffect(() => {
    pushSong(match);
  }, [match, pushSong]);

  useEffect(() => {
    pushLyrics(lyrics);
  }, [lyrics, pushLyrics]);

  useEffect(() => {
    injectJs('window.ZV&&ZV.setLoading(' + (lyricsLoading ? 'true' : 'false') + ');');
  }, [injectJs, lyricsLoading]);

  useEffect(() => {
    if (phase !== 'result') {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return undefined;
    }
    pushSync();
    syncIntervalRef.current = setInterval(pushSync, 150);
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [phase, pushSync]);

  useEffect(() => {
    pushInsets();
  }, [pushInsets]);

  const onWebMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let msg: { type?: string } = {};
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (msg.type === 'ready') {
        webReadyRef.current = true;
        pushInsets();
        pushPhase(phase);
        pushSong(match);
        pushLyrics(lyrics);
        injectJs('window.ZV&&ZV.setLoading(' + (lyricsLoading ? 'true' : 'false') + ');');
        if (phase === 'result') pushSync();
      } else if (msg.type === 'detect') {
        if (phase !== 'listening' && phase !== 'identifying' && phase !== 'result') {
          runIdentifyRef.current();
        }
      } else if (msg.type === 'close') {
        onClose();
      }
    },
    [lyrics, match, onClose, phase, pushInsets, pushLyrics, pushPhase, pushSong, pushSync, injectJs, lyricsLoading],
  );

  const enterTranslateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_WIDTH * 0.16, 0],
  });
  const enterScale = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f4eee2" translucent />
      <Animated.View
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={[
          styles.backdrop,
          {
            opacity: slide,
            transform: [{ translateX: enterTranslateX }, { scale: enterScale }],
          },
        ]}
      >
        <WebView
          ref={webRef}
          source={{ html: NOW_PLAYING_HTML }}
          originWhitelist={['*']}
          style={styles.web}
          onMessage={onWebMessage}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          overScrollMode="never"
          bounces={false}
          androidLayerType="hardware"
          setSupportMultipleWindows={false}
          textZoom={100}
          cacheEnabled
          renderToHardwareTextureAndroid
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#f4eee2',
  },
  web: {
    flex: 1,
    backgroundColor: '#f4eee2',
  },
});
