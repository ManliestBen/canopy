/** Home Assistant entity state (from /api/states). */
export interface HAEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown> & {
    friendly_name?: string;
    brightness?: number;
    current_temperature?: number;
    temperature?: number;
    target_temp_low?: number;
    target_temp_high?: number;
    hvac_modes?: string[];
    hvac_mode?: string;
    min_temp?: number;
    max_temp?: number;
    target_temp_step?: number;
    percentage?: number;
    preset_mode?: string;
    unit_of_measurement?: string;
    device_class?: string;
    code_format?: unknown;
  };
}

/** Calendar event from calendar API. */
export interface CalendarEvent {
  id?: string;
  summary?: string;
  start: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  description?: string;
  htmlLink?: string;
  calendarId?: string;
  /** From getEvent (full event); RRULE strings */
  recurrence?: string[];
  /** From getEvent; email strings */
  attendees?: string[];
  /** From getEvent */
  reminders?: { overrides: { method: string; minutes: number }[] };
}

/** Calendar list item from calendar API. */
export interface CalendarListItem {
  id: string;
  summary?: string;
}

/** Error with optional status and service account hint. */
export interface CalendarError extends Error {
  status?: number;
  serviceAccountEmail?: string;
}
