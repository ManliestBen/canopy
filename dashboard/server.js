#!/usr/bin/env node
/**
 * Serves the built dashboard and proxies /api to Home Assistant.
 * Also serves GET /api/calendar/events (Google Calendar via SERVICE_ACCOUNT.json).
 * Keeps the HA token server-side (not in the browser).
 *
 * Usage:
 *   npm run build && HA_BASE_URL=... HA_TOKEN=... npm run serve
 *   Or put HA_BASE_URL, HA_TOKEN, CALENDAR_ID in .env (loaded automatically).
 */

import 'dotenv/config';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUpcomingEvents, getUpcomingEventsFromCalendars, listCalendars, getServiceAccountEmail, parseCalendarIds } from './lib/calendar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const HA_BASE_URL = (process.env.HA_BASE_URL || '').replace(/\/+$/, '');
const HA_TOKEN = process.env.HA_TOKEN || '';
const CALENDAR_ID = process.env.CALENDAR_ID || '';

if (!HA_BASE_URL || !HA_TOKEN) {
  console.error('Set HA_BASE_URL and HA_TOKEN (e.g. in .env)');
  process.exit(1);
}

const app = express();

// Calendar API (separate path so HA proxy doesn't catch it)
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
  const tryCalendarId = req.query.calendarId || CALENDAR_ID;
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
