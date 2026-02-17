import { useState, useEffect, useMemo } from 'react';
import { getCalendarEvents, getCalendarList, getCalendarDiagnose } from '../api';
import type { CalendarEvent } from '../types';

export type CalendarViewMode = 'daily' | 'weekly' | 'biweekly' | 'monthly';

const PASTEL_CLASSES = [
  'pastel-0', 'pastel-1', 'pastel-2', 'pastel-3', 'pastel-4',
  'pastel-5', 'pastel-6', 'pastel-7', 'pastel-8', 'pastel-9',
] as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const TIME_GRID_START = 0;   // 12 AM
const TIME_GRID_END = 24;    // 12 AM (midnight next day)
/** If no event starts before this hour (6 AM), we hide 12 AM–5 AM rows. */
const TIME_GRID_COLLAPSE_BEFORE_HOUR = 6;
const SLOT_HEIGHT_PX = 48;

function dateToKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getStartOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getMinutesFromMidnight(isoOrDateKey: string): number {
  if (DATE_ONLY.test(isoOrDateKey)) return 0;
  const d = new Date(isoOrDateKey);
  return d.getHours() * 60 + d.getMinutes();
}

function getDurationMinutes(ev: CalendarEvent): number {
  if (ev.allDay || !ev.end) return 60;
  const start = new Date(ev.start).getTime();
  const end = new Date(ev.end).getTime();
  return Math.max(15, Math.round((end - start) / 60000));
}

function getTimeGridPosition(
  ev: CalendarEvent,
  gridStartHour: number,
  gridEndHour: number
): { topPct: number; heightPct: number } {
  const startMin = getMinutesFromMidnight(ev.start);
  const gridStartMin = gridStartHour * 60;
  const gridEndMin = gridEndHour * 60;
  const gridTotalMin = gridEndMin - gridStartMin;
  let topMin = startMin - gridStartMin;
  if (topMin < 0) topMin = 0;
  const durationMin = getDurationMinutes(ev);
  let endMinInGrid = startMin + durationMin - gridStartMin;
  if (endMinInGrid > gridTotalMin) endMinInGrid = gridTotalMin;
  if (endMinInGrid < topMin) endMinInGrid = topMin;
  const heightMin = endMinInGrid - topMin;
  return {
    topPct: (topMin / gridTotalMin) * 100,
    heightPct: (heightMin / gridTotalMin) * 100,
  };
}

function getEventDateKey(ev: CalendarEvent): string {
  const s = ev.start;
  if (typeof s === 'string' && DATE_ONLY.test(s)) return s;
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getEventDateKeys(ev: CalendarEvent): string[] {
  const startKey = getEventDateKey(ev);
  if (!ev.allDay || !ev.end || typeof ev.start !== 'string' || typeof ev.end !== 'string') {
    return [startKey];
  }
  if (!DATE_ONLY.test(ev.start) || !DATE_ONLY.test(ev.end)) return [startKey];
  const keys: string[] = [];
  const [sy, sm, sd] = ev.start.split('-').map(Number);
  const [ey, em, ed] = ev.end.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    keys.push(dateToKey(d));
  }
  return keys.length > 0 ? keys : [startKey];
}

function buildCalendarColorMap(events: CalendarEvent[]): Map<string, number> {
  const ids = Array.from(new Set(events.map((e) => e.calendarId).filter(Boolean) as string[])).sort();
  const map = new Map<string, number>();
  ids.forEach((id, i) => map.set(id, i));
  return map;
}

function getPastelClass(calendarId: string | undefined, index: number): string {
  const i = index % PASTEL_CLASSES.length;
  return `calendar-event-card ${PASTEL_CLASSES[i]}`;
}

function formatEventTime(ev: CalendarEvent): string {
  if (ev.allDay) return 'All day';
  const start = new Date(ev.start);
  const end = ev.end ? new Date(ev.end) : null;
  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return end ? `${fmt(start)} - ${fmt(end)}` : fmt(start);
}

interface CalendarErrorState {
  message: string;
  status?: number;
  serviceAccountEmail?: string;
}

