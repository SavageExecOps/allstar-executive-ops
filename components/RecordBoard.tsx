'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useData } from '@/components/DataProvider';
import { fromLocalInput, toLocalInput } from '@/components/RecruitDrawer';
import { money, type Row, type useTable } from '@/lib/useTable';
import { fmtDate } from '@/lib/time';

export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'date' | 'datetime' | 'number' | 'money' | 'select' | 'bool';
  options?: readonly string[] | { value: string; label: string }[];
  full?: boolean;
  required?: boolean;
  placeholder?: string;
  hint?: string;
};
export type Column<T> = { label: string; key?: string; render?: (r: T) => ReactNode; className?: string };
export type Group<T> = { label: string; filter: (r: T) => boolean };

const GOOD = /^(paid|completed|ready|active|confirmed|connected|stocked|answered|closed|done|deal closed)$/i;
const BAD = /^(overdue|out|disputed|escalated|at risk|disconnected|defaulted|declined)$/i;
const WAIT = /(waiting|awaiting|pending|proposed|requested|request received)/i;
const WARN = /^(low|needs reconnect|removal required|contact required|partially paid)$/i;
export function pillClass(s: unknown) {
  const v = String(s ?? '');
  return GOOD.test(v) ? 'ok' : BAD.test(v) ? 'crit' : WARN.test(v) ? 'high' : WAIT.test(v) ? 'wait' : '';
}
export const StatusPill = ({ s }: { s: unknown }) => s ? <span className={`pill ${pillClass(s)}`}>{String(s)}</span> : null;

/** Show a value the way its field type reads best. */
export function show(f: Field | undefined, v: unknown): ReactNode {
  if (v == null || v === '') return <span style={{ color: 'var(--fg3)' }}>—</span>;
  switch (f?.type) {
    case 'money': return money(v);
    case 'date': return fmtDate(String(v));
    case 'datetime': return new Date(String(v)).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    case 'bool': return v ? 'Yes' : 'No';
    default: return String(v);
  }
}

type Table<T extends Row> = ReturnType<typeof useTable<T>>;

