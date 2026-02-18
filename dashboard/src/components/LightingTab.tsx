import { useState, useEffect } from 'react';
import { callService } from '../api';
import type { HAEntityState } from '../types';

interface EntityCardProps {
  entity: HAEntityState;
  onAction: () => void;
}

function EntityCard({ entity, onAction }: EntityCardProps) {
  const name = entity.attributes?.friendly_name || entity.entity_id;
  const isOn = entity.state === 'on';
  const unavailable = entity.state === 'unavailable';
  const brightness = entity.attributes?.brightness ?? (isOn ? 255 : 0);
  const brightnessPct = Math.round(((brightness || 0) / 255) * 100);
  const supportsBrightness = 'brightness' in (entity.attributes || {});

  const [busy, setBusy] = useState(false);
  const [localBrightness, setLocalBrightness] = useState(brightnessPct);

  useEffect(() => {
    setLocalBrightness(brightnessPct);
  }, [brightnessPct]);

  const toggle = async () => {
    if (unavailable || busy) return;
    setBusy(true);
    try {
      await callService('light', isOn ? 'turn_off' : 'turn_on', {
        entity_id: entity.entity_id,
      });
      onAction();
    } finally {
      setBusy(false);
    }
  };

  const setBrightness = async (pct: number) => {
    if (unavailable || busy || !supportsBrightness) return;
    setLocalBrightness(pct);
    const b = Math.round((pct / 100) * 255);
    setBusy(true);
    try {
      await callService('light', 'turn_on', {
        entity_id: entity.entity_id,
        brightness: b,
      });
      onAction();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`card ${unavailable ? 'unavailable' : ''}`}>
      <div className="card-name">{name}</div>
      <div className={`card-state ${entity.state}`}>{entity.state}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`entity-toggle ${isOn ? 'entity-toggle-on' : ''}`}
          onClick={toggle}
          disabled={unavailable || busy}
          style={{ padding: '0.4rem 1rem' }}
        >
          {busy ? '…' : isOn ? 'On' : 'Off'}
        </button>
        {supportsBrightness && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1', minWidth: '120px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '2.5rem' }}>{localBrightness}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={localBrightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              disabled={unavailable || busy}
              style={{ flex: 1, ['--range-pct' as string]: localBrightness }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

interface LightingTabProps {
  entities: HAEntityState[];
  onAction: () => void;
}

export function LightingTab({ entities, onAction }: LightingTabProps) {
  return (
    <>
      <div className="refresh-row">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {entities.length} light{entities.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="entity-grid">
        {entities.map((e) => (
          <EntityCard key={e.entity_id} entity={e} onAction={onAction} />
        ))}
      </div>
      {entities.length === 0 && (
        <p className="loading">No lights in this instance.</p>
      )}
    </>
  );
}
