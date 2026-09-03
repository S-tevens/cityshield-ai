import { useEffect, useState } from "react";
import { MapContainer, Rectangle, Tooltip } from "react-leaflet";
import { CRS } from "leaflet";
import { ZONES, RISK_COLORS } from "../config.js";

const FLASH_MS = 1200;

export default function ZoneMap({ zoneState }) {
  // Re-renders periodically so the "recent event" flash can fade out.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);

  return (
    <MapContainer
      crs={CRS.Simple}
      bounds={[[0, 0], [200, 200]]}
      style={{ height: "100%", width: "100%", background: "#0d1117" }}
      zoomControl={false}
      attributionControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
    >
      {Object.entries(ZONES).map(([zoneId, zone]) => {
        const state = zoneState[zoneId];
        const level = state?.risk_level ?? "unknown";
        const color = RISK_COLORS[level];
        const age = state ? Date.now() - state.receivedAt : Infinity;
        const isFresh = age < FLASH_MS;

        return (
          <Rectangle
            key={zoneId}
            bounds={zone.bounds}
            pathOptions={{
              color,
              weight: isFresh ? 4 : 1.5,
              fillColor: color,
              fillOpacity: isFresh ? 0.55 : 0.2,
            }}
          >
            <Tooltip direction="center" permanent className="zone-tooltip">
              <div className="zone-tooltip-inner">
                <strong>{zone.label}</strong>
                {state ? (
                  <>
                    <div className={`zone-label risk-${level}`}>{state.label}</div>
                    <div className="zone-score">risk {state.risk_score.toFixed(2)}</div>
                  </>
                ) : (
                  <div className="zone-label">no data yet</div>
                )}
              </div>
            </Tooltip>
          </Rectangle>
        );
      })}
    </MapContainer>
  );
}
