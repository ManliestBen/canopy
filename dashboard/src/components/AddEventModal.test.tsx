import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddEventModal, RECURRENCE_OPTIONS, REMINDER_PRESETS } from './AddEventModal';
import * as api from '../api';

vi.mock('../api', () => ({
  createCalendarEvent: vi.fn(),
}));

const mockSavedCalendars = [
  { id: 1, title: 'Home', calendarId: 'home@group', colorIndex: 0 },
];

const defaultProps = {
  savedCalendars: mockSavedCalendars,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

describe('AddEventModal', () => {
  beforeEach(() => {
    vi.mocked(api.createCalendarEvent).mockReset();
    defaultProps.onClose.mockClear();
    defaultProps.onSuccess.mockClear();
  });

  it('renders modal with title and form', () => {
    render(<AddEventModal {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /add event/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
  });

  it('pre-fills date when defaultDate is provided', () => {
    render(<AddEventModal {...defaultProps} defaultDate="2025-06-15" />);
    const dateInput = screen.getByLabelText(/date/i) as HTMLInputElement;
    expect(dateInput.value).toBe('2025-06-15');
  });

  it('pre-fills start and end time when defaultStartTime and defaultEndTime are provided', () => {
    render(
      <AddEventModal
        {...defaultProps}
        defaultDate="2025-06-15"
        defaultStartTime="14:00"
        defaultEndTime="15:00"
      />
    );
    const startInput = screen.getByLabelText(/start time/i) as HTMLInputElement;
    const endInput = screen.getByLabelText(/end time/i) as HTMLInputElement;
    expect(startInput.value).toBe('14:00');
    expect(endInput.value).toBe('15:00');
  });

  it('shows All day checkbox', () => {
    render(<AddEventModal {...defaultProps} />);
    expect(screen.getByRole('checkbox', { name: /all day/i })).toBeInTheDocument();
  });

  it('has Save and Cancel buttons', () => {
    render(<AddEventModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows Repeat and Calendar dropdowns', () => {
    render(<AddEventModal {...defaultProps} />);
    expect(screen.getByLabelText(/repeat/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/calendar/i)).toBeInTheDocument();
  });

  it('shows validation error when no calendar selected and user submits', async () => {
    render(<AddEventModal {...defaultProps} savedCalendars={[]} />);
    const form = screen.getByRole('dialog').querySelector('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form!);
    await waitFor(() => {
      expect(screen.getByText(/please select a calendar/i)).toBeInTheDocument();
    });
    expect(api.createCalendarEvent).not.toHaveBeenCalled();
  });

  it('calls createCalendarEvent with correct payload and then onSuccess and onClose on success', async () => {
    vi.mocked(api.createCalendarEvent).mockResolvedValue({ id: 'ev1' });
    render(
      <AddEventModal
        {...defaultProps}
        defaultDate="2025-06-20"
        defaultStartTime="09:00"
        defaultEndTime="10:00"
      />
    );
    const titleInput = screen.getByPlaceholderText(/add title/i);
    fireEvent.change(titleInput, { target: { value: 'Team standup' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(api.createCalendarEvent).toHaveBeenCalledTimes(1);
    });
    const payload = vi.mocked(api.createCalendarEvent).mock.calls[0][0];
    expect(payload.calendarId).toBe('home@group');
    expect(payload.summary).toBe('Team standup');
    expect(payload.date).toBe('2025-06-20');
    expect(payload.allDay).toBe(false);
    expect(payload.startTime).toBe('09:00');
    expect(payload.endTime).toBe('10:00');
    expect(payload.timeZone).toBeDefined();
    expect(defaultProps.onSuccess).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('sends allDay event without startTime/endTime/timeZone', async () => {
    vi.mocked(api.createCalendarEvent).mockResolvedValue({ id: 'ev1' });
    render(<AddEventModal {...defaultProps} defaultDate="2025-06-21" />);
    fireEvent.click(screen.getByRole('checkbox', { name: /all day/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(api.createCalendarEvent).toHaveBeenCalledTimes(1);
    });
    const payload = vi.mocked(api.createCalendarEvent).mock.calls[0][0];
    expect(payload.allDay).toBe(true);
    expect(payload.startTime).toBeUndefined();
    expect(payload.endTime).toBeUndefined();
    expect(payload.timeZone).toBeUndefined();
  });

  it('sends location and description when filled', async () => {
    vi.mocked(api.createCalendarEvent).mockResolvedValue({ id: 'ev1' });
    render(<AddEventModal {...defaultProps} defaultDate="2025-06-22" />);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Meet' } });
    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: 'Office' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Notes' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(api.createCalendarEvent).toHaveBeenCalledTimes(1);
    });
    const payload = vi.mocked(api.createCalendarEvent).mock.calls[0][0];
    expect(payload.location).toBe('Office');
    expect(payload.description).toBe('Notes');
  });

  it('shows API error in banner when createCalendarEvent rejects', async () => {
    vi.mocked(api.createCalendarEvent).mockRejectedValue(new Error('Calendar API disabled'));
    render(<AddEventModal {...defaultProps} defaultDate="2025-06-22" />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(screen.getByText(/calendar api disabled/i)).toBeInTheDocument();
    });
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('uses (No title) when title is empty', async () => {
    vi.mocked(api.createCalendarEvent).mockResolvedValue({ id: 'ev1' });
    render(<AddEventModal {...defaultProps} defaultDate="2025-06-22" />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(api.createCalendarEvent).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(api.createCalendarEvent).mock.calls[0][0].summary).toBe('(No title)');
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<AddEventModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    render(<AddEventModal {...defaultProps} />);
    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', () => {
    render(<AddEventModal {...defaultProps} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('RECURRENCE_OPTIONS', () => {
  it('includes none and common presets', () => {
    const values = RECURRENCE_OPTIONS.map((o) => o.value);
    expect(values).toContain('none');
    expect(values).toContain('daily');
    expect(values).toContain('weekdays');
    expect(values).toContain('custom');
  });
});

describe('REMINDER_PRESETS', () => {
  it('includes popup and email options', () => {
    const methods = [...new Set(REMINDER_PRESETS.map((p) => p.method))];
    expect(methods).toContain('popup');
    expect(methods).toContain('email');
  });
});
