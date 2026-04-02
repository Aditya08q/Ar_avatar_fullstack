"""
ollama_service.py
"""

import httpx
import logging
from typing import Optional

from config import OLLAMA_BASE, GPT4ALL_BASE, OLLAMA_MODEL_PREFS, MAX_OUTPUT_TOKENS, TEMPERATURE

log = logging.getLogger("aria.ollama")

#  Cached availability
_ollama_available:  Optional[bool] = None
_ollama_model:      Optional[str]  = None
_gpt4all_available: Optional[bool] = None


async def _check_ollama() -> bool:
    global _ollama_available, _ollama_model
    if _ollama_available is not None:
        return _ollama_available
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{OLLAMA_BASE}/api/tags")
        if not resp.is_success:
            _ollama_available = False
            return False
        data   = resp.json()
        models = [m["name"].split(":")[0].lower() for m in data.get("models", [])]
        for pref in OLLAMA_MODEL_PREFS:
            match = next((m for m in models if pref in m), None)
            if match:
                _ollama_model = match
                break
        if not _ollama_model and models:
            _ollama_model = models[0]
        _ollama_available = bool(_ollama_model)
        log.info(f"Ollama available={_ollama_available} model={_ollama_model}")
        return _ollama_available
    except Exception:
        _ollama_available = False
        return False


async def _check_gpt4all() -> bool:
    global _gpt4all_available
    if _gpt4all_available is not None:
        return _gpt4all_available
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{GPT4ALL_BASE}/v1/models")
        _gpt4all_available = resp.is_success
        log.info(f"GPT4All available={_gpt4all_available}")
        return _gpt4all_available
    except Exception:
        _gpt4all_available = False
        return False


async def _ollama_chat(system: str, user: str, max_tokens: int) -> Optional[str]:
    body = {
        "model":   _ollama_model,
        "stream":  False,
        "options": {"num_predict": max_tokens, "temperature": TEMPERATURE},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{OLLAMA_BASE}/api/chat", json=body)
    if not resp.is_success:
        raise RuntimeError(f"Ollama HTTP {resp.status_code}")
    return resp.json().get("message", {}).get("content", "").strip() or None


async def _gpt4all_chat(system: str, user: str, max_tokens: int) -> Optional[str]:
    body = {
        "model":       "gpt4all-falcon",
        "max_tokens":  max_tokens,
        "temperature": TEMPERATURE,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{GPT4ALL_BASE}/v1/chat/completions", json=body)
    if not resp.is_success:
        raise RuntimeError(f"GPT4All HTTP {resp.status_code}")
    choices = resp.json().get("choices", [])
    return choices[0].get("message", {}).get("content", "").strip() or None if choices else None


async def ask_offline_llm(
    system_prompt: str,
    user_msg: str,
    max_tokens: int = MAX_OUTPUT_TOKENS,
) -> Optional[str]:
    """
    Try Ollama then GPT4All.
    Returns reply text or None if neither is available.
    """
    if await _check_ollama():
        try:
            text = await _ollama_chat(system_prompt, user_msg, max_tokens)
            if text:
                return text
        except Exception as e:
            log.warning(f"Ollama chat failed: {e}")

    if await _check_gpt4all():
        try:
            text = await _gpt4all_chat(system_prompt, user_msg, max_tokens)
            if text:
                return text
        except Exception as e:
            log.warning(f"GPT4All chat failed: {e}")

    return None
