export default function StatBar({ connected, health, stats }) {
  return (
    <div className="stat-bar">
      <div className={`stat-pill connection ${connected ? "up" : "down"}`}>
        <span className="dot" />
        {connected ? "Live" : "Reconnecting…"}
      </div>
      <div className="stat-pill">
        model: <strong>{health?.model_mode ?? "—"}</strong>
      </div>
      <div className="stat-pill">
        dashboards: <strong>{health?.connected_dashboards ?? "—"}</strong>
      </div>
      <div className="stat-pill">
        events: <strong>{stats.total}</strong>
      </div>
      <div className="stat-pill risk-high">
        high risk: <strong>{stats.high}</strong>
      </div>
      <div className="stat-pill risk-medium">
        medium: <strong>{stats.medium}</strong>
      </div>
      <div className="stat-pill risk-low">
        low: <strong>{stats.low}</strong>
      </div>
    </div>
  );
}
