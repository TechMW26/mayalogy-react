import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { bootLegacyMayalogy } from './legacyLoader.js';
import { LEGACY_SHELL_HTML } from './legacyShell.js';

const GENERATED_ICON = '/images/maya-logo.png';

function SplashScreen() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const firstTimer = window.setTimeout(() => setStep(1), 500);
    const secondTimer = window.setTimeout(() => setStep(2), 2500);

    return () => {
      window.clearTimeout(firstTimer);
      window.clearTimeout(secondTimer);
    };
  }, []);

  const infinityPath = 'M100,100 C145,60 190,60 190,100 C190,140 145,140 100,100 C55,60 10,60 10,100 C10,140 55,140 100,100 Z';
  const iconPath = 'M100,40 C150,40 160,50 160,100 C160,150 150,160 100,160 C50,160 40,150 40,100 C40,50 50,40 100,40 Z';

  return (
    <div
      style={{
        width: '180px',
        height: '180px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', filter: 'url(#neonGlow)' }}>
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4AF37" />
            <stop offset="50%" stopColor="#F9E29C" />
            <stop offset="100%" stopColor="#D4AF37" />
          </linearGradient>

          <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <clipPath id="iconClip">
            <path d={iconPath} />
          </clipPath>
        </defs>

        <motion.image
          href={GENERATED_ICON}
          xlinkHref={GENERATED_ICON}
          x="40"
          y="40"
          width="120"
          height="120"
          preserveAspectRatio="xMidYMid slice"
          initial={{ opacity: 0 }}
          animate={{ opacity: step >= 2 ? 1 : 0 }}
          transition={{ duration: 1, ease: 'linear' }}
          clipPath="url(#iconClip)"
        />

        <motion.path
          d={step >= 2 ? iconPath : infinityPath}
          stroke="url(#goldGradient)"
          strokeWidth="3"
          fill="transparent"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{
            pathLength: step >= 1 ? 1 : 0,
            d: step >= 2 ? iconPath : infinityPath,
          }}
          transition={{
            pathLength: { duration: 1.5, ease: 'easeInOut' },
            d: { duration: 1, ease: [0.4, 0, 0.2, 1] },
          }}
        />
      </svg>
    </div>
  );
}

export default function App() {
  const [bootError, setBootError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    bootLegacyMayalogy().catch((error) => {
      console.error('Failed to boot Mayalogy legacy runtime:', error);
      if (!cancelled) {
        setBootError(error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div id="preloader" className="maya-splash">
        <div id="splash-root">
          <SplashScreen />
        </div>
      </div>

      <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: LEGACY_SHELL_HTML }} />

      {bootError ? (
        <div className="position-fixed bottom-0 start-50 translate-middle-x p-3" style={{ zIndex: 10000 }}>
          <div className="alert alert-danger shadow-sm mb-0" role="alert">
            Failed to start Mayalogy. Check the browser console for the script that did not load.
          </div>
        </div>
      ) : null}
    </>
  );
}
