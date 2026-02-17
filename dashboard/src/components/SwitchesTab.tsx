import { useState } from 'react';
import { callService, domainFromEntityId } from '../api';
import type { HAEntityState } from '../types';

interface EntityCardProps {
  entity: HAEntityState;
  onAction: () => void;
}

function EntityCard({ entity, onAction }: EntityCardProps) {
  const name = entity.attributes?.friendly_name || entity.entity_id;
  const domain = domainFromEntityId(entity.entity_id);
  const isOn = entity.state === 'on';
  const unavailable = entity.state === 'unavailable';
  const isFan = domain === 'fan';
  const percentage = entity.attributes?.percentage;
  const presetMode = entity.attributes?.preset_mode;

  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (unavailable || busy) return;
    setBusy(true);
    try {
      if (isFan) {
        await callService('fan', isOn ? 'turn_off' : 'turn_on', { entity_id: entity.entity_id });
      } else {
        await callService('switch', isOn ? 'turn_off' : 'turn_on', { entity_id: entity.entity_id });
      }
      onAction();
    } finally {
      setBusy(false);
    }
  };

  const setSpeed = async (pct: number) => {
    if (unavailable || busy || !isFan) return;
    setBusy(true);
    try {
      await callService('fan', 'set_percentage', { entity_id: entity.entity_id, percentage: pct });
      onAction();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`card ${unavailable ? 'unavailable' : ''}`}>
      <div className="card-name">{name}</div>
      <div className={`card-state ${entity.state}`}>
        {entity.state}
        {isFan && percentage != null && ` (${percentage}%)`}
        {presetMode && ` · ${presetMode}`}
      </div>
      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button
          onClick={toggle}
          disabled={unavailable || busy}
          style={{
            padding: '0.4rem 1rem',
            background: isOn ? 'var(--on)' : 'var(--bg-card-hover)',
            color: isOn ? '#0f1419' : 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          {busy ? '…' : isOn ? 'On' : 'Off'}
        </button>
        {isFan && entity.attributes?.percentage != null && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Speed</span>
            <input
              type="range"
              min="0"
              max="100"
              value={percentage ?? 0}
              onChange={(e) => setSpeed(Number(e.target.value))}
              disabled={unavailable || busy}
              style={{ flex: 1 }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

interface SwitchesTabProps {
  entities: HAEntityState[];
  onAction: () => void;
}

export function SwitchesTab({ entities, onAction }: SwitchesTabProps) {
  return (
    <>
      <div className="refresh-row">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {entities.length} switch/fan{entities.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="entity-grid">
        {entities.map((e) => (
          <EntityCard key={e.entity_id} entity={e} onAction={onAction} />
        ))}
      </div>
      {entities.length === 0 && (
        <p className="loading">No switches or fans.</p>
      )}
    </>
  );
}
