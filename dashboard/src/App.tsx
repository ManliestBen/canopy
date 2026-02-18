import { useState, useEffect, useCallback } from 'react';
import { getStates } from './api';
import { LightingTab } from './components/LightingTab';
import { ClimateTab } from './components/ClimateTab';
import { SwitchesTab } from './components/SwitchesTab';
import { CoversTab } from './components/CoversTab';
import { SecurityTab } from './components/SecurityTab';
import { SensorsTab } from './components/SensorsTab';
import { CalendarTab } from './components/CalendarTab';
import type { HAEntityState } from './types';

interface TabConfig {
  id: string;
  label: string;
  domain?: string;
  domains?: string[];
}

const THEME_KEY = 'canopy-theme';
type ThemeValue = 'light' | 'dark' | 'system';

const THEME_OPTIONS: { value: ThemeValue; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function getStoredTheme(): ThemeValue {
  try {
    const s = localStorage.getItem(THEME_KEY);
    if (s === 'light' || s === 'dark' || s === 'system') return s;
    if (s === 'liquid-glass-light') return 'light';
    if (s === 'liquid-glass-dark') return 'dark';
  } catch {}
  return 'system';
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(value: ThemeValue) {
  const html = document.documentElement;
  if (value === 'system') html.setAttribute('data-theme', getSystemTheme());
  else html.setAttribute('data-theme', value);
}

// Apply stored theme before first paint to avoid flash
applyTheme(getStoredTheme());

const TABS: TabConfig[] = [
  { id: 'lighting', label: 'Lighting', domain: 'light' },
  { id: 'climate', label: 'Climate', domain: 'climate' },
  { id: 'switches', label: 'Switches & Fans', domains: ['switch', 'fan'] },
  { id: 'covers', label: 'Covers', domain: 'cover' },
  { id: 'security', label: 'Locks & Security', domains: ['lock', 'alarm_control_panel'] },
  { id: 'sensors', label: 'Sensors', domains: ['sensor', 'binary_sensor'] },
  { id: 'calendar', label: 'Calendar' },
];

function App() {
  const [states, setStates] = useState<HAEntityState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('lighting');
  const [theme, setTheme] = useState<ThemeValue>(() => getStoredTheme());

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getStates();
      setStates(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load states');
      setStates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
    if (theme === 'system') {
      const m = window.matchMedia('(prefers-color-scheme: dark)');
      const update = () => document.documentElement.setAttribute('data-theme', m.matches ? 'dark' : 'light');
      m.addEventListener('change', update);
      return () => m.removeEventListener('change', update);
    }
  }, [theme]);

  const onServiceCall = useCallback(() => {
    refresh();
  }, [refresh]);

  const entitiesByDomain = (domain: string): HAEntityState[] =>
    states.filter((s) => s.entity_id.startsWith(domain + '.'));

  const entitiesByDomains = (domains: string[]): HAEntityState[] =>
    states.filter((s) => domains.some((d) => s.entity_id.startsWith(d + '.')));

  return (
    <>
      <header className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h1>Canopy</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>Theme</span>
            <select
              aria-label="Theme"
              value={theme}
              onChange={(e) => setTheme((e.target.value as ThemeValue))}
              className="theme-select"
            >
              {THEME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              {loading ? '…' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className={`tab-panel${activeTab === 'calendar' ? ' tab-panel--calendar' : ''}`}>
        {error && (
          <div className="error-banner">
            {error}. Check that the HA proxy is running and VITE_HA_BASE_URL / VITE_HA_TOKEN are set.
          </div>
        )}
        {loading && !states.length ? (
          <div className="loading">Loading…</div>
        ) : (
          <>
            {activeTab === 'lighting' && (
              <LightingTab
                entities={entitiesByDomain('light')}
                onAction={onServiceCall}
              />
            )}
            {activeTab === 'climate' && (
              <ClimateTab
                entities={entitiesByDomain('climate')}
                onAction={onServiceCall}
              />
            )}
            {activeTab === 'switches' && (
              <SwitchesTab
                entities={entitiesByDomains(['switch', 'fan'])}
                onAction={onServiceCall}
              />
            )}
            {activeTab === 'covers' && (
              <CoversTab
                entities={entitiesByDomain('cover')}
                onAction={onServiceCall}
              />
            )}
            {activeTab === 'security' && (
              <SecurityTab
                entities={entitiesByDomains(['lock', 'alarm_control_panel'])}
                onAction={onServiceCall}
              />
            )}
            {activeTab === 'sensors' && (
              <SensorsTab entities={entitiesByDomains(['sensor', 'binary_sensor'])} />
            )}
            {activeTab === 'calendar' && <CalendarTab />}
          </>
        )}
      </main>
    </>
  );
}

export default App;
