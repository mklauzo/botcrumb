"""LLM routing for tribe name generation."""
import asyncio
from app.config import get_settings

FALLBACK_NAMES = [
    "Ignis", "Aquila", "Ferrum", "Umbra", "Caelum",
    "Corvus", "Lupus", "Draco", "Nox", "Lux",
]

SYSTEM_PROMPT = (
    "You are a naming AI. Generate short Latin tribe names for a battle simulation."
)

USER_PROMPT_TEMPLATE = (
    "Generate exactly {n} unique Latin tribe names. "
    "Rules: single word only, Latin origin, 4-8 letters, powerful meaning. "
    "Examples: Ignis, Aquila, Ferrum, Umbra, Caelum, Corvus, Lupus, Draco, Nox, Lux. "
    "Return ONLY the names, one per line, no numbering, no punctuation."
)


async def generate_tribe_names(n: int, model: str, api_key: str = "") -> list[str]:
    """Generate n tribe names using LLM. Falls back to defaults on error."""
    try:
        names = await _call_llm(n, model, api_key)
        if names and len(names) >= n:
            return names[:n]
    except Exception:
        pass
    return FALLBACK_NAMES[:n]


async def _call_llm(n: int, model: str, api_key: str) -> list[str]:
    settings = get_settings()
    prompt = USER_PROMPT_TEMPLATE.format(n=n)

    if model.startswith("ollama:"):
        from openai import AsyncOpenAI
        client = AsyncOpenAI(
            base_url=f"{settings.ollama_url}/v1",
            api_key="ollama",
        )
        model_name = model[len("ollama:"):]
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.9,
                max_tokens=200,
            ),
            timeout=30.0,
        )
        text = response.choices[0].message.content or ""

    elif model.startswith("claude-"):
        from anthropic import AsyncAnthropic
        key = api_key or settings.anthropic_api_key
        client = AsyncAnthropic(api_key=key)
        response = await asyncio.wait_for(
            client.messages.create(
                model=model,
                max_tokens=200,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.9,
            ),
            timeout=30.0,
        )
        text = response.content[0].text if response.content else ""

    elif model.startswith("gemini-"):
        from openai import AsyncOpenAI
        key = api_key or settings.google_api_key
        client = AsyncOpenAI(
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            api_key=key,
        )
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.9,
                max_tokens=200,
            ),
            timeout=30.0,
        )
        text = response.choices[0].message.content or ""

    else:
        # OpenAI
        from openai import AsyncOpenAI
        key = api_key or settings.openai_api_key
        client = AsyncOpenAI(api_key=key)
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.9,
                max_tokens=200,
            ),
            timeout=30.0,
        )
        text = response.choices[0].message.content or ""

    lines = [line.strip().strip("•-*123456789.") .strip()
             for line in text.strip().splitlines() if line.strip()]
    return [l for l in lines if l][:n]
