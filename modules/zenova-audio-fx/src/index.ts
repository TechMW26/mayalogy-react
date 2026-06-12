import { requireOptionalNativeModule } from 'expo-modules-core';

type Native = {
  isAvailable: () => boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
  setMakeupGain: (gainMb: number) => Promise<void>;
  getBandCount: () => Promise<number>;
  getBandLevels: () => Promise<number[]>;
  getBandRange: () => Promise<[number, number]>;
  setBandLevels: (levels: number[]) => Promise<void>;
  setTone: (bass: number, mid: number, treble: number) => Promise<void>;
  setBassBoost: (strength: number) => Promise<void>;
  setVirtualizer: (strength: number) => Promise<void>;
  setReverbPreset: (preset: number) => Promise<void>;
  getPresets: () => Promise<string[]>;
  usePreset: (index: number) => Promise<void>;
  startBackground: () => Promise<void>;
  stopBackground: () => Promise<void>;
  getConnectedAudioAddresses: () => Promise<string[]>;
  isAudioRouteReady: (address: string) => Promise<boolean>;
  getMusicVolume: () => Promise<[number, number]>;
  setMusicVolume: (level: number) => Promise<number>;
  startKaraoke: () => Promise<void>;
  stopKaraoke: () => Promise<void>;
  isKaraokeRunning: () => Promise<boolean>;
  setKaraokeGain: (value: number) => Promise<void>;
  setKaraokeReverb: (mix: number) => Promise<void>;
  setKaraokeEcho: (mix: number, delayMs: number, feedback: number) => Promise<void>;
  setKaraokeLowpass: (hz: number) => Promise<void>;
  setKaraokeHighpass: (hz: number) => Promise<void>;
  setKaraokeRing: (hz: number) => Promise<void>;
  setKaraokeDistortion: (value: number) => Promise<void>;
  getKaraokeLevel: () => Promise<number>;
  setKeepScreenOn: (enabled: boolean) => Promise<void>;
  recordMicSnippet: (durationMs: number) => Promise<string | null>;
  release: () => void;
};

const native = requireOptionalNativeModule<Native>('ZenovaAudioFx');

export const isAudioFxAvailable = (): boolean => {
  if (!native) return false;
  try {
    return native.isAvailable();
  } catch {
    return false;
  }
};

export const setAudioFxEnabled = async (enabled: boolean) => {
  if (!native) return;
  try {
    await native.setEnabled(enabled);
  } catch {
    /* noop */
  }
};

export const setAudioFxMakeupGain = async (gainMb: number) => {
  if (!native) return;
  try {
    await native.setMakeupGain(gainMb);
  } catch {
    /* noop */
  }
};

export const setSystemTone = async (
  bass: number,
  mid: number,
  treble: number,
) => {
  if (!native) return;
  try {
    await native.setTone(bass, mid, treble);
  } catch {
    /* noop */
  }
};

export const setSystemBandLevels = async (levels: number[]) => {
  if (!native) return;
  try {
    await native.setBandLevels(levels);
  } catch {
    /* noop */
  }
};

export const getSystemBandRange = async (): Promise<[number, number]> => {
  if (!native) return [-1500, 1500];
  try {
    return await native.getBandRange();
  } catch {
    return [-1500, 1500];
  }
};

export const useSystemPreset = async (index: number) => {
  if (!native) return;
  try {
    await native.usePreset(index);
  } catch {
    /* noop */
  }
};

export const startAudioFxBackground = async () => {
  if (!native) return;
  try {
    await native.startBackground();
  } catch {
    /* noop */
  }
};

export const stopAudioFxBackground = async () => {
  if (!native) return;
  try {
    await native.stopBackground();
  } catch {
    /* noop */
  }
};

export const setSystemBassBoost = async (strength: number) => {
  if (!native) return;
  try {
    await native.setBassBoost(strength);
  } catch {
    /* noop */
  }
};

export const setSystemVirtualizer = async (strength: number) => {
  if (!native) return;
  try {
    await native.setVirtualizer(strength);
  } catch {
    /* noop */
  }
};

// Reverb presets: 0=NONE, 1=SMALLROOM, 2=MEDIUMROOM, 3=LARGEROOM,
// 4=MEDIUMHALL, 5=LARGEHALL, 6=PLATE.
export const setSystemReverbPreset = async (preset: number) => {
  if (!native) return;
  try {
    await native.setReverbPreset(preset);
  } catch {
    /* noop */
  }
};

// Returns uppercase MAC addresses of devices currently connected as A2DP audio
// sinks. This catches speakers / headphones that don't open an SPP socket so
// `BluetoothDevice.isConnected()` would otherwise report false for them.
export const getConnectedAudioAddresses = async (): Promise<string[]> => {
  if (!native) return [];
  try {
    return await native.getConnectedAudioAddresses();
  } catch {
    return [];
  }
};

