# Simulator

Streams rows from `traffic_emergency_cyber_dataset.csv` to the backend's
`POST /ingest` endpoint, one row at a time, so there's live traffic flowing
through `FastAPI -> WebSocket -> dashboard` for the demo.

## Setup

```bash
pip install requests
```

## Run

Start the backend first (see `../backend/README.md`), then:

```bash
cd simulator
python simulate.py
```

Each row is classified by the backend and, if any dashboards are connected
to `/ws`, broadcast to them live. The simulator also prints its own
predicted-vs-actual comparison for each row so you can watch accuracy in the
terminal.

## Options

| Flag | Default | Purpose |
|---|---|---|
| `--csv PATH` | `../traffic_emergency_cyber_dataset.csv` | Dataset to stream |
| `--url URL` | `http://127.0.0.1:8000/ingest` | Backend ingest endpoint |
| `--interval SECONDS` | `0.3` | Delay between rows |
| `--shuffle` | off | Randomize row order instead of streaming in file order |
| `--loop` | off | Restart from the beginning once the dataset is exhausted |
| `--limit N` | none | Stop after N rows |
| `--seed N` | none | Seed for `--shuffle` |

Example — fast, shuffled, continuous demo traffic:

```bash
python simulate.py --interval 0.1 --shuffle --loop
```
