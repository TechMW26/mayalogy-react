import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Path, Skia, type SkPath } from '@shopify/react-native-skia';

type BlobVisualizerProps = {
  /**
   * Reference size used to derive sphere radius and particle density.
   * Treat this as the visual diameter of the blob — NOT the canvas size.
   */
  size?: number;
  /** Drawing canvas width. Defaults to `size`. Keep this larger than
   * `size` so the burst dispersion (~180 px) isn't clipped on the sides. */
  width?: number;
  /** Drawing canvas height. Defaults to `size`. */
  height?: number;
  /** 0..1 smoothed mic level driving particle dispersion. */
  intensity: number;
  accent?: string;
  accentSoft?: string;
  ink?: string;
};

// ---------------------------------------------------------------------------
// Faithful port of the particle reference (blob.html):
//
//   Many small black dots arranged on a slowly rotating sphere. When the
//   mic is quiet, the dots collapse into a thin orbiting ring with
//   pulsation + sporadic dispersion. When audio is present, the dots burst
//   outward from the sphere surface along their own radial vector, then
//   ease back. Always rendered at the active output (Bluetooth speaker
//   for our case).
//
// The reference is canvas-based and draws each particle independently.
// In React Native we use react-native-skia with a single Path composed of
// many addCircle() sub-paths \u2014 one draw call per frame, so 1000+ particles
// stay smooth on mid-range Android devices.
// ---------------------------------------------------------------------------

type Particle = {
  baseX: number;
  baseY: number;
  baseZ: number;
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
  oscSeed1: number;
  oscSeed2: number;
  oscSeed3: number;
  randDX: number;
  randDY: number;
  randDZ: number;
};

const SILENCE_THRESHOLD = 0.001;
const RING_RADIUS_FRAC = 0.30;
const RING_THICKNESS_FRAC = 0.04;
const RING_DISPERSE_AMOUNT = 35;
const RING_ROTATION_SPEED = 0.8;
const FOLLOW = 0.20;
const DOT_MIN = 0.45;
const DOT_MAX = 1.15;
const ROTATION_SPEED = 0.22;

function initParticles(count: number, radius: number): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    // Tiny jitter so the surface isn't a perfect grid.
    const jitter = Math.random() * 0.5;
    const finalTheta = theta + (Math.random() - 0.5) * jitter;
    const finalPhi = Math.max(
      0.05,
      Math.min(Math.PI - 0.05, phi + (Math.random() - 0.5) * jitter * 0.5),
    );

    const x = radius * Math.sin(finalPhi) * Math.cos(finalTheta);
    const z = radius * Math.sin(finalPhi) * Math.sin(finalTheta);
    const y = radius * Math.cos(finalPhi);

    // Uniform random unit vector for "stop mode" bursts (kept for parity
    // even though we don't expose stop mode in the public API).
    const uTheta = Math.random() * Math.PI * 2;
    const uZ = Math.random() * 2 - 1;
    const uR = Math.sqrt(1 - uZ * uZ);

    out.push({
      baseX: x,
      baseY: y,
      baseZ: z,
      x,
      y,
      z,
      size: DOT_MIN + Math.random() * (DOT_MAX - DOT_MIN),
      alpha: 0.38 + Math.random() * 0.55,
      oscSeed1: Math.random() * Math.PI * 2,
      oscSeed2: Math.random() * Math.PI * 2,
      oscSeed3: Math.random() * Math.PI * 2,
      randDX: uR * Math.cos(uTheta),
      randDY: uR * Math.sin(uTheta),
      randDZ: uZ,
    });
  }
  return out;
}

