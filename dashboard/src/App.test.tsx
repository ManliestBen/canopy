import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as api from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof api;
  return { ...actual, getStates: vi.fn() };
});

describe('App', () => {
  beforeEach(() => {
    vi.mocked(api.getStates).mockResolvedValue([]);
  });

  it('renders header with title and theme selector', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: /canopy/i });
    expect(screen.getByLabelText(/theme/i)).toBeInTheDocument();
  });

  it('renders all nav tabs', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: /canopy/i });
    expect(screen.getByRole('button', { name: /lighting/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /climate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switches/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /covers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /locks & security/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sensors/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /calendar/i })).toBeInTheDocument();
  });

  it('shows loading then main content when getStates resolves', async () => {
    render(<App />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await screen.findByRole('button', { name: /lighting/i });
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('switches tab when clicking a tab button', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('button', { name: /lighting/i });
    await user.click(screen.getByRole('button', { name: /calendar/i }));
    expect(screen.getByRole('button', { name: /calendar/i })).toHaveClass('active');
  });

  it('only the active tab button has active class', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('button', { name: /lighting/i });
    const lighting = screen.getByRole('button', { name: /lighting/i });
    const calendar = screen.getByRole('button', { name: /calendar/i });
    expect(lighting).toHaveClass('active');
    expect(calendar).not.toHaveClass('active');
    await user.click(calendar);
    expect(calendar).toHaveClass('active');
    expect(lighting).not.toHaveClass('active');
  });

  it('allows changing theme via select', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText(/theme/i);
    const select = screen.getByLabelText(/theme/i);
    await user.selectOptions(select, 'dark');
    expect(select).toHaveValue('dark');
  });

  it('theme select has all six options: System, Light, Dark, Bold (Light), Bold (Dark), Pride', async () => {
    render(<App />);
    await screen.findByLabelText(/theme/i);
    const select = screen.getByLabelText(/theme/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => ({ value: o.value, label: o.label || o.text }));
    expect(options).toEqual(
      expect.arrayContaining([
        { value: 'system', label: 'System' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
        { value: 'bold-light', label: 'Bold (Light)' },
        { value: 'bold-dark', label: 'Bold (Dark)' },
        { value: 'pride', label: 'Pride' },
      ])
    );
    expect(options).toHaveLength(6);
  });

  it('applies selected theme to document (data-theme and select value)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText(/theme/i);
    const select = screen.getByLabelText(/theme/i);
    await user.selectOptions(select, 'pride');
    expect(select).toHaveValue('pride');
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('pride');
    });
  });

  it('shows error banner when getStates rejects', async () => {
    vi.mocked(api.getStates).mockRejectedValueOnce(new Error('Network error'));
    render(<App />);
    await screen.findByText(/network error/i);
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
    expect(screen.getByText(/check that the ha proxy/i)).toBeInTheDocument();
  });

  it('passes only light entities to Lighting tab', async () => {
    vi.mocked(api.getStates).mockResolvedValue([
      { entity_id: 'light.living', state: 'on', attributes: {} },
      { entity_id: 'switch.fan', state: 'off', attributes: {} },
      { entity_id: 'climate.thermostat', state: 'heat', attributes: {} },
    ] as never[]);
    render(<App />);
    await screen.findByRole('button', { name: /lighting/i });
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent('light.living');
    expect(main).not.toHaveTextContent('switch.fan');
    expect(main).not.toHaveTextContent('climate.thermostat');
  });

  it('passes switch and fan entities to Switches tab', async () => {
    vi.mocked(api.getStates).mockResolvedValue([
      { entity_id: 'switch.fan', state: 'off', attributes: {} },
      { entity_id: 'fan.ceiling', state: 'on', attributes: {} },
      { entity_id: 'light.desk', state: 'on', attributes: {} },
    ] as never[]);
    render(<App />);
    await screen.findByRole('button', { name: /lighting/i });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /switches/i }));
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent('switch.fan');
    expect(main).toHaveTextContent('fan.ceiling');
    expect(main).not.toHaveTextContent('light.desk');
  });
});
