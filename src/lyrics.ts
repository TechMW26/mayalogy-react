// Time-synced lyrics from LRCLIB (https://lrclib.net) — an open-source,
// community-maintained database with strong English and Romanized/Hinglish
// coverage. Multiple candidates are fired in parallel so the first synced
// hit wins; plain text is accepted at the 13 s deadline.
//
// All results are filtered to Latin-script only (English, Hinglish, Romanized
// languages). Any lyrics dominated by CJK, Devanagari, Arabic, Cyrillic, etc.
// are silently rejected so wrong-language hits can never appear on screen.

export type LyricLine = { ms: number; text: string };

export type LyricsResult = {
  synced: boolean;
  lines: LyricLine[];
  /** Whole plain text when no synced lyrics exist. */
  plain: string | null;
  /** Track length in ms (from LRCLIB), used to auto-detect the song end. */
  durationMs: number | null;
};

function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const re = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  for (const raw of lrc.split('\n')) {
    re.lastIndex = 0;
    const stamps: number[] = [];
    let m: RegExpExecArray | null;
    let lastEnd = 0;
    while ((m = re.exec(raw)) !== null) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      stamps.push(min * 60000 + sec * 1000 + frac);
      lastEnd = re.lastIndex;
    }
    if (stamps.length === 0) continue;
    const text = raw.slice(lastEnd).trim();
    for (const ms of stamps) lines.push({ ms, text });
  }
  lines.sort((a, b) => a.ms - b.ms);
  return lines;
}

function plainToLines(plain: string): LyricLine[] {
  return plain
    .split('\n')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((text) => ({ ms: -1, text }));
}

function buildResult(
  syncedLyrics?: string | null,
  plainLyrics?: string | null,
  durationSec?: number | null,
): LyricsResult | null {
  const durationMs =
    typeof durationSec === 'number' && durationSec > 0
      ? Math.round(durationSec * 1000)
      : null;
  if (syncedLyrics && syncedLyrics.trim().length > 0) {
    const lines = parseLrc(syncedLyrics);
    if (lines.length > 0) return { synced: true, lines, plain: plainLyrics ?? null, durationMs };
  }
  if (plainLyrics && plainLyrics.trim().length > 0) {
    return { synced: false, lines: plainToLines(plainLyrics), plain: plainLyrics, durationMs };
  }
  return null;
}

const REQ_TIMEOUT_MS = 14000;
const DEADLINE_MS = 16000;

// Promise.race timeout — bulletproof across Hermes/release where an
// AbortController + custom headers occasionally misbehaved. No custom
// User-Agent: the default works and avoids any header-parsing quirks.
async function getJson(url: string): Promise<any | null> {
  try {
    const res = await Promise.race([
      fetch(url, { headers: { Accept: 'application/json' } }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), REQ_TIMEOUT_MS)),
    ]);
    if (!res || !res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Resolve as soon as a SYNCED result is available (best case ≈ one round
// trip); otherwise return the best plain result once every candidate has
// settled or the deadline hits. This collapses what used to be up to seven
// slow *sequential* LRCLIB calls into a single parallel wait — critical
// because the server's time-to-first-byte is often 8–13s.
function raceForLyrics(
  tasks: Promise<LyricsResult | null>[],
  deadlineMs: number,
): Promise<LyricsResult | null> {
  return new Promise((resolve) => {
    let done = false;
    let settled = 0;
    let bestPlain: LyricsResult | null = null;
    const finish = (r: LyricsResult | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(() => finish(bestPlain), deadlineMs);
    for (const task of tasks) {
      task
        .then((r) => {
          if (done || !r) return;
          if (r.synced) finish(r);
          else if (!bestPlain) bestPlain = r;
        })
        .catch(() => {})
        .finally(() => {
          settled++;
          if (settled === tasks.length) finish(bestPlain);
        });
    }
  });
}

// Streaming services tack qualifiers onto titles — (From "…"), (feat …),
// "- Remastered", "[Live]" — that stop LRCLIB from matching. Strip them.
function cleanTitle(raw: string): string {
  let s = raw;
  s = s.replace(/\s*[([{][^)\]}]*[)\]}]/g, ' ');
  s = s.replace(
    /\s*-\s*(from|feat\.?|ft\.?|featuring|with|single|remaster(ed)?|live|acoustic|version|edit|mix|soundtrack|ost)\b.*$/i,
    ' ',
  );
  return s.replace(/\s+/g, ' ').trim();
}

// Reduce a multi-artist credit to the lead artist for a forgiving search.
function primaryArtist(raw: string): string {
  const s = raw.split(/\s*(?:,|&|\/|feat\.?|ft\.?|featuring|×|with)\s+/i)[0];
  return s.replace(/\s+/g, ' ').trim();
}

