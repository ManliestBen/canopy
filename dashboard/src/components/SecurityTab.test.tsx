import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SecurityTab } from './SecurityTab';
import * as api from '../api';

vi.mock('../api', () => ({ callService: vi.fn().mockResolvedValue(undefined) }));

describe('SecurityTab', () => {
  beforeEach(() => vi.mocked(api.callService).mockClear());

  it('shows lock count and Unlock button', () => {
    const entities = [{ entity_id: 'lock.front_door', state: 'locked', attributes: { friendly_name: 'Front door' } }];
    render(<SecurityTab entities={entities} onAction={vi.fn()} />);
    expect(screen.getByText(/1 lock/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument();
  });

  it('calls lock service when Lock clicked', async () => {
    const entities = [{ entity_id: 'lock.front_door', state: 'unlocked', attributes: {} }];
    const onAction = vi.fn();
    render(<SecurityTab entities={entities} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /lock/i }));
    await vi.waitFor(() => {
      expect(api.callService).toHaveBeenCalledWith('lock', 'lock', { entity_id: 'lock.front_door' });
    });
    expect(onAction).toHaveBeenCalled();
  });

  it('shows alarm and Disarm / Arm Home / Arm Away', () => {
    const entities = [{ entity_id: 'alarm_control_panel.house', state: 'armed_home', attributes: {} }];
    render(<SecurityTab entities={entities} onAction={vi.fn()} />);
    expect(screen.getByText(/1 alarm/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disarm/i })).toBeInTheDocument();
  });

  it('when disarmed shows Arm Home and Arm Away', () => {
    const entities = [{ entity_id: 'alarm_control_panel.house', state: 'disarmed', attributes: {} }];
    render(<SecurityTab entities={entities} onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: /arm home/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /arm away/i })).toBeInTheDocument();
  });

  it('calls alarm_disarm when Disarm clicked', async () => {
    const entities = [{ entity_id: 'alarm_control_panel.house', state: 'armed_away', attributes: {} }];
    render(<SecurityTab entities={entities} onAction={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /disarm/i }));
    await vi.waitFor(() => {
      expect(api.callService).toHaveBeenCalledWith('alarm_control_panel', 'alarm_disarm', expect.objectContaining({ entity_id: 'alarm_control_panel.house' }));
    });
  });

  it('shows no locks or alarm panels when empty', () => {
    render(<SecurityTab entities={[]} onAction={vi.fn()} />);
    expect(screen.getByText(/no locks or alarm panels/i)).toBeInTheDocument();
  });
});
