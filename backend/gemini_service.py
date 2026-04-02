"""
gemini_service.py
Calls the Google Gemini API.
Mirrors the exact request shape used in the original aiAgent.js.
"""

import httpx
import logging
from typing import List, Tuple

from config import (
    GEMINI_API_KEY, GEMINI_URL,
    MAX_OUTPUT_TOKENS, TEMPERATURE, TOP_K, TOP_P,
)

log = logging.getLogger("aria.gemini")

SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT",        "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH",       "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]


async def ask_gemini(
    system_prompt: str,
    user_msg: str,
    history: List[Tuple[str, str]],   # [(role, content), ...]
) -> str:
    """
    Send a request to Gemini and return the reply text.
    Raises on HTTP or API errors — caller handles them.
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not set in .env")

    # Build contents — prepend system prompt as first user/model exchange.
    # This works on ALL Gemini models and both v1 + v1beta.
    # system_instruction field is only supported on newer models via v1beta.
    recent = history[-8:]
    contents = [
        # System prompt injected as a user turn at position 0
        {"role": "user",  "parts": [{"text": f"[System instructions]\n{system_prompt}"}]},
        {"role": "model", "parts": [{"text": "Understood. I will follow these instructions."}]},
        # Conversation history
        *[
            {
                "role": "model" if role == "assistant" else "user",
                "parts": [{"text": content}]
            }
            for role, content in recent
        ],
        # Current user message
        {"role": "user", "parts": [{"text": user_msg}]},
    ]

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature":     TEMPERATURE,
            "topK":            TOP_K,
            "topP":            TOP_P,
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
        },
        "safetySettings": SAFETY_SETTINGS,
    }

    url = f"{GEMINI_URL}?key={GEMINI_API_KEY}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload)

    if not resp.is_success:
        try:
            err = resp.json()
            msg = err.get("error", {}).get("message", f"HTTP {resp.status_code}")
        except Exception:
            msg = f"HTTP {resp.status_code}"
        log.error(f"Gemini API error: {msg}")
        raise RuntimeError(f"Gemini error: {msg}")

    data = resp.json()
    text = (
        data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
    )

    if not text:
        raise RuntimeError("Gemini returned an empty response")

    return text.strip()
