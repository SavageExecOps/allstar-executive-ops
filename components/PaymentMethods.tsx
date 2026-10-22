'use client';

import { useEffect, useState } from 'react';
import { RecordDrawer, type Field } from '@/components/RecordBoard';
import { useTable, type Row } from '@/lib/useTable';

type Method = Row & { label: string; institution: string | null; last4: string | null; notes: string | null };

const fields: Field[] = [
  { key: 'label', label: 'Name', required: true, placeholder: 'Wylie’s Amex, Office debit, Zelle…' },
  { key: 'institution', label: 'Type / bank', placeholder: 'Amex, Chase Visa, Zelle…' },
  { key: 'last4', label: 'Last 4 digits', placeholder: '1234' },
  { key: 'notes', label: 'Details', type: 'textarea', placeholder: 'What it pays for, billing zip, who to ask…',
    hint: 'Never a full card number, CVV or login. Last 4 is enough to find the card.' },
];
// 13+ digits in a row (spaces/dashes allowed) looks like a full card or account number.
const looksLikeFullNumber = (s: unknown) => /(?:\d[ -]?){13,}/.test(String(s ?? ''));

/** Payment methods, blurred until clicked. Re-blurs after 30 seconds or when you click again. */
export function PaymentMethods() {
  const t = useTable<Method>('financial_accounts', { col: 'label', asc: true });
  const [shown, setShown] = useState<string | null>(null);
  const [open, setOpen] = useState<Method | 'new' | null>(null);
  useEffect(() => {
    if (!shown) return;
    const i = setTimeout(() => setShown(null), 30_000);
    return () => clearTimeout(i);
  }, [shown]);

  return (
    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-h">
        <h2 className="sec">Payment methods <span className="n">{t.rows.length}</span></h2>
        <button className="btn sm" onClick={() => setOpen('new')}>Add</button>
      </div>
      {t.ready && t.rows.length === 0 && <div className="empty">None yet. Add the cards and accounts you pay things with.</div>}
      <div className="pm-grid">
        {t.rows.map(m => {
          const on = shown === m.id;
          return (
            <div key={m.id} className={`pm ${on ? 'on' : ''}`}>
              <div className="pm-h">
                <span className="pm-name">{m.label}</span>
                <button className="link" onClick={() => setOpen(m)} aria-label={`Edit ${m.label}`}>Edit</button>
              </div>
              <button type="button" className="pm-body" onClick={() => setShown(on ? null : m.id)} aria-pressed={on}
                aria-label={on ? `Hide ${m.label} details` : `Show ${m.label} details`}>
                <span className="pm-secret" aria-hidden={!on}>
                  <span>{m.institution ?? '—'}{m.last4 ? ` ···· ${m.last4}` : ''}</span>
                  {m.notes && <span className="pm-notes">{m.notes}</span>}
                </span>
                {!on && <span className="pm-tap">Click to show</span>}
              </button>
            </div>
          );
        })}
      </div>
      {open && (
        <RecordDrawer t={t} noun="payment method" fields={fields} row={open === 'new' ? null : open}
          defaults={{} as Partial<Method>} titleOf={m => m.label} onClose={() => setOpen(null)}
          validate={n => {
            if (n.last4 && !/^\d{4}$/.test(String(n.last4))) return 'Last 4 has to be exactly four digits.';
            if (looksLikeFullNumber(n.notes) || looksLikeFullNumber(n.institution) || looksLikeFullNumber(n.label)) return 'That looks like a full card or account number. Keep just the last 4.';
            if (/\b(cvv|cvc|security code|password|pin)\b/i.test(String(n.notes ?? ''))) return 'Leave CVVs, PINs and passwords out of here.';
            return null;
          }} />
      )}
    </section>
  );
}
