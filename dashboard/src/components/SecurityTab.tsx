import { useState } from 'react';
import { callService } from '../api';
import type { HAEntityState } from '../types';

interface LockCardProps {
  entity: HAEntityState;
  onAction: () => void;
}

function LockCard({ entity, onAction }: LockCardProps) {
  const name = entity.attributes?.friendly_name || entity.entity_id;
  const isLocked = entity.state === 'locked';
  const unavailable = entity.state === 'unavailable';
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (unavailable || busy) return;
    setBusy(true);
    try {
      await callService('lock', isLocked ? 'unlock' : 'lock', { entity_id: entity.entity_id });
      onAction();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`card ${unavailable ? 'unavailable' : ''}`}>
      <div className="card-name">{name}</div>
      <div className={`card-state ${entity.state}`}>{entity.state}</div>
      <button
        onClick={toggle}
        disabled={unavailable || busy}
        style={{
          marginTop: '0.75rem',
          padding: '0.4rem 1rem',
          background: isLocked ? 'var(--danger)' : 'var(--on)',
          color: '#0f1419',
          border: '1px solid transparent',
        }}
      >
        {busy ? '…' : isLocked ? 'Unlock' : 'Lock'}
      </button>
    </div>
  );
}

interface AlarmCardProps {
  entity: HAEntityState;
  onAction: () => void;
}

function AlarmCard({ entity, onAction }: AlarmCardProps) {
  const name = entity.attributes?.friendly_name || entity.entity_id;
  const state = entity.state;
  const unavailable = state === 'unavailable';
  const [busy, setBusy] = useState(false);
  const code = entity.attributes?.code_format ? '••••' : null;

  const arm = async (mode: string) => {
    if (unavailable || busy) return;
    setBusy(true);
    try {
      await callService('alarm_control_panel', `alarm_arm_${mode}`, {
        entity_id: entity.entity_id,
        ...(code && { code: '' }),
      });
      onAction();
    } catch {
      // Some panels require code; user may need to configure
    } finally {
      setBusy(false);
    }
  };

  const disarm = async () => {
    if (unavailable || busy) return;
    setBusy(true);
    try {
      await callService('alarm_control_panel', 'alarm_disarm', {
        entity_id: entity.entity_id,
        ...(code && { code: '' }),
      });
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
        {state !== 'disarmed' && (
          <button
            onClick={disarm}
            disabled={unavailable || busy}
            style={{ padding: '0.4rem 0.75rem', background: 'var(--on)', color: '#0f1419', border: '1px solid transparent' }}
          >
            Disarm
          </button>
        )}
        {state === 'disarmed' && (
          <>
            <button
              onClick={() => arm('home')}
              disabled={unavailable || busy}
              style={{ padding: '0.4rem 0.75rem', background: 'var(--bg-card-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              Arm Home
            </button>
            <button
              onClick={() => arm('away')}
              disabled={unavailable || busy}
              style={{ padding: '0.4rem 0.75rem', background: 'var(--danger)', color: '#fff', border: '1px solid transparent' }}
            >
              Arm Away
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface SecurityTabProps {
  entities: HAEntityState[];
  onAction: () => void;
}

export function SecurityTab({ entities, onAction }: SecurityTabProps) {
  const locks = entities.filter((e) => e.entity_id.startsWith('lock.'));
  const alarms = entities.filter((e) => e.entity_id.startsWith('alarm_control_panel.'));

  return (
    <>
      <div className="refresh-row">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {locks.length} lock{locks.length !== 1 ? 's' : ''}, {alarms.length} alarm{alarms.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="entity-grid">
        {locks.map((e) => (
          <LockCard key={e.entity_id} entity={e} onAction={onAction} />
        ))}
        {alarms.map((e) => (
          <AlarmCard key={e.entity_id} entity={e} onAction={onAction} />
        ))}
      </div>
      {entities.length === 0 && (
        <p className="loading">No locks or alarm panels.</p>
      )}
    </>
  );
}
