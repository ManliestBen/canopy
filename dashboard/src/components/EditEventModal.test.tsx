import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditEventModal } from './EditEventModal';

vi.mock('../api', () => ({
  getCalendarEvent: vi.fn().mockResolvedValue(null),
  updateCalendarEvent: vi.fn().mockResolvedValue({ id: 'ev1' }),
}));

const savedCalendars = [{ id: 1, title: 'Home', calendarId: 'home@group', colorIndex: 0 }];
const initialEvent = {
  id: 'ev1',
  summary: 'Team standup',
  start: '2025-06-15T09:00:00',
  end: '2025-06-15T09:30:00',
  calendarId: 'home@group',
};

describe('EditEventModal', () => {
  it('renders with initialEvent and shows Edit event title', () => {
    render(
      <EditEventModal
        calendarId="home@group"
        eventId="ev1"
        savedCalendars={savedCalendars}
        initialEvent={initialEvent}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(screen.getByRole('heading', { name: /edit event/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Team standup')).toBeInTheDocument();
  });

  it('has Save and Cancel buttons', () => {
    render(
      <EditEventModal
        calendarId="home@group"
        eventId="ev1"
        savedCalendars={savedCalendars}
        initialEvent={initialEvent}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});
