/**
 * Home Assistant REST API client.
 * In dev, Vite proxies /api to HA and injects the token.
 * In production, the Node server proxies /api and injects the token.
 */

import type { HAEntityState } from './types';
import type { CalendarEvent, CalendarListItem } from './types';

const API = '/api';

export async function getStates(): Promise<HAEntityState[]> {
  const res = await fetch(`${API}/states`);
  if (!res.ok) throw new Error(`States: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function getState(entityId: string): Promise<HAEntityState> {
  const id = encodeURIComponent(entityId);
  const res = await fetch(`${API}/states/${id}`);
  if (!res.ok) throw new Error(`State ${entityId}: ${res.status}`);
  return res.json();
}

export async function callService(
  domain: string,
  service: string,
  data: Record<string, unknown> = {}
): Promise<unknown> {
  const res = await fetch(`${API}/services/${domain}/${service}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Service ${domain}.${service}: ${res.status}`);
  return res.json();
}

export function domainFromEntityId(entityId: string): string {
  const i = entityId.indexOf('.');
  return i === -1 ? entityId : entityId.slice(0, i);
}

export interface GetCalendarEventsOptions {
  days?: number;
  maxResults?: number;
  calendarId?: string;
}

export interface GetCalendarEventsResponse {
  events: CalendarEvent[];
  calendarId?: string | null;
  calendarSummary?: string | null;
  /** Map of calendar ID → human-readable title */
  calendarSummaries?: Record<string, string>;
  /** Map of calendar ID → color index (0–19) for saved calendars */
  calendarColors?: Record<string, number>;
  /** Per-calendar error messages when some calendars fail to load */
  calendarErrors?: string[];
}

/** Saved calendar (stored in DB). */
export interface SavedCalendar {
  id: number;
  title: string;
  calendarId: string;
  colorIndex: number;
  /** Custom hex color (e.g. #ff0000); when set, overrides pastel from colorIndex. */
  colorHex?: string;
}

export async function getSavedCalendars(): Promise<SavedCalendar[]> {
  const res = await fetch('/calendar-api/saved-calendars');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to load saved calendars');
  return Array.isArray(data) ? data : [];
}

export async function addSavedCalendar(body: { title: string; calendarId: string; colorIndex?: number; colorHex?: string }): Promise<SavedCalendar> {
  const res = await fetch('/calendar-api/saved-calendars', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to add calendar');
  return data as SavedCalendar;
}

export async function updateSavedCalendar(id: number, updates: { title?: string; calendarId?: string; colorIndex?: number; colorHex?: string | null }): Promise<SavedCalendar> {
  const res = await fetch(`/calendar-api/saved-calendars/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to update calendar');
  return data as SavedCalendar;
}

export async function deleteSavedCalendar(id: number): Promise<void> {
  const res = await fetch(`/calendar-api/saved-calendars/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Failed to delete calendar');
  }
}

/** Google Calendar (proxied to calendar server in dev or served by server.js in prod). Returns { events, calendarId, calendarSummary }. */
export async function getCalendarEvents(
  options: GetCalendarEventsOptions = {}
): Promise<GetCalendarEventsResponse | CalendarEvent[]> {
  const params = new URLSearchParams();
  if (options.days != null) params.set('days', String(options.days));
  if (options.maxResults != null) params.set('maxResults', String(options.maxResults));
  if (options.calendarId) params.set('calendarId', options.calendarId);
  const qs = params.toString();
  const url = `/calendar-api/events${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as
    | GetCalendarEventsResponse
    | { error?: string; serviceAccountEmail?: string };
  if (!res.ok) {
    const msg =
      (data as { error?: string }).error || `Calendar: ${res.status}`;
    const err = new Error(msg) as Error & { status?: number; serviceAccountEmail?: string };
    err.status = res.status;
    err.serviceAccountEmail = (data as { serviceAccountEmail?: string }).serviceAccountEmail;
    throw err;
  }
  return data as GetCalendarEventsResponse | CalendarEvent[];
}

/** List calendars the service account can access. */
export async function getCalendarList(): Promise<CalendarListItem[]> {
  const res = await fetch('/calendar-api/list');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Calendar list: ${res.status}`);
  return Array.isArray(data) ? data : (data as { calendars?: CalendarListItem[] }).calendars ?? [];
}

/** Run calendar diagnostic (list + optional direct access test). */
export async function getCalendarDiagnose(
  calendarId?: string
): Promise<{ list?: { ok: boolean }; direct?: { ok: boolean; error?: string; status?: number; code?: number } }> {
  const url = calendarId
    ? `/calendar-api/diagnose?calendarId=${encodeURIComponent(calendarId)}`
    : '/calendar-api/diagnose';
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Diagnose: ${res.status}`);
  return data as { list?: { ok: boolean }; direct?: { ok: boolean; error?: string; status?: number; code?: number } };
}

/** Payload for creating a calendar event (POST /calendar-api/events). */
export interface CreateCalendarEventPayload {
  calendarId: string;
  summary: string;
  date: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  /** IANA timezone (e.g. America/Chicago) so times are stored in user's local time. */
  timeZone?: string;
  location?: string;
  description?: string;
  recurrence?: string[];
  reminders?: { overrides: { method: 'email' | 'popup'; minutes: number }[] };
  attendees?: string[];
}

/** Create an event on a calendar. Returns the created event. */
export async function createCalendarEvent(payload: CreateCalendarEventPayload): Promise<{ id: string; htmlLink?: string }> {
  const res = await fetch('/calendar-api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to create event');
  return data as { id: string; htmlLink?: string };
}

/** Get a single event (full details for edit). */
export async function getCalendarEvent(calendarId: string, eventId: string): Promise<CalendarEvent> {
  const res = await fetch(`/calendar-api/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to load event');
  return data as CalendarEvent;
}

/** Delete an event. */
export async function deleteCalendarEvent(calendarId: string, eventId: string): Promise<void> {
  const res = await fetch(`/calendar-api/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Failed to delete event');
  }
}

/** Update payload (same shape as create; calendarId/eventId in URL). */
export type UpdateCalendarEventPayload = Omit<CreateCalendarEventPayload, 'calendarId'>;

/** Update an event. */
export async function updateCalendarEvent(
  calendarId: string,
  eventId: string,
  payload: UpdateCalendarEventPayload
): Promise<{ id: string; htmlLink?: string }> {
  const res = await fetch(`/calendar-api/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to update event');
  return data as { id: string; htmlLink?: string };
}
