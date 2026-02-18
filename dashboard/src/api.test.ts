import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  domainFromEntityId,
  getStates,
  getState,
  getSavedCalendars,
  addSavedCalendar,
  updateSavedCalendar,
  deleteSavedCalendar,
  getCalendarEvents,
  getCalendarList,
  createCalendarEvent,
  getCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  getCalendarDiagnose,
  callService,
} from './api';

const mockFetch = () => vi.stubGlobal('fetch', vi.fn());
const unmockFetch = () => vi.unstubAllGlobals();

describe('domainFromEntityId', () => {
  it('returns the domain part before the first dot', () => {
    expect(domainFromEntityId('light.living_room')).toBe('light');
    expect(domainFromEntityId('climate.thermostat')).toBe('climate');
    expect(domainFromEntityId('switch.fan')).toBe('switch');
    expect(domainFromEntityId('lock.front_door')).toBe('lock');
    expect(domainFromEntityId('alarm_control_panel.house')).toBe('alarm_control_panel');
  });

  it('returns the full string when there is no dot', () => {
    expect(domainFromEntityId('light')).toBe('light');
  });
});

describe('getStates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON when response is ok', async () => {
    const mockStates = [{ entity_id: 'light.a', state: 'on' }];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockStates),
    });
    const result = await getStates();
    expect(result).toEqual(mockStates);
    expect(fetch).toHaveBeenCalledWith('/api/states');
  });

  it('throws when response is not ok', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    await expect(getStates()).rejects.toThrow('States: 500 Internal Server Error');
  });
});

describe('getSavedCalendars', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns array when response is ok', async () => {
    const mockCalendars = [{ id: 1, title: 'Home', calendarId: 'x@group', colorIndex: 0 }];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCalendars),
    });
    const result = await getSavedCalendars();
    expect(result).toEqual(mockCalendars);
    expect(fetch).toHaveBeenCalledWith('/calendar-api/saved-calendars');
  });

  it('throws with message when response is not ok', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });
    await expect(getSavedCalendars()).rejects.toThrow('Unauthorized');
  });
});

describe('callService', () => {
  beforeEach(mockFetch);
  afterEach(unmockFetch);

  it('POSTs to the correct URL with JSON body', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await callService('light', 'turn_on', { entity_id: 'light.a' });
    expect(fetch).toHaveBeenCalledWith('/api/services/light/turn_on', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_id: 'light.a' }),
    });
  });

  it('throws with domain.service in message when not ok', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 403,
    });
    await expect(callService('climate', 'set_temperature', { entity_id: 'climate.a', temperature: 20 }))
      .rejects.toThrow('climate.set_temperature');
  });
});

describe('getState', () => {
  beforeEach(mockFetch);
  afterEach(unmockFetch);

  it('fetches single entity and returns parsed state', async () => {
    const state = { entity_id: 'light.living', state: 'on', attributes: {} };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(state),
    });
    const result = await getState('light.living');
    expect(result).toEqual(state);
    expect(fetch).toHaveBeenCalledWith('/api/states/light.living');
  });

  it('encodes entity_id in URL', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await getState('light.my room');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('light.my room')));
  });
});

describe('getCalendarEvents', () => {
  beforeEach(mockFetch);
  afterEach(unmockFetch);

  it('builds URL with days and maxResults', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ events: [] }),
    });
    await getCalendarEvents({ days: 42, maxResults: 100 });
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/calendar-api\/events\?.*days=42.*maxResults=100/));
  });

  it('returns event list from response.events', async () => {
    const events = [{ id: '1', summary: 'Meeting', start: '2025-06-15T10:00:00', end: '2025-06-15T11:00:00' }];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ events, calendarSummaries: {} }),
    });
    const result = await getCalendarEvents({ days: 7 });
    expect(result).toHaveProperty('events', events);
  });

  it('accepts array response (legacy)', async () => {
    const events = [{ id: '1', summary: 'E', start: '2025-06-15T10:00:00' }];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(events),
    });
    const result = await getCalendarEvents();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(events);
  });

  it('throws with serviceAccountEmail when API returns it', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({
        error: 'Calendar API disabled',
        serviceAccountEmail: 'canopy@project.iam.gserviceaccount.com',
      }),
    });
    const err = await getCalendarEvents().then(
      () => null,
      (e: Error & { serviceAccountEmail?: string }) => e
    );
    expect(err).not.toBeNull();
    expect((err as Error).message).toContain('Calendar');
    expect((err as Error & { serviceAccountEmail?: string }).serviceAccountEmail).toBe('canopy@project.iam.gserviceaccount.com');
  });
});

