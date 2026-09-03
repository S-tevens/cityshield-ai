# Smart City Cyber Risk Detection — Backend API

## Setup

```bash
pip install fastapi uvicorn pydantic
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

Visit `http://127.0.0.1:8000/docs` for interactive Swagger UI — use this to
test `/predict` by hand without needing curl or the frontend.

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Liveness check, shows whether mock or real model is active |
| `/predict` | POST | Classify one row, returns prediction (no broadcast) |
| `/ingest` | POST | Classify one row AND broadcast it to all connected dashboards over WebSocket — **this is what the simulator should call** |
| `/ws` | WebSocket | Dashboard connects here to receive live predictions |

## Response contract (give this to the frontend dev now)

```json
{
  "label": "ddos",
  "risk_score": 0.91,
  "risk_level": "high",
  "device_type": "cctv_camera",
  "zone_id": "downtown",
  "timestamp": "2026-09-03T10:04:49.949946+00:00",
  "confidence": null
}
```

`risk_level` is always one of `"low" | "medium" | "high"` — safe to key
dashboard colors off this directly instead of thresholding `risk_score`
yourself.

## Mock mode (active right now, no model.pkl needed)

`model.py` ships with a rule-based heuristic that mirrors the exact attack
signatures the dataset generator uses (high failed_login_attempts ->
brute_force, high packets_per_second + near-zero avg_request_interval ->
ddos, etc). This means the whole pipeline — simulator, API, dashboard — can
be built and demoed right now, with believable predictions, before the ML
lead's model is ready.

## Swapping in the real trained model

Once the ML lead exports their model, drop these two files into this same
folder:

- `model.pkl` — the trained sklearn/xgboost model
- `encoders.pkl` — a pickled dict shaped like:
  ```python
  {
      "encoders": {"device_type": LabelEncoder(), "zone_id": LabelEncoder(), ...},
      "scaler": StandardScaler(),        # fit on the numeric columns
      "numeric_cols": ["packet_size", "packets_per_second", ...],
      "feature_order": ["device_type", "zone_id", ..., "day_type"],  # exact column order model expects
  }
  ```

Restart the server. `model.py` auto-detects both files and switches from
mock to real inference — nothing else in the codebase needs to change.
Check `/health` to confirm `"model_mode": "real"`.

If the ML lead's preprocessing doesn't match this exact structure, adjust
`_real_predict()` in `model.py` — that's the only function that needs to
change.

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
    "is_encrypted": 0, "mac_ip_mismatch": 0, "hour_of_day": 4, "day_type": "weekday"
  }'
```

Expect `"label": "brute_force"` back.