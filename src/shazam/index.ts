// In-app music recognition over Shazam's public recognition endpoint.
//
// Flow: 16 kHz mono PCM (base64 from native) -> fingerprint signature ->
// POST to amp.shazam.com -> parsed track metadata. No API key, no account.

import { makeSignature } from './signature';

export type ShazamMatch = {
  title: string;
  artist: string;
  album: string | null;
  coverArt: string | null;
  /** Plain (non-synced) lyric lines Shazam sometimes returns. */
  shazamLyrics: string[] | null;
  appleMusicUrl: string | null;
  shazamUrl: string | null;
  /** Seconds into the track where the recorded sample began, if provided. */
  offsetSeconds: number | null;
  genre: string | null;
};

const B64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64_CHARS.length; i++) t[B64_CHARS.charCodeAt(i)] = i;
  return t;
})();

function base64ToBytes(b64: string): Uint8Array {
  let len = b64.length;
  while (len > 0 && b64[len - 1] === '=') len--;
  const out = new Uint8Array((len * 3) >> 2);
  let oi = 0;
  let buf = 0;
  let bits = 0;
  for (let i = 0; i < len; i++) {
    const v = B64_LOOKUP[b64.charCodeAt(i)];
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[oi++] = (buf >> bits) & 0xff;
    }
  }
  return oi === out.length ? out : out.subarray(0, oi);
}

// Decodes base64 little-endian s16 PCM into an Int16Array of raw sample values.
export function decodePcmBase64(b64: string): Int16Array {
  const bytes = base64ToBytes(b64);
  const n = bytes.length >> 1;
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const lo = bytes[i * 2];
    const hi = bytes[i * 2 + 1];
    let v = (hi << 8) | lo;
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v;
  }
  return out;
}

function uuid4Upper(): string {
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';
    else if (i === 14) s += '4';
    else if (i === 19) s += h[((Math.random() * 4) | 0) + 8];
    else s += h[(Math.random() * 16) | 0];
  }
  return s.toUpperCase();
}

function endpointUrl(): string {
  const u1 = uuid4Upper();
  const u2 = uuid4Upper();
  return (
    `https://amp.shazam.com/discovery/v5/en-US/GB/android/-/tag/${u1}/${u2}` +
    '?sync=true&webv3=true&sampling=true&connected=' +
    '&shazamapiversion=v3&sharehub=true&hubv5minorversion=v5.1&hidelb=true&video=v3'
  );
}

const HEADERS: Record<string, string> = {
  'X-Shazam-Platform': 'ANDROID',
  'X-Shazam-AppVersion': '14.1.0',
  Accept: '*/*',
  'Accept-Language': 'en-US',
  'Content-Type': 'application/json',
  'User-Agent':
    'Dalvik/2.1.0 (Linux; U; Android 13; Pixel 7 Build/TQ3A.230805.001)',
};

type ShazamSection = {
  type?: string;
  text?: string[];
  metadata?: { title?: string; text?: string }[];
};

function parseMatch(json: any): ShazamMatch | null {
  const track = json?.track;
  if (!track || !track.title) return null;
  if (Array.isArray(json.matches) && json.matches.length === 0) return null;

  const sections: ShazamSection[] = Array.isArray(track.sections)
    ? track.sections
    : [];

  let album: string | null = null;
  const songSection = sections.find((s) => s.type === 'SONG');
  if (songSection?.metadata) {
    const albumMeta = songSection.metadata.find((m) => m.title === 'Album');
    album = albumMeta?.text ?? null;
  }

  const lyricsSection = sections.find((s) => s.type === 'LYRICS');
  const shazamLyrics =
    lyricsSection && Array.isArray(lyricsSection.text) ? lyricsSection.text : null;

  const images = track.images ?? {};
  const coverArt =
    images.coverarthq ?? images.coverart ?? images.background ?? null;

  let appleMusicUrl: string | null = null;
  const actions = track.hub?.actions;
  if (Array.isArray(actions)) {
    const play = actions.find(
      (a: any) => a?.type === 'applemusicplay' || a?.type === 'uri',
    );
    appleMusicUrl = play?.uri ?? null;
  }

  let offsetSeconds: number | null = null;
  if (Array.isArray(json.matches) && json.matches[0]) {
    const off = json.matches[0].offset;
    if (typeof off === 'number') offsetSeconds = off;
  }

  return {
    title: String(track.title),
    artist: track.subtitle ? String(track.subtitle) : '',
    album,
    coverArt,
    shazamLyrics,
    appleMusicUrl,
    shazamUrl: track.url ? String(track.url) : null,
    offsetSeconds,
    genre: track.genres?.primary ? String(track.genres.primary) : null,
  };
}

// Recognizes a song from raw 16 kHz mono s16 samples. Returns null on no match.
export async function recognizeFromSamples(
  samples: Int16Array,
): Promise<ShazamMatch | null> {
  const sig = makeSignature(samples);
  if (!sig) return null;

  const body = JSON.stringify({
    timezone: 'Europe/London',
    signature: { uri: sig.uri, samplems: sig.samplesMs },
    timestamp: Date.now(),
    context: {},
    geolocation: {},
  });

  const res = await fetch(endpointUrl(), {
    method: 'POST',
    headers: HEADERS,
    body,
  });
  if (!res.ok) return null;
  const json = await res.json();
  return parseMatch(json);
}

// Convenience: decode base64 PCM (from the native recorder) and recognize.
export async function recognizePcmBase64(
  b64: string,
): Promise<ShazamMatch | null> {
  const samples = decodePcmBase64(b64);
  if (samples.length < 16000) return null; // need at least ~1s of audio
  return recognizeFromSamples(samples);
}
