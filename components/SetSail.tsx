'use client';

import { useEffect, useState } from 'react';

const KEY = 'aeo.sail';
const SHIP = '/sail/ship.webp';
const FOG = '/sail/fog.webp';
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// The ship takes about 2s to cross; we change pages as its stern clears the screen.
const GO = 1900;

/** "Set sail": the screen goes dark, smoke rolls in and the ship sails through it. Click to skip. */
export function SetSailIntro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    if (reduced()) { onDone(); return; }
    const t = setTimeout(() => {
      try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
      onDone();
    }, GO);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="ss-stage" role="presentation" onClick={onDone}>
      <div className="ss-fog f1" />
      <div className="ss-glow" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ss-ship" src={SHIP} alt="" aria-hidden="true" />
      <div className="ss-fog f2" />
      <div className="ss-fog f3" />
    </div>
  );
}

/** Keeps the ship and smoke in the browser cache so they show instantly. Render it next to the button. */
export function SetSailPreload() {
  const hide = { position: 'absolute' as const, width: 1, height: 1, opacity: 0, pointerEvents: 'none' as const };
  return <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={SHIP} alt="" aria-hidden="true" style={hide} />
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={FOG} alt="" aria-hidden="true" style={hide} />
  </>;
}

/** In the app shell: the smoke clears off the new page. */
export function SetSailReveal() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let at = 0;
    try { at = Number(sessionStorage.getItem(KEY) || 0); sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    if (at && Date.now() - at < 8000 && !reduced()) {
      setOn(true);
      const t = setTimeout(() => setOn(false), 1400);
      return () => clearTimeout(t);
    }
  }, []);
  if (!on) return null;
  return (
    <div className="ss-stage ss-out" role="presentation" onClick={() => setOn(false)}>
      <div className="ss-dark" />
      <div className="ss-fog o1" />
      <div className="ss-fog o2" />
    </div>
  );
}