// Returns true when Android's audio routing is fully READY to send a stream
// to the given Bluetooth device. Use this to wait for the speaker to actually
// accept audio before playing a sound — just checking "connected" is not
// enough since codec negotiation and audio route binding finish 1–3+ seconds
// AFTER the connection event.
export const isAudioRouteReady = async (address: string): Promise<boolean> => {
  if (!native) return false;
  try {
    return await native.isAudioRouteReady(address);
  } catch {
    return false;
  }
};

// Returns [current, max] for STREAM_MUSIC. [0, 0] if unavailable.
export const getMusicVolume = async (): Promise<[number, number]> => {
  if (!native) return [0, 0];
  try {
    return await native.getMusicVolume();
  } catch {
    return [0, 0];
  }
};

// Pushes STREAM_MUSIC to the given absolute level. Returns the new level.
export const setMusicVolume = async (level: number): Promise<number> => {
  if (!native) return 0;
  try {
    return await native.setMusicVolume(level);
  } catch {
    return 0;
  }
};

// ---------------------------------------------------------------------------
// Karaoke: real-time mic \u2192 speaker loopback with a small DSP chain.
// ---------------------------------------------------------------------------

export type KaraokeParams = {
  /** Pre-gain on the mic input. 1.0 = unity. Range 0..4. */
  gain?: number;
  /** Schroeder reverb wet mix. 0 = off. Range 0..1. */
  reverb?: number;
  /** Single-tap echo mix. 0 = off. Range 0..1. */
  echo?: number;
  /** Echo delay in milliseconds. Range 20..1000. Defaults to 350. */
  echoDelayMs?: number;
  /** Echo feedback. Range 0..0.95. Defaults to 0.35. */
  echoFeedback?: number;
  /** Low-pass cutoff in Hz. 0 = bypass. Use ~2800 for telephone, ~3500 for megaphone. */
  lowpassHz?: number;
  /** High-pass cutoff in Hz. 0 = bypass. Use ~300 for telephone, ~500 for megaphone. */
  highpassHz?: number;
  /** Ring-modulator carrier in Hz. 0 = bypass. ~60 Hz gives a classic robot. */
  ringHz?: number;
  /** Soft-clip distortion. 0 = bypass. Range 0..1. */
  distortion?: number;
};

export const startKaraoke = async (): Promise<void> => {
  if (!native) return;
  try { await native.startKaraoke(); } catch { /* noop */ }
};

export const stopKaraoke = async (): Promise<void> => {
  if (!native) return;
  try { await native.stopKaraoke(); } catch { /* noop */ }
};

export const isKaraokeRunning = async (): Promise<boolean> => {
  if (!native) return false;
  try { return await native.isKaraokeRunning(); } catch { return false; }
};

export const setKaraokeParams = async (params: KaraokeParams): Promise<void> => {
  if (!native) return;
  try {
    if (params.gain !== undefined) await native.setKaraokeGain(params.gain);
    if (params.reverb !== undefined) await native.setKaraokeReverb(params.reverb);
    if (
      params.echo !== undefined ||
      params.echoDelayMs !== undefined ||
      params.echoFeedback !== undefined
    ) {
      await native.setKaraokeEcho(
        params.echo ?? 0,
        params.echoDelayMs ?? 350,
        params.echoFeedback ?? 0.35,
      );
    }
    if (params.lowpassHz !== undefined) await native.setKaraokeLowpass(params.lowpassHz);
    if (params.highpassHz !== undefined) await native.setKaraokeHighpass(params.highpassHz);
    if (params.ringHz !== undefined) await native.setKaraokeRing(params.ringHz);
    if (params.distortion !== undefined) await native.setKaraokeDistortion(params.distortion);
  } catch {
    /* noop */
  }
};

// Returns the current smoothed peak level (0..1) for VU meters.
export const getKaraokeLevel = async (): Promise<number> => {
  if (!native) return 0;
  try { return await native.getKaraokeLevel(); } catch { return 0; }
};

// ---------------------------------------------------------------------------
// Keep screen on \u2014 used during terraform so the device doesn't go to
// sleep mid-measurement and pause the song / kill the recorder.
// ---------------------------------------------------------------------------

export const setKeepScreenOn = async (enabled: boolean): Promise<void> => {
  if (!native) return;
  try { await native.setKeepScreenOn(enabled); } catch { /* noop */ }
};

// ---------------------------------------------------------------------------
// Mic snippet capture — records a short 16 kHz mono PCM clip from the mic and
// returns it as a base64 string of little-endian signed 16-bit samples. Used
// by the in-app Shazam-style recognizer. Returns null on any failure.
// ---------------------------------------------------------------------------

export const recordMicSnippet = async (
  durationMs: number,
): Promise<string | null> => {
  if (!native) return null;
  try {
    return await native.recordMicSnippet(durationMs);
  } catch {
    return null;
  }
};
