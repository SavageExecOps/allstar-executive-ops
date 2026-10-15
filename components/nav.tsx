const P: Record<string, JSX.Element> = {
  cmd: <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />,
  day: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  task: <><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /></>,
  wait: <path d="M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10" />,
  proj: <path d="M3 7h18v13H3zM8 7V4h8v3" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  note: <><path d="M5 3h10l4 4v14H5z" /><path d="M14 3v5h5" /></>,
  recap: <path d="M4 6h16M4 12h10M4 18h7" />,
  rec: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.2 2.6 3.5 5.5" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="1" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  fin: <path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M2 10l10-6 10 6" />,
  debt: <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  lead: <path d="M3 4h18l-7 8v7l-4 2v-9z" />,
  ad: <path d="M3 10v4h4l6 5V5L7 10zM17 8c1.5 1 1.5 7 0 8M20 5c3 3 3 11 0 14" />,
  office: <path d="M4 21V4h11v17M15 9h5v12M8 8h3M8 12h3M8 16h3" />,
  comm: <path d="M4 4h16v12H8l-4 4z" />,
  ai: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />,
  set: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
};
export const Icon = ({ name }: { name: string }) => <svg viewBox="0 0 24 24" aria-hidden="true">{P[name]}</svg>;

export type NavItem = { group: string } | { href: string; label: string; icon: string; phase?: 2 | 3; count?: 'open' | 'waiting' | 'recruits' | 'wylie' };

export const NAV: NavItem[] = [
  { group: 'Today' },
  { href: '/command', label: 'Command Center', icon: 'cmd' },
  { href: '/my-day', label: 'My Day', icon: 'day' },
  { href: '/tasks', label: 'Tasks & Follow-ups', icon: 'task', count: 'open' },
  { href: '/waiting', label: 'Waiting On', icon: 'wait', count: 'waiting' },
  { href: '/wylie', label: 'For Wylie', icon: 'flag', count: 'wylie' },
  { group: 'Work' },
  { href: '/projects', label: 'Projects', icon: 'proj' },
  { href: '/notes', label: 'Notes & Preferences', icon: 'note' },
  { href: '/recaps', label: 'Daily Recaps', icon: 'recap' },
  { group: 'Operations' },
  { href: '/recruiting', label: 'Recruiting', icon: 'rec', count: 'recruits' },
  { href: '/m/calendar', label: 'Wylie’s Calendar', icon: 'cal', phase: 2 },
  { href: '/m/finance', label: 'Finance & Bookkeeping', icon: 'fin', phase: 2 },
  { href: '/m/debt', label: 'Debt Management', icon: 'debt', phase: 2 },
  { href: '/m/leads', label: 'Agent Support & Leads', icon: 'lead', phase: 2 },
  { href: '/m/advertising', label: 'Advertising', icon: 'ad', phase: 2 },
  { href: '/m/office', label: 'Office Operations', icon: 'office', phase: 2 },
  { href: '/m/communications', label: 'Communications', icon: 'comm', phase: 3 },
  { href: '/m/ai', label: 'AI Assistant', icon: 'ai', phase: 3 },
  { group: 'System' },
  { href: '/settings', label: 'Settings', icon: 'set' },
];

export const MODULE_SCOPE: Record<string, { title: string; phase: 2 | 3; items: string[] }> = {
  calendar: { title: 'Wylie’s Calendar', phase: 2, items: [
    'Scheduling request queue: Requested → Awaiting Availability → Proposed → Confirmed → Completed',
    'Direct-report directory and meeting priorities',
    'Back-to-back 30-minute one-on-one grouping; Friday one-on-ones restricted (configurable)',
    'Conflict warnings and a weekly scheduling briefing. Nothing books without approval.'] },
  finance: { title: 'Finance & Bookkeeping', phase: 2, items: [
    'KPA question queue (transactions, W-9s, Zelle details)',
    'QuickBooks connection checklist. Bank accounts and Venmo are already tracked as “Needs reconnect”.',
    'Accounts payable with autopay verification (coffee machine invoices)',
    'Monthly office rent tracker. No banking credentials are ever stored.'] },
  debt: { title: 'Debt Management', phase: 2, items: [
    'Debt ledger, payment history and installment schedules, with balances computed from recorded payments',
    'Identified → Verified → … → Paid workflow, plus Disputed / Escalated / Closed',
    'Overdue alerts and follow-up reminders. Jonathan’s record already exists, amount pending confirmation.',
    'Compensation actions require Wylie’s explicit authorization and are never automated'] },
  leads: { title: 'Agent Support & Leads', phase: 2, items: [
    'ATM free lead program: request inbox, enrollment, closed-deal records, removal queue',
    'Editable program rules; no removals from unverified deal notices',
    'Weekly volume lead readiness for both groups with a Friday reminder'] },
  advertising: { title: 'Advertising', phase: 2, items: [
    'Agent advertising tracker: Requested → Payment Pending → Preparation → Ready → Active',
    'Central view of who is waiting and what is blocking launch'] },
  office: { title: 'Office Operations', phase: 2, items: [
    'Internet project: vendor, quote (expected Oct 19), equipment, install, testing',
    'Lightweight supplies list with reorder thresholds'] },
  communications: { title: 'Communications', phase: 3, items: [
    'Your inbox and Wylie’s inbox side by side (Gmail, once authorized)',
    'Sort into Needs Response, Needs Action, Waiting, Invoice, Scheduling and more',
    'Turn any message into a task; draft replies. Nothing sends without your approval.'] },
  ai: { title: 'AI Assistant', phase: 3, items: [
    'Type updates like “Jonathan still hasn’t paid. Follow up tomorrow.” and it updates the right records',
    'Asks when a record is ambiguous; confirms before money, messages, deletions or calendar changes',
    'Full audit log of every change it makes'] },
};