export function RecordBoard<T extends Row>({
  t, noun, fields, columns, groups, defaults = {}, validate, warn, extra, titleOf, empty, sort, newLabel, toolbar,
}: {
  t: Table<T>;
  noun: string;
  fields: Field[];
  columns: Column<T>[];
  groups?: Group<T>[];
  defaults?: Partial<T> | (() => Partial<T>);
  validate?: (next: Partial<T>, prev: T | null) => string | null;
  warn?: (next: Partial<T>, all: T[]) => string | null;
  extra?: (r: T) => ReactNode;
  titleOf: (r: T) => string;
  empty?: string;
  sort?: (a: T, b: T) => number;
  newLabel?: string;
  toolbar?: ReactNode;
}) {
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState<T | 'new' | null>(null);
  const list = useMemo(() => {
    const base = groups ? t.rows.filter(groups[tab]?.filter ?? (() => true)) : t.rows;
    return sort ? [...base].sort(sort) : base;
  }, [t.rows, groups, tab, sort]);
  const byKey = useMemo(() => Object.fromEntries(fields.map(f => [f.key, f])), [fields]);

  if (t.missing) return <div className="empty">This section needs the latest database update. Run <b>0007_phase2.sql</b> in Supabase (see SETUP.md).</div>;

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        {groups ? (
          <div className="tabs" role="tablist" style={{ margin: 0, borderBottom: 0 }}>
            {groups.map((g, i) => (
              <button key={g.label} role="tab" aria-selected={tab === i} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>
                {g.label}<span className="c">{t.rows.filter(g.filter).length}</span>
              </button>
            ))}
          </div>
        ) : <span />}
        <div className="toolbar" style={{ margin: 0 }}>
          {toolbar}
          <button className="btn primary sm" onClick={() => setOpen('new')}>{newLabel ?? `Add ${noun}`}</button>
        </div>
      </div>
      {!t.ready ? <div className="empty">Loading…</div> : list.length === 0 ? <div className="empty">{empty ?? `Nothing here yet.`}</div> : (
        <div className="scroll-x">
          <table className="ttable rb">
            <thead><tr>{columns.map(c => <th key={c.label}>{c.label}</th>)}</tr></thead>
            <tbody>
              {list.map(r => (
                <tr key={r.id} onClick={() => setOpen(r)} className="rb-row" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setOpen(r); }}>
                  {columns.map((c, i) => (
                    <td key={c.label} className={c.className ?? (i === 0 ? 'tt' : '')} data-label={c.label}>
                      {c.render ? c.render(r) : show(byKey[c.key!], r[c.key!])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <RecordDrawer t={t} noun={noun} fields={fields} row={open === 'new' ? null : open}
          defaults={typeof defaults === 'function' ? defaults() : defaults}
          validate={validate} warn={warn} extra={extra} titleOf={titleOf} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

function toForm(f: Field, v: unknown) {
  if (f.type === 'bool') return !!v;
  if (f.type === 'datetime') return toLocalInput((v as string) ?? null);
  return v == null ? '' : String(v);
}
function fromForm(f: Field, v: unknown) {
  if (f.type === 'bool') return !!v;
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (f.type === 'number' || f.type === 'money') { const n = Number(s.replace(/[$,]/g, '')); return Number.isFinite(n) ? n : null; }
  if (f.type === 'datetime') return fromLocalInput(s);
  return s;
}

export function RecordDrawer<T extends Row>({ t, noun, fields, row, defaults, validate, warn, extra, titleOf, onClose }: {
  t: Table<T>; noun: string; fields: Field[]; row: T | null; defaults: Partial<T>;
  validate?: (next: Partial<T>, prev: T | null) => string | null;
  warn?: (next: Partial<T>, all: T[]) => string | null;
  extra?: (r: T) => ReactNode; titleOf: (r: T) => string; onClose: () => void;
}) {
  const { toast } = useData();
  const src = (row ?? defaults) as Record<string, unknown>;
  const [f, setF] = useState<Record<string, unknown>>(() => Object.fromEntries(fields.map(x => [x.key, toForm(x, src[x.key])])));
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const next = useMemo(() => {
    const o: Record<string, unknown> = {};
    for (const x of fields) o[x.key] = fromForm(x, f[x.key]);
    if (!row) for (const [k, v] of Object.entries(defaults)) if (!(k in o)) o[k] = v;
    return o as Partial<T>;
  }, [f, fields, row, defaults]);
  const warning = warn?.(next, t.rows.filter(r => r.id !== row?.id));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const missing = fields.find(x => x.required && (next as Record<string, unknown>)[x.key] == null);
    if (missing) { setErr(`${missing.label} is required.`); return; }
    const v = validate?.(next, row);
    if (v) { setErr(v); return; }
    setSaving(true);
    const ok = row ? await t.update(row.id, next) : !!(await t.create(next));
    setSaving(false);
    if (ok) { toast('Saved'); onClose(); }
  }

  const set = (k: string, v: unknown) => { setErr(null); setF(s => ({ ...s, [k]: v })); };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer drawer-wide" role="dialog" aria-label={row ? titleOf(row) : `New ${noun}`}>
        <header><span className="eyebrow" style={{ margin: 0 }}>{row ? noun : `New ${noun}`}</span><button className="btn sm ghost" onClick={onClose}>Close</button></header>
        <div className="body">
        <form id="rbf" onSubmit={save} className="rb-form">
          {err && <div className="rb-err" role="alert">{err}</div>}
          {warning && <div className="rb-warn" role="status">{warning}</div>}
          <div className="fgrid">
            {fields.map(x => {
              const id = `rb-${x.key}`;
              const v = f[x.key];
              const full = x.full || x.type === 'textarea';
              return (
                <div key={x.key} className={`field ${full ? 'full' : ''}`}>
                  {x.type === 'bool' ? (
                    <label className="check" htmlFor={id} style={{ fontSize: 13, color: 'var(--fg)', letterSpacing: 0 }}>
                      <input type="checkbox" id={id} checked={!!v} onChange={e => set(x.key, e.target.checked)} /> {x.label}
                    </label>
                  ) : <label htmlFor={id}>{x.label}{x.required ? ' *' : ''}</label>}
                  {x.type === 'textarea' ? <textarea id={id} rows={3} value={String(v)} placeholder={x.placeholder} onChange={e => set(x.key, e.target.value)} />
                    : x.type === 'select' ? (
                      <select id={id} value={String(v)} onChange={e => set(x.key, e.target.value)}>
                        {!x.required && <option value="">—</option>}
                        {(x.options ?? []).map(o => typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : x.type === 'bool' ? null
                    : <input id={id} type={x.type === 'date' ? 'date' : x.type === 'datetime' ? 'datetime-local' : 'text'}
                        inputMode={x.type === 'number' || x.type === 'money' ? 'decimal' : undefined}
                        value={String(v)} placeholder={x.placeholder ?? (x.type === 'money' ? '$0.00' : undefined)} onChange={e => set(x.key, e.target.value)} />}
                  {x.hint && <span className="hint" style={{ marginTop: 2 }}>{x.hint}</span>}
                </div>
              );
            })}
          </div>
        </form>
          {row && extra?.(row)}
          {row && (
            <div>
              {!confirmDel ? <button type="button" className="link" style={{ color: 'var(--crit)' }} onClick={() => setConfirmDel(true)}>Delete {noun}</button> : (
                <span className="check">Delete permanently?
                  <button type="button" className="btn sm" style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }} onClick={async () => { if (await t.remove(row.id)) { toast('Deleted'); onClose(); } }}>Delete</button>
                  <button type="button" className="btn sm ghost" onClick={() => setConfirmDel(false)}>Keep</button>
                </span>
              )}
            </div>
          )}
        </div>
        <footer><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="rbf" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></footer>
      </aside>
    </>
  );
}

/** Page header + optional stat strip shared by the modules. */
export function ModuleHead({ eyebrow, title, sub, stats }: { eyebrow: string; title: string; sub: string; stats?: { n: ReactNode; l: string; tone?: string }[] }) {
  return (
    <>
      <div className="ph"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="sub">{sub}</p></div></div>
      {stats && (
        <div className="mstats">
          {stats.map(s => <div key={s.l} className={`stat ${s.tone ?? ''}`}><span className="stat-n">{s.n}</span><span className="stat-l">{s.l}</span></div>)}
        </div>
      )}
    </>
  );
}
