# CityShield AI — Backend Inference API

FastAPI service that classifies traffic/emergency-device telemetry rows for
cyber risk and streams predictions to a dashboard over WebSocket.

Pipeline: simulator (streams rows from `traffic_emergency_cyber_dataset.csv`)
→ `POST /ingest` → `predict_risk()` → broadcast over `/ws` → React dashboard.

## Setup

```bash
pip install fastapi uvicorn pydantic websockets
```

## Run

```bash
cd backend
uvicorn main:app --reload --port 8000
```

The startup log prints which inference mode is active:

```
[model] model.pkl / encoders.pkl not found -> inference mode: HEURISTIC
```

or, once a trained model is dropped in:

```
[model] model.pkl + encoders.pkl loaded -> inference mode: TRAINED
```

Visit `http://127.0.0.1:8000/docs` for interactive Swagger UI — use it to
call `/predict` by hand without curl or the frontend.

## Endpoints

| Endpoint    | Method    | Purpose                                                                 |
|-------------|-----------|--------------------------------------------------------------------------|
| `/health`   | GET       | Liveness check: overall model mode + connected dashboard count           |
| `/predict`  | POST      | Classify one row, return the prediction (no broadcast)                   |
| `/ingest`   | POST      | Classify one row **and** broadcast it to every connected dashboard       |
| `/ws`       | WebSocket | Dashboard connects here to receive live predictions pushed by `/ingest`  |

`GET /health` response:

```json
{
  "status": "ok",
  "model_mode": "heuristic",
  "connected_dashboards": 0
}
```

`model_mode` reflects whether `model.pkl`/`encoders.pkl` were loaded at
startup. An individual prediction's `inference_mode` (see below) can still
say `"heuristic"` even when `model_mode` is `"trained"`, if that row's
`device_type` isn't one of the four types the model was trained on.

## Request body — `TrafficRow`

Matches `traffic_emergency_cyber_dataset.csv`'s header exactly (every column
except `label`, which is the prediction output):

```json
{
  "device_type": "traffic_camera",
  "zone_id": "downtown",
  "protocol": "TCP",
  "mqtt_msg_type": "none",
  "src_port": 58221,
  "dst_port": 22,
  "packet_size": 74,
  "packets_per_second": 2.9,
  "connection_duration": 0.8,
  "bytes_transferred": 590,
  "unique_dst_ips_contacted": 1,
  "avg_request_interval": 0.4,
  "syn_flag_count": 0,
  "rst_flag_count": 0,
  "failed_login_attempts": 41,
  "is_encrypted": 0,
  "mac_ip_mismatch": 0,
  "signal_preemption_request": 0,
  "gps_deviation_km": 0.0,
  "hour_of_day": 4,
  "day_type": "weekday"
}
```

## Response contract — `PredictionResponse` (give this to the frontend dev)

```json
{
  "label": "brute_force",
  "risk_score": 0.642,
  "risk_level": "medium",
  "device_type": "dispatch_server",
  "zone_id": "hospital_zone",
  "timestamp": "2026-09-03T15:12:47.630113+00:00",
  "inference_mode": "heuristic",
  "confidence": null
}
```

- `label` — one of `normal`, `ddos`, `port_scan`, `brute_force`, `spoofing`,
  `command_injection`.
- `risk_score` — float in `[0, 1]`.
- `risk_level` — always one of `"low" | "medium" | "high"`, derived from
  `risk_score` (`<0.4` low, `0.4–0.7` medium, `>=0.7` high). Safe to key
  dashboard colors off this directly instead of thresholding `risk_score`
  yourself.
- `timestamp` — ISO 8601, UTC, generated server-side at prediction time.
- `inference_mode` — `"trained"` only when a real model is loaded **and**
  the row's `device_type` is one of the 4 trained types (`traffic_camera`,
  `signal_controller`, `ambulance_tracker`, `dispatch_server`); otherwise
  `"heuristic"`.
- `confidence` — the trained model's max class probability when
  `inference_mode` is `"trained"`; `null` in heuristic mode (there's no real
  probability to report).

`/ingest` returns this same object and also pushes it, as JSON, to every
socket connected on `/ws`.

## Heuristic mode (fallback when no model.pkl is present)

`model.py` ships with a rule-based heuristic whose thresholds were derived
by inspecting the actual per-label distributions in
`traffic_emergency_cyber_dataset.csv` (see the module docstring in
`model.py` for the full derivation), not guessed:

| Label               | Trigger                                                                                     |
|---------------------|-----------------------------------------------------------------------------------------------|
| `ddos`               | `packets_per_second > 100` OR `syn_flag_count > 100`                                          |
| `port_scan`          | `unique_dst_ips_contacted >= 10`                                                               |
| `brute_force`        | `failed_login_attempts >= 10`                                                                  |
| `spoofing`           | `mac_ip_mismatch == 1` AND `gps_deviation_km > 1.0`                                            |
| `command_injection`  | `signal_preemption_request == 1` AND (`failed_login_attempts >= 3` OR (off-hours AND unencrypted)) |
| `normal`             | none of the above                                                                              |

