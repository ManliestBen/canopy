/**
 * Google Calendar API using service account from SERVICE_ACCOUNT.json.
 * Share your Google Calendar with the service account email to allow access.
 */

import { google } from 'googleapis';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar',
];

function loadKey() {
  const keyPath = path.join(__dirname, '..', 'SERVICE_ACCOUNT.json');
  return JSON.parse(readFileSync(keyPath, 'utf8'));
}

function getAuthClient() {
  const key = loadKey();
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: SCOPES,
  });
  return auth;
}

/** Service account email (share your calendar with this address). */
export function getServiceAccountEmail() {
  return loadKey().client_email || '';
}

/**
 * Fetch upcoming events from the given calendar.
 * @param {string} calendarId - Calendar ID (e.g. 'primary' or 'user@gmail.com'). For service accounts, use the email of the calendar you shared.
 * @param {object} options - { maxResults?: number, days?: number }
 * @returns {Promise<Array>} Array of event objects { id, summary, start, end, htmlLink, ... }
 */
export async function getUpcomingEvents(calendarId, options = {}) {
  const { maxResults = 50, days = 14 } = options;
  const auth = getAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const timeMin = new Date();
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + days);

  const res = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = (res.data.items || []).map((ev) => ({
    id: ev.id,
    summary: ev.summary || '(No title)',
    start: ev.start?.dateTime || ev.start?.date,
    end: ev.end?.dateTime || ev.end?.date,
    allDay: !ev.start?.dateTime,
    htmlLink: ev.htmlLink,
    location: ev.location,
    description: ev.description,
    calendarId,
  }));

  return events;
}

/**
 * Parse CALENDAR_ID env value: single ID or comma-separated list (trimmed).
 * @param {string} value
 * @returns {string[]}
 */
export function parseCalendarIds(value) {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Fetch upcoming events from one or more calendars; merge and sort by start time.
 * If a calendar fails (e.g. not shared), its events are skipped; others still return.
 * @param {string|string[]} calendarIds - Single ID or array (e.g. from parseCalendarIds(CALENDAR_ID))
 * @param {object} options - { maxResults?: number, days?: number }
 * @returns {Promise<{ events: Array, errors: string[] }>} events and list of error messages for failed calendars
 */
export async function getUpcomingEventsFromCalendars(calendarIds, options = {}) {
  const ids = Array.isArray(calendarIds) ? calendarIds : [calendarIds];
  if (ids.length === 0) return { events: [], errors: [] };

  const perCalendar = Math.min(options.maxResults ?? 50, Math.ceil(250 / ids.length));
  const settled = await Promise.allSettled(
    ids.map((id) => getUpcomingEvents(id, { ...options, maxResults: perCalendar }))
  );

  const errors = [];
  const merged = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      merged.push(...result.value);
    } else {
      const calId = ids[i];
      const msg = result.reason?.message || String(result.reason);
      errors.push(`${calId}: ${msg}`);
      console.error(`Calendar ${calId} failed:`, result.reason?.message || result.reason);
    }
  });

  merged.sort((a, b) => new Date(a.start || 0) - new Date(b.start || 0));
  const events = merged.slice(0, options.maxResults ?? 50);
  return { events, errors };
}

/**
 * List calendars the service account can access (calendars shared with it).
 * @returns {Promise<Array>} Array of { id, summary, primary }
 */
export async function listCalendars() {
  const auth = getAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.calendarList.list();
  return (res.data.items || []).map((c) => ({
    id: c.id,
    summary: c.summary || c.id,
    primary: !!c.primary,
  }));
}

/**
 * Get a single calendar's metadata by ID (e.g. title/summary).
 * Works for any calendar the account can read, including public calendars like
 * usa#holiday@group.v.calendar.google.com that may not appear in calendarList.list().
 * @param {string} calendarId - Calendar ID
 * @returns {Promise<{ id: string, summary: string } | null>} Calendar id and summary, or null on error
 */
export async function getCalendarSummary(calendarId) {
  if (!calendarId) return null;
  try {
    const auth = getAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.calendars.get({ calendarId });
    return {
      id: res.data.id,
      summary: res.data.summary || res.data.id,
    };
  } catch {
    return null;
  }
}

