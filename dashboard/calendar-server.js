#!/usr/bin/env node
/**
 * Dev-only server: serves GET /api/calendar/events for the dashboard.
 * Run with: npm run dev:calendar (or use npm run dev which starts this + Vite).
 * Uses SERVICE_ACCOUNT.json and CALENDAR_ID env (or first available calendar).
 */

import 'dotenv/config';
import express from 'express';
import { getUpcomingEvents, getUpcomingEventsFromCalendars, listCalendars, getServiceAccountEmail, parseCalendarIds } from './lib/calendar.js';

const PORT = process.env.CALENDAR_SERVER_PORT || 3001;
const CALENDAR_ID = process.env.CALENDAR_ID || '';

const app = express();

app.get('/calendar-api/list', async (req, res) => {
  try {
    const calendars = await listCalendars();
    res.json(calendars);
  } catch (err) {
    console.error('Calendar list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** Diagnostic: run list + optional direct fetch by calendarId. */
app.get('/calendar-api/diagnose', async (req, res) => {
  const tryCalendarId = req.query.calendarId || CALENDAR_ID;
  const out = { serviceAccountEmail: getServiceAccountEmail(), list: null, direct: null };
  try {
    const list = await listCalendars();
    out.list = { ok: true, count: list.length, calendars: list };
  } catch (err) {
    out.list = { ok: false, error: err.message, code: err.code };
    console.error('Diagnose listCalendars:', err.message);
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
      console.error('Diagnose getUpcomingEvents:', err.message, err.code, response?.status);
    }
  }
  res.json(out);
});

app.get('/calendar-api/events', async (req, res) => {
  try {
    const queryId = req.query.calendarId?.trim();
    const envIds = parseCalendarIds(CALENDAR_ID);
    let calendarId;
    let calendarSummary = null;
    let events;

    if (queryId) {
      calendarId = queryId;
      events = await getUpcomingEvents(calendarId, {
        maxResults: parseInt(req.query.maxResults, 10) || 50,
        days: parseInt(req.query.days, 10) || 14,
      });
    } else if (envIds.length > 1) {
      calendarId = envIds.join(',');
      calendarSummary = `${envIds.length} calendars`;
      events = await getUpcomingEventsFromCalendars(envIds, {
        maxResults: parseInt(req.query.maxResults, 10) || 50,
        days: parseInt(req.query.days, 10) || 14,
      });
    } else if (envIds.length === 1) {
      calendarId = envIds[0];
      events = await getUpcomingEvents(calendarId, {
        maxResults: parseInt(req.query.maxResults, 10) || 50,
        days: parseInt(req.query.days, 10) || 14,
      });
    } else {
      const calendars = await listCalendars();
      const primary = calendars.find((c) => c.primary);
      const chosen = primary || calendars[0];
      if (!chosen) {
        const email = getServiceAccountEmail();
        res.status(503).json({
          error: 'No calendars in list. Set CALENDAR_ID in .env to your calendar email (e.g. you@gmail.com) to use direct access.',
          serviceAccountEmail: email,
          calendars: [],
        });
        return;
      }
      calendarId = chosen.id;
      calendarSummary = chosen.summary;
      events = await getUpcomingEvents(calendarId, {
        maxResults: parseInt(req.query.maxResults, 10) || 50,
        days: parseInt(req.query.days, 10) || 14,
      });
    }

    console.log(`Calendar: ${calendarId} (${calendarSummary || 'direct'}) → ${events.length} events`);
    res.json({ events, calendarId, calendarSummary: calendarSummary || calendarId });
  } catch (err) {
    console.error('Calendar API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Calendar API: http://localhost:${PORT}/calendar-api/events`);
});
