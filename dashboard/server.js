#!/usr/bin/env node
/**
 * Serves the built dashboard and proxies /api to Home Assistant.
 * Also serves GET /api/calendar/events (Google Calendar via SERVICE_ACCOUNT.json).
 * Keeps the HA token server-side (not in the browser).
 *
 * Usage:
 *   npm run build && HA_BASE_URL=... HA_TOKEN=... npm run serve
 *   Or put HA_BASE_URL, HA_TOKEN in .env (loaded automatically). Calendars are stored in the DB.
 */

import 'dotenv/config';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUpcomingEvents, getUpcomingEventsFromCalendars, listCalendars, getCalendarSummary, getServiceAccountEmail, insertEvent, getEvent, deleteEvent, updateEvent } from './lib/calendar.js';
import { getSavedCalendars, addSavedCalendar, updateSavedCalendar, deleteSavedCalendar } from './lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const HA_BASE_URL = (process.env.HA_BASE_URL || '').replace(/\/+$/, '');
const HA_TOKEN = process.env.HA_TOKEN || '';

if (!HA_BASE_URL || !HA_TOKEN) {
  console.error('Set HA_BASE_URL and HA_TOKEN (e.g. in .env)');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Calendar API (separate path so HA proxy doesn't catch it)

// Saved calendars (stored in DB; no CALENDAR_ID env needed)
app.get('/calendar-api/saved-calendars', (req, res) => {
  try {
    const list = getSavedCalendars();
    res.json(list);
  } catch (err) {
    console.error('Saved calendars list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/calendar-api/saved-calendars', (req, res) => {
  try {
    const { title, calendarId, colorIndex, colorHex } = req.body || {};
    if (!title || !calendarId) {
      res.status(400).json({ error: 'title and calendarId are required' });
      return;
    }
    const row = addSavedCalendar({ title, calendarId: String(calendarId).trim(), colorIndex: colorIndex ?? 0, colorHex });
    res.status(201).json(row);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'A calendar with this ID is already saved' });
      return;
    }
    console.error('Add calendar error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/calendar-api/saved-calendars/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const updated = updateSavedCalendar(id, req.body || {});
    if (!updated) {
      res.status(404).json({ error: 'Calendar not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'A calendar with this ID is already saved' });
      return;
    }
    console.error('Update calendar error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/calendar-api/saved-calendars/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const deleted = deleteSavedCalendar(id);
    if (!deleted) {
      res.status(404).json({ error: 'Calendar not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('Delete calendar error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/calendar-api/list', async (req, res) => {
  try {
    const calendars = await listCalendars();
    res.json(calendars);
  } catch (err) {
    console.error('Calendar list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/calendar-api/diagnose', async (req, res) => {
  const tryCalendarId = req.query.calendarId ?? null;
  const out = { serviceAccountEmail: getServiceAccountEmail(), list: null, direct: null };
  try {
    const list = await listCalendars();
    out.list = { ok: true, count: list.length, calendars: list };
  } catch (err) {
    out.list = { ok: false, error: err.message, code: err.code };
  }
  if (tryCalendarId) {
    try {
      const events = await getUpcomingEvents(tryCalendarId, { maxResults: 1, days: 30 });
      out.direct = { ok: true, calendarId: tryCalendarId, eventCount: events.length };
    } catch (err) {
      const response = err.response;
      out.direct = {
        ok: false,
        calendarId: tryCalendarId,
        error: err.message,
        code: err.code,
        status: response?.status,
        statusText: response?.statusText,
      };
    }
  }
  res.json(out);
});

app.post('/calendar-api/events', async (req, res) => {
  try {
    const {
      calendarId,
      summary,
      date,
      allDay,
      startTime,
      endTime,
      timeZone,
      location,
      description,
      recurrence,
      reminders,
      attendees,
    } = req.body || {};

    if (!calendarId || !date) {
      res.status(400).json({ error: 'calendarId and date are required' });
      return;
    }

    const dateStr = date.slice(0, 10);
    const tz = (typeof timeZone === 'string' && timeZone.trim()) ? timeZone.trim() : 'UTC';
    let start;
    let end;

    if (allDay) {
      start = { date: dateStr };
      const d = new Date(dateStr + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1);
      end = { date: d.toISOString().slice(0, 10) };
    } else {
      const st = startTime || '09:00';
      const et = endTime || '10:00';
      start = { dateTime: dateStr + 'T' + st + ':00', timeZone: tz };
      end = { dateTime: dateStr + 'T' + et + ':00', timeZone: tz };
    }

    const event = {
      summary: summary || '(No title)',
      start,
      end,
      location: location || undefined,
      description: description || undefined,
      recurrence: Array.isArray(recurrence) && recurrence.length ? recurrence : undefined,
      reminders:
        reminders?.overrides?.length ?
          { useDefault: false, overrides: reminders.overrides } :
          undefined,
      attendees: Array.isArray(attendees) && attendees.length ? attendees.map((e) => ({ email: e })) : undefined,
    };

    const created = await insertEvent(calendarId, event, { sendUpdates: 'all' });
    res.status(201).json(created);
  } catch (err) {
    console.error('Create event error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/calendar-api/calendars/:calendarId/events/:eventId', async (req, res) => {
  try {
    const { calendarId, eventId } = req.params;
    const ev = await getEvent(calendarId, eventId);
    if (!ev) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json(ev);
  } catch (err) {
    console.error('Get event error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/calendar-api/calendars/:calendarId/events/:eventId', async (req, res) => {
  try {
    const { calendarId, eventId } = req.params;
    await deleteEvent(calendarId, eventId, { sendUpdates: 'all' });
    res.status(204).send();
  } catch (err) {
    console.error('Delete event error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function buildEventStartEnd(body) {
  const { date, startTime, endTime, timeZone } = body;
  const allDay = body.allDay === true || body.allDay === 'true';
  const dateStr = (date || '').slice(0, 10);
  if (!dateStr || !DATE_ONLY_REGEX.test(dateStr)) {
    const err = new Error(allDay ? 'Date is required for all-day events (use YYYY-MM-DD).' : 'Date is required (use YYYY-MM-DD).');
    err.statusCode = 400;
    throw err;
  }
  const tz = (typeof timeZone === 'string' && timeZone.trim()) ? timeZone.trim() : 'UTC';
  if (allDay) {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    const endDateStr = d.toISOString().slice(0, 10);
    // Clear dateTime/timeZone so PATCH removes existing timed fields (avoids "Invalid start time")
    const start = { date: dateStr, dateTime: null, timeZone: null };
    const end = { date: endDateStr, dateTime: null, timeZone: null };
    return { start, end };
  }
  const st = startTime || '09:00';
  const et = endTime || '10:00';
  return {
    start: { dateTime: dateStr + 'T' + st + ':00', timeZone: tz },
    end: { dateTime: dateStr + 'T' + et + ':00', timeZone: tz },
  };
}

app.patch('/calendar-api/calendars/:calendarId/events/:eventId', async (req, res) => {
  try {
    const { calendarId, eventId } = req.params;
    const body = req.body || {};
    const { start, end } = buildEventStartEnd(body);
    const event = {
      summary: body.summary ?? '',
      start,
      end,
      location: body.location ?? undefined,
      description: body.description ?? undefined,
      recurrence: Array.isArray(body.recurrence) && body.recurrence.length ? body.recurrence : undefined,
      reminders: body.reminders?.overrides?.length ? { useDefault: false, overrides: body.reminders.overrides } : undefined,
      attendees: Array.isArray(body.attendees) && body.attendees.length ? body.attendees.map((e) => ({ email: typeof e === 'string' ? e : e.email })) : undefined,
    };
    const updated = await updateEvent(calendarId, eventId, event, { sendUpdates: 'all' });
    res.json(updated);
  } catch (err) {
    console.error('Update event error:', err.message);
    const status = err.statusCode === 400 ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

app.get('/calendar-api/events', async (req, res) => {
  try {
    let saved;
    try {
      saved = getSavedCalendars();
    } catch (dbErr) {
      console.error('Calendar DB error:', dbErr.message);
      return res.status(500).json({
        events: [],
        calendarSummaries: {},
        calendarColors: {},
        error: `Database error: ${dbErr.message}`,
      });
    }

    const calendarIds = saved.map((c) => c.calendarId);
    const maxResults = parseInt(req.query.maxResults, 10) || 50;
    const days = parseInt(req.query.days, 10) || 14;

    if (calendarIds.length === 0) {
      return res.json({
        events: [],
        calendarId: null,
        calendarSummary: null,
        calendarSummaries: {},
        calendarColors: {},
        calendarErrors: [],
        error: 'Add at least one calendar in Calendars settings to see events.',
      });
    }

    const { events, errors: calendarErrors } = await getUpcomingEventsFromCalendars(calendarIds, { maxResults, days });
    const calendarSummary = saved.length === 1 ? saved[0].title : `${saved.length} calendars`;

    const calendarSummaries = {};
    const calendarColors = {};
    for (const c of saved) {
      calendarSummaries[c.calendarId] = c.title;
      calendarColors[c.calendarId] = c.colorIndex;
    }
    const list = await listCalendars().catch(() => []);
    const eventCalendarIds = [...new Set(events.map((e) => e.calendarId).filter(Boolean))];
    for (const id of eventCalendarIds) {
      if (!calendarSummaries[id]) {
        const fromList = list.find((c) => c.id === id);
        calendarSummaries[id] = fromList ? fromList.summary : (await getCalendarSummary(id))?.summary ?? id;
      }
      if (calendarColors[id] === undefined) {
        calendarColors[id] = 0;
      }
    }

    console.log(`Calendar: ${saved.length} saved → ${events.length} events${calendarErrors.length ? ` (${calendarErrors.length} failed)` : ''}`);
    res.json({
      events,
      calendarId: calendarIds.join(','),
      calendarSummary,
      calendarSummaries,
      calendarColors,
      calendarErrors,
    });
  } catch (err) {
    console.error('Calendar API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.use(
  '/api',
  createProxyMiddleware({
    target: HA_BASE_URL,
    changeOrigin: true,
    secure: false,
    onProxyReq: (proxyReq) => {
      proxyReq.setHeader('Authorization', `Bearer ${HA_TOKEN}`);
    },
  })
);

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Dashboard: http://localhost:${PORT}`);
  console.log(`Proxying /api -> ${HA_BASE_URL}`);
});
