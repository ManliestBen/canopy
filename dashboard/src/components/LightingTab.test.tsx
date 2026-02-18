import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LightingTab } from './LightingTab';
import * as api from '../api';

vi.mock('../api', () => ({
  callService: vi.fn().mockResolvedValue({}),
}));

const mockEntity = (overrides: Partial<{ entity_id: string; state: string; attributes: object }> = {}) => ({
  entity_id: 'light.living_room',
  state: 'on',
  attributes: { friendly_name: 'Living room', brightness: 255 },
  ...overrides,
});

describe('LightingTab', () => {
  it('renders entity count and cards', () => {
    const entities = [mockEntity()];
    render(<LightingTab entities={entities} onAction={vi.fn()} />);
    expect(screen.getByText(/1 light/)).toBeInTheDocument();
    expect(screen.getByText(/Living room/)).toBeInTheDocument();
    expect(screen.getByText('on')).toBeInTheDocument();
  });

  it('shows On/Off button and toggles via callService', async () => {
    const onAction = vi.fn();
    const entities = [mockEntity()];
    render(<LightingTab entities={entities} onAction={onAction} />);
    const toggle = screen.getByRole('button', { name: /on/i });
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(api.callService).toHaveBeenCalledWith('light', 'turn_off', { entity_id: 'light.living_room' });
    });
  });

  it('shows plural when multiple entities', () => {
    const entities = [mockEntity(), mockEntity({ entity_id: 'light.bedroom', attributes: { friendly_name: 'Bedroom' } })];
    render(<LightingTab entities={entities} onAction={vi.fn()} />);
    expect(screen.getByText(/2 lights/)).toBeInTheDocument();
  });
});
