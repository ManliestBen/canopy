import { useState } from 'react';
import { callService } from '../api';
import type { HAEntityState } from '../types';

interface EntityCardProps {
  entity: HAEntityState;
  onAction: () => void;
}

function EntityCard({ entity, onAction }: EntityCardProps) {
  const name = entity.attributes?.friendly_name || entity.entity_id;
  const unavailable = entity.state === 'unavailable';
  const current = entity.attributes?.current_temperature;
  const target = entity.attributes?.temperature ?? entity.attributes?.target_temp_low ?? entity.attributes?.target_temp_high;
  const hvac = entity.attributes?.hvac_modes || [];
  const currentMode = entity.attributes?.hvac_mode ?? entity.state;
  const minTemp = entity.attributes?.min_temp ?? 5;
  const maxTemp = entity.attributes?.max_temp ?? 35;
  const step = entity.attributes?.target_temp_step ?? 1;

  const [busy, setBusy] = useState(false);

  const setTemp = async (temp: number) => {
    if (unavailable || busy) return;
    setBusy(true);
    try {
      await callService('climate', 'set_temperature', {
        entity_id: entity.entity_id,
        temperature: temp,
      });
      onAction();
    } finally {
      setBusy(false);
    }
  };

  const setHvacMode = async (mode: string) => {
    if (unavailable || busy) return;
    setBusy(true);
    try {
      await callService('climate', 'set_hvac_mode', {
        entity_id: entity.entity_id,
        hvac_mode: mode,
      });
      onAction();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`card ${unavailable ? 'unavailable' : ''}`}>
      <div className="card-name">{name}</div>
      <div className="card-state">{entity.state}</div>
      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {(current != null || target != null) && (
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {current != null && <span>Current: {current}°</span>}
            {current != null && target != null && ' · '}
            {target != null && <span>Target: {target}°</span>}
          </div>
        )}
        {hvac.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {hvac.map((mode) => (
              <button
                key={mode}
                onClick={() => setHvacMode(mode)}
                disabled={unavailable || busy}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.8rem',
                  background: currentMode === mode ? 'var(--accent)' : 'var(--bg-card-hover)',
                  color: currentMode === mode ? '#0f1419' : 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setTemp(Math.max(minTemp, (target ?? current ?? 20) - step))}
            disabled={unavailable || busy}
            style={{ padding: '0.35rem 0.6rem', background: 'var(--bg-card-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            −
          </button>
          <span style={{ minWidth: '3rem', textAlign: 'center', fontSize: '0.95rem' }}>{target ?? '—'}°</span>
          <button
            onClick={() => setTemp(Math.min(maxTemp, (target ?? current ?? 20) + step))}
            disabled={unavailable || busy}
            style={{ padding: '0.35rem 0.6rem', background: 'var(--bg-card-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

interface ClimateTabProps {
  entities: HAEntityState[];
  onAction: () => void;
}

export function ClimateTab({ entities, onAction }: ClimateTabProps) {
  return (
    <>
      <div className="refresh-row">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {entities.length} climate device{entities.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="entity-grid">
        {entities.map((e) => (
          <EntityCard key={e.entity_id} entity={e} onAction={onAction} />
        ))}
      </div>
      {entities.length === 0 && (
        <p className="loading">No climate entities.</p>
      )}
    </>
  );
}
