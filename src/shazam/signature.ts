// Shazam fingerprint ("signature") generator, ported faithfully from the
// reverse-engineered reference implementation (ShazamIO / SongRec).
//
// Input: signed 16-bit, 16 kHz, mono PCM samples.
// Output: a `data:audio/vnd.shazam.sig;base64,...` URI plus the sampled
// duration in milliseconds, ready to POST to Shazam's recognition endpoint.
//
// The math here is intentionally a 1:1 port — every constant, window, spread
// offset and byte layout matches the reference, because Shazam's servers will
// silently return "no match" if the signature bytes are even slightly off.

import { realPowerSpectrum } from './fft';

const SAMPLE_RATE = 16000;
const FFT_SIZE = 2048;
const BINS = FFT_SIZE / 2 + 1; // 1025
const RING_SIZE = 256;
const MAX_TIME_SECONDS = 12;
const MAX_PEAKS = 255;
const DATA_URI_PREFIX = 'data:audio/vnd.shazam.sig;base64,';

// Hanning window: np.hanning(2050)[1:-1] — i.e. 0.5 - 0.5*cos(2*pi*(i+1)/2049).
const HANN = new Float64Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) {
  HANN[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 1)) / (FFT_SIZE + 1));
}

const NEIGHBOR_OFFSETS = [-10, -7, -4, -3, 1, 2, 5, 8];
const OTHER_OFFSETS = [
  -53, -45, 165, 172, 179, 186, 193, 200, 214, 221, 228, 235, 242, 249,
];

type Peak = {
  fftPassNumber: number;
  peakMagnitude: number;
  correctedPeakFrequencyBin: number;
};

function zeroBuffers(count: number): Float64Array[] {
  const arr: Float64Array[] = new Array(count);
  for (let i = 0; i < count; i++) arr[i] = new Float64Array(BINS);
  return arr;
}

