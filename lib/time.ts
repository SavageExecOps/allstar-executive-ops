// All dates are reckoned in Central Time, regardless of where the browser is.
export const TZ = 'America/Chicago';

export function ctNow(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const o: Record<string, string> = {};
  f.formatToParts(d).forEach(p => { o[p.type] = p.value; });
  return { iso: `${o.year}-${o.month}-${o.day}`, h: Number(o.hour) % 24, m: Number(o.minute) };
}
export const today = () => ctNow().iso;
export const minutesNow = () => { const p = ctNow(); return p.h * 60 + p.m; };

export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export const weekday = (iso: string) => new Date(iso + 'T12:00:00Z').getUTCDay();
export const endOfWeek = (iso: string) => addDays(iso, (7 - weekday(iso)) % 7);

export function fmtDate(iso: string | null | undefined, opt: Intl.DateTimeFormatOptions = {}) {
  if (!iso) return '';
  return new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', ...opt });
}
export function relDate(iso: string | null | undefined) {
  if (!iso) return '';
  const t = today();
  if (iso === t) return 'Today';
  if (iso === addDays(t, 1)) return 'Tomorrow';
  if (iso === addDays(t, -1)) return 'Yesterday';
  const diff = Math.round((Date.parse(iso) - Date.parse(t)) / 864e5);
  if (diff > 1 && diff < 7) return fmtDate(iso, { weekday: 'short' });
  return fmtDate(iso);
}
export const fmtStamp = (s: string) =>
  new Date(s).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const fmtClock = (s: string) =>
  new Date(s).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
export const dayOf = (stamp: string) => ctNow(new Date(stamp)).iso;

export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export function fmt12(t: string) {
  const [H, m] = t.split(':').map(Number);
  return `${H % 12 || 12}:${String(m).padStart(2, '0')} ${H >= 12 ? 'PM' : 'AM'}`;
}
export function fmtSecs(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0');
}
