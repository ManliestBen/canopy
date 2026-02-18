import { useState, useEffect } from 'react';
import { getCalendarEvent, updateCalendarEvent, type UpdateCalendarEventPayload } from '../api';
import type { CalendarEvent } from '../types';
import type { SavedCalendar } from '../api';
import { RECURRENCE_OPTIONS, REMINDER_PRESETS } from './AddEventModal';

/** Parse API event start/end into date, startTime, endTime, allDay. */
function eventToFormState(ev: CalendarEvent) {
  const start = ev.start ?? '';
  const end = ev.end ?? start;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const allDay = ev.allDay ?? dateOnly.test(start);
  let date = '';
  let startTime = '09:00';
  let endTime = '10:00';
  if (dateOnly.test(start)) {
    date = start;
  } else {
    const d = new Date(start);
    date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    startTime = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const de = new Date(end);
    endTime = String(de.getHours()).padStart(2, '0') + ':' + String(de.getMinutes()).padStart(2, '0');
  }
  return { date, startTime, endTime, allDay };
}

/** Match first reminder override to a preset label or null. */
function reminderToPreset(reminders: CalendarEvent['reminders']): string {
  const o = reminders?.overrides?.[0];
  if (!o) return '';
  const m = o.method === 'email' ? 'email' : 'popup';
  const match = REMINDER_PRESETS.find((p) => p.method === m && p.minutes === o.minutes);
  return match?.label ?? '';
}

