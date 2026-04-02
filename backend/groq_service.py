"""
groq_service.py
Calls the Groq API (OpenAI-compatible).
Free tier: no credit card, 14,400 req/day on 8B models, 1,000/day on 70B.
Get a key at: https://console.groq.com
"""

import httpx
import logging
from typing import List, Tuple

from config import GROQ_API_KEY, GROQ_URL, GROQ_MODEL, MAX_OUTPUT_TOKENS, TEMPERATURE

log = logging.getLogger("aria.groq")


async def ask_groq(
    system_prompt: str,
    user_msg: str,
    history: List[Tuple[str, str]],   # [(role, content), ...]
) -> str:
    """
    Send a request to Groq and return the reply text.
    Uses the OpenAI-compatible chat completions endpoint.
    Raises on HTTP or API errors — caller handles them.
    """
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set in .env")

    # Build messages — system prompt + history + current message
    messages = [
        {"role": "system", "content": system_prompt},
        *[
            {"role": role, "content": content}
            for role, content in history[-8:]   # max 8 turns
        ],
        {"role": "user", "content": user_msg},
    ]

    payload = {
        "model":       GROQ_MODEL,
        "messages":    messages,
        "temperature": TEMPERATURE,
        "max_tokens":  MAX_OUTPUT_TOKENS,
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type":  "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(GROQ_URL, json=payload, headers=headers)

    if not resp.is_success:
        try:
            err = resp.json()
            msg = err.get("error", {}).get("message", f"HTTP {resp.status_code}")
        except Exception:
            msg = f"HTTP {resp.status_code}"
        log.error(f"Groq API error: {msg}")
        raise RuntimeError(f"Groq error: {msg}")

    data = resp.json()
    text = data.get("choices", [{}])[0].get("message", {}).get("content", "")

    if not text:
        raise RuntimeError("Groq returned an empty response")

    return text.strip()
