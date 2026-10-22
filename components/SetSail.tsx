'use client';

import { useEffect, useRef, useState } from 'react';

const KEY = 'aeo.sail';
const SPLASH = '/sail/splash.mp4';
const SPLASH_WEBM = '/sail/splash.webm';
const Sources = () => <><source src={SPLASH} type="video/mp4" /><source src={SPLASH_WEBM} type="video/webm" /></>;
// Drop a clean, transparent ship PNG at public/sail/ship.png and set this to '/sail/ship.png'.
const SHIP: string | null = null;
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Timeline (ms): fog rolls in, the water hits at HIT, we change pages at GO and the
// next page picks the same splash up where it left off.
const HIT = 950;
const GO = 1450;

/**
 * "Set sail": the screen goes dark, fog rolls in (and the ship rips through it when there's a
 * ship image), then real water slams the screen. Click to skip. Off with reduced motion.
 */
export function SetSailIntro({ onDone }: { onDone: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [hit, setHit] = useState(false);
  useEffect(() => {
    if (reduced()) { onDone(); return; }
    const a = setTimeout(() => { setHit(true); video.current?.play().catch(() => { /* autoplay blocked: fog only */ }); }, HIT);
    const b = setTimeout(() => {
      try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), t: video.current?.currentTime ?? 0.5 })); } catch { /* ignore */ }
      onDone();
    }, GO);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onDone]);
  return (
    <div className="ss-stage" role="presentation" onClick={onDone}>
      <div className="ss-fog f1" />
      <div className="ss-glow" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {SHIP && <img className="ss-ship" src={SHIP} alt="" aria-hidden="true" />}
      <div className="ss-fog f2" />
      <div className="ss-fog f3" />
      <video ref={video} className={`ss-water ${hit ? 'on' : ''}`} muted playsInline preload="auto" aria-hidden="true"><Sources /></video>
    </div>
  );
}

/** Keeps the splash in the browser cache so it plays instantly. Render it on the page with the button. */
export function SetSailPreload() {
  return <video muted playsInline preload="auto" aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}><Sources /></video>;
}

/** In the app shell: the splash keeps going over the new page, then drains away. */
export function SetSailReveal() {
  const [from, setFrom] = useState<number | null>(null);
  const [going, setGoing] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let v: { at: number; t: number } | null = null;
    try { v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    if (v && Date.now() - v.at < 8000 && !reduced()) {
      setFrom(v.t);
      // Safety net: never hold the page more than 2.5s, even if the video can't play.
      const done = setTimeout(() => setFrom(null), 2500);
      return () => clearTimeout(done);
    }
  }, []);
  useEffect(() => {
    const el = video.current;
    if (from == null || !el) return;
    const start = () => { try { el.currentTime = Math.min(from + 0.05, 1.2); } catch { /* ignore */ } el.play().catch(() => setFrom(null)); };
    // The drain starts only once the water is actually moving, then clears 1.3s later.
    const playing = () => { setGoing(true); setTimeout(() => setFrom(null), 1300); };
    el.addEventListener('playing', playing, { once: true });
    if (el.readyState >= 1) start(); else el.addEventListener('loadedmetadata', start, { once: true });
    return () => el.removeEventListener('playing', playing);
  }, [from]);
  if (from == null) return null;
  return (
    <div className={`ss-stage ss-out ${going ? 'go' : ''}`} role="presentation" onClick={() => setFrom(null)}>
      <div className="ss-dark" />
      <video ref={video} className="ss-water" muted playsInline preload="auto" aria-hidden="true"><Sources /></video>
    </div>
  );
}
