import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CalendarTab } from './CalendarTab';
import * as api from '../api';

vi.mock('../api', () => ({
  getCalendarEvents: vi.fn().mockResolvedValue({ events: [] }),
  getSavedCalendars: vi.fn().mockResolvedValue([]),
  getCalendarList: vi.fn().mockResolvedValue([]),
  addSavedCalendar: vi.fn(),
  updateSavedCalendar: vi.fn(),
  deleteSavedCalendar: vi.fn(),
  getCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn(),
}));

describe('CalendarTab', () => {
  beforeEach(() => {
    vi.mocked(api.getCalendarEvents).mockResolvedValue({ events: [] });
    vi.mocked(api.getSavedCalendars).mockResolvedValue([]);
    vi.mocked(api.getCalendarList).mockResolvedValue([]);
  });

  it('renders without crashing', async () => {
    render(<CalendarTab />);
    await screen.findByRole('button', { name: /calendars/i });
  });

  it('shows Calendars and Add Event buttons', async () => {
    render(<CalendarTab />);
    await screen.findByRole('button', { name: /calendars/i });
    expect(screen.getByRole('button', { name: /add event/i })).toBeInTheDocument();
  });

  it('shows view mode selector with Daily, Weekly, Biweekly, Monthly', async () => {
    render(<CalendarTab />);
    await screen.findByRole('button', { name: /calendars/i });
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select).toHaveDisplayValue('Biweekly');
    expect(screen.getByRole('option', { name: 'Daily' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Weekly' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Biweekly' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Monthly' })).toBeInTheDocument();
  });

  it('switches view mode when selecting Daily', async () => {
    render(<CalendarTab />);
    await screen.findByRole('button', { name: /calendars/i });
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'daily' } });
    expect(select).toHaveValue('daily');
  });

  it('when no saved calendars, Add Event opens Calendars modal', async () => {
    vi.mocked(api.getSavedCalendars).mockResolvedValue([]);
    render(<CalendarTab />);
    await screen.findByRole('button', { name: /calendars/i });
    fireEvent.click(screen.getByRole('button', { name: /add event/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^calendars$/i })).toBeInTheDocument();
    });
  });

  it('when saved calendars exist, Add Event opens Add Event modal', async () => {
    vi.mocked(api.getSavedCalendars).mockResolvedValue([
      { id: 1, title: 'Home', calendarId: 'home@group', colorIndex: 0 },
    ]);
    render(<CalendarTab />);
    await screen.findByRole('button', { name: /add event/i });
    fireEvent.click(screen.getByRole('button', { name: /add event/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /add event/i })).toBeInTheDocument();
    });
  });

  it('shows error banner when getCalendarEvents rejects', async () => {
    vi.mocked(api.getCalendarEvents).mockRejectedValue(new Error('Calendar API disabled'));
    render(<CalendarTab />);
    await waitFor(() => {
      expect(screen.getByText(/calendar api disabled|failed to load calendar/i)).toBeInTheDocument();
    });
  });

  it('renders events when getCalendarEvents returns events', async () => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    const dateKey = start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') + '-' + String(start.getDate()).padStart(2, '0');
    vi.mocked(api.getCalendarEvents).mockResolvedValue({
      events: [
        {
          id: 'ev1',
          summary: 'Team standup',
          start: `${dateKey}T09:00:00`,
          end: `${dateKey}T09:30:00`,
          calendarId: 'home@group',
        },
      ],
      calendarSummaries: {},
    });
    vi.mocked(api.getSavedCalendars).mockResolvedValue([
      { id: 1, title: 'Home', calendarId: 'home@group', colorIndex: 0 },
    ]);
    render(<CalendarTab />);
    await waitFor(() => {
      expect(screen.getByText(/team standup/i)).toBeInTheDocument();
    });
  });
});
