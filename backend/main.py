"""FastAPI inference service: simulator -> /ingest -> WebSocket -> dashboard."""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import model
from schemas import PredictionResponse, TrafficRow

app = FastAPI(title="CityShield AI - Cyber Risk Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        for connection in dead_connections:
            self.disconnect(connection)


manager = ConnectionManager()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_mode": "trained" if model._MODEL is not None else "heuristic",
        "connected_dashboards": len(manager.active_connections),
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(row: TrafficRow):
    return model.predict_risk(row)


@app.post("/ingest", response_model=PredictionResponse)
async def ingest(row: TrafficRow):
    prediction = model.predict_risk(row)
    await manager.broadcast(prediction.model_dump())
    return prediction


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
