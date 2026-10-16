'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setError(error.message === 'Invalid login credentials' ? 'That email and password don’t match an account.' : error.message); return; }
    router.replace('/');
    router.refresh();
  }

  // Same stage as the home page: Pegasus in the background, ALL-STAR top left.
  return (
    <div className="home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="home-watermark" src="/allstar-pegasus-white.png" alt="" aria-hidden="true" width={601} height={534} />
      <header className="home-top">
        <div className="home-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/allstar-wordmark-white.png" alt="ALL-STAR" width={240} height={44} />
          <span className="home-rule" aria-hidden="true" />
          <span className="home-unit">EXECUTIVE OPS</span>
        </div>
      </header>

      <main className="home-main">
        <div className="home-hero">
          <div className="home-date">Private workspace</div>
          <h1>Authorized<br />crew only.</h1>
        </div>

        <form className="gate-form" onSubmit={onSubmit}>
          {error && <div className="gate-err" role="alert">{error}</div>}
          <div className="gate-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="gate-field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="home-ctas">
            <button className="home-cta" disabled={busy}>
              {busy ? 'Boarding…' : 'Come aboard'}
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
          <p className="gate-hint">No public sign-up. Accounts are created by the workspace owner.</p>
        </form>
      </main>
    </div>
  );
}
