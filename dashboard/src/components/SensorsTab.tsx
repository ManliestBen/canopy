import type { HAEntityState } from '../types';

interface EntityCardProps {
  entity: HAEntityState;
}

function EntityCard({ entity }: EntityCardProps) {
  const name = entity.attributes?.friendly_name || entity.entity_id;
  const state = entity.state;
  const unit = entity.attributes?.unit_of_measurement ?? '';
  const deviceClass = entity.attributes?.device_class;
  const unavailable = state === 'unavailable';
  const isBinary = entity.entity_id.startsWith('binary_sensor.');

  let display: string = state;
  if (unit && state !== 'unavailable' && !isBinary) display = `${state} ${unit}`.trim();
  if (deviceClass === 'timestamp' && state !== 'unavailable') {
    try {
      const d = new Date(state);
      if (!isNaN(d.getTime())) display = d.toLocaleString();
    } catch {
      // ignore
    }
  }

  return (
    <div className={`card ${unavailable ? 'unavailable' : ''}`}>
      <div className="card-name">{name}</div>
      <div className={`card-state ${state}`}>{display}</div>
    </div>
  );
}

interface SensorsTabProps {
  entities: HAEntityState[];
}

export function SensorsTab({ entities }: SensorsTabProps) {
  const binary = entities.filter((e) => e.entity_id.startsWith('binary_sensor.'));
  const sensors = entities.filter((e) => e.entity_id.startsWith('sensor.'));

  return (
    <>
      <div className="refresh-row">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {binary.length} binary, {sensors.length} sensor{sensors.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="entity-grid">
        {[...binary, ...sensors].map((e) => (
          <EntityCard key={e.entity_id} entity={e} />
        ))}
      </div>
      {entities.length === 0 && (
        <p className="loading">No sensors.</p>
      )}
    </>
  );
}
