import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SwitchesTab } from './SwitchesTab';
import * as api from '../api';

vi.mock('../api', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof api;
  return { ...actual, callService: vi.fn().mockResolvedValue(undefined) };
});

describe('SwitchesTab', () => {
  beforeEach(() => {
    vi.mocked(api.callService).mockClear();
  });

  it('shows entity count', () => {
    const entities = [
      { entity_id: 'switch.lamp', state: 'off', attributes: { friendly_name: 'Lamp' } },
    ];
    render(<SwitchesTab entities={entities as never} onAction={vi.fn()} />);
    expect(screen.getByText(/1 switch\/fan/)).toBeInTheDocument();
  });

  it('calls switch turn_on when Off switch is clicked', async () => {
    const entities = [
      { entity_id: 'switch.lamp', state: 'off', attributes: {} },
    ];
    const onAction = vi.fn();
    render(<SwitchesTab entities={entities as never} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /off/i }));
    await vi.waitFor(() => {
      expect(api.callService).toHaveBeenCalledWith('switch', 'turn_on', {
        entity_id: 'switch.lamp',
      });
    });
    expect(onAction).toHaveBeenCalled();
  });

  it('calls switch turn_off when On switch is clicked', async () => {
    const entities = [
      { entity_id: 'switch.lamp', state: 'on', attributes: {} },
    ];
    render(<SwitchesTab entities={entities as never} onAction={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /on/i }));
    await vi.waitFor(() => {
      expect(api.callService).toHaveBeenCalledWith('switch', 'turn_off', {
        entity_id: 'switch.lamp',
      });
    });
  });

  it('calls fan turn_on for fan entity', async () => {
    const entities = [
      { entity_id: 'fan.ceiling', state: 'off', attributes: {} },
    ];
    render(<SwitchesTab entities={entities as never} onAction={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /off/i }));
    await vi.waitFor(() => {
      expect(api.callService).toHaveBeenCalledWith('fan', 'turn_on', {
        entity_id: 'fan.ceiling',
      });
    });
  });

  it('shows fan percentage and speed slider when fan has percentage', () => {
    const entities = [
      {
        entity_id: 'fan.ceiling',
        state: 'on',
        attributes: { percentage: 50 },
      },
    ];
    render(<SwitchesTab entities={entities as never} onAction={vi.fn()} />);
    expect(screen.getByText(/speed/i)).toBeInTheDocument();
    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('50');
  });

  it('calls fan set_percentage when slider is changed', async () => {
    const entities = [
      {
        entity_id: 'fan.ceiling',
        state: 'on',
        attributes: { percentage: 50 },
      },
    ];
    render(<SwitchesTab entities={entities as never} onAction={vi.fn()} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '75' } });
    await vi.waitFor(() => {
      expect(api.callService).toHaveBeenCalledWith('fan', 'set_percentage', {
        entity_id: 'fan.ceiling',
        percentage: 75,
      });
    });
  });

  it('shows plural and no switches message when empty', () => {
    render(<SwitchesTab entities={[]} onAction={vi.fn()} />);
    expect(screen.getByText(/0 switch\/fans/)).toBeInTheDocument();
    expect(screen.getByText(/no switches or fans/i)).toBeInTheDocument();
  });
});
