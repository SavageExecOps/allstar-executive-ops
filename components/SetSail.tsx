'use client';

import { useEffect, useState } from 'react';

const KEY = 'aeo.sail';
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** An original three-masted ship, gold on black. */
function Ship() {
  return (
    <svg viewBox="0 0 640 520" className="ss-ship-svg" aria-hidden="true">
      <g fill="none" stroke="#C9A766" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
        {/* masts */}
        <path d="M200 400V90M330 400V40M450 400V110" />
        {/* sails: billowing forward */}
        <path d="M200 110c48 22 56 74 40 120H200z" fill="#F2F2EF" stroke="#F2F2EF" />
        <path d="M200 250c56 20 66 70 48 108H200z" fill="#E8E5DC" stroke="#E8E5DC" />
        <path d="M330 62c62 26 72 92 52 150H330z" fill="#F2F2EF" stroke="#F2F2EF" />
        <path d="M330 232c68 24 78 82 56 128H330z" fill="#E8E5DC" stroke="#E8E5DC" />
        <path d="M450 130c40 18 46 62 32 98H450z" fill="#F2F2EF" stroke="#F2F2EF" />
        <path d="M450 248c46 18 52 60 36 92H450z" fill="#E8E5DC" stroke="#E8E5DC" />
        {/* bowsprit + jib */}
        <path d="M560 395L630 330" />
        <path d="M450 130L626 334L470 350z" fill="#D9D5CA" stroke="#D9D5CA" strokeWidth="3" />
        {/* flags */}
        <path d="M330 40l44 12-44 12z" fill="#C9A766" />
        <path d="M200 90l30 9-30 9z" fill="#C9A766" />
        {/* hull */}
        <path d="M70 392h520c-14 46-50 78-104 86H178c-56-6-92-38-108-86z" fill="#C9A766" />
        <path d="M96 420h460" stroke="#0B0B0B" strokeWidth="4" />
        <path d="M140 444h380" stroke="#0B0B0B" strokeWidth="3" opacity=".6" />
        {/* stern castle */}
        <path d="M70 392V360h96v32" fill="#B99555" />
      </g>
    </svg>
  );
}

function Droplets({ n = 22, delay = 0 }: { n?: number; delay?: number }) {
  return (
    <div className="ss-drops" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI - Math.PI; // upper half-circle
        const d = 180 + ((i * 53) % 220);
        return <i key={i} style={{ ['--dx' as string]: `${Math.cos(a) * d}px`, ['--dy' as string]: `${Math.sin(a) * d}px`, ['--s' as string]: `${12 + (i * 7) % 26}px`, animationDelay: `${delay + (i % 5) * 18}ms` }} />;
      })}
    </div>
  );
}

const Wave = ({ className }: { className: string }) => (
  <div className={className} aria-hidden="true">
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none"><path d="M0 60c120-50 240-50 360 0s240 50 360 0 240-50 360 0 240 50 360 0v60H0z" /></svg>
    <div className="ss-wall" />
  </div>
);

/**
 * The "Set sail" launch: the ship crashes through, the water rises over the screen,
 * then the page you go to washes in. Click anywhere to skip. Off when reduced motion is on.
 */
export function SetSailIntro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    if (reduced()) { onDone(); return; }
    try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="ss-stage" role="presentation" onClick={onDone}>
      <div className="ss-ship"><Ship /></div>
      <div className="ss-crash"><Droplets n={36} delay={1050} /></div>
      <Wave className="ss-wave-in" />
    </div>
  );
}

/** Mounted in the app shell: if you just set sail, the water washes away to reveal the page. */
export function SetSailReveal() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let at = 0;
    try { at = Number(sessionStorage.getItem(KEY) || 0); sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    if (at && Date.now() - at < 8000 && !reduced()) {
      setOn(true);
      const t = setTimeout(() => setOn(false), 1100);
      return () => clearTimeout(t);
    }
  }, []);
  if (!on) return null;
  return (
    <div className="ss-stage ss-out" role="presentation" onClick={() => setOn(false)}>
      <Wave className="ss-wave-out" />
      <div className="ss-splash"><Droplets n={28} delay={80} /></div>
    </div>
  );
}
