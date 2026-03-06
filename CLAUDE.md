# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BOTcrumb is an AI vs AI strategy game where tribes of units battle on the surface of a sphere. Tribes are named by an LLM at game start. The backend runs a real-time game engine; the frontend visualizes it in 3D using Three.js.

## Commands

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

## Architecture

### Backend (`backend/app/`)
- `main.py` — FastAPI app, CORS, mounts two routers
- `api/game_ws.py` — WebSocket endpoint `/ws/game`, global `GameEngine` instance, `asyncio` game loop, `ConnectionManager` for broadcasting
- `api/setup.py` — REST routes (e.g. `/api/status`)
- `game/game_engine.py` — `GameEngine.tick()` drives unit movement, spawning, combat, energy collection
- `game/ai_controller.py` — `queen_ai_decision()` runs every 5 ticks; `unit_behavior()` + `resolve_combat()` run every tick / every 25 ticks
- `game/diff_encoder.py` — encodes game state as JSON: full `game_init` snapshot or incremental `diff` (moved/spawned/died/hp_changed/hit_flashes/energy_spawned/energy_depleted/tribe_stats/events)
- `game/constants.py` — all tunable game constants (tick rate, unit stats, tribe colors, etc.)
- `game/sphere_math.py` — geodesic math (fibonacci placement, `great_circle_dist`, `move_on_sphere`)
- `game/octree.py` — `SphereOctree` for spatial neighbor queries
- `game/stone_gen.py` — generates obstacle stones on the sphere surface
- `game/types.py` — dataclasses: `Unit`, `Tribe`, `EnergySource`, `Stone`, `GameState`
- `services/llm_service.py` — generates tribe names via Ollama, Claude, Gemini, or OpenAI; falls back to Latin defaults

### Frontend (`frontend/src/`)
- `app/page.tsx` — root page, renders `SetupScreen` or `GameView` based on `gamePhase`
- `components/GameCanvas.tsx` — mounts Three.js scene, `OrbitControls`, manages `GameSocket`, dispatches WS messages to Zustand store
- `components/GameView.tsx` — layout: `GameCanvas` (left, fills screen) + `RightPanel` (right sidebar)
- `components/RightPanel.tsx` — tabbed panel: stats table + event log
- `components/StatsTable.tsx` — live tribe stats (energy, workers, attackers, defenders, queen)
- `components/EventLog.tsx` — scrollable event feed
- `store/gameStore.ts` — Zustand store; single source of truth for game phase, tribe stats, event log, winner
- `ws/GameSocket.ts` — WebSocket client with auto-reconnect; typed `ServerMessage` union
- `three/` — Three.js renderers: `UnitRenderer` (4x `InstancedMesh` per unit type), `StoneRenderer`, `EnergyRenderer`, `HitFlash`

### WebSocket Protocol
Client sends: `{ type: "start", num_tribes, llm_model, llm_api_key }` | `{ type: "stop" }` | `{ type: "get_snapshot" }`

Server sends:
- `game_init` — full snapshot on connect or new game
- `diff` — per-tick incremental update
- `event_history` — replayed events for reconnecting clients
- `game_over` — winner info

### Configuration (`.env` in `backend/`)
```
OLLAMA_URL=http://ollama:11434
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
```

## Key Implementation Notes
- `OrbitControls` import requires `.js` extension: `three/examples/jsm/controls/OrbitControls.js`
- `tsconfig.json` needs `"downlevelIteration": true` and `"target": "es2015"` for `Map.values()` iteration
- Game runs at 8.6x realtime (200ms tick budget handles 200 ticks in ~1.7s)
- `UnitRenderer` uses per-instance colors via `instancedMesh.setColorAt()`
- Stone generation uses simplified rejection sampling (no BFS), 0.04–0.15 rad cap_angle, max 35% sphere coverage, avoids queen proximity
