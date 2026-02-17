import { useState, useEffect, useMemo } from 'react';
import { getCalendarEvents, getCalendarList, getSavedCalendars, addSavedCalendar, updateSavedCalendar, deleteSavedCalendar } from '../api';
import type { CalendarEvent } from '../types';
import type { SavedCalendar } from '../api';

export type CalendarViewMode = 'daily' | 'weekly' | 'biweekly' | 'monthly';

const PASTEL_CLASSES = [
  'pastel-0', 'pastel-1', 'pastel-2', 'pastel-3', 'pastel-4',
  'pastel-5', 'pastel-6', 'pastel-7', 'pastel-8', 'pastel-9',
  'pastel-10', 'pastel-11', 'pastel-12', 'pastel-13', 'pastel-14',
  'pastel-15', 'pastel-16', 'pastel-17', 'pastel-18', 'pastel-19',
] as const;

const PASTEL_COUNT = PASTEL_CLASSES.length;

/** Hex colors for the 20 pastels (for color picker swatches). */
const PASTEL_HEX = [
  '#FFF8E1', '#E6FFDD', '#A5E0DA', '#D4E8F7', '#E0D4ED', '#FFDDE7', '#FFCCCC', '#FFE4D4', '#E8E4F0', '#D4F0F0',
  '#FEF3C7', '#FED7AA', '#E2E8F0', '#FECDD3', '#D9F99D', '#BAE6FD', '#DDD6FE', '#F5D0FE', '#A5F3FC', '#A7F3D0',
];