export default function BlobVisualizer({
  size = 300,
  width,
  height,
  intensity,
}: BlobVisualizerProps) {
  const canvasW = width ?? size;
  const canvasH = height ?? size;

  // Live intensity ref so the rAF loop reads fresh values without
  // re-binding.
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  // Smoothed mic level, plus a separate silence-onset timer for the ring
  // transition.
  const smoothedRef = useRef(0);
  const silenceStartRef = useRef(0);
  const ringPhaseRef = useRef(0);

  // Particles allocated once for a given size.
  const particlesRef = useRef<Particle[]>([]);
  if (particlesRef.current.length === 0) {
    // Tune particle count vs. size. The reference uses 1800 on mobile; we
    // run inside a 300x300 view so ~700 is plenty visually and renders
    // smoothly.
    const count = Math.max(400, Math.min(1200, Math.round(size * 2.5)));
    const sphereR = size * 0.22;
    particlesRef.current = initParticles(count, sphereR);
  }

  // We re-render only when the path object identity changes. The path
  // itself is rebuilt every frame via Skia.Path.Make().
  const [path, setPath] = useState<SkPath>(() => Skia.Path.Make());

  useEffect(() => {
    let rafId = 0;
    const persp = size * 3.2; // matches the ratio in the reference (950 px for ~290 px sphere)
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    let lastFrame = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;

      // Two-stage low-pass on the raw mic so the field doesn't twitch.
      smoothedRef.current +=
        (intensityRef.current - smoothedRef.current) * 0.18;
      const audioLevel = Math.max(0, Math.min(1, smoothedRef.current));

      const isInSilenceMode = audioLevel < SILENCE_THRESHOLD;
      if (isInSilenceMode) {
        if (silenceStartRef.current === 0) silenceStartRef.current = now;
      } else {
        silenceStartRef.current = 0;
      }

      ringPhaseRef.current += dt * RING_ROTATION_SPEED * Math.PI * 2;

      const time = now * 0.001 * ROTATION_SPEED;
      const audioTime = now * 0.001;
      const cosY = Math.cos(time);
      const sinY = Math.sin(time);

      const next = Skia.Path.Make();
      const particles = particlesRef.current;

      for (let pi = 0; pi < particles.length; pi++) {
        const p = particles[pi];

        // Slow Y-axis rotation of the base sphere.
        const gx = p.baseX * cosY - p.baseZ * sinY;
        const gz = p.baseX * sinY + p.baseZ * cosY;
        const gy = p.baseY;

        let tx = gx;
        let ty = gy;
        let tz = gz;

        if (isInSilenceMode) {
          // Quiet mode: collapse the sphere into a thin orbiting ring with
          // pulsation + sporadic dispersion. Exactly the reference logic.
          const baseTheta = Math.atan2(p.baseZ, p.baseX);
          const theta = baseTheta + ringPhaseRef.current + p.oscSeed1 * 0.3;

          const pulse1 = Math.sin(audioTime * 12 + p.oscSeed1 * 3) * 0.06;
          const pulse2 = Math.sin(audioTime * 8.5 + p.oscSeed2 * 5) * 0.04;
          const pulseFactor = 1 + pulse1 + pulse2;

          const baseRadius = size * RING_RADIUS_FRAC * pulseFactor;
          const thicknessVar =
            size * RING_THICKNESS_FRAC *
            (0.5 + Math.sin(p.oscSeed2 * 10) * 0.5);
          const ringR =
            baseRadius +
            thicknessVar * Math.sin(p.oscSeed3 * 8 + audioTime * 3);

          const ringX = ringR * Math.cos(theta);
          const ringY = ringR * Math.sin(theta);
          const ringZ = 0;

          const oscAmp = 8 + p.oscSeed1 * 12;
          const oscX =
            Math.sin(audioTime * (2 + p.oscSeed1 * 4) + p.oscSeed1 * 20) *
            oscAmp;
          const oscY =
            Math.sin(audioTime * (1.5 + p.oscSeed2 * 3) + p.oscSeed2 * 20) *
            oscAmp;
          const oscZ =
            Math.sin(audioTime * (2.5 + p.oscSeed3 * 5) + p.oscSeed3 * 20) *
            oscAmp *
            0.3;

          const dispersePhase = Math.sin(
            audioTime * 0.7 + p.oscSeed1 * 15,
          );
          let dispX = 0,
            dispY = 0,
            dispZ = 0;
          if (dispersePhase > 0.5) {
            const dispIntensity = (dispersePhase - 0.5) * RING_DISPERSE_AMOUNT * 2;
            const dispAngle = theta + p.oscSeed2 * 2;
            dispX =
              Math.cos(dispAngle) * dispIntensity * (0.3 + p.oscSeed3 * 0.3);
            dispY =
              Math.sin(dispAngle) * dispIntensity * (0.3 + p.oscSeed1 * 0.3);
            dispZ = (p.oscSeed2 - 0.5) * dispIntensity * 0.2;
          }

          const transitionTime = now - silenceStartRef.current;
          const ringBlend = Math.min(1, transitionTime / 500);

          tx = gx + (ringX + oscX + dispX - gx) * ringBlend;
          ty = gy + (ringY + oscY + dispY - gy) * ringBlend;
          tz = gz + (ringZ + oscZ + dispZ - gz) * ringBlend;
        } else {
          // Loud mode: burst outward along each particle's surface
          // normal, with elastic bounce, scaled by audio level.
          const dist = Math.sqrt(gx * gx + gy * gy + gz * gz);
          let nx: number, ny: number, nz: number;
          if (dist > 0.1) {
            nx = gx / dist;
            ny = gy / dist;
            nz = gz / dist;
          } else {
            nx = p.randDX;
            ny = p.randDY;
            nz = p.randDZ;
          }

          const wavePhase = p.oscSeed1 * Math.PI * 2;
          const waveOffset = Math.sin(audioTime * 8 + wavePhase) * 0.3 + 0.7;
          const baseDisperse = 180 * Math.pow(audioLevel, 0.6);
          const particleVariation = 0.5 + 0.5 * Math.sin(p.oscSeed2 * 15);
          const disperseDistance =
            baseDisperse * particleVariation * waveOffset;

          const elasticFreq = 6 + p.oscSeed3 * 4;
          const elasticPhase = audioTime * elasticFreq + p.oscSeed1 * 10;
          const elasticBounce =
            Math.sin(elasticPhase) *
            Math.exp(-Math.abs(Math.sin(audioTime * 2)) * 0.7);
          const elasticMultiplier = 1 + elasticBounce * 0.25;

          tx = gx + nx * disperseDistance * elasticMultiplier;
          ty = gy + ny * disperseDistance * elasticMultiplier;
          tz = gz + nz * disperseDistance * elasticMultiplier;
        }

        // Critically-damped follower so the particle doesn't snap to its
        // new target each frame.
        p.x += (tx - p.x) * FOLLOW;
        p.y += (ty - p.y) * FOLLOW;
        p.z += (tz - p.z) * FOLLOW;

        // Perspective projection.
        const scale = persp / (persp + p.z);
        if (scale <= 0) continue;

        const sx = cx + p.x * scale;
        const sy = cy + p.y * scale;

        // Depth-based size (further dots are smaller).
        const depth = Math.max(0, Math.min(1, (scale - 0.55) * 1.8));
        const radius = p.size * scale * (0.48 + depth * 0.8);
        if (radius < 0.3) continue;
        next.addCircle(sx, sy, radius);
      }

      setPath(next);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [size, canvasW, canvasH]);

  return (
    <View style={{ width: canvasW, height: canvasH }}>
      <Canvas style={{ flex: 1 }}>
        <Path path={path} color="black" opacity={0.8} />
      </Canvas>
    </View>
  );
}
