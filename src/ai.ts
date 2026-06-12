// Groq-backed AI helpers: lyric generation fallback + Terraform EQ refinement.
//
// SECURITY NOTE: the API key below is bundled into the client app, which means
// anyone can extract it from the APK. This is acceptable only for a prototype.
// Before shipping, ROTATE this key and move these calls behind a backend proxy
// so the secret never ships on-device.

import type { LyricLine, LyricsResult } from './lyrics';

const GROQ_API_KEY = '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';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const REQUEST_TIMEOUT_MS = 12000;

type ChatMessage = { role: 'system' | 'user'; content: string };

async function groqChat(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.maxTokens ?? 900,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Lyric generation fallback
// ---------------------------------------------------------------------------

// Used when LRCLIB and Shazam both fail to provide lyrics. Returns an UNSYNCED
// LyricsResult (no timestamps) so the Now Playing screen renders it in plain,
// scrollable mode. Returns null on any failure so callers can keep their
// existing empty state.
export async function generateLyricsWithAI(
  artist: string,
  title: string,
): Promise<LyricsResult | null> {
  if (!artist || !title) return null;

  const content = await groqChat(
    [
      {
        role: 'system',
        content:
          'You are a music lyrics assistant. The user names a song. Reply with ONLY the song lyrics, one lyric line per line, with no timestamps, no section headers like [Chorus], no commentary, no numbering, and no markdown. If you do not know the lyrics confidently, reply with exactly the single word: UNKNOWN.',
      },
      {
        role: 'user',
        content: `Song: "${title}" by ${artist}. Provide the full lyrics.`,
      },
    ],
    { maxTokens: 1200, temperature: 0.4 },
  );

  if (!content) return null;
  const trimmed = content.trim();
  if (!trimmed || /^unknown$/i.test(trimmed)) return null;

  const lines: LyricLine[] = trimmed
    .split('\n')
    .map((t) => t.replace(/^\s*[\d.)\-]+\s*/, '').trim())
    .filter((t) => t.length > 0 && !/^\[.*\]$/.test(t))
    .map((text) => ({ ms: -1, text }));

  if (lines.length < 2) return null;

  return {
    synced: false,
    lines,
    plain: lines.map((l) => l.text).join('\n'),
    durationMs: null,
  };
}

// ---------------------------------------------------------------------------
// Terraform EQ refinement
// ---------------------------------------------------------------------------

export type EqShape = {
  subBass: number;
  bass: number;
  mid: number;
  presence: number;
  treble: number;
};

type BandReading = { key: keyof EqShape; label: string; deltaDb: number };

function clampStep(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-6, Math.min(6, Math.round(v)));
}

// Sends the measured per-band level deltas (in dB, relative to the room
// baseline) plus the heuristic correction to Groq and asks for a refined,
// musically-sensible 5-band EQ. Falls back to the heuristic result on any
// failure so Terraform always produces something. Each band is in [-6, +6].
export async function refineTerraformEqWithAI(
  readings: BandReading[],
  heuristic: EqShape,
): Promise<EqShape | null> {
  if (readings.length === 0) return null;

  const measurementText = readings
    .map((r) => `${r.label} (${r.key}): ${r.deltaDb.toFixed(2)} dB`)
    .join('\n');

  const content = await groqChat(
    [
      {
        role: 'system',
        content:
          'You are an expert audio engineer tuning a 5-band graphic equaliser to counteract a room\'s acoustic colouration. You are given per-band measured level deltas in dB (positive = the room over-emphasises that band, so it should be CUT; negative = under-emphasised, so it should be BOOSTED). Reply with ONLY a compact JSON object with integer keys subBass, bass, mid, presence, treble, each in the range -6 to 6. No prose, no markdown, no code fences.',
      },
      {
        role: 'user',
        content:
          `Measured band deltas (dB relative to room baseline):\n${measurementText}\n\n` +
          `Heuristic starting point: ${JSON.stringify(heuristic)}\n\n` +
          'Refine these into a balanced correction. Keep changes gentle and musical (avoid extreme ±6 unless the delta is large). Return only the JSON object.',
      },
    ],
    { maxTokens: 200, temperature: 0.3 },
  );

  if (!content) return null;

  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Partial<Record<keyof EqShape, number>>;
    return {
      subBass: clampStep(parsed.subBass ?? heuristic.subBass),
      bass: clampStep(parsed.bass ?? heuristic.bass),
      mid: clampStep(parsed.mid ?? heuristic.mid),
      presence: clampStep(parsed.presence ?? heuristic.presence),
      treble: clampStep(parsed.treble ?? heuristic.treble),
    };
  } catch {
    return null;
  }
}
