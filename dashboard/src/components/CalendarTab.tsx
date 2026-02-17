import { useState, useEffect } from 'react';
import { getCalendarEvents, getCalendarList, getCalendarDiagnose } from '../api';
import type { CalendarEvent } from '../types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (isToday) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatAllDay(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

interface EventItemProps {
  event: CalendarEvent;
  showCalendar: boolean;
}

function EventItem({ event, showCalendar }: EventItemProps) {
  const timeStr = event.allDay
    ? formatAllDay(event.start)
    : `${formatDate(event.start)} – ${event.end ? formatDate(event.end) : ''}`;
  const calendarLabel = event.calendarId && showCalendar
    ? (event.calendarId.includes('@') ? event.calendarId.split('@')[0] : event.calendarId)
    : null;
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div className="card-name">{event.summary}</div>
      <div className="card-state" style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>
        {timeStr}
      </div>
      {calendarLabel && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title={event.calendarId}>{calendarLabel}</div>
      )}
      {event.location && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{event.location}</div>
      )}
      {event.htmlLink && (
        <a
          href={event.htmlLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '0.25rem' }}
        >
          Open in Calendar
        </a>
      )}
    </div>
  );
}

interface CalendarErrorState {
  message: string;
  status?: number;
  serviceAccountEmail?: string;
}

interface CalendarMeta {
  calendarId: string | null;
  calendarSummary: string | null;
}

