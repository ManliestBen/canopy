import { useState } from 'react';
import { callService } from '../api';
import type { HAEntityState } from '../types';

interface EntityCardProps {
  entity: HAEntityState;
  onAction: () => void;
}

function EntityCard({ entity, onAction }: EntityCardProps) {
  const name = entity.attributes?.friendly_name || entity.entity_id;
  const state = entity.state;
  const unavailable = state === 'unavailable';
  const isOpen = state === 'open';
  const isOpening = state === 'opening';
  const isClosing = state === 'closing';

  const [busy, setBusy] = useState(false);

  const run = async (service: string) => {
    if (unavailable || busy) return;
    setBusy(true);
    try {
      await callService('cover', service, { entity_id: entity.entity_id });
      onAction();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`card ${unavailable ? 'unavailable' : ''}`}>
      <div className="card-name">{name}</div>
      <div className={`card-state ${state}`}>{state}</div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => run('open_cover')}
          disabled={unavailable || busy || isOpen || isOpening}
          style={{ padding: '0.4rem 0.75rem', background: 'var(--bg-card-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          Open
        </button>
        <button
          onClick={() => run('close_cover')}
          disabled={unavailable || busy || !isOpen || isClosing}
          style={{ padding: '0.4rem 0.75rem', background: 'var(--bg-card-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          Close
        </button>
        <button
          onClick={() => run('stop_cover')}
          disabled={unavailable || busy || (!isOpening && !isClosing)}
          style={{ padding: '0.4rem 0.75rem', background: 'var(--bg-card-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          Stop
        </button>
      </div>
    </div>
  );
}

interface CoversTabProps {
  entities: HAEntityState[];
  onAction: () => void;
}

export function CoversTab({ entities, onAction }: CoversTabProps) {
  return (
    <>
      <div className="refresh-row">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {entities.length} cover{entities.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="entity-grid">
        {entities.map((e) => (
          <EntityCard key={e.entity_id} entity={e} onAction={onAction} />
        ))}
      </div>
      {entities.length === 0 && (
        <p className="loading">No covers (blinds, garage doors, etc.).</p>
      )}
    </>
  );
}