describe('getCalendarList', () => {
  beforeEach(mockFetch);
  afterEach(unmockFetch);

  it('returns array of calendars', async () => {
    const list = [{ id: 'a@group', summary: 'Home' }];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(list),
    });
    const result = await getCalendarList();
    expect(result).toEqual(list);
  });

  it('handles response.calendars shape', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ calendars: [{ id: 'x', summary: 'Y' }] }),
    });
    const result = await getCalendarList();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'x', summary: 'Y' });
  });
});

describe('addSavedCalendar', () => {
  beforeEach(mockFetch);
  afterEach(unmockFetch);

  it('POSTs with title, calendarId, colorIndex', async () => {
    const saved = { id: 1, title: 'Work', calendarId: 'work@group', colorIndex: 2 };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(saved),
    });
    const result = await addSavedCalendar({ title: 'Work', calendarId: 'work@group', colorIndex: 2 });
    expect(result).toEqual(saved);
    expect(fetch).toHaveBeenCalledWith(
      '/calendar-api/saved-calendars',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Work', calendarId: 'work@group', colorIndex: 2 }),
      })
    );
  });

  it('can include colorHex', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1, title: 'C', calendarId: 'c@group', colorIndex: 0, colorHex: '#ff0000' }),
    });
    await addSavedCalendar({ title: 'C', calendarId: 'c@group', colorHex: '#ff0000' });
    expect(fetch).toHaveBeenCalledWith(
      '/calendar-api/saved-calendars',
      expect.objectContaining({
        body: expect.stringContaining('"colorHex":"#ff0000"'),
      })
    );
  });
});

describe('updateSavedCalendar', () => {
  beforeEach(mockFetch);
  afterEach(unmockFetch);

  it('PATCHes to saved-calendars/:id', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1, title: 'Updated', calendarId: 'x@group', colorIndex: 1 }),
    });
    await updateSavedCalendar(1, { title: 'Updated' });
    expect(fetch).toHaveBeenCalledWith(
      '/calendar-api/saved-calendars/1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ title: 'Updated' }) })
    );
  });
});

describe('deleteSavedCalendar', () => {
  beforeEach(mockFetch);
  afterEach(unmockFetch);

  it('DELETEs saved-calendars/:id', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });
    await deleteSavedCalendar(1);
    expect(fetch).toHaveBeenCalledWith('/calendar-api/saved-calendars/1', { method: 'DELETE' });
  });
});

describe('createCalendarEvent', () => {
  beforeEach(mockFetch);
  afterEach(unmockFetch);

  it('POSTs payload with calendarId, summary, date, allDay', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'ev1', htmlLink: 'https://calendar.google.com/event/ev1' }),
    });
    const payload = {
      calendarId: 'home@group',
      summary: 'Team standup',
      date: '2025-06-20',
      allDay: false,
      startTime: '09:00',
      endTime: '09:30',
      timeZone: 'America/Chicago',
    };
    const result = await createCalendarEvent(payload);
    expect(result).toMatchObject({ id: 'ev1' });
    expect(fetch).toHaveBeenCalledWith(
      '/calendar-api/events',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
  });
});

describe('getCalendarEvent', () => {
  beforeEach(mockFetch);
  afterEach(unmockFetch);

  it('GETs calendar event by calendarId and eventId', async () => {
    const ev = { id: 'ev1', summary: 'Meeting', start: '2025-06-15T10:00:00', end: '2025-06-15T11:00:00' };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(ev),
    });
    const result = await getCalendarEvent('cal@group', 'ev1');
    expect(result).toEqual(ev);
    expect(fetch).toHaveBeenCalledWith('/calendar-api/calendars/cal%40group/events/ev1');
  });
});

describe('deleteCalendarEvent', () => {
  beforeEach(mockFetch);
  afterEach(unmockFetch);

  it('DELETEs event', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });
    await deleteCalendarEvent('cal@group', 'ev1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/calendar-api/calendars/'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});

describe('updateCalendarEvent', () => {
  beforeEach(mockFetch);
  afterEach(unmockFetch);

  it('PATCHes event with payload', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'ev1' }),
    });
    await updateCalendarEvent('cal@group', 'ev1', {
      summary: 'Updated title',
      date: '2025-06-16',
      allDay: true,
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('events/ev1'),
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('Updated title'),
      })
    );
  });
});

describe('getCalendarDiagnose', () => {
  beforeEach(mockFetch);
  afterEach(unmockFetch);

  it('GETs diagnose without calendarId', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ list: { ok: true } }),
    });
    const result = await getCalendarDiagnose();
    expect(result).toMatchObject({ list: { ok: true } });
    expect(fetch).toHaveBeenCalledWith('/calendar-api/diagnose');
  });

  it('GETs diagnose with calendarId query', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ direct: { ok: true } }),
    });
    await getCalendarDiagnose('my@group');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('calendarId=my%40group'));
  });
});