export function CalendarTab() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendarMeta, setCalendarMeta] = useState<CalendarMeta>({ calendarId: null, calendarSummary: null });
  const [calendarList, setCalendarList] = useState<{ id: string; summary?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<CalendarErrorState | null>(null);
  const [directId, setDirectId] = useState('');
  const [diagnose, setDiagnose] = useState<{ list?: { ok: boolean }; direct?: { ok: boolean; error?: string; status?: number; code?: number } } | null>(null);
  const [directLoading, setDirectLoading] = useState(false);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getCalendarEvents({ days: 14, maxResults: 30 });
      const eventList = Array.isArray(data) ? data : data.events || [];
      setEvents(eventList);
      setCalendarMeta({
        calendarId: Array.isArray(data) ? null : (data.calendarId ?? null),
        calendarSummary: Array.isArray(data) ? null : (data.calendarSummary ?? null),
      });
      const list = await getCalendarList().catch(() => []);
      setCalendarList(Array.isArray(list) ? list : []);
    } catch (e) {
      const err = e as Error & { status?: number; serviceAccountEmail?: string };
      setError({
        message: err.message || 'Failed to load calendar',
        status: err.status,
        serviceAccountEmail: err.serviceAccountEmail,
      });
      setEvents([]);
      setCalendarMeta({ calendarId: null, calendarSummary: null });
      setCalendarList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (error) {
    const msg = error.message;
    const is503 = error.status === 503;
    const serviceEmail = error.serviceAccountEmail;
    return (
      <>
        <div className="error-banner">{msg}</div>
        {is503 && (
          <>
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--text)' }}>Share a calendar with the service account:</p>
              <ol style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
                <li>Open <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Google Calendar</a></li>
                <li>Click the three dots next to your calendar → <strong>Settings and sharing</strong></li>
                <li>Under <strong>Share with specific people</strong>, click <strong>Add people</strong></li>
                <li>Add this address with <strong>See all event details</strong>:<br />
                  <code style={{ display: 'inline-block', marginTop: '0.25rem', padding: '0.25rem 0.5rem', background: 'var(--bg)', borderRadius: 4, fontSize: '0.85rem', wordBreak: 'break-all' }}>
                    {serviceEmail || 'your-service-account@project.iam.gserviceaccount.com'}
                  </code>
                </li>
              </ol>
              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.85rem' }}>Also ensure the <strong>Google Calendar API</strong> is enabled in <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Google Cloud Console</a>.</p>
            </div>
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.9rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--text)' }}>Or try direct access (calendar list is empty but share may still work):</p>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Enter the Google account email that owns the calendar you shared (e.g. you@gmail.com):</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="you@gmail.com"
                  value={directId}
                  onChange={(e) => setDirectId(e.target.value.trim())}
                  style={{ padding: '0.4rem 0.6rem', minWidth: '200px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: '0.9rem' }}
                />
                <button
                  type="button"
                  disabled={!directId || directLoading}
                  onClick={async () => {
                    if (!directId) return;
                    setDirectLoading(true);
                    setDiagnose(null);
                    try {
                      const d = await getCalendarDiagnose(directId);
                      setDiagnose(d);
                    } catch (e) {
                      setDiagnose({ list: { ok: false }, direct: { ok: false, error: (e as Error).message } });
                    } finally {
                      setDirectLoading(false);
                    }
                  }}
                  style={{ padding: '0.4rem 0.6rem', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  Run diagnostic
                </button>
                <button
                  type="button"
                  disabled={!directId || directLoading}
                  onClick={async () => {
                    if (!directId) return;
                    setDirectLoading(true);
                    setError(null);
                    try {
                      const data = await getCalendarEvents({ days: 14, maxResults: 30, calendarId: directId });
                      const eventList = Array.isArray(data) ? data : data.events || [];
                      setEvents(eventList);
                      setCalendarMeta({ calendarId: Array.isArray(data) ? directId : (data.calendarId ?? directId), calendarSummary: Array.isArray(data) ? directId : (data.calendarSummary ?? directId) });
                      setCalendarList([]);
                    } catch (e) {
                      const err = e as Error & { status?: number; serviceAccountEmail?: string };
                      setError({ message: err.message, status: err.status, serviceAccountEmail: err.serviceAccountEmail });
                    } finally {
                      setDirectLoading(false);
                    }
                  }}
                  style={{ padding: '0.4rem 0.6rem', background: 'var(--accent)', color: '#0f1419', border: 'none' }}
                >
                  Load this calendar
                </button>
              </div>
              {diagnose && (
                <>
                  <pre style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'var(--bg)', borderRadius: 6, fontSize: '0.8rem', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(diagnose, null, 2)}
                  </pre>
                  {diagnose.direct?.ok === false && (diagnose.direct?.status === 404 || diagnose.direct?.code === 404) && (
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <strong>404 from Google</strong> usually means the calendar ID is wrong. If this is a <strong>secondary</strong> calendar (not your main Gmail one), the ID is not your email: in Google Calendar go to <strong>Settings</strong> → select that calendar → <strong>Integrate calendar</strong> and copy the <strong>Calendar ID</strong> (often <code>…@group.calendar.google.com</code>). Use that exact value above.
                    </p>
                  )}
                </>
              )}
              {diagnose?.direct?.error?.startsWith('Diagnose:') && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--accent)' }}>
                  The diagnostic request failed (e.g. 404). Ensure you ran <code>npm run dev</code> so both Vite and the calendar server start, or that the calendar server is reachable at the proxy path.
                </p>
              )}
              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>If &quot;Load this calendar&quot; works, add <code>CALENDAR_ID={directId || 'your@gmail.com'}</code> to your <code>.env</code> and restart the app.</p>
            </div>
          </>
        )}
        <button onClick={load} style={{ marginTop: '1rem', padding: '0.4rem 0.75rem', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          Retry
        </button>
      </>
    );
  }

  if (loading) return <div className="loading">Loading calendar…</div>;

  return (
    <>
      <div className="refresh-row">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {calendarMeta.calendarSummary ? `Calendar: ${calendarMeta.calendarSummary} · ` : ''}
          Next 14 days · {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
        <button onClick={load} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          Refresh
        </button>
      </div>
      {events.length === 0 && (
        <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <p style={{ margin: '0 0 0.5rem 0' }}>No upcoming events.</p>
          <p style={{ margin: 0 }}>
            {calendarMeta.calendarId
              ? <>Showing <strong>{calendarMeta.calendarSummary || calendarMeta.calendarId}</strong>. To use a different calendar, set <code style={{ fontSize: '0.85em' }}>CALENDAR_ID</code> in your .env to one of the IDs below.</>
              : 'Share your Google Calendar with the service account email (see README). Set <code style={{ fontSize: "0.85em" }}>CALENDAR_ID</code> in .env to your calendar\'s ID if you have multiple.'}
          </p>
          {calendarList.length > 0 && (
            <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.85rem' }}>
              Available calendars: {calendarList.map((c) => <code key={c.id} style={{ marginRight: '0.5em', fontSize: '0.9em' }} title={c.id}>{c.summary}</code>)}
            </p>
          )}
        </div>
      )}
      <div className="entity-grid">
        {events.map((ev, i) => (
          <EventItem key={ev.calendarId && ev.id ? `${ev.calendarId}-${ev.id}` : ev.id || i} event={ev} showCalendar={calendarMeta.calendarSummary?.includes('calendars') ?? false} />
        ))}
      </div>
    </>
  );
}