function CalendarEventCard({
  event,
  pastelClass,
  isContinuation,
}: {
  event: CalendarEvent;
  pastelClass: string;
  isContinuation: boolean;
}) {
  const title = event.summary || '(No title)';
  return (
    <div className={pastelClass}>
      <div className="event-title">{isContinuation ? `${title} (cont'd)` : title}</div>
      <div className="event-time">{formatEventTime(event)}</div>
      {event.location && <div className="event-location">{event.location}</div>}
      {event.htmlLink && (
        <a className="calendar-event-link" href={event.htmlLink} target="_blank" rel="noopener noreferrer">
          Open in Calendar
        </a>
      )}
    </div>
  );
}

export function CalendarTab() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<CalendarErrorState | null>(null);
  const [calendarMeta, setCalendarMeta] = useState<{ calendarId: string | null; calendarSummary: string | null }>({ calendarId: null, calendarSummary: null });
  const [calendarList, setCalendarList] = useState<{ id: string; summary?: string }[]>([]);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('biweekly');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => dateToKey(new Date()));

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getCalendarEvents({ days: 42, maxResults: 100 });
      const eventList = Array.isArray(data) ? data : (data as { events?: CalendarEvent[] }).events ?? [];
      setEvents(eventList);
      setCalendarMeta({
        calendarId: Array.isArray(data) ? null : (data as { calendarId?: string }).calendarId ?? null,
        calendarSummary: Array.isArray(data) ? null : (data as { calendarSummary?: string }).calendarSummary ?? null,
      });
      const list = await getCalendarList().catch(() => []);
      setCalendarList(Array.isArray(list) ? list : []);
    } catch (e) {
      const err = e as CalendarErrorState;
      setError({ message: err.message || 'Failed to load calendar', status: err.status, serviceAccountEmail: err.serviceAccountEmail });
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((ev) => {
      const keys = getEventDateKeys(ev);
      keys.forEach((key) => {
        if (!map[key]) map[key] = [];
        map[key].push(ev);
      });
    });
    return map;
  }, [events]);

  const calendarColorMap = useMemo(() => buildCalendarColorMap(events), [events]);

  const todayKey = dateToKey(new Date());

  const {
    weekRowsBiweekly,
    weekRowsMonthly,
    days7Weekly,
    selectedDayLabel,
  } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = getStartOfWeek(today);
    const days14: { key: string; dayName: string; dateNum: number; fullLabel: string }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = dateToKey(d);
      days14.push({
        key,
        dayName: d.toLocaleDateString([], { weekday: 'short' }),
        dateNum: d.getDate(),
        fullLabel: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
      });
    }
    const weekRowsBiweekly = [days14.slice(0, 7), days14.slice(7, 14)];
    const sel = keyToDate(selectedDateKey);
    const weekStart = getStartOfWeek(sel);
    const days7Weekly: { key: string; dayName: string; dateNum: number; fullLabel: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days7Weekly.push({
        key: dateToKey(d),
        dayName: d.toLocaleDateString([], { weekday: 'short' }),
        dateNum: d.getDate(),
        fullLabel: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
      });
    }
    const y = today.getFullYear();
    const m = today.getMonth();
    const first = new Date(y, m, 1);
    const startPad = getStartOfWeek(first);
    const weeks: { key: string; dayName: string; dateNum: number }[][] = [];
    let cur = new Date(startPad);
    for (let row = 0; row < 6; row++) {
      const rowDays: { key: string; dayName: string; dateNum: number }[] = [];
      for (let col = 0; col < 7; col++) {
        rowDays.push({ key: dateToKey(cur), dayName: cur.toLocaleDateString([], { weekday: 'short' }), dateNum: cur.getDate() });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(rowDays);
    }
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const weekRowsMonthlyFiltered = weeks.filter((row) => keyToDate(row[6].key) >= todayStart);
    const selectedDayLabel = keyToDate(selectedDateKey).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    return { weekRowsBiweekly, weekRowsMonthly: weekRowsMonthlyFiltered, days7Weekly, selectedDayLabel };
  }, [selectedDateKey]);

  function dayInfo(key: string) {
    const d = keyToDate(key);
    return {
      key,
      dayName: d.toLocaleDateString([], { weekday: 'short' }),
      dateNum: d.getDate(),
    };
  }

  function renderDayColumn(key: string, dayName: string, dateNum: number) {
    const dayEvents = eventsByDay[key] || [];
    const isToday = key === todayKey;
    return (
      <div key={key} className={`calendar-day-col${isToday ? ' is-today' : ''}`}>
        <div className="calendar-day-header">{dayName}</div>
        <div className="calendar-day-date">{dateNum}</div>
        <div className="calendar-day-count">
          {dayEvents.length === 0 ? '0 events' : `${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}`}
        </div>
        <div className="calendar-day-events">
          {dayEvents.length === 0 ? (
            <div className="calendar-empty-day">—</div>
          ) : (
            dayEvents.map((ev, i) => (
              <CalendarEventCard
                key={`${key}-${ev.id ?? i}`}
                event={ev}
                pastelClass={getPastelClass(ev.calendarId, calendarColorMap.get(ev.calendarId ?? '') ?? 0)}
                isContinuation={key !== getEventDateKey(ev)}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  function renderTimeGrid(days: { key: string; dayName: string; dateNum: number }[]) {
    const numDays = days.length;
    const allDayByDay = days.map((d) => (eventsByDay[d.key] || []).filter((e) => e.allDay));
    const timedByDay = days.map((d) => (eventsByDay[d.key] || []).filter((e) => !e.allDay));
    const allTimedInView = timedByDay.flat();
    const earliestStartMin =
      allTimedInView.length > 0
        ? Math.min(...allTimedInView.map((ev) => getMinutesFromMidnight(ev.start)))
        : TIME_GRID_END * 60;
    const gridStartHour =
      earliestStartMin < TIME_GRID_COLLAPSE_BEFORE_HOUR * 60
        ? TIME_GRID_START
        : TIME_GRID_COLLAPSE_BEFORE_HOUR;
    const gridEndHour = TIME_GRID_END;
    const hours: number[] = [];
    for (let h = gridStartHour; h < gridEndHour; h++) hours.push(h);
    return (
      <div className={`calendar-time-grid-wrap${numDays === 1 ? ' calendar-time-grid-daily' : ''}`}>
        <div className="calendar-time-grid-header">
          <div className="time-col"> </div>
          {days.map((d) => (
            <div key={d.key} className="day-label">
              {d.dayName}
              <span className="day-num">{d.dateNum}</span>
            </div>
          ))}
        </div>
        <div className="calendar-time-grid-all-day">
          <div className="time-col">All day</div>
          {days.map((d, colIdx) => (
            <div key={d.key} className="day-slot">
              {allDayByDay[colIdx].map((ev, i) => (
                <div
                  key={ev.id ?? i}
                  className={getPastelClass(ev.calendarId, calendarColorMap.get(ev.calendarId ?? '') ?? 0)}
                  style={{ padding: '0.35rem 0.5rem', borderRadius: 8, fontSize: '0.75rem' }}
                >
                  <span className="event-title">{ev.summary || '(No title)'}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="calendar-time-grid-body">
          <div className="calendar-time-grid-hours">
            {hours.map((h) => (
              <div key={h} className="hour-row">
                {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
              </div>
            ))}
          </div>
          <div className="calendar-time-grid-slots">
            {days.map((d, colIdx) => (
              <div key={d.key} className="calendar-time-grid-column">
                {timedByDay[colIdx]
                  .filter((ev) => {
                    const startMin = getMinutesFromMidnight(ev.start);
                    const endMin = startMin + getDurationMinutes(ev);
                    return endMin > gridStartHour * 60 && startMin < gridEndHour * 60;
                  })
                  .map((ev, i) => {
                    const pos = getTimeGridPosition(ev, gridStartHour, gridEndHour);
                    const pastel = getPastelClass(ev.calendarId, calendarColorMap.get(ev.calendarId ?? '') ?? 0).replace('calendar-event-card ', '');
                    return (
                      <div
                        key={ev.id ?? `${d.key}-${i}`}
                        className={`calendar-time-grid-event ${pastel}`}
                        style={{
                          top: `${pos.topPct}%`,
                          height: `${pos.heightPct}%`,
                          minHeight: 24,
                        }}
                      >
                        <div className="event-title">{ev.summary || '(No title)'}</div>
                        <div className="event-time">{formatEventTime(ev)}</div>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="calendar-wrap">
        <div className="error-banner">
          {error.message}
          {error.serviceAccountEmail && (
            <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.85rem' }}>
              Share your calendar with: <code>{error.serviceAccountEmail}</code>
            </span>
          )}
        </div>
        <button type="button" className="calendar-refresh" onClick={load}>Retry</button>
      </div>
    );
  }

  if (loading) return <div className="loading">Loading calendar…</div>;

  return (
    <div className="calendar-wrap">
      <div className="calendar-header">
        <span className="calendar-meta">
          {calendarMeta.calendarSummary ? `${calendarMeta.calendarSummary} · ` : ''}
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select
            className="calendar-view-select"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as CalendarViewMode)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <button type="button" className="calendar-refresh" onClick={load}>
            Refresh
          </button>
        </div>
      </div>
      {events.length === 0 && (
        <div className="calendar-no-events-box">
          <p>No upcoming events.</p>
          <p>
            {calendarMeta.calendarId
              ? <>Showing <strong>{calendarMeta.calendarSummary || calendarMeta.calendarId}</strong>. To use a different calendar, set <code>CALENDAR_ID</code> in your .env to one of the IDs below.</>
              : 'Share your Google Calendar with the service account email (see README). Set <code>CALENDAR_ID</code> in .env to your calendar\'s ID if you have multiple.'}
          </p>
          {calendarList.length > 0 && (
            <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.85rem' }}>
              Available calendars: {calendarList.map((c) => <code key={c.id} style={{ marginRight: '0.5em' }} title={c.id}>{c.summary}</code>)}
            </p>
          )}
        </div>
      )}
      {events.length > 0 && (
        <>
          {viewMode === 'daily' && (
            <>
              <div className="calendar-day-nav">
                <button type="button" onClick={() => setSelectedDateKey((k) => dateToKey(new Date(keyToDate(k).getTime() - 86400000)))}>← Previous</button>
                <span className="current-day-label">{selectedDayLabel}</span>
                <button type="button" onClick={() => setSelectedDateKey((k) => dateToKey(new Date(keyToDate(k).getTime() + 86400000)))}>Next →</button>
              </div>
              {renderTimeGrid([dayInfo(selectedDateKey)])}
            </>
          )}
          {viewMode === 'weekly' && (
            <>
              <div className="calendar-day-nav">
                <button type="button" onClick={() => setSelectedDateKey(dateToKey(new Date(keyToDate(selectedDateKey).getTime() - 7 * 86400000)))}>← Previous week</button>
                <span className="current-day-label">Week of {days7Weekly[0]?.fullLabel ?? ''}</span>
                <button type="button" onClick={() => setSelectedDateKey(dateToKey(new Date(keyToDate(selectedDateKey).getTime() + 7 * 86400000)))}>Next week →</button>
              </div>
              {renderTimeGrid(days7Weekly.map((d) => ({ key: d.key, dayName: d.dayName, dateNum: d.dateNum })))}
            </>
          )}
          {viewMode === 'biweekly' && (
            <div className="calendar-week-rows">
              {weekRowsBiweekly.map((row, rowIdx) => (
                <div key={rowIdx} className="calendar-week-row">
                  {row.map((d) => renderDayColumn(d.key, d.dayName, d.dateNum))}
                </div>
              ))}
            </div>
          )}
          {viewMode === 'monthly' && (
            <div className="calendar-week-rows">
              {weekRowsMonthly.map((row, rowIdx) => (
                <div key={rowIdx} className="calendar-week-row">
                  {row.map((d) => renderDayColumn(d.key, d.dayName, d.dateNum))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
