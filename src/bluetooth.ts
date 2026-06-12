import { PermissionsAndroid, Platform } from 'react-native';
import type { BluetoothDevice } from 'react-native-bluetooth-classic';

import { getConnectedAudioAddresses } from 'zenova-audio-fx';

type BluetoothClassicModule = typeof import('react-native-bluetooth-classic').default;

let bluetoothClassic: BluetoothClassicModule | null = null;

try {
  bluetoothClassic = require('react-native-bluetooth-classic').default as BluetoothClassicModule;
} catch {
  bluetoothClassic = null;
}

export type CicadaDevice = {
  address: string;
  rawName: string;
  displayName: string;
  subtitle: string;
  matchedAsCicada: boolean;
  bonded: boolean;
  device: BluetoothDevice;
};

export function getBluetoothClassic() {
  return bluetoothClassic;
}

export function isAndroidBluetoothRuntimeReady() {
  return Platform.OS === 'android' && bluetoothClassic !== null;
}

// Race a promise against a timeout. Throws TimeoutError if it doesn't settle
// in time. Used to keep Bluetooth ops from blocking the UI indefinitely —
// rn-bluetooth-classic ops can hang for 30+ seconds when a speaker is
// off-route or out of range.
export class BluetoothTimeoutError extends Error {
  constructor(label: string) {
    super(`${label} timed out`);
    this.name = 'BluetoothTimeoutError';
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new BluetoothTimeoutError(label));
    }, ms);
    p.then(
      (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function normalizeName(name?: string | null) {
  return (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(name?: string | null) {
  return normalizeName(name).split(' ').filter(Boolean);
}

// Tiny Levenshtein distance for short tokens.
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function fuzzyHasToken(tokens: string[], target: string, maxEdits = 1) {
  for (const tok of tokens) {
    if (tok === target) return true;
    // Allow longer tokens to "contain" the target loosely.
    if (tok.includes(target) && Math.abs(tok.length - target.length) <= 2) return true;
    if (editDistance(tok, target) <= maxEdits) return true;
  }
  return false;
}

// Strict Cicada identification: must look like "avante bar 600" (fuzzy).
export function isCicadaCandidate(name?: string | null) {
  const tokens = tokenize(name);
  if (!tokens.length) return false;

  const hasAvante = fuzzyHasToken(tokens, 'avante', 1);
  const hasBar = fuzzyHasToken(tokens, 'bar', 0);
  const hasSixHundred = tokens.some((tok) => tok.includes('600'));

  // All three required, but accept "bar600" as a single concatenated token.
  if (hasAvante && hasBar && hasSixHundred) return true;

  const joined = normalizeName(name).replace(/\s+/g, '');
  if (
    joined.includes('avantebar600') ||
    joined.includes('avante600') ||
    joined.includes('boatavantebar600')
  ) {
    return true;
  }

  return false;
}

// Keywords that signal a music-ready audio sink (A2DP-class device).
const AUDIO_KEYWORDS = [
  'speaker',
  'soundbar',
  'sound bar',
  'bar',
  'audio',
  'music',
  'stereo',
  'boombox',
  'subwoofer',
  'woofer',
  'headphone',
  'headphones',
  'headset',
  'earbud',
  'earbuds',
  'earphone',
  'earphones',
  'airpods',
  'pods',
  'buds',
  'beats',
  'jbl',
  'sony',
  'bose',
  'boat',
  'avante',
  'marshall',
  'harman',
  'kardon',
  'sennheiser',
  'bang olufsen',
  'b o',
  'b&o',
  'sonos',
  'anker',
  'soundcore',
  'tribit',
  'ue boom',
  'mifa',
  'realme buds',
  'oneplus buds',
  'galaxy buds',
  'pixel buds',
  'mi sound',
  'noise',
  'zebronics',
  'iball',
];

// Device-class introspection (best-effort across rn-bluetooth-classic versions).
function readDeviceClass(device: BluetoothDevice): number | null {
  const anyDev = device as unknown as {
    extra?: { deviceClass?: number; majorDeviceClass?: number; bluetoothClass?: number };
    bluetoothClass?: number;
    deviceClass?: number;
    type?: number;
  };
  const candidates = [
    anyDev.extra?.deviceClass,
    anyDev.extra?.bluetoothClass,
    anyDev.extra?.majorDeviceClass,
    anyDev.bluetoothClass,
    anyDev.deviceClass,
  ];
  for (const v of candidates) {
    if (typeof v === 'number' && v > 0) return v;
  }
  return null;
}

// Bluetooth Major Device Class 0x04 (Audio/Video). Mask is 0x1F00 >> 8.
function isAudioMajorClass(value: number) {
  const major = (value & 0x1f00) >> 8;
  return major === 0x04;
}

export function isAudioBluetoothDevice(device: BluetoothDevice) {
  const cls = readDeviceClass(device);
  if (cls !== null) {
    if (isAudioMajorClass(cls)) return true;
  }
  const tokens = tokenize(device.name);
  if (!tokens.length) return false;
  // Match any single audio keyword fuzzily, or recognise concatenated tokens.
  const joined = tokens.join(' ');
  for (const keyword of AUDIO_KEYWORDS) {
    const parts = keyword.split(' ');
    if (parts.every((p) => fuzzyHasToken(tokens, p, 1))) return true;
    if (joined.includes(keyword)) return true;
  }
  return false;
}

export function mapBluetoothDevice(device: BluetoothDevice): CicadaDevice {
  const rawName = device.name?.trim() || 'Unnamed speaker';
  const matchedAsCicada = isCicadaCandidate(rawName);

  return {
    address: device.address,
    rawName,
    displayName: matchedAsCicada ? 'Cicada' : rawName,
    subtitle: matchedAsCicada ? 'Cicada speaker' : 'Bluetooth audio',
    matchedAsCicada,
    bonded: Boolean(device.bonded),
    device,
  };
}

// Discovery / bonded-list filter.
//
// Cicada is an Avante Bar 600 audio device, so we ONLY surface devices
// whose Bluetooth name matches the Cicada signature ("avante bar 600" /
// "boat avante bar 600", fuzzy). Non-Cicada audio devices are not shown
// in the radar or paired list — the user explicitly asked for that.
function filterAudioDevices(devices: BluetoothDevice[]) {
  return devices.filter((d) => isCicadaCandidate(d.name));
}

export function mergeBluetoothDevices(...deviceGroups: CicadaDevice[][]) {
  const byAddress = new Map<string, CicadaDevice>();

  for (const group of deviceGroups) {
    for (const device of group) {
      byAddress.set(device.address, device);
    }
  }

  return Array.from(byAddress.values()).sort((left, right) => {
    if (left.matchedAsCicada !== right.matchedAsCicada) {
      return left.matchedAsCicada ? -1 : 1;
    }

    if (left.bonded !== right.bonded) {
      return left.bonded ? -1 : 1;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

export async function requestBluetoothPermissions() {
  if (Platform.OS !== 'android') {
    return false;
  }

  const requestedPermissions =
    Platform.Version >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]
      : [
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];

  const result = await PermissionsAndroid.requestMultiple(requestedPermissions);

  return requestedPermissions.every(
    (permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED,
  );
}

export async function ensureBluetoothReady() {
  const module = getBluetoothClassic();

  if (!isAndroidBluetoothRuntimeReady() || !module) {
    throw new Error('Cicada needs the Android build to talk Bluetooth.');
  }

  const available = await module.isBluetoothAvailable();
  if (!available) {
    throw new Error('This phone has no Bluetooth Classic. Cicada can\u2019t reach it.');
  }

  const permissionsGranted = await requestBluetoothPermissions();
  if (!permissionsGranted) {
    throw new Error('Bluetooth permission is needed to find your Cicada.');
  }

  let enabled = await module.isBluetoothEnabled();
  if (!enabled) {
    enabled = await module.requestBluetoothEnabled();
  }

  if (!enabled) {
    throw new Error('Turn Bluetooth on to find your Cicada.');
  }

  return module;
}

export async function getBondedCicadaDevices() {
  const module = await ensureBluetoothReady();
  const devices = await withTimeout(
    module.getBondedDevices(),
    5000,
    'getBondedDevices',
  );
  return filterAudioDevices(devices).map(mapBluetoothDevice);
}

export async function discoverCicadaDevices() {
  const module = await ensureBluetoothReady();
  try {
    // 15 s hard cap. Android's startDiscovery typically resolves around 12 s.
    const devices = await withTimeout(
      module.startDiscovery(),
      15000,
      'startDiscovery',
    );
    return filterAudioDevices(devices).map(mapBluetoothDevice);
  } catch (e) {
    // Best-effort cancel on timeout so a stuck discovery doesn't lock the
    // adapter for the next attempt.
    try {
      await module.cancelDiscovery();
    } catch {
      /* ignore */
    }
    throw e;
  }
}

// Streaming discovery. Returns a `stop` function. Bonded audio devices are
// emitted immediately (synchronously on the next tick) and live discoveries
// stream in via the native onDeviceDiscovered event — each new device shows
// up in the UI within ~milliseconds of the radio detecting it, rather than
// waiting for the full 12 s startDiscovery() result.
export function discoverCicadaDevicesStream(
  onDevice: (device: CicadaDevice) => void,
  onComplete?: (err?: unknown) => void,
): () => void {
  let stopped = false;
  let sub: { remove: () => void } | null = null;

  const seen = new Set<string>();
  const emit = (raw: BluetoothDevice) => {
    if (stopped) return;
    // ONLY Cicada-matching devices are emitted. The radar must not show
    // unrelated Bluetooth audio devices.
    if (!isCicadaCandidate(raw.name)) return;
    if (seen.has(raw.address)) return;
    seen.add(raw.address);
    onDevice(mapBluetoothDevice(raw));
  };

  const run = async () => {
    let module: BluetoothClassicModule;
    try {
      module = await ensureBluetoothReady();
    } catch (e) {
      onComplete?.(e);
      return;
    }
    if (stopped) return;

    // 1. Push bonded audio devices instantly so the UI has something to
    //    show before discovery completes.
    try {
      const bonded = await withTimeout(
        module.getBondedDevices(),
        5000,
        'getBondedDevices',
      );
      for (const d of bonded) emit(d);
    } catch {
      // non-fatal — streaming continues
    }

    if (stopped) return;

    // 2. Live discovery events.
    sub = module.onDeviceDiscovered((event) => {
      const raw = (event as unknown as { device?: BluetoothDevice }).device;
      if (raw) emit(raw);
    });

    // 3. Kick off the full sweep. We still await the final list because
    //    the event subscription only fires for newly-seen devices; the
    //    final array can include ones the event stream missed.
    try {
      const final = await withTimeout(
        module.startDiscovery(),
        15000,
        'startDiscovery',
      );
      for (const d of final) emit(d);
      onComplete?.();
    } catch (e) {
      try {
        await module.cancelDiscovery();
      } catch {
        /* ignore */
      }
      onComplete?.(e);
    } finally {
      sub?.remove();
      sub = null;
    }
  };

  run();

  return () => {
    stopped = true;
    sub?.remove();
    sub = null;
    // Best-effort cancel of any in-flight discovery.
    bluetoothClassic?.cancelDiscovery().catch(() => {});
  };
}

export async function pairCicadaDevice(device: CicadaDevice) {
  const module = await ensureBluetoothReady();
  const paired = await withTimeout(
    module.pairDevice(device.address),
    25000,
    'pairDevice',
  );
  return mapBluetoothDevice(paired);
}

export async function unpairCicadaDevice(device: CicadaDevice) {
  const module = await ensureBluetoothReady();
  const unpaired = await withTimeout(
    module.unpairDevice(device.address),
    10000,
    'unpairDevice',
  );

  if (!unpaired) {
    throw new Error(`Couldn\u2019t forget ${device.displayName}.`);
  }

  return true;
}

// True if Android currently has this address connected as an A2DP audio sink.
// This is what actually matters for "can I play music to this speaker?" —
// the SPP socket probe most audio devices don't open at all.
async function isA2dpConnected(address: string): Promise<boolean> {
  try {
    const addrs = await getConnectedAudioAddresses();
    const upper = address.toUpperCase();
    return addrs.some((a) => a.toUpperCase() === upper);
  } catch {
    return false;
  }
}

export async function isSpeakerConnected(device: CicadaDevice) {
  // Prefer A2DP — it's what audio devices use. Only fall back to SPP probe
  // if A2DP says no (some BT-Classic devices DO open an SPP socket).
  if (await isA2dpConnected(device.address)) return true;
  try {
    return await withTimeout(
      device.device.isConnected(),
      4000,
      'isConnected',
    );
  } catch {
    return false;
  }
}

// Smart connect.
//
// Audio speakers (the common case for Cicada) connect via the A2DP profile,
// which Android auto-establishes after pairing. They generally DO NOT expose
// an SPP socket, so calling rn-bluetooth-classic's device.connect() either
// (a) throws an IOException after a few seconds, or worse, (b) hangs.
//
// We treat "connected" as the user-meaningful question: is this device
// currently routed for A2DP music output?
//   1. If A2DP already says yes → success immediately.
//   2. Try the SPP socket connect with a tight timeout (for the rare device
//      that supports it). If it succeeds → success.
//   3. If SPP throws or times out, poll A2DP for up to 6 s — Android often
//      brings A2DP up automatically a moment later. If it appears → success.
//   4. Only then surface the failure.
export async function connectToSpeaker(device: CicadaDevice) {
  // 1.
  if (await isA2dpConnected(device.address)) return true;

  // 2.
  try {
    const ok = await withTimeout(
      device.device.connect(),
      8000,
      'connect',
    );
    if (ok) return true;
  } catch {
    // fall through to A2DP poll
  }

  // 3. Poll A2DP for up to 6 s in 500 ms ticks.
  for (let i = 0; i < 12; i++) {
    if (await isA2dpConnected(device.address)) return true;
    await sleep(500);
  }

  // 4.
  throw new Error(`Couldn\u2019t reach ${device.displayName}. Try again.`);
}

export async function disconnectFromSpeaker(device: CicadaDevice) {
  try {
    return await withTimeout(
      device.device.disconnect(),
      5000,
      'disconnect',
    );
  } catch {
    // Best-effort — audio devices often have no SPP socket to disconnect
    // from. The user-visible state is already torn down by the caller.
    return false;
  }
}
