"""Setup endpoints: start game, model management."""
import re
import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/status")
async def game_status() -> dict:
    from app.api.game_ws import get_game_status
    return get_game_status()


class StartRequest(BaseModel):
    num_tribes: int = 4
    llm_model: str = "ollama:llama3.2"
    llm_api_key: str = ""


@router.get("/models/ollama")
async def list_ollama_models() -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.ollama_url}/api/tags")
            resp.raise_for_status()
            names = [m["name"] for m in resp.json().get("models", [])]
            return {"models": names}
    except Exception:
        return {"models": []}


@router.post("/models/pull")
async def pull_ollama_model(body: dict, background_tasks: BackgroundTasks) -> dict:
    model = body.get("model", "").strip()
    if not model:
        raise HTTPException(400, "model is required")
    if not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,99}$', model):
        raise HTTPException(400, "Invalid model name")
    background_tasks.add_task(_pull_model_bg, model)
    return {"status": "pulling", "model": model}


async def _pull_model_bg(model: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=600) as client:
            await client.post(
                f"{settings.ollama_url}/api/pull",
                json={"name": model, "stream": False},
            )
    except Exception:
        pass


@router.post("/models/fetch")
async def fetch_provider_models(body: dict) -> dict:
    provider = body.get("provider", "").strip()
    api_key = body.get("api_key", "").strip()

    if provider == "ollama":
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{settings.ollama_url}/api/tags")
                resp.raise_for_status()
                models = [
                    {"id": m["name"], "size_gb": round(m.get("size", 0) / 1e9, 1)}
                    for m in resp.json().get("models", [])
                ]
                return {"models": models}
        except Exception:
            return {"models": [], "error": "Ollama niedostepny"}

    if provider == "openai":
        key = api_key or settings.openai_api_key
        if not key:
            return {"models": [], "error": "Brak klucza OpenAI"}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                )
                resp.raise_for_status()
                models = sorted(
                    [{"id": m["id"]} for m in resp.json()["data"]
                     if "gpt" in m["id"] and "instruct" not in m["id"]],
                    key=lambda x: x["id"], reverse=True,
                )
                return {"models": models}
        except Exception as e:
            return {"models": [], "error": str(e)[:100]}

    if provider == "gemini":
        key = api_key or settings.google_api_key
        if not key:
            return {"models": [], "error": "Brak klucza Google API"}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    "https://generativelanguage.googleapis.com/v1beta/models",
                    params={"key": key},
                )
                resp.raise_for_status()
                models = [
                    {"id": m["name"].replace("models/", "")}
                    for m in resp.json().get("models", [])
                    if "gemini" in m.get("name", "")
                    and "generateContent" in m.get("supportedGenerationMethods", [])
                    and "embedding" not in m.get("name", "")
                ]
                return {"models": models}
        except Exception as e:
            return {"models": [], "error": str(e)[:100]}

    if provider == "anthropic":
        return {"models": [
            {"id": "claude-opus-4-5"},
            {"id": "claude-sonnet-4-5"},
            {"id": "claude-haiku-4-5-20251001"},
            {"id": "claude-3-5-sonnet-20241022"},
            {"id": "claude-3-5-haiku-20241022"},
            {"id": "claude-3-opus-20240229"},
        ]}

    raise HTTPException(400, "Unknown provider")
