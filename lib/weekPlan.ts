// The weekly game plan. My Day shows the blocks for today; loading the plan
// (My Day banner or Settings → Weekly schedule) writes these into your schedule.
// Times are Central. Recruiting blocks match the iClosed availability.
import type { ScheduleBlock } from '@/lib/types';

type Row = Pick<ScheduleBlock, 'start_time' | 'end_time' | 'title' | 'description' | 'departments' | 'is_protected' | 'is_recap'>;
const b = (start_time: string, end_time: string, title: string, description: string, departments: string[] = [], extra: Partial<Row> = {}): Row =>
  ({ start_time, end_time, title, description, departments, is_protected: false, is_recap: false, ...extra });

const OPEN = b('09:00', '09:30', 'Open the day', 'Command Center, My Day, overnight bookings, answer overnight DMs, your inbox and Wylie’s.', ['Communications']);
const WYLIE = b('09:30', '11:00', 'Wylie block', 'His calendar requests, Waiting On, follow-ups, anything urgent. Add to For Wylie as things come up.', ['Executive']);
const REC_AM = b('11:00', '12:30', 'Recruiting calls', 'Calls at 11:00, 11:30, 12:00. Notes, manager and group chat intro in the 10 minutes after each call.', ['Recruiting']);
const LUNCH = b('12:30', '13:15', 'Lunch', 'Off the clock.', [], { is_protected: true });
const REC_PM = b('16:00', '17:30', 'Recruiting calls', 'Calls at 4:00, 4:30, 5:00. Hand off right after each call.', ['Recruiting']);
const CLOSE = b('17:30', '18:00', 'Close out', 'Last DM check, every “Talked” recruit has a manager, Daily Recap, tomorrow’s top 3.', [], { is_recap: true });
const deep = (title: string, description: string, departments: string[], start = '14:00') => b(start, '16:00', title, description, departments);
const DM = (start = '13:15', end = '14:00') => b(start, end, 'DM block', 'Answer every recruiting DM first, then reach out: follow-ups, people who engaged, old no-shows. Log counts on Recruiting. Goal: booked calls.', ['Recruiting']);

/** Index = weekday (0 Sunday … 6 Saturday). Weekends are off. */
export const WEEK_PLAN: Record<number, Row[]> = {
  1: [OPEN, WYLIE, REC_AM, LUNCH, DM(), deep('Deep work · Finance & Bookkeeping', 'KPA questions, QuickBooks and bank reconnects, bills and autopay checks, rent.', ['Finance']), REC_PM, CLOSE],
  2: [OPEN, WYLIE, REC_AM, LUNCH, DM(), deep('Deep work · Debt Management', 'Payment follow-ups and debt records. Any compensation action goes to Wylie first.', ['Debt']), REC_PM, CLOSE],
  3: [OPEN, WYLIE, REC_AM, LUNCH, DM(), deep('Deep work · Agent Support, Leads & Advertising', 'ATM free lead requests and enrollments, removals from verified deals only, ad requests that are waiting or blocked.', ['Leads', 'Advertising']), REC_PM, CLOSE],
  4: [OPEN, WYLIE, REC_AM,
    b('12:30', '13:00', 'Lunch', 'Short one today: the meeting starts at 1.', [], { is_protected: true }),
    b('13:00', '14:00', 'Mandatory meeting', 'Non-negotiable. Be there.', [], { is_protected: true }),
    DM('14:00', '14:45'),
    deep('Deep work · Office Operations & Projects', 'Internet project, supplies, and moving your Projects list forward.', ['Office', 'Operations'], '14:45'),
    REC_PM, CLOSE],
  5: [
    OPEN,
    b('09:30', '10:00', 'Quick Wylie check', 'Anything urgent before calls start.', ['Executive']),
    b('10:00', '12:00', 'Recruiting calls', 'Calls at 10:00, 10:30, 11:00, 11:30.', ['Recruiting']),
    b('12:00', '12:45', 'Lunch', 'Off the clock.', [], { is_protected: true }),
    b('12:45', '14:00', 'DMs, pipeline & leads', 'DMs first. Then chase no-shows and reschedules, and get weekly volume leads ready for both groups.', ['Recruiting', 'Leads']),
    b('14:00', '16:00', 'Recruiting calls', 'Calls at 2:00, 2:30, 3:00, 3:30.', ['Recruiting']),
    b('16:00', '17:00', 'Wylie wrap', 'Weekly recap to Wylie. Finalize the For Wylie list for your one-on-one.', ['Executive']),
    b('17:00', '18:00', 'Plan next week & close out', 'Set up Wylie’s calendar for next week (no Friday one-on-ones), clear Waiting On, Daily Recap.', ['Executive', 'Operations'], { is_recap: true }),
  ],
};

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Rows ready to insert into schedule_blocks. */
export function planRows() {
  return Object.entries(WEEK_PLAN).flatMap(([wd, rows]) =>
    rows.map((r, i) => ({ ...r, weekday: Number(wd), sort_order: i + 1 })));
}

/** The plan is in place when the schedule has weekday-specific blocks. */
export const hasWeekPlan = (blocks: ScheduleBlock[]) => blocks.some(x => x.weekday !== null);
/** Loaded before the DM blocks were added. */
export const planOutdated = (blocks: ScheduleBlock[]) => hasWeekPlan(blocks) && !blocks.some(x => x.title === 'DM block');
