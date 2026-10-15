'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AllstarMark } from '@/components/Logo';

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
    <div className="login">
      <div className="login-art">
        <AllstarMark />
        <div><h2>ALLSTAR</h2><p>Executive Ops</p></div>
      </div>
      <div className="login-form">
        <form onSubmit={onSubmit}>
          <div><div className="eyebrow">Private workspace</div><h1 style={{ fontFamily: 'var(--display)', fontStretch: '112%', fontWeight: 800, margin: 0, fontSize: 28 }}>Sign in</h1></div>
          {error && <div className="err" role="alert">{error}</div>}
          <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
          <button className="btn primary" disabled={busy} style={{ justifyContent: 'center', padding: '10px 12px' }}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="hint">Accounts are created by the workspace owner in Supabase. There is no public sign-up.</p>
        </form>
      </div>
    </div>
  );
}