**Important:** `signal_preemption_request` is `1` on ~13% of `normal` rows —
real ambulances legitimately request signal preemption. It is never treated
as a standalone attack flag; `command_injection` only fires when it's paired
with a secondary indicator (repeated failed logins, or an off-hours +
unencrypted connection).

This means the whole pipeline — simulator, API, dashboard — could be built and
demoed with believable predictions before a trained model existed. A trained
model is now included by default (see below), but deleting `model.pkl` +
`encoders.pkl` (or running elsewhere without them) drops straight back to
this heuristic with no code changes.

## Trained model (active by default)

`model.pkl` + `encoders.pkl` are checked into `backend/`, produced by
`../training/train_model.py` — a `RandomForestClassifier` trained on the
full dataset (99.9% held-out accuracy; see `training/README.md`). Drop in a
different pair of files with the same structure to swap it out:

- **`model.pkl`** — a pickled sklearn/xgboost-style classifier exposing
  `.predict(X)` and `.predict_proba(X)`, with `.classes_` including
  `"normal"` as one of the class labels.
- **`encoders.pkl`** — a pickled dict shaped **exactly** like this:

  ```python
  {
      "encoders": {
          "device_type": LabelEncoder(),   # fit on the 4 device_type values
          "zone_id": LabelEncoder(),       # fit on the 4 zone_id values
          "protocol": LabelEncoder(),
          "mqtt_msg_type": LabelEncoder(),
          "day_type": LabelEncoder(),
          # one entry per categorical TrafficRow column the model needs encoded
      },
      "scaler": StandardScaler(),          # fit on numeric_cols, in that order
      "numeric_cols": [
          "src_port", "dst_port", "packet_size", "packets_per_second",
          "connection_duration", "bytes_transferred", "unique_dst_ips_contacted",
          "avg_request_interval", "syn_flag_count", "rst_flag_count",
          "failed_login_attempts", "is_encrypted", "mac_ip_mismatch",
          "signal_preemption_request", "gps_deviation_km", "hour_of_day",
      ],                                    # exact list + order fed into scaler.transform()
      "feature_order": [
          "device_type", "zone_id", "protocol", "mqtt_msg_type",
          "src_port", "dst_port", "packet_size", "packets_per_second",
          "connection_duration", "bytes_transferred", "unique_dst_ips_contacted",
          "avg_request_interval", "syn_flag_count", "rst_flag_count",
          "failed_login_attempts", "is_encrypted", "mac_ip_mismatch",
          "signal_preemption_request", "gps_deviation_km", "hour_of_day",
          "day_type",
      ],                                    # exact column order model.predict() expects
  }
  ```

  At inference time, `model.py` encodes each `encoders` key via
  `encoder.transform([str(value)])`, scales `numeric_cols` via
  `scaler.transform(...)`, assembles the final feature vector in
  `feature_order`, then calls `model.predict()` / `model.predict_proba()`.

Restart the server. `model.py` auto-detects both files at import time and
switches from heuristic to trained inference — nothing else in the codebase
needs to change. Check `/health` to confirm `"model_mode": "trained"`.

If a model's preprocessing doesn't match this exact structure, adjust
`_real_predict()` in `model.py` — that's the only function that needs to
change. If loading fails for any reason (missing keys, unseen category,
shape mismatch), `model.py` logs the error and falls back to the heuristic
automatically rather than crashing the server.

## Quick test (once running)

```bash
curl -X POST http://127.0.0.1:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "device_type": "traffic_camera", "zone_id": "downtown", "protocol": "TCP",
    "mqtt_msg_type": "none", "src_port": 58221, "dst_port": 22,
    "packet_size": 74, "packets_per_second": 2.9, "connection_duration": 0.8,
    "bytes_transferred": 590, "unique_dst_ips_contacted": 1, "avg_request_interval": 0.4,
    "syn_flag_count": 0, "rst_flag_count": 0, "failed_login_attempts": 41,
    "is_encrypted": 0, "mac_ip_mismatch": 0, "signal_preemption_request": 0,
    "gps_deviation_km": 0.0, "hour_of_day": 4, "day_type": "weekday"
  }'
```

Expect `"label": "brute_force"` back (`failed_login_attempts: 41 >= 10`).

This was verified against real sampled rows from
`traffic_emergency_cyber_dataset.csv` — one `normal` plus one of each attack
class (`ddos`, `port_scan`, `brute_force`, `spoofing`,
`command_injection`) — all six correctly classified, and `/ingest` was
confirmed to broadcast to a live `/ws` connection with `/health`'s
`connected_dashboards` count updating on connect/disconnect.
