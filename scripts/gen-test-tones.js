// Generates 5 mono 16-bit PCM WAV files at the standard Android 5-band
// Equalizer center frequencies. Each file is 1.2s with a 80ms fade-in/out
// to avoid speaker clicks. Bundled into assets/tones/ and shipped with the
// app for the auto-tune calibration flow.
//
// Run with:  node scripts/gen-test-tones.js

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '..', 'assets', 'tones');
const SAMPLE_RATE = 44100;
const DURATION_SEC = 1.2;
const AMP = 0.55; // peak (0..1). Leaves headroom + comfortable level.
const FADE_SEC = 0.08;

// Band 0..4 → approximate Android Equalizer center frequencies.
const BANDS = [
  { id: 0, label: 'sub', hz: 60 },
  { id: 1, label: 'bass', hz: 230 },
  { id: 2, label: 'mid', hz: 910 },
  { id: 3, label: 'presence', hz: 3600 },
  { id: 4, label: 'treble', hz: 14000 },
];

function writeWavMonoPcm16(filePath, samples) {
  const numSamples = samples.length;
  const byteRate = SAMPLE_RATE * 2; // mono * 16-bit
  const dataSize = numSamples * 2;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM subchunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const body = Buffer.alloc(dataSize);
  for (let i = 0; i < numSamples; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    body.writeInt16LE(Math.round(v * 32767), i * 2);
  }

  fs.writeFileSync(filePath, Buffer.concat([header, body]));
}

function buildTone(freq) {
  const n = Math.round(SAMPLE_RATE * DURATION_SEC);
  const fadeSamples = Math.round(SAMPLE_RATE * FADE_SEC);
  const samples = new Float32Array(n);
  const twoPi = 2 * Math.PI;
  for (let i = 0; i < n; i++) {
    let env = 1;
    if (i < fadeSamples) env = i / fadeSamples;
    else if (i > n - fadeSamples) env = (n - i) / fadeSamples;
    samples[i] = AMP * env * Math.sin((twoPi * freq * i) / SAMPLE_RATE);
  }
  return samples;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const band of BANDS) {
    const samples = buildTone(band.hz);
    const outPath = path.join(OUT_DIR, `band${band.id}_${band.label}_${band.hz}hz.wav`);
    writeWavMonoPcm16(outPath, samples);
    console.log('wrote', path.relative(process.cwd(), outPath), `(${samples.length} samples)`);
  }
  console.log('done');
}

main();
