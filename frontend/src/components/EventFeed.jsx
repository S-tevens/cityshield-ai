export default function EventFeed({ events }) {
  return (
    <div className="event-feed">
      <div className="event-feed-header">
        <span>Time</span>
        <span>Label</span>
        <span>Device / Zone</span>
        <span>Risk</span>
        <span>Mode</span>
      </div>
      <div className="event-feed-body">
        {events.length === 0 && (
          <div className="event-feed-empty">Waiting for events…</div>
        )}
        {events.map((e) => (
          <div key={e.receivedAt + e.label + e.zone_id} className={`event-row risk-${e.risk_level}`}>
            <span className="event-time">
              {new Date(e.timestamp).toLocaleTimeString()}
            </span>
            <span className="event-label">{e.label}</span>
            <span className="event-device">
              {e.device_type} <span className="event-zone">/ {e.zone_id}</span>
            </span>
            <span className="event-risk">
              <span className={`pill risk-${e.risk_level}`}>{e.risk_level}</span>
              {e.risk_score.toFixed(2)}
            </span>
            <span className="event-mode">{e.inference_mode}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
