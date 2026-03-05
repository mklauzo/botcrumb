"""Encode game diffs and snapshots for WebSocket broadcast."""
import json
from app.game.types import GameState
from app.game.constants import SPHERE_RADIUS


def encode_diff(tick: int, diff_data: dict) -> str:
    """Encode a tick diff as JSON string."""
    return json.dumps({
        "type": "diff",
        "tick": tick,
        **diff_data,
    })


def encode_snapshot(engine) -> str:
    """Encode full game snapshot as JSON string."""
    return json.dumps(engine.get_snapshot())


def encode_game_over(winner: dict) -> str:
    return json.dumps({"type": "game_over", "winner": winner})