function CalendarManagement({ savedCalendars, onRefresh }: { savedCalendars: SavedCalendar[]; onRefresh: () => void }) {
  const [addTitle, setAddTitle] = useState('');
  const [addCalendarId, setAddCalendarId] = useState('');
  const [addColorIndex, setAddColorIndex] = useState(0);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCalendarId, setEditCalendarId] = useState('');
  const [editColorIndex, setEditColorIndex] = useState(0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const title = addTitle.trim();
    const calendarId = addCalendarId.trim();
    if (!title || !calendarId) {
      setAddError('Title and Calendar ID are required');
      return;
    }
    setAdding(true);
    try {
      await addSavedCalendar({ title, calendarId, colorIndex: addColorIndex });
      setAddTitle('');
      setAddCalendarId('');
      setAddColorIndex(0);
      onRefresh();
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (c: SavedCalendar) => {
    setEditingId(c.id);
    setEditTitle(c.title);
    setEditCalendarId(c.calendarId);
    setEditColorIndex(c.colorIndex);
  };

  const cancelEdit = () => setEditingId(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId == null) return;
    try {
      await updateSavedCalendar(editingId, { title: editTitle.trim(), calendarId: editCalendarId.trim(), colorIndex: editColorIndex });
      setEditingId(null);
      onRefresh();
    } catch (err) {
      setAddError((err as Error).message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this calendar from the list?')) return;
    try {
      await deleteSavedCalendar(id);
      if (editingId === id) setEditingId(null);
      onRefresh();
    } catch (err) {
      setAddError((err as Error).message);
    }
  };

  return (
    <section className="calendar-management" aria-label="Calendar list">
      <form className="calendar-management-form" onSubmit={handleAdd}>
        <div className="calendar-management-fields">
          <div className="calendar-management-input-row">
            <input
              type="text"
              placeholder="Title (e.g. Holidays)"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              className="calendar-management-input"
              aria-label="Calendar title"
            />
            <input
              type="text"
              placeholder="Calendar ID (e.g. usa#holiday@group.v.calendar.google.com)"
              value={addCalendarId}
              onChange={(e) => setAddCalendarId(e.target.value)}
              className="calendar-management-input calendar-management-input-id"
              aria-label="Calendar ID"
            />
          </div>
          <div className="calendar-management-colors" role="group" aria-label="Color">
            {PASTEL_HEX.map((hex, i) => (
              <button
                key={i}
                type="button"
                className={`calendar-management-swatch${addColorIndex === i ? ' is-selected' : ''}`}
                style={{ background: hex }}
                title={`Color ${i + 1}`}
                onClick={() => setAddColorIndex(i)}
              />
            ))}
          </div>
          <button type="submit" className="calendar-management-submit" disabled={adding}>
            {adding ? 'Adding…' : 'Add calendar'}
          </button>
        </div>
      </form>
      {addError && <p className="calendar-management-error">{addError}</p>}
      <ul className="calendar-management-list">
        {savedCalendars.map((c) => (
          <li key={c.id} className="calendar-management-item">
            {editingId === c.id ? (
              <form className="calendar-management-edit-form" onSubmit={handleUpdate}>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="calendar-management-input"
                  placeholder="Title"
                />
                <input
                  type="text"
                  value={editCalendarId}
                  onChange={(e) => setEditCalendarId(e.target.value)}
                  className="calendar-management-input calendar-management-input-id"
                  placeholder="Calendar ID"
                />
                <div className="calendar-management-colors" role="group" aria-label="Color">
                  {PASTEL_HEX.map((hex, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`calendar-management-swatch${editColorIndex === i ? ' is-selected' : ''}`}
                      style={{ background: hex }}
                      onClick={() => setEditColorIndex(i)}
                    />
                  ))}
                </div>
                <button type="submit" className="calendar-management-submit">Save</button>
                <button type="button" onClick={cancelEdit}>Cancel</button>
              </form>
            ) : (
              <>
                <span className="calendar-management-swatch calendar-management-swatch-inline" style={{ background: PASTEL_HEX[c.colorIndex] ?? PASTEL_HEX[0] }} />
                <span className="calendar-management-item-title">{c.title}</span>
                <code className="calendar-management-item-id" title={c.calendarId}>{c.calendarId.length > 35 ? `${c.calendarId.slice(0, 32)}…` : c.calendarId}</code>
                <span className="calendar-management-item-actions">
                  <button type="button" className="calendar-management-btn" onClick={() => startEdit(c)}>Edit</button>
                  <button type="button" className="calendar-management-btn calendar-management-btn-danger" onClick={() => handleDelete(c.id)}>Remove</button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

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

function buildCalendarColorMap(
  events: CalendarEvent[],
  calendarColors?: Record<string, number>
): Map<string, number> {
  if (calendarColors && Object.keys(calendarColors).length > 0) {
    const map = new Map<string, number>();
    Object.entries(calendarColors).forEach(([id, idx]) => map.set(id, Math.max(0, Math.min(PASTEL_COUNT - 1, idx))));
    return map;
  }
  const ids = Array.from(new Set(events.map((e) => e.calendarId).filter(Boolean) as string[])).sort();
  const map = new Map<string, number>();
  ids.forEach((id, i) => map.set(id, i % PASTEL_COUNT));
  return map;
}

function getPastelClass(calendarId: string | undefined, index: number): string {
  const i = Math.max(0, Math.min(PASTEL_COUNT - 1, index)) % PASTEL_COUNT;
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

function formatEventDate(ev: CalendarEvent): string {
  const d = new Date(ev.start);
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function EventDetailModal({
  event,
  calendarSummaries,
  calendarList,
  onClose,
}: {
  event: CalendarEvent;
  /** Map of calendar ID → title from API (includes public calendars like Holidays) */
  calendarSummaries: Record<string, string>;
  calendarList: { id: string; summary?: string }[];
  onClose: () => void;
}) {
  const title = event.summary || '(No title)';
  const eventCalendarName = event.calendarId
    ? (calendarSummaries[event.calendarId] ?? calendarList.find((c) => c.id === event.calendarId)?.summary ?? event.calendarId)
    : null;
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };
  return (
    <div
      className="event-detail-modal-backdrop"
      onClick={handleBackdrop}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-detail-title"
    >
      <div className="event-detail-modal">
        <button type="button" className="event-detail-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="event-detail-modal-content">
          <h2 id="event-detail-title" className="event-detail-title">{title}</h2>
          <div className="event-detail-date">{formatEventDate(event)}</div>
          <div className="event-detail-time">{formatEventTime(event)}</div>
          {event.location && (
            <div className="event-detail-row">
              <span className="event-detail-icon" aria-hidden>📍</span>
              <span>{event.location}</span>
            </div>
          )}
          {event.description && (
            <div className="event-detail-description">{event.description}</div>
          )}
          {eventCalendarName && (
            <div className="event-detail-row">
              <span className="event-detail-icon" aria-hidden>📅</span>
              <span>{eventCalendarName}</span>
            </div>
          )}
        </div>
        <div className="event-detail-modal-actions">
          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="event-detail-edit-link"
            >
              Edit in Google Calendar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarEventCard({
  event,
  pastelClass,
  isContinuation,
  onSelect,
}: {
  event: CalendarEvent;
  pastelClass: string;
  isContinuation: boolean;
  onSelect?: (ev: CalendarEvent) => void;
}) {
  const title = event.summary || '(No title)';
  return (
    <div
      className={pastelClass}
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(event)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(event); } }}
    >
      <div className="event-title">{isContinuation ? `${title} (cont'd)` : title}</div>
      <div className="event-time">{formatEventTime(event)}</div>
      {event.location && <div className="event-location">{event.location}</div>}
    </div>
  );
}

export function CalendarTab() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<CalendarErrorState | null>(null);
  const [calendarMeta, setCalendarMeta] = useState<{ calendarId: string | null; calendarSummary: string | null }>({ calendarId: null, calendarSummary: null });
  const [calendarList, setCalendarList] = useState<{ id: string; summary?: string }[]>([]);
  const [calendarSummaries, setCalendarSummaries] = useState<Record<string, string>>({});
  const [calendarColors, setCalendarColors] = useState<Record<string, number>>({});
  const [calendarErrors, setCalendarErrors] = useState<string[]>([]);
  const [savedCalendars, setSavedCalendars] = useState<SavedCalendar[]>([]);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('biweekly');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => dateToKey(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [calendarsModalOpen, setCalendarsModalOpen] = useState(false);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [data, saved] = await Promise.all([
        getCalendarEvents({ days: 42, maxResults: 100 }),
        getSavedCalendars().catch(() => []),
      ]);
      const eventList = Array.isArray(data) ? data : (data as { events?: CalendarEvent[] }).events ?? [];
      setEvents(eventList);
      setCalendarMeta({
        calendarId: Array.isArray(data) ? null : (data as { calendarId?: string }).calendarId ?? null,
        calendarSummary: Array.isArray(data) ? null : (data as { calendarSummary?: string }).calendarSummary ?? null,
      });
      setCalendarSummaries(Array.isArray(data) ? {} : (data as { calendarSummaries?: Record<string, string> }).calendarSummaries ?? {});
      setCalendarColors(Array.isArray(data) ? {} : (data as { calendarColors?: Record<string, number> }).calendarColors ?? {});
      setCalendarErrors(Array.isArray(data) ? [] : (data as { calendarErrors?: string[] }).calendarErrors ?? []);
      setSavedCalendars(Array.isArray(saved) ? saved : []);
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

  useEffect(() => {
    if (!selectedEvent) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedEvent(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedEvent]);

  useEffect(() => {
    if (!calendarsModalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCalendarsModalOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [calendarsModalOpen]);

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

  const calendarColorMap = useMemo(() => buildCalendarColorMap(events, calendarColors), [events, calendarColors]);

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
                onSelect={setSelectedEvent}
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
                  role="button"
                  tabIndex={0}
                  className={`calendar-clickable-event ${getPastelClass(ev.calendarId, calendarColorMap.get(ev.calendarId ?? '') ?? 0)}`}
                  style={{ padding: '0.35rem 0.5rem', borderRadius: 8, fontSize: '0.75rem' }}
                  onClick={() => setSelectedEvent(ev)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedEvent(ev); } }}
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
                        role="button"
                        tabIndex={0}
                        className={`calendar-time-grid-event calendar-clickable-event ${pastel}`}
                        style={{
                          top: `${pos.topPct}%`,
                          height: `${pos.heightPct}%`,
                          minHeight: 24,
                        }}
                        onClick={() => setSelectedEvent(ev)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedEvent(ev); } }}
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
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          calendarSummaries={calendarSummaries}
          calendarList={calendarList}
          onClose={() => setSelectedEvent(null)}
        />
      )}
      <div className="calendar-header">
        <span className="calendar-meta">
          {calendarMeta.calendarSummary ? `${calendarMeta.calendarSummary} · ` : ''}
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          className="calendar-calendars-btn"
          onClick={() => setCalendarsModalOpen(true)}
          aria-label="Manage calendars"
        >
          Calendars
        </button>
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
      {calendarErrors.length > 0 && (
        <div className="calendar-warning-banner">
          <strong>Some calendars could not be loaded:</strong>
          <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem' }}>
            {calendarErrors.map((msg, i) => <li key={i}>{msg}</li>)}
          </ul>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>Share each calendar with the service account email, or remove it below.</p>
        </div>
      )}
      {calendarsModalOpen && (
        <div
          className="event-detail-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setCalendarsModalOpen(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setCalendarsModalOpen(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendars-modal-title"
        >
          <div className="event-detail-modal calendars-modal">
            <button
              type="button"
              className="event-detail-modal-close"
              onClick={() => setCalendarsModalOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="calendars-modal-content">
              <h2 id="calendars-modal-title" className="event-detail-title">Calendars</h2>
              <CalendarManagement
                savedCalendars={savedCalendars}
                onRefresh={load}
              />
            </div>
          </div>
        </div>
      )}
      {events.length === 0 && savedCalendars.length === 0 && (
        <div className="calendar-no-events-box">
          <p>Add a calendar to see events (click <strong>Calendars</strong> above).</p>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Share your Google Calendar with the service account email (see README), then add the calendar with its ID.
          </p>
        </div>
      )}
      {events.length === 0 && savedCalendars.length > 0 && (
        <div className="calendar-no-events-box">
          <p>No upcoming events in the selected calendars.</p>
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
