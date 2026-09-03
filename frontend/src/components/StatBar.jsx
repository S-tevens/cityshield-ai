import { useEffect, useState } from "react";

const STABLE_WINDOW_MS = 4000;

export default function StatBar({ connected, health, stats, lastEventAt }) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const dataState = !lastEventAt
    ? "no-signal"
    : Date.now() - lastEventAt < STABLE_WINDOW_MS
    ? "stable"
    : "idle";

  const dataLabel = { stable: "stable", idle: "idle", "no-signal": "no signal" }[dataState];

  return (
    <div className="status-strip">
      <div className="status-strip-left">
        <span className={`status-chip ${connected ? "ok" : "bad"}`}>
          <span className="status-dot" />
          comms: {connected ? "online" : "offline"}
        </span>
        <span className={`status-chip ${dataState === "stable" ? "ok" : dataState === "idle" ? "warn" : "bad"}`}>
          <span className="status-dot" />
          data: {dataLabel}
        </span>
        <span className="status-chip muted">model: {health?.model_mode ?? "—"}</span>
        <span className="status-chip muted">dashboards: {health?.connected_dashboards ?? "—"}</span>
      </div>
      <div className="status-strip-right">
        <span className="status-count">{stats.total} events</span>
        <span className="status-count risk-high">{stats.high} high</span>
        <span className="status-count risk-medium">{stats.medium} med</span>
        <span className="status-count risk-low">{stats.low} low</span>
      </div>
    </div>
  );
}
