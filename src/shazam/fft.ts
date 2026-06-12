// Minimal in-place iterative radix-2 Cooley–Tukey FFT.
//
// Used by the Shazam fingerprint generator. `n` must be a power of two. The
// transform runs in place on the supplied real/imaginary buffers. We reuse a
// single pair of scratch buffers across the whole signature pass so the hot
// loop allocates nothing.

let scratchRe: Float64Array | null = null;
let scratchIm: Float64Array | null = null;
let scratchN = 0;

// Precomputed bit-reversal permutation + twiddle factors for the active size.
let revTable: Int32Array | null = null;
let cosTable: Float64Array | null = null;
let sinTable: Float64Array | null = null;

function ensureTables(n: number): void {
  if (scratchN === n && revTable && cosTable && sinTable) return;

  scratchRe = new Float64Array(n);
  scratchIm = new Float64Array(n);
  scratchN = n;

  const rev = new Int32Array(n);
  let logN = 0;
  while (1 << logN < n) logN++;
  for (let i = 0; i < n; i++) {
    let x = i;
    let r = 0;
    for (let b = 0; b < logN; b++) {
      r = (r << 1) | (x & 1);
      x >>= 1;
    }
    rev[i] = r;
  }
  revTable = rev;

  // Twiddle factors for the half-size angle set: cos/sin of -2*pi*k/n.
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) {
    const ang = (-2 * Math.PI * k) / n;
    cos[k] = Math.cos(ang);
    sin[k] = Math.sin(ang);
  }
  cosTable = cos;
  sinTable = sin;
}

// Computes the magnitude-squared spectrum of a real input signal of length `n`
// (power of two), writing `n/2 + 1` bins into `out`. `out[bin] = re^2 + im^2`.
export function realPowerSpectrum(
  input: Float64Array,
  n: number,
  out: Float64Array,
): void {
  ensureTables(n);
  const re = scratchRe as Float64Array;
  const im = scratchIm as Float64Array;
  const rev = revTable as Int32Array;
  const cos = cosTable as Float64Array;
  const sin = sinTable as Float64Array;

  // Load input into bit-reversed order; imaginary part is zero.
  for (let i = 0; i < n; i++) {
    re[i] = input[rev[i]];
    im[i] = 0;
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const step = n / len;
    for (let i = 0; i < n; i += len) {
      let twiddle = 0;
      for (let j = 0; j < half; j++) {
        const wRe = cos[twiddle];
        const wIm = sin[twiddle];
        const a = i + j;
        const b = a + half;
        const vRe = re[b] * wRe - im[b] * wIm;
        const vIm = re[b] * wIm + im[b] * wRe;
        re[b] = re[a] - vRe;
        im[b] = im[a] - vIm;
        re[a] += vRe;
        im[a] += vIm;
        twiddle += step;
      }
    }
  }

  const bins = (n >> 1) + 1;
  for (let k = 0; k < bins; k++) {
    out[k] = re[k] * re[k] + im[k] * im[k];
  }
}
