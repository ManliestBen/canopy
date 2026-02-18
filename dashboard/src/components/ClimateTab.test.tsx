import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClimateTab } from './ClimateTab';
import * as api from '../api';

vi.mock('../api', () => ({ callService: vi.fn().mockResolvedValue(undefined) }));

const mockEntities = [
  {
    entity_id: 'climate.thermostat',
    state: 'heat',
    attributes: {
      friendly_name: 'Living room',
      current_temperature: 20,
      temperature: 21,
      hvac_modes: ['heat', 'cool', 'off'],
      hvac_mode: 'heat',
      min_temp: 5,
      max_temp: 35,
      target_temp_step: 1,
    },
  },
];

describe('ClimateTab', () => {
  beforeEach(() => vi.mocked(api.callService).mockClear());

  it('shows entity count', () => {
    render(<ClimateTab entities={mockEntities} onAction={vi.fn()} />);
    expect(screen.getByText(/1 climate/)).toBeInTheDocument();
  });

  it('shows current and target temperature', () => {
    render(<ClimateTab entities={mockEntities} onAction={vi.fn()} />);
    expect(screen.getByText(/current: 20°/i)).toBeInTheDocument();
    expect(screen.getByText(/target: 21°/i)).toBeInTheDocument();
  });

  it('shows HVAC mode buttons', () => {
    render(<ClimateTab entities={mockEntities} onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'heat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cool' })).toBeInTheDocument();
  });

  it('calls set_temperature when minus clicked', async () => {
    const onAction = vi.fn();
    render(<ClimateTab entities={mockEntities} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: '−' }));
    await vi.waitFor(() => {
      expect(api.callService).toHaveBeenCalledWith('climate', 'set_temperature', {
        entity_id: 'climate.thermostat',
        temperature: 20,
      });
    });
    expect(onAction).toHaveBeenCalled();
  });

  it('calls set_hvac_mode when HVAC button clicked', async () => {
    render(<ClimateTab entities={mockEntities} onAction={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'cool' }));
    await vi.waitFor(() => {
      expect(api.callService).toHaveBeenCalledWith('climate', 'set_hvac_mode', {
        entity_id: 'climate.thermostat',
        hvac_mode: 'cool',
      });
    });
  });

  it('shows no climate when empty', () => {
    render(<ClimateTab entities={[]} onAction={vi.fn()} />);
    expect(screen.getByText(/no climate/i)).toBeInTheDocument();
  });
});
