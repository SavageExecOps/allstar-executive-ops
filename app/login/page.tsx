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

  return (
    <div className="gate">
      <header className="gate-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/allstar-wordmark-white.png" alt="ALL-STAR" width={200} height={37} />
        <span className="gate-unit">EXECUTIVE OPS</span>
      </header>

      <div className="gate-stage">
        <div className="gate-art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gate-pegasus" src="/allstar-pegasus-white.png" alt="" aria-hidden="true" width={601} height={534} />
          <p className="gate-motto">Authorized crew only.</p>
        </div>

        <form className="gate-card" onSubmit={onSubmit}>
          <div>
            <div className="gate-eyebrow">Private workspace</div>
            <h1>Sign in</h1>
          </div>
          {error && <div className="gate-err" role="alert">{error}</div>}
          <div className="gate-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="gate-field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button className="gate-btn" disabled={busy}>{busy ? 'Signing in…' : 'Take the wheel'}</button>
          <p className="gate-hint">No public sign-up. Accounts are created by the workspace owner.</p>
        </form>
      </div>
    </div>
  );
}
