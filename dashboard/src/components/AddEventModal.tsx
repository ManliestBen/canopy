import { useState } from 'react';
import { createCalendarEvent, type CreateCalendarEventPayload, type SavedCalendar } from '../api';

export const RECURRENCE_OPTIONS: { value: string; label: string; rrule?: string[] }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily', rrule: ['RRULE:FREQ=DAILY'] },
  { value: 'weekdays', label: 'Every weekday (Monday to Friday)', rrule: ['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'] },
  { value: 'weekly_su', label: 'Weekly on Sunday', rrule: ['RRULE:FREQ=WEEKLY;BYDAY=SU'] },
  { value: 'weekly_mo', label: 'Weekly on Monday', rrule: ['RRULE:FREQ=WEEKLY;BYDAY=MO'] },
  { value: 'weekly_tu', label: 'Weekly on Tuesday', rrule: ['RRULE:FREQ=WEEKLY;BYDAY=TU'] },
  { value: 'weekly_we', label: 'Weekly on Wednesday', rrule: ['RRULE:FREQ=WEEKLY;BYDAY=WE'] },
  { value: 'weekly_th', label: 'Weekly on Thursday', rrule: ['RRULE:FREQ=WEEKLY;BYDAY=TH'] },
  { value: 'weekly_fr', label: 'Weekly on Friday', rrule: ['RRULE:FREQ=WEEKLY;BYDAY=FR'] },
  { value: 'weekly_sa', label: 'Weekly on Saturday', rrule: ['RRULE:FREQ=WEEKLY;BYDAY=SA'] },
  { value: 'monthly_first', label: 'Monthly on the first', rrule: ['RRULE:FREQ=MONTHLY;BYDAY=1MO'] },
  { value: 'annually', label: 'Annually', rrule: ['RRULE:FREQ=YEARLY'] },
  { value: 'custom', label: 'Custom...' },
];

export const REMINDER_PRESETS: { label: string; method: 'popup' | 'email'; minutes: number }[] = [
  { label: '5 minutes before', method: 'popup', minutes: 5 },
  { label: '10 minutes before', method: 'popup', minutes: 10 },
  { label: '15 minutes before', method: 'popup', minutes: 15 },
  { label: '30 minutes before', method: 'popup', minutes: 30 },
  { label: '1 hour before', method: 'popup', minutes: 60 },
  { label: '1 day before', method: 'popup', minutes: 24 * 60 },
  { label: '30 minutes before, as email', method: 'email', minutes: 30 },
  { label: '1 hour before, as email', method: 'email', minutes: 60 },
  { label: '1 day before, as email', method: 'email', minutes: 24 * 60 },
];