function pickFromSearch(
  results: any,
  accept: (r: LyricsResult) => boolean,
): LyricsResult | null {
  if (!Array.isArray(results) || results.length === 0) return null;
  const built: LyricsResult[] = results
    .map((r: any) => buildResult(r.syncedLyrics, r.plainLyrics, r.duration))
    .filter((r: LyricsResult | null): r is LyricsResult => !!r)
    .filter((r: LyricsResult) => accept(r));
  if (built.length === 0) return null;
  const synced = built.find((r) => r.synced);
  return synced ?? built[0];
}

// Non-Latin Unicode letter ranges: CJK, Devanagari, Arabic, Cyrillic, Korean,
// Japanese kana, Thai, and the major Indic scripts.
const NON_LATIN_RE =
  /[\u0250-\u02af\u0370-\u052f\u0590-\u06ff\u0900-\u0d7f\u0e00-\u0e7f\u1000-\u109f\u1100-\u11ff\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;
const LATIN_LETTER_RE = /[a-zA-Z\u00c0-\u024f\u1e00-\u1eff]/g;

// Returns true when a lyrics result is predominantly non-Latin script — i.e.
// not in English or Hinglish/Romanized form. Any result that fails this check
// is silently dropped so it can never reach the screen.
function isNonLatinLyrics(result: LyricsResult): boolean {
  const sample = result.plain ?? result.lines.map((l) => l.text).join('\n');
  const foreign = (sample.match(NON_LATIN_RE) || []).length;
  if (foreign === 0) return false;
  const latin = (sample.match(LATIN_LETTER_RE) || []).length;
  const total = latin + foreign;
  // Reject if non-Latin letters make up more than 15 % of all letter chars.
  return total > 0 && foreign / total > 0.15;
}

// Small in-memory cache so re-identifying the same track is instant and we
// don't re-hit the providers on every auto-redetect.
const lyricsCache = new Map<string, LyricsResult>();

export async function fetchLyrics(
  artist: string,
  track: string,
  album?: string | null,
  durationSec?: number | null,
): Promise<LyricsResult | null> {
  if (!artist || !track) return null;
  const q = (s: string) => encodeURIComponent(s.trim());

  const cTrack = cleanTitle(track) || track.trim();
  const lead = primaryArtist(artist) || artist.trim();
  const cacheKey = `${lead.toLowerCase()}::${cTrack.toLowerCase()}`;
  const cached = lyricsCache.get(cacheKey);
  if (cached) return cached;

  const getUrl = (a: string, tr: string) =>
    `https://lrclib.net/api/get?artist_name=${q(a)}&track_name=${q(tr)}`;
  const searchUrl = (a: string, tr: string) =>
    `https://lrclib.net/api/search?artist_name=${q(a)}&track_name=${q(tr)}`;

  // Drop any result whose lyrics are not in Latin script (English / Hinglish).
  const guard = (r: LyricsResult | null): LyricsResult | null =>
    r && isNonLatinLyrics(r) ? null : r;
  const accept = (r: LyricsResult): boolean => !isNonLatinLyrics(r);

  // Fire all LRCLIB candidates in PARALLEL — "get" is exact, "search" widens
  // coverage when the title/artist don't match byte-for-byte. We omit the
  // album/duration params on "get" because they make it over-strict and 404
  // too often. First SYNCED hit wins; otherwise best plain text at the deadline.
  const tasks: Promise<LyricsResult | null>[] = [
    getJson(getUrl(lead, cTrack)).then((j) =>
      guard(j ? buildResult(j.syncedLyrics, j.plainLyrics, j.duration) : null),
    ),
    getJson(getUrl(artist, cTrack)).then((j) =>
      guard(j ? buildResult(j.syncedLyrics, j.plainLyrics, j.duration) : null),
    ),
    getJson(searchUrl(lead, cTrack)).then((j) => pickFromSearch(j, accept)),
    getJson(searchUrl(artist, cTrack)).then((j) => pickFromSearch(j, accept)),
    // Extra broad pass: search by track name alone in case artist credit differs.
    getJson(`https://lrclib.net/api/search?track_name=${q(cTrack)}`).then((j) =>
      pickFromSearch(j, accept),
    ),
  ];

  const result = await raceForLyrics(tasks, DEADLINE_MS);
  if (result) lyricsCache.set(cacheKey, result);
  return result;
}

// Binary-search the active line index for a synced position (ms). Returns -1
// before the first line.
export function findActiveLineIndex(lines: LyricLine[], positionMs: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].ms <= positionMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}