// Builds the peak constellation for the supplied samples.
function generatePeaks(samples: Int16Array): {
  peaksByBand: Peak[][];
  numberSamples: number;
} {
  const ring = new Float64Array(FFT_SIZE);
  let ringPos = 0;

  const fftOutputs = zeroBuffers(RING_SIZE);
  let fftPos = 0;
  let fftNumWritten = 0;

  const spreadOutputs = zeroBuffers(RING_SIZE);
  let spreadPos = 0;
  let spreadNumWritten = 0;

  const windowed = new Float64Array(FFT_SIZE);
  const power = new Float64Array(BINS);

  const peaksByBand: Peak[][] = [[], [], [], []];
  let totalPeaks = 0;
  let numberSamples = 0;

  const doFft = (chunkStart: number) => {
    // Write the 128-sample chunk into the ring buffer (positions are always a
    // multiple of 128, so this never wraps mid-chunk).
    for (let i = 0; i < 128; i++) ring[ringPos + i] = samples[chunkStart + i];
    ringPos = (ringPos + 128) % FFT_SIZE;

    // Reorder oldest-first and apply the Hanning window.
    let idx = ringPos;
    for (let i = 0; i < FFT_SIZE; i++) {
      windowed[i] = HANN[i] * ring[idx];
      idx++;
      if (idx === FFT_SIZE) idx = 0;
    }

    realPowerSpectrum(windowed, FFT_SIZE, power);

    const mags = new Float64Array(BINS);
    for (let k = 0; k < BINS; k++) {
      let m = power[k] / (1 << 17);
      if (m < 1e-10) m = 1e-10;
      mags[k] = m;
    }
    fftOutputs[fftPos] = mags;
    fftPos = (fftPos + 1) % RING_SIZE;
    fftNumWritten++;
  };

  const doPeakSpreading = () => {
    const origin = fftOutputs[(fftPos - 1 + RING_SIZE) % RING_SIZE];

    // Spread in frequency: each bin becomes max(self, +1, +2) except the top 3.
    const spreadFreq = new Float64Array(BINS);
    for (let i = 0; i < BINS - 3; i++) {
      let m = origin[i];
      if (origin[i + 1] > m) m = origin[i + 1];
      if (origin[i + 2] > m) m = origin[i + 2];
      spreadFreq[i] = m;
    }
    spreadFreq[BINS - 3] = origin[BINS - 3];
    spreadFreq[BINS - 2] = origin[BINS - 2];
    spreadFreq[BINS - 1] = origin[BINS - 1];

    // Spread in time across previously written frames (-1, -3, -6).
    const sp1 = spreadOutputs[(spreadPos - 1 + RING_SIZE) % RING_SIZE];
    const sp2 = spreadOutputs[(spreadPos - 3 + RING_SIZE) % RING_SIZE];
    const sp3 = spreadOutputs[(spreadPos - 6 + RING_SIZE) % RING_SIZE];
    for (let k = 0; k < BINS; k++) {
      const o = spreadFreq[k];
      let a = sp1[k];
      if (o > a) a = o;
      sp1[k] = a;
      let b = sp2[k];
      if (a > b) b = a;
      sp2[k] = b;
      let c = sp3[k];
      if (b > c) c = b;
      sp3[k] = c;
    }

    spreadOutputs[spreadPos] = spreadFreq;
    spreadPos = (spreadPos + 1) % RING_SIZE;
    spreadNumWritten++;
  };

  const doPeakRecognition = () => {
    const fm46 = fftOutputs[(fftPos - 46 + RING_SIZE) % RING_SIZE];
    const fm49 = spreadOutputs[(spreadPos - 49 + RING_SIZE) % RING_SIZE];

    for (let bin = 10; bin < 1015; bin++) {
      if (fm46[bin] < 1 / 64) continue;
      if (fm46[bin] < fm49[bin - 1]) continue;

      let maxN49 = 0;
      for (let o = 0; o < NEIGHBOR_OFFSETS.length; o++) {
        const v = fm49[bin + NEIGHBOR_OFFSETS[o]];
        if (v > maxN49) maxN49 = v;
      }
      if (fm46[bin] <= maxN49) continue;

      let maxOther = maxN49;
      for (let o = 0; o < OTHER_OFFSETS.length; o++) {
        const slot = spreadOutputs[
          (spreadPos + OTHER_OFFSETS[o] + RING_SIZE * 2) % RING_SIZE
        ];
        const v = slot[bin - 1];
        if (v > maxOther) maxOther = v;
      }
      if (fm46[bin] <= maxOther) continue;

      const fftNumber = spreadNumWritten - 46;
      const pm = Math.log(Math.max(1 / 64, fm46[bin])) * 1477.3 + 6144;
      const pmBefore = Math.log(Math.max(1 / 64, fm46[bin - 1])) * 1477.3 + 6144;
      const pmAfter = Math.log(Math.max(1 / 64, fm46[bin + 1])) * 1477.3 + 6144;

      const variation1 = pm * 2 - pmBefore - pmAfter;
      if (variation1 <= 0) continue;
      const variation2 = ((pmAfter - pmBefore) * 32) / variation1;
      const correctedBin = bin * 64 + variation2;

      const hz = correctedBin * (SAMPLE_RATE / 2 / 1024 / 64);
      let band: number;
      if (hz > 250 && hz < 520) band = 0;
      else if (hz > 520 && hz < 1450) band = 1;
      else if (hz > 1450 && hz < 3500) band = 2;
      else if (hz > 3500 && hz < 5500) band = 3;
      else continue;

      peaksByBand[band].push({
        fftPassNumber: fftNumber,
        peakMagnitude: Math.trunc(pm),
        correctedPeakFrequencyBin: Math.trunc(correctedBin),
      });
      totalPeaks++;
    }
  };

  const totalChunks = Math.floor(samples.length / 128);
  for (let c = 0; c < totalChunks; c++) {
    if (
      !(numberSamples / SAMPLE_RATE < MAX_TIME_SECONDS || totalPeaks < MAX_PEAKS)
    ) {
      break;
    }
    numberSamples += 128;
    doFft(c * 128);
    doPeakSpreading();
    if (spreadNumWritten >= 46) doPeakRecognition();
  }

  return { peaksByBand, numberSamples };
}