/**
 * Create an event on a calendar.
 * @param {string} calendarId - Calendar ID
 * @param {object} event - Event payload: summary, start, end, allDay?, location?, description?, recurrence?, reminders?, attendees?
 *   start/end: { dateTime: ISO } for timed, or { date: 'YYYY-MM-DD' } for all-day
 *   recurrence: string[] (RRULE lines, e.g. ['RRULE:FREQ=WEEKLY;BYDAY=SU'])
 *   reminders: { overrides: [{ method: 'email'|'popup', minutes: number }] }
 *   attendees: [{ email: string }]
 * @param {object} options - { sendUpdates?: 'none'|'externalOnly'|'all' }
 * @returns {Promise<object>} Created event (id, htmlLink, ...)
 */
export async function insertEvent(calendarId, event, options = {}) {
  const auth = getAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const body = {
    summary: event.summary || '',
    location: event.location || undefined,
    description: event.description || undefined,
    start: event.start,
    end: event.end,
    recurrence: event.recurrence?.length ? event.recurrence : undefined,
    attendees: event.attendees?.length ? event.attendees.map((a) => (typeof a === 'string' ? { email: a } : { email: a.email })) : undefined,
    reminders: event.reminders
      ? {
          useDefault: false,
          overrides: event.reminders.overrides || [],
        }
      : undefined,
  };

  const res = await calendar.events.insert({
    calendarId,
    requestBody: body,
    sendUpdates: options.sendUpdates || 'none',
  });

  return res.data;
}

/**
 * Get a single event by ID.
 * @param {string} calendarId - Calendar ID
 * @param {string} eventId - Event ID
 * @returns {Promise<object|null>} Event object or null if not found
 */
export async function getEvent(calendarId, eventId) {
  if (!calendarId || !eventId) return null;
  try {
    const auth = getAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.get({ calendarId, eventId });
    const ev = res.data;
    return {
      id: ev.id,
      summary: ev.summary || '(No title)',
      start: ev.start?.dateTime || ev.start?.date,
      end: ev.end?.dateTime || ev.end?.date,
      allDay: !ev.start?.dateTime,
      location: ev.location,
      description: ev.description,
      htmlLink: ev.htmlLink,
      recurrence: ev.recurrence || undefined,
      attendees: ev.attendees?.map((a) => a.email).filter(Boolean) || undefined,
      reminders: ev.reminders?.overrides?.length
        ? { overrides: ev.reminders.overrides }
        : undefined,
      calendarId,
    };
  } catch {
    return null;
  }
}

/**
 * Delete an event.
 * @param {string} calendarId - Calendar ID
 * @param {string} eventId - Event ID
 * @param {object} options - { sendUpdates?: 'none'|'externalOnly'|'all' }
 */
export async function deleteEvent(calendarId, eventId, options = {}) {
  const auth = getAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.delete({
    calendarId,
    eventId,
    sendUpdates: options.sendUpdates || 'all',
  });
}

/**
 * Update an event (patch).
 * @param {string} calendarId - Calendar ID
 * @param {string} eventId - Event ID
 * @param {object} event - Same shape as insertEvent (summary, start, end, ...)
 * @param {object} options - { sendUpdates?: 'none'|'externalOnly'|'all' }
 * @returns {Promise<object>} Updated event
 */
export async function updateEvent(calendarId, eventId, event, options = {}) {
  const auth = getAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const body = {
    summary: event.summary ?? '',
    location: event.location ?? undefined,
    description: event.description ?? undefined,
    start: event.start,
    end: event.end,
    recurrence: event.recurrence?.length ? event.recurrence : undefined,
    attendees: event.attendees?.length ? event.attendees.map((a) => (typeof a === 'string' ? { email: a } : { email: a.email })) : undefined,
    reminders: event.reminders?.overrides?.length
      ? { useDefault: false, overrides: event.reminders.overrides }
      : undefined,
  };

  const res = await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: body,
    sendUpdates: options.sendUpdates || 'all',
  });

  return res.data;
}
