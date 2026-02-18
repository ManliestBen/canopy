import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SensorsTab } from './SensorsTab';

const mockSensor = (entityId: string, state: string, attrs: Record<string, unknown> = {}) => ({
  entity_id: entityId,
  state,
  attributes: { friendly_name: entityId.replace('.', ' '), ...attrs },
});

describe('SensorsTab', () => {
  it('renders binary and sensor counts', () => {
    const entities = [
      mockSensor('binary_sensor.door', 'on'),
      mockSensor('sensor.temperature', '72', { unit_of_measurement: '°F' }),
    ];
    render(<SensorsTab entities={entities} />);
    expect(screen.getByText(/1 binary, 1 sensor/)).toBeInTheDocument();
  });

  it('shows no sensors message when empty', () => {
    render(<SensorsTab entities={[]} />);
    expect(screen.getByText(/no sensors/i)).toBeInTheDocument();
  });

  it('renders entity cards with state', () => {
    const entities = [mockSensor('sensor.temp', '21.5', { unit_of_measurement: '°C' })];
    render(<SensorsTab entities={entities} />);
    expect(screen.getByText(/sensor temp/i)).toBeInTheDocument();
    expect(screen.getByText(/21.5 °C/)).toBeInTheDocument();
  });

  it('formats timestamp device_class state as locale date string', () => {
    const iso = '2025-06-15T14:30:00';
    const entities = [mockSensor('sensor.next_ring', iso, { device_class: 'timestamp' })];
    render(<SensorsTab entities={entities} />);
    const formatted = new Date(iso).toLocaleString();
    expect(screen.getByText(formatted)).toBeInTheDocument();
  });

  it('shows binary sensor state without unit', () => {
    const entities = [mockSensor('binary_sensor.door', 'on')];
    render(<SensorsTab entities={entities} />);
    expect(screen.getByText(/binary_sensor door/i)).toBeInTheDocument();
    expect(screen.getByText('on')).toBeInTheDocument();
  });
});
