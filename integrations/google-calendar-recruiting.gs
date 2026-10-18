/**
 * ALL-STAR Executive Ops · Google Calendar → Executive Ops
 *
 * Runs inside your own Google account (script.google.com). Every 15 minutes it:
 *   1. looks at your calendar for recruiting calls booked through iClosed and sends new,
 *      moved and cancelled ones to Recruiting, and
 *   2. (optional) copies Wylie's upcoming events into Wylie's Calendar, if his calendar is
 *      shared with this Google account. It only reads his calendar; it never changes it.
 * Nothing is sent anywhere else.
 *
 * Setup (about 10 minutes, see SETUP.md → "Recruiting calls from Google Calendar"):
 *   1. Fill in the four settings below.
 *   2. Run  listUpcoming  once to see your next events and pick the TITLE_MATCH text.
 *   3. Run  setup  once and approve the calendar permission. Done.
 */

// ---- Settings -------------------------------------------------------------------------
var INTAKE_URL  = 'https://allstar-executive-ops.vercel.app/api/intake/iclosed';
var INTAKE_KEY  = 'PASTE_YOUR_INTAKE_SECRET_HERE';   // same value as INTAKE_SECRET in Vercel
var CALENDAR_ID = 'primary';                          // or the calendar iClosed books onto
var TITLE_MATCH = 'Interview with Allstar';          // text every recruiting call title contains
var DAYS_AHEAD  = 30;
// Wylie's calendar: his calendar's email address. Leave '' to skip. It must be shared with
// this Google account ("See all event details").
var WYLIE_CALENDAR_ID = '';
var CALENDAR_SYNC_URL = INTAKE_URL.replace('/iclosed', '/calendar');
// ---------------------------------------------------------------------------------------

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncRecruitingCalls') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncRecruitingCalls').timeBased().everyMinutes(15).create();
  syncRecruitingCalls();
  Logger.log('Set up. Recruiting calls' + (WYLIE_CALENDAR_ID ? ' and Wylie\'s calendar' : '') + ' now sync every 15 minutes.');
}

/** Shows your next 20 events so you can choose TITLE_MATCH. Sends nothing. */
function listUpcoming() {
  var cal = CalendarApp.getCalendarById(CALENDAR_ID) || CalendarApp.getDefaultCalendar();
  var now = new Date(), end = new Date(now.getTime() + DAYS_AHEAD * 864e5);
  cal.getEvents(now, end).slice(0, 20).forEach(function (ev) {
    Logger.log(ev.getStartTime() + '  |  ' + ev.getTitle() + (isRecruitingCall(ev) ? '   ← would sync' : ''));
  });
}

function isRecruitingCall(ev) {
  var title = (ev.getTitle() || '').toLowerCase();
  var desc = (ev.getDescription() || '').toLowerCase();
  if (TITLE_MATCH) return title.indexOf(TITLE_MATCH.toLowerCase()) !== -1;
  return desc.indexOf('iclosed') !== -1 || title.indexOf('iclosed') !== -1;
}

function syncRecruitingCalls() {
  var props = PropertiesService.getScriptProperties();
  var seen = JSON.parse(props.getProperty('seen') || '{}');   // eventId -> start ISO
  var cal = CalendarApp.getCalendarById(CALENDAR_ID) || CalendarApp.getDefaultCalendar();
  var now = new Date();
  var events = cal.getEvents(new Date(now.getTime() - 3600e3), new Date(now.getTime() + DAYS_AHEAD * 864e5))
    .filter(isRecruitingCall);
  var me = Session.getActiveUser().getEmail().toLowerCase();
  var current = {};

  events.forEach(function (ev) {
    var id = ev.getId();
    var start = ev.getStartTime().toISOString();
    current[id] = start;
    if (seen[id] === start) return;                       // nothing changed since last run
    var guest = ev.getGuestList().filter(function (g) { return g.getEmail().toLowerCase() !== me; })[0];
    var details = (ev.getDescription() || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    send({
      event: seen[id] ? 'rescheduled' : 'booked',
      external_id: id,
      name: nameFromTitle(ev.getTitle()) || (guest && guest.getName()) || (guest && guest.getEmail()) || '',
      email: guest ? guest.getEmail() : '',
      phone: phoneFrom(details),
      call_time: start,
      'Booking details': details.slice(0, 3000)
    });
    seen[id] = start;
  });

  // A future call we saw before that's gone from the calendar was cancelled.
  Object.keys(seen).forEach(function (id) {
    var start = new Date(seen[id]);
    if (current[id]) return;
    if (start > now) send({ event: 'cancelled', external_id: id });
    delete seen[id];
  });

  props.setProperty('seen', JSON.stringify(seen));
  if (WYLIE_CALENDAR_ID) syncWylieCalendar();
}

/** Sends Wylie's events for the next DAYS_AHEAD days. Removed events disappear in the app too. */
function syncWylieCalendar() {
  var cal = CalendarApp.getCalendarById(WYLIE_CALENDAR_ID);
  if (!cal) { Logger.log('Can\'t see ' + WYLIE_CALENDAR_ID + '. Ask Wylie to share his calendar with this account.'); return; }
  var from = new Date(Date.now() - 864e5), to = new Date(Date.now() + DAYS_AHEAD * 864e5);
  var events = cal.getEvents(from, to).map(function (ev) {
    var allDay = ev.isAllDayEvent();
    return {
      id: ev.getId() + '|' + ev.getStartTime().getTime(),   // recurring events share an id; the start keeps each one unique
      title: ev.getTitle(),
      start: (allDay ? ev.getAllDayStartDate() : ev.getStartTime()).toISOString(),
      end: (allDay ? ev.getAllDayEndDate() : ev.getEndTime()).toISOString(),
      allDay: allDay,
      location: ev.getLocation()
    };
  });
  var res = UrlFetchApp.fetch(CALENDAR_SYNC_URL, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-intake-key': INTAKE_KEY },
    payload: JSON.stringify({ from: from.toISOString(), to: to.toISOString(), events: events.slice(0, 500) })
  });
  Logger.log('Wylie\'s calendar: ' + res.getResponseCode() + ' ' + res.getContentText());
}

/** Run once to check you can see Wylie's calendar. Sends nothing. */
function listWylieUpcoming() {
  var cal = CalendarApp.getCalendarById(WYLIE_CALENDAR_ID);
  if (!cal) { Logger.log('Can\'t see ' + WYLIE_CALENDAR_ID + '. Ask Wylie to share his calendar with this account.'); return; }
  cal.getEvents(new Date(), new Date(Date.now() + 7 * 864e5)).slice(0, 20).forEach(function (ev) {
    Logger.log(ev.getStartTime() + '  |  ' + ev.getTitle());
  });
}

function send(payload) {
  var res = UrlFetchApp.fetch(INTAKE_URL, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(payload),
    headers: { 'x-intake-key': INTAKE_KEY }, muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) Logger.log('Intake said ' + res.getResponseCode() + ': ' + res.getContentText());
}

/** "Mark Sharkozy Interview with Allstar" → "Mark Sharkozy"; also "Call with Jane Doe" (best effort). */
function nameFromTitle(title) {
  title = title || '';
  var m = /(?:with|w\/)\s+([A-Z][\w'.-]+(?:\s+[A-Z][\w'.-]+)+)/.exec(title)
       || /^(.+?)\s+(?:interview|call|meeting)\b/i.exec(title);
  return m ? m[1].trim() : '';
}
function phoneFrom(text) {
  var m = /(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/.exec(text || '');
  return m ? m[1].trim() : '';
}
