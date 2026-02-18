import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoversTab } from './CoversTab';
import * as api from '../api';

vi.mock('../api', () => ({ callService: vi.fn().mockResolvedValue(undefined) }));

const closedCover = [{ entity_id: 'cover.blind', state: 'closed', attributes: {} }];
const openCover = [{ entity_id: 'cover.blind', state: 'open', attributes: {} }];

describe('CoversTab', () => {
  beforeEach(() => vi.mocked(api.callService).mockClear());

  it('shows entity count', () => {
    render(<CoversTab entities={closedCover} onAction={vi.fn()} />);
    expect(screen.getByText(/1 cover$/)).toBeInTheDocument();
  });

  it('shows Open, Close, Stop buttons', () => {
    render(<CoversTab entities={closedCover} onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('calls open_cover when Open clicked', async () => {
    const onAction = vi.fn();
    render(<CoversTab entities={closedCover} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    await vi.waitFor(() => {
      expect(api.callService).toHaveBeenCalledWith('cover', 'open_cover', { entity_id: 'cover.blind' });
    });
    expect(onAction).toHaveBeenCalled();
  });

  it('Open disabled when cover is open', () => {
    render(<CoversTab entities={openCover} onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: /open/i })).toBeDisabled();
  });

  it('shows no covers when empty', () => {
    render(<CoversTab entities={[]} onAction={vi.fn()} />);
    expect(screen.getByText(/no covers/i)).toBeInTheDocument();
  });
});