// --- CRC-32 (IEEE) -------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// --- Base64 --------------------------------------------------------------

const B64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Encode(bytes: Uint8Array): string {
  let out = '';
  const len = bytes.length;
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  if (len - i === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (len - i === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  return out;
}

// --- Binary serialization (DecodedMessage.encode_to_binary) --------------

function encodeToBinary(peaksByBand: Peak[][], numberSamples: number): Uint8Array {
  const contents: number[] = [];
  const pushU16 = (arr: number[], v: number) => {
    arr.push(v & 0xff, (v >>> 8) & 0xff);
  };
  const pushU32 = (arr: number[], v: number) => {
    arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  };

  for (let band = 0; band < 4; band++) {
    const peaks = peaksByBand[band];
    if (peaks.length === 0) continue;

    const peaksBuf: number[] = [];
    let fftPass = 0;
    for (let p = 0; p < peaks.length; p++) {
      const peak = peaks[p];
      if (peak.fftPassNumber - fftPass >= 255) {
        peaksBuf.push(0xff);
        pushU32(peaksBuf, peak.fftPassNumber);
        fftPass = peak.fftPassNumber;
      }
      peaksBuf.push((peak.fftPassNumber - fftPass) & 0xff);
      pushU16(peaksBuf, peak.peakMagnitude);
      pushU16(peaksBuf, peak.correctedPeakFrequencyBin);
      fftPass = peak.fftPassNumber;
    }

    pushU32(contents, 0x60030040 + band);
    pushU32(contents, peaksBuf.length);
    for (let i = 0; i < peaksBuf.length; i++) contents.push(peaksBuf[i]);
    const pad = ((-peaksBuf.length % 4) + 4) % 4;
    for (let i = 0; i < pad; i++) contents.push(0);
  }

  const sizeMinusHeader = contents.length + 8;

  const out: number[] = [];
  pushU32(out, 0xcafe2580); // magic1
  pushU32(out, 0); // crc32 placeholder (rewritten below)
  pushU32(out, sizeMinusHeader);
  pushU32(out, 0x94119c00); // magic2
  pushU32(out, 0); // void1[0]
  pushU32(out, 0); // void1[1]
  pushU32(out, 0); // void1[2]
  pushU32(out, 3 << 27); // shifted_sample_rate_id (16000 -> id 3)
  pushU32(out, 0); // void2[0]
  pushU32(out, 0); // void2[1]
  pushU32(out, Math.trunc(numberSamples + SAMPLE_RATE * 0.24));
  pushU32(out, (15 << 19) + 0x40000); // fixed_value

  pushU32(out, 0x40000000);
  pushU32(out, contents.length + 8);
  for (let i = 0; i < contents.length; i++) out.push(contents[i]);

  const bytes = Uint8Array.from(out);
  const crc = crc32(bytes, 8, bytes.length);
  bytes[4] = crc & 0xff;
  bytes[5] = (crc >>> 8) & 0xff;
  bytes[6] = (crc >>> 16) & 0xff;
  bytes[7] = (crc >>> 24) & 0xff;
  return bytes;
}

export type SignatureResult = {
  uri: string;
  samplesMs: number;
  peakCount: number;
};

// Generates a Shazam signature URI from 16 kHz mono s16 samples. Returns null
// if too few peaks were found to be worth sending (e.g. silence).
export function makeSignature(samples: Int16Array): SignatureResult | null {
  const { peaksByBand, numberSamples } = generatePeaks(samples);
  const peakCount = peaksByBand.reduce((sum, b) => sum + b.length, 0);
  if (peakCount < 3 || numberSamples <= 0) return null;

  const binary = encodeToBinary(peaksByBand, numberSamples);
  const uri = DATA_URI_PREFIX + base64Encode(binary);
  const samplesMs = Math.trunc((numberSamples / SAMPLE_RATE) * 1000);
  return { uri, samplesMs, peakCount };
}
