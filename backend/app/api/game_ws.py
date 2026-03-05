"""WebSocket game endpoint and connection manager."""
import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.game.game_engine import GameEngine
from app.game.diff_encoder import encode_diff, encode_snapshot, encode_game_over
from app.services.llm_service import generate_tribe_names

logger = logging.getLogger(__name__)
router = APIRouter()

# Global game state (persists across WebSocket connections)
_engine: GameEngine | None = None
_game_task: asyncio.Task | None = None

# Persistent event log and stats (survive browser close)
_stored_events: list[dict] = []
_stored_tribe_stats: list[dict] = []
_game_result: dict | None = None

MAX_STORED_EVENTS = 2000


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: str) -> None:
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


def get_game_status() -> dict:
    """Return current game state for /api/status."""
    if _engine is None:
        return {"state": "none", "winner": None}
    if _engine.state.running:
        return {"state": "running", "winner": None}
    return {"state": "over", "winner": _game_result}


@router.websocket("/ws/game")
async def game_ws(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Auto-send current game state to every connecting client
        if _engine is not None:
            await websocket.send_text(encode_snapshot(_engine))

            if _stored_events or _stored_tribe_stats:
                history = json.dumps({
                    "type": "event_history",
                    "events": list(_stored_events),
                    "tribe_stats": list(_stored_tribe_stats),
                })
                await websocket.send_text(history)

            if _game_result:
                await websocket.send_text(encode_game_over(_game_result))

        async for raw in websocket.iter_text():
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")

            if msg_type == "start":
                # Only start if no game running (new game or after game over)
                if _engine is None or not _engine.state.running:
                    await _handle_start(msg)
                else:
                    # Game already running — send current state to this client
                    await websocket.send_text(encode_snapshot(_engine))

            elif msg_type == "get_snapshot":
                if _engine:
                    await websocket.send_text(encode_snapshot(_engine))

            elif msg_type == "stop":
                await _handle_stop()

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)


async def _handle_start(msg: dict) -> None:
    global _engine, _game_task, _stored_events, _stored_tribe_stats, _game_result

    # Cancel previous game loop if any
    if _game_task and not _game_task.done():
        _game_task.cancel()
        try:
            await _game_task
        except asyncio.CancelledError:
            pass

    # Reset persistent state for fresh game
    _stored_events = []
    _stored_tribe_stats = []
    _game_result = None

    num_tribes = max(2, min(10, int(msg.get("num_tribes", 4))))
    llm_model = msg.get("llm_model", "ollama:llama3.2")
    api_key = msg.get("llm_api_key", "")

    try:
        tribe_names = await generate_tribe_names(num_tribes, llm_model, api_key)
    except Exception:
        tribe_names = [f"Tribe{i}" for i in range(num_tribes)]

    _engine = GameEngine()
    try:
        _engine.init_game(num_tribes, tribe_names)
    except Exception as e:
        logger.error(f"init_game failed: {e}", exc_info=True)
        await manager.broadcast(json.dumps({"type": "error", "msg": f"Game init failed: {e}"}))
        _engine = None
        return

    await manager.broadcast(encode_snapshot(_engine))
    _game_task = asyncio.create_task(_game_loop())


async def _handle_stop() -> None:
    global _game_task, _engine
    if _game_task and not _game_task.done():
        _game_task.cancel()
        try:
            await _game_task
        except asyncio.CancelledError:
            pass
    _engine = None


async def _game_loop() -> None:
    global _engine, _stored_events, _stored_tribe_stats, _game_result
    from app.game.constants import TICK_MS

    while _engine and _engine.state.running:
        try:
            diff = _engine.tick()
            tick_num = _engine.state.tick - 1

            # Persist events
            for ev in diff.get("events") or []:
                ev_with_tick = {**ev, "tick": tick_num}
                _stored_events.append(ev_with_tick)
            if len(_stored_events) > MAX_STORED_EVENTS:
                _stored_events = _stored_events[-MAX_STORED_EVENTS:]

            # Persist latest tribe stats
            if diff.get("tribe_stats"):
                _stored_tribe_stats = diff["tribe_stats"]

            msg = encode_diff(tick_num, diff)
            await manager.broadcast(msg)

            if not _engine.state.running and _engine.state.winner:
                _game_result = _engine.state.winner
                await manager.broadcast(encode_game_over(_game_result))
                break

            await asyncio.sleep(TICK_MS / 1000.0)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Game loop error: {e}", exc_info=True)
            await asyncio.sleep(0.5)
