'use client';

import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import { useUI } from '@/components/UI';
import { type Note, type Preference } from '@/lib/types';
import { fmtDate, fmtStamp } from '@/lib/time';
import { PRIVATE, isPrivate } from '@/lib/notes';


function PrefList({ items }: { items: Preference[] }) {
  const { updatePreference, deletePreference, toast } = useData();
  if (!items.length) return <div className="empty">None right now.</div>;
  return (
    <div>
      {items.map(p => (
        <div key={p.id} className="pref-row">
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0 }}>{p.body}</p>
            <div className="meta"><span>{p.category}</span>{p.effective_until && <span>Until {fmtDate(p.effective_until)}</span>}</div>
          </div>
          <div className="qa" style={{ flex: 'none' }}>
            <button className="link" onClick={async () => { if (await updatePreference(p.id, { active: false })) toast('Archived'); }}>Archive</button>
            <button className="link" onClick={async () => { if (await deletePreference(p.id)) toast('Deleted'); }}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const I = {
  pin: <path d="M12 17v5M8 3h8l-1 6 3 3H6l3-3z" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
};
const Ico = ({ d }: { d: JSX.Element }) => <svg viewBox="0 0 24 24" aria-hidden="true">{d}</svg>;

function NoteCard({ n, shown, onToggleShow }: { n: Note; shown: boolean; onToggleShow: () => void }) {
  const { updateNote, deleteNote, toast } = useData();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(n.body);
  const [confirm, setConfirm] = useState(false);
  const [more, setMore] = useState(false);
  const priv = isPrivate(n);
  const long = n.body.length > 280 || n.body.split('\n').length > 6;

  return (
    <article className={`note2 ${n.pinned ? 'pinned' : ''} ${priv ? 'priv' : ''}`}>
      <header className="note2-h">
        <span className="note2-type">{priv && <Ico d={I.lock} />}{n.note_type}{n.department && !priv ? ` · ${n.department}` : ''}</span>
        <span className="note2-acts">
          <button className={`icon-btn ${n.pinned ? 'on' : ''}`} aria-label={n.pinned ? 'Unpin' : 'Pin'} title={n.pinned ? 'Unpin' : 'Pin'} onClick={() => updateNote(n.id, { pinned: !n.pinned })}><Ico d={I.pin} /></button>
          <button className={`icon-btn ${priv ? 'on' : ''}`} aria-label={priv ? 'Make visible' : 'Blur this note'} title={priv ? 'Make visible' : 'Blur this note'}
            onClick={async () => { if (await updateNote(n.id, { department: priv ? null : PRIVATE })) toast(priv ? 'Note is visible' : 'Note blurred'); }}><Ico d={I.lock} /></button>
          <button className="icon-btn" aria-label="Edit" title="Edit" onClick={() => { setBody(n.body); setEditing(true); }}><Ico d={I.edit} /></button>
          <button className="icon-btn" aria-label="Delete" title="Delete" onClick={() => setConfirm(true)}><Ico d={I.trash} /></button>
        </span>
      </header>
      {editing ? (
        <form onSubmit={async e => { e.preventDefault(); const v = body.trim(); if (v && await updateNote(n.id, { body: v })) { toast('Saved'); setEditing(false); } }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea rows={6} value={body} onChange={e => setBody(e.target.value)} autoFocus aria-label="Note" />
          <div className="qa"><button className="btn sm primary">Save</button><button type="button" className="btn sm ghost" onClick={() => setEditing(false)}>Cancel</button></div>
        </form>
      ) : priv && !shown ? (
        <button type="button" className="note2-blur" onClick={onToggleShow} aria-label="Show private note">
          <span className="note2-body blurred" aria-hidden="true">{n.body.slice(0, 220)}</span>
          <span className="note2-tap"><Ico d={I.lock} />Click to show</span>
        </button>
      ) : (
        <>
          <p className={`note2-body ${long && !more ? 'clamp' : ''}`} onClick={priv ? onToggleShow : undefined}>{n.body}</p>
          {long && <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setMore(m => !m)}>{more ? 'Show less' : 'Show more'}</button>}
          {priv && <button className="link" style={{ alignSelf: 'flex-start' }} onClick={onToggleShow}>Hide</button>}
        </>
      )}
      <footer className="note2-f">
        {confirm ? (
          <span className="check">Delete this note?
            <button className="btn sm" style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }} onClick={async () => { if (await deleteNote(n.id)) toast('Note deleted'); }}>Delete</button>
            <button className="btn sm ghost" onClick={() => setConfirm(false)}>Keep</button>
          </span>
        ) : <time>{fmtStamp(n.created_at)}</time>}
      </footer>
    </article>
  );
}

export default function Notes() {
  const { notes, preferences } = useData();
  const { quickAdd } = useUI();
  const [tab, setTab] = useState<'notes' | 'wylie'>('notes');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  // A revealed private note blurs again after 30 seconds.
  useEffect(() => { if (!shown) return; const i = setTimeout(() => setShown(null), 30_000); return () => clearTimeout(i); }, [shown]);

  const active = preferences.filter(p => p.active);
  const types = useMemo(() => Array.from(new Set(notes.map(n => n.note_type))), [notes]);
  const s = q.trim().toLowerCase();
  const list = notes
    .filter(n => (!type || (type === PRIVATE ? isPrivate(n) : n.note_type === type)) && (!s || (!isPrivate(n) && n.body.toLowerCase().includes(s)) || (isPrivate(n) && type === PRIVATE && n.body.toLowerCase().includes(s))))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pinned = list.filter(n => n.pinned);
  const rest = list.filter(n => !n.pinned);
  const card = (n: Note) => <NoteCard key={n.id} n={n} shown={shown === n.id} onToggleShow={() => setShown(shown === n.id ? null : n.id)} />;

  return (
    <>
      <div className="ph">
        <div>
          <div className="eyebrow">Knowledge base</div>
          <h1>Notes</h1>
          <p className="sub">Pin what matters. Lock anything you don’t want on screen; it stays blurred until you click it.</p>
        </div>
        <div className="qa"><button className="btn primary" onClick={() => quickAdd('note')}>New note</button></div>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'notes'} className={tab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')}>Notes<span className="c">{notes.length}</span></button>
        <button role="tab" aria-selected={tab === 'wylie'} className={tab === 'wylie' ? 'on' : ''} onClick={() => setTab('wylie')}>Wylie’s preferences<span className="c">{active.length}</span></button>
      </div>

      {tab === 'wylie' ? (
        <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <section className="panel"><div className="panel-h"><h2 className="sec">Permanent</h2></div><PrefList items={active.filter(p => p.permanence === 'Permanent')} /></section>
          <section className="panel"><div className="panel-h"><h2 className="sec">Temporary rules</h2></div><PrefList items={active.filter(p => p.permanence === 'Temporary')} /></section>
        </div>
      ) : (
        <>
          <div className="notes-bar">
            <input type="text" placeholder="Search notes" aria-label="Search notes" value={q} onChange={e => setQ(e.target.value)} />
            <div className="chips" role="group" aria-label="Filter by type">
              <button className={!type ? 'on' : ''} onClick={() => setType('')}>All</button>
              {types.map(t => <button key={t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>{t}</button>)}
              {notes.some(isPrivate) && <button className={type === PRIVATE ? 'on' : ''} onClick={() => setType(PRIVATE)}>Locked</button>}
            </div>
          </div>
          {list.length === 0 && <div className="empty">{notes.length ? 'No notes match.' : 'No notes yet. Use “New note” or press N.'}</div>}
          {pinned.length > 0 && <>
            <h2 className="sec notes-h">Pinned</h2>
            <div className="notes2">{pinned.map(card)}</div>
          </>}
          {rest.length > 0 && <>
            {pinned.length > 0 && <h2 className="sec notes-h">Everything else</h2>}
            <div className="notes2">{rest.map(card)}</div>
          </>}
        </>
      )}
    </>
  );
}