interface AddEventModalProps {
  savedCalendars: SavedCalendar[];
  defaultDate?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddEventModal({ savedCalendars, defaultDate, onClose, onSuccess }: AddEventModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate || today);
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [calendarId, setCalendarId] = useState(savedCalendars[0]?.calendarId ?? '');
  const [recurrencePreset, setRecurrencePreset] = useState('none');
  const [customRecurrence, setCustomRecurrence] = useState({ every: 1, unit: 'week' as 'day' | 'week' | 'month' | 'year', byDay: [1, 2, 3, 4, 5] as number[] });
  const [reminderPreset, setReminderPreset] = useState<string>('');
  const [customReminder, setCustomReminder] = useState({ method: 'popup' as 'popup' | 'email', value: 30, unit: 'minutes' as 'minutes' | 'hours' | 'days' });
  const [showCustomReminder, setShowCustomReminder] = useState(false);
  const [guestsText, setGuestsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const buildReminders = (): CreateCalendarEventPayload['reminders'] | undefined => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!calendarId) {
      setError('Please select a calendar.');
      return;
    }
    setSaving(true);
    try {
      const attendees = guestsText
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.includes('@'));
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const payload: CreateCalendarEventPayload = {
        calendarId,
        summary: title.trim() || '(No title)',
        date,
        allDay,
        startTime: allDay ? undefined : startTime,
        endTime: allDay ? undefined : endTime,
        timeZone: allDay ? undefined : timeZone,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        recurrence: buildRecurrence(),
        reminders: buildReminders(),
        attendees: attendees.length ? attendees : undefined,
      };
      await createCalendarEvent(payload);
      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="event-detail-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-event-modal-title"
    >
      <div className="event-detail-modal add-event-modal">
        <button type="button" className="event-detail-modal-close" onClick={onClose} aria-label="Close">×</button>
        <h2 id="add-event-modal-title" className="event-detail-title" style={{ marginBottom: '1rem' }}>Add event</h2>
        <form onSubmit={handleSubmit} className="add-event-form">
          {error && <div className="error-banner" style={{ marginBottom: '1rem' }}>{error}</div>}
          <div className="add-event-field">
            <label htmlFor="add-event-title">Title</label>
            <input
              id="add-event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add title"
              className="add-event-input"
            />
          </div>
          <div className="add-event-row">
            <div className="add-event-field">
              <label htmlFor="add-event-date">Date</label>
              <input
                id="add-event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="add-event-input"
              />
            </div>
            <div className="add-event-field add-event-checkbox">
              <label>
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
                All day
              </label>
            </div>
          </div>
          {!allDay && (
            <div className="add-event-row">
              <div className="add-event-field">
                <label htmlFor="add-event-start">Start time</label>
                <input
                  id="add-event-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="add-event-input"
                />
              </div>
              <div className="add-event-field">
                <label htmlFor="add-event-end">End time</label>
                <input
                  id="add-event-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="add-event-input"
                />
              </div>
            </div>
          )}
          <div className="add-event-field">
            <label>Repeat</label>
            <select
              value={recurrencePreset}
              onChange={(e) => setRecurrencePreset(e.target.value)}
              className="add-event-select"
              aria-label="Repeat frequency"
            >
              {RECURRENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {recurrencePreset === 'custom' && (
              <div className="add-event-custom-recurrence">
                <label>Repeat every</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    min={1}
                    value={customRecurrence.every}
                    onChange={(e) => setCustomRecurrence((c) => ({ ...c, every: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                    className="add-event-input"
                    style={{ width: '4rem' }}
                  />
                  <select
                    value={customRecurrence.unit}
                    onChange={(e) => setCustomRecurrence((c) => ({ ...c, unit: e.target.value as 'day' | 'week' | 'month' | 'year' }))}
                    className="add-event-select"
                  >
                    <option value="day">day(s)</option>
                    <option value="week">week(s)</option>
                    <option value="month">month(s)</option>
                    <option value="year">year(s)</option>
                  </select>
                </div>
                {customRecurrence.unit === 'week' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <label>Repeat on</label>
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((letter, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`add-event-day-btn ${customRecurrence.byDay.includes(i) ? 'active' : ''}`}
                          onClick={() => {
                            setCustomRecurrence((c) => ({
                              ...c,
                              byDay: c.byDay.includes(i) ? c.byDay.filter((d) => d !== i) : [...c.byDay, i].sort((a, b) => a - b),
                            }));
                          }}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="add-event-field">
            <label htmlFor="add-event-calendar">Calendar</label>
            <select
              id="add-event-calendar"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              className="add-event-select"
              required
            >
              {savedCalendars.map((c) => (
                <option key={c.id} value={c.calendarId}>{c.title}</option>
              ))}
            </select>
          </div>
          <div className="add-event-field">
            <label>Notification reminders</label>
            <select
              value={showCustomReminder ? 'custom' : reminderPreset}
              onChange={(e) => {
                const v = e.target.value;
                setReminderPreset(v);
                setShowCustomReminder(v === 'custom');
              }}
              className="add-event-select"
              aria-label="Reminder"
            >
              <option value="">None</option>
              {REMINDER_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
              <option value="custom">Custom...</option>
            </select>
            {showCustomReminder && (
              <div className="add-event-custom-reminder">
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <select
                    value={customReminder.method}
                    onChange={(e) => setCustomReminder((c) => ({ ...c, method: e.target.value as 'popup' | 'email' }))}
                    className="add-event-select"
                  >
                    <option value="popup">Notification</option>
                    <option value="email">Email</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={customReminder.value}
                    onChange={(e) => setCustomReminder((c) => ({ ...c, value: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                    className="add-event-input"
                    style={{ width: '4rem' }}
                  />
                  <select
                    value={customReminder.unit}
                    onChange={(e) => setCustomReminder((c) => ({ ...c, unit: e.target.value as 'minutes' | 'hours' | 'days' }))}
                    className="add-event-select"
                  >
                    <option value="minutes">minutes before</option>
                    <option value="hours">hours before</option>
                    <option value="days">days before</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          <div className="add-event-field">
            <label htmlFor="add-event-guests">Guests</label>
            <input
              id="add-event-guests"
              type="text"
              value={guestsText}
              onChange={(e) => setGuestsText(e.target.value)}
              placeholder="Email addresses (comma or space separated)"
              className="add-event-input"
            />
          </div>
          <div className="add-event-field">
            <label htmlFor="add-event-location">Location</label>
            <input
              id="add-event-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location"
              className="add-event-input"
            />
          </div>
          <div className="add-event-field">
            <label htmlFor="add-event-description">Description</label>
            <textarea
              id="add-event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description"
              className="add-event-input add-event-textarea"
              rows={3}
            />
          </div>
          <div className="event-detail-modal-actions" style={{ marginTop: '1rem', paddingBottom: 0 }}>
            <button type="button" onClick={onClose} className="add-event-btn add-event-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="add-event-btn add-event-btn-primary">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
