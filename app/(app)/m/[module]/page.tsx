import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MODULE_SCOPE } from '@/components/nav';

export function generateStaticParams() {
  return Object.keys(MODULE_SCOPE).map(module => ({ module }));
}

export default function ModulePage({ params }: { params: { module: string } }) {
  const m = MODULE_SCOPE[params.module];
  if (!m) notFound();
  return (
    <>
      <div className="ph">
        <div>
          <div className="eyebrow">Phase {m.phase}</div>
          <h1>{m.title}</h1>
          <p className="sub">This module is next on the build list. Its database tables already exist, so nothing you track now will need to move.</p>
        </div>
      </div>
      <div className="later-box">
        <h2 className="sec">Planned scope</h2>
        <ul>{m.items.map(i => <li key={i}>{i}</li>)}</ul>
        <p className="hint" style={{ marginTop: 16 }}>Related tasks already live in Tasks: <Link className="link" href="/tasks?view=all">open the task list</Link>.</p>
      </div>
    </>
  );
}