interface EditEventModalProps {
  calendarId: string;
  eventId: string;
  savedCalendars: SavedCalendar[];
  initialEvent: CalendarEvent | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditEventModal({
  calendarId,
  eventId,
  savedCalendars,
  initialEvent,
  onClose,
  onSuccess,
}: EditEventModalProps) {
  const [event, setEvent] = useState<CalendarEvent | null>(initialEvent);
  const [loading, setLoading] = useState(!initialEvent);
  const [title, setTitle] = useState(initialEvent?.summary ?? '');
  const [date, setDate] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [recurrencePreset, setRecurrencePreset] = useState('none');
  const [customRecurrence, setCustomRecurrence] = useState({ every: 1, unit: 'week' as 'day' | 'week' | 'month' | 'year', byDay: [1, 2, 3, 4, 5] as number[] });
  const [reminderPreset, setReminderPreset] = useState<string>('');
  const [customReminder, setCustomReminder] = useState({ method: 'popup' as 'popup' | 'email', value: 30, unit: 'minutes' as 'minutes' | 'hours' | 'days' });
  const [showCustomReminder, setShowCustomReminder] = useState(false);
  const [guestsText, setGuestsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialEvent) {
      setEvent(initialEvent);
      setTitle(initialEvent.summary ?? '');
      const { date: d, startTime: st, endTime: et, allDay: ad } = eventToFormState(initialEvent);
      setDate(d);
      setStartTime(st);
      setEndTime(et);
      setAllDay(ad);
      setLocation(initialEvent.location ?? '');
      setDescription(initialEvent.description ?? '');
      setRecurrencePreset(initialEvent.recurrence?.length ? 'custom' : 'none');
      setReminderPreset(reminderToPreset(initialEvent.reminders));
      setGuestsText((initialEvent.attendees ?? []).join(', '));
      setLoading(false);
      return;
    }
    let cancelled = false;
    getCalendarEvent(calendarId, eventId)
      .then((ev) => {
        if (!cancelled) {
          setEvent(ev);
          setTitle(ev.summary ?? '');
          const { date: d, startTime: st, endTime: et, allDay: ad } = eventToFormState(ev);
          setDate(d);
          setStartTime(st);
          setEndTime(et);
          setAllDay(ad);
          setLocation(ev.location ?? '');
          setDescription(ev.description ?? '');
          setRecurrencePreset(ev.recurrence?.length ? 'custom' : 'none');
          setReminderPreset(reminderToPreset(ev.reminders));
          setGuestsText((ev.attendees ?? []).join(', '));
        }
      })
      .catch((err) => { if (!cancelled) setError((err as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [calendarId, eventId, initialEvent]);

  const buildRecurrence = (): string[] | undefined => {
    if (recurrencePreset === 'none') return undefined;
    const opt = RECURRENCE_OPTIONS.find((o) => o.value === recurrencePreset);
    if (opt?.rrule?.length) return opt.rrule;
    if (recurrencePreset === 'custom') {
      const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const byDay = customRecurrence.byDay.length ? customRecurrence.byDay.map((d) => DAY_CODES[d]).join(',') : 'MO';
      const freq = customRecurrence.unit.toUpperCase().slice(0, 2);
      if (freq === 'WE') return [`RRULE:FREQ=WEEKLY;INTERVAL=${customRecurrence.every};BYDAY=${byDay}`];
      if (freq === 'DA') return [`RRULE:FREQ=DAILY;INTERVAL=${customRecurrence.every}`];
      if (freq === 'MO') return [`RRULE:FREQ=MONTHLY;INTERVAL=${customRecurrence.every}`];
      if (freq === 'YE') return [`RRULE:FREQ=YEARLY;INTERVAL=${customRecurrence.every}`];
    }
    return undefined;
  };

  const buildReminders = (): UpdateCalendarEventPayload['reminders'] | undefined => {
    if (showCustomReminder) {
      let minutes = customReminder.value;
      if (customReminder.unit === 'hours') minutes *= 60;
      if (customReminder.unit === 'days') minutes *= 24 * 60;
      return { overrides: [{ method: customReminder.method, minutes }] };
    }
    const match = REMINDER_PRESETS.find((p) => p.label === reminderPreset);
    if (match) return { overrides: [{ method: match.method, minutes: match.minutes }] };
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const allDayChecked = (form.elements.namedItem('allDay') as HTMLInputElement | null)?.checked ?? allDay;
    const dateStr = (date || '').trim().slice(0, 10);
    if (allDayChecked && (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr))) {
      setError('Please select a date for all-day events.');
      return;
    }
    if (!allDayChecked && (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr))) {
      setError('Please select a date.');
      return;
    }
    setSaving(true);
    try {
      const attendees = guestsText.split(/[\s,;]+/).map((s) => s.trim()).filter((s) => s.includes('@'));
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const payload: UpdateCalendarEventPayload = {
        summary: title.trim() || '(No title)',
        date: dateStr || date,
        allDay: allDayChecked,
        startTime: allDayChecked ? undefined : startTime,
        endTime: allDayChecked ? undefined : endTime,
        timeZone: allDayChecked ? undefined : timeZone,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        recurrence: buildRecurrence(),
        reminders: buildReminders(),
        attendees: attendees.length ? attendees : undefined,
      };
      await updateCalendarEvent(calendarId, eventId, payload);
      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="event-detail-modal-backdrop" role="dialog" aria-modal="true" aria-busy="true">
        <div className="event-detail-modal add-event-modal">
          <p className="loading">Loading event…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="event-detail-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-event-modal-title"
    >
      <div className="event-detail-modal add-event-modal">
        <button type="button" className="event-detail-modal-close" onClick={onClose} aria-label="Close">×</button>
        <h2 id="edit-event-modal-title" className="event-detail-title" style={{ marginBottom: '1rem' }}>Edit event</h2>
        <form onSubmit={handleSubmit} className="add-event-form">
          {error && <div className="error-banner" style={{ marginBottom: '1rem' }}>{error}</div>}
          <div className="add-event-field">
            <label htmlFor="edit-event-title">Title</label>
            <input id="edit-event-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add title" className="add-event-input" />
          </div>
          <div className="add-event-row">
            <div className="add-event-field">
              <label htmlFor="edit-event-date">Date</label>
              <input id="edit-event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="add-event-input" />
            </div>
            <div className="add-event-field add-event-checkbox">
              <label><input name="allDay" type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day</label>
            </div>
          </div>
          {!allDay && (
            <div className="add-event-row">
              <div className="add-event-field">
                <label htmlFor="edit-event-start">Start time</label>
                <input id="edit-event-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="add-event-input" />
              </div>
              <div className="add-event-field">
                <label htmlFor="edit-event-end">End time</label>
                <input id="edit-event-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="add-event-input" />
              </div>
            </div>
          )}
          <div className="add-event-field">
            <label>Repeat</label>
            <select value={recurrencePreset} onChange={(e) => setRecurrencePreset(e.target.value)} className="add-event-select" aria-label="Repeat frequency">
              {RECURRENCE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
            {recurrencePreset === 'custom' && (
              <div className="add-event-custom-recurrence">
                <label>Repeat every</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="number" min={1} value={customRecurrence.every} onChange={(e) => setCustomRecurrence((c) => ({ ...c, every: Math.max(1, parseInt(e.target.value, 10) || 1) }))} className="add-event-input" style={{ width: '4rem' }} />
                  <select value={customRecurrence.unit} onChange={(e) => setCustomRecurrence((c) => ({ ...c, unit: e.target.value as 'day' | 'week' | 'month' | 'year' }))} className="add-event-select">
                    <option value="day">day(s)</option><option value="week">week(s)</option><option value="month">month(s)</option><option value="year">year(s)</option>
                  </select>
                </div>
                {customRecurrence.unit === 'week' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <label>Repeat on</label>
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((letter, i) => (
                        <button key={i} type="button" className={`add-event-day-btn ${customRecurrence.byDay.includes(i) ? 'active' : ''}`}
                          onClick={() => setCustomRecurrence((c) => ({ ...c, byDay: c.byDay.includes(i) ? c.byDay.filter((d) => d !== i) : [...c.byDay, i].sort((a, b) => a - b) }))}>{letter}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="add-event-field">
            <label>Notification reminders</label>
            <select value={showCustomReminder ? 'custom' : reminderPreset} onChange={(e) => { setReminderPreset(e.target.value); setShowCustomReminder(e.target.value === 'custom'); }} className="add-event-select" aria-label="Reminder">
              <option value="">None</option>
              {REMINDER_PRESETS.map((p) => (<option key={p.label} value={p.label}>{p.label}</option>))}
              <option value="custom">Custom...</option>
            </select>
            {showCustomReminder && (
              <div className="add-event-custom-reminder">
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <select value={customReminder.method} onChange={(e) => setCustomReminder((c) => ({ ...c, method: e.target.value as 'popup' | 'email' }))} className="add-event-select">
                    <option value="popup">Notification</option><option value="email">Email</option>
                  </select>
                  <input type="number" min={1} value={customReminder.value} onChange={(e) => setCustomReminder((c) => ({ ...c, value: Math.max(1, parseInt(e.target.value, 10) || 1) }))} className="add-event-input" style={{ width: '4rem' }} />
                  <select value={customReminder.unit} onChange={(e) => setCustomReminder((c) => ({ ...c, unit: e.target.value as 'minutes' | 'hours' | 'days' }))} className="add-event-select">
                    <option value="minutes">minutes before</option><option value="hours">hours before</option><option value="days">days before</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          <div className="add-event-field">
            <label htmlFor="edit-event-guests">Guests</label>
            <input id="edit-event-guests" type="text" value={guestsText} onChange={(e) => setGuestsText(e.target.value)} placeholder="Email addresses (comma or space separated)" className="add-event-input" />
          </div>
          <div className="add-event-field">
            <label htmlFor="edit-event-location">Location</label>
            <input id="edit-event-location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add location" className="add-event-input" />
          </div>
          <div className="add-event-field">
            <label htmlFor="edit-event-description">Description</label>
            <textarea id="edit-event-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add description" className="add-event-input add-event-textarea" rows={3} />
          </div>
          <div className="event-detail-modal-actions" style={{ marginTop: '1rem', paddingBottom: 0 }}>
            <button type="button" onClick={onClose} className="add-event-btn add-event-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="add-event-btn add-event-btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
