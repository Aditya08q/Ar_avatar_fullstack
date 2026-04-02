"""
config.py
Centralised configuration — loads from .env, provides typed constants.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Groq ─────────────────────────────────────────────────────
GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL    = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_URL      = "https://api.groq.com/openai/v1/chat/completions"

# ── Offline LLMs ─────────────────────────────────────────────
OLLAMA_BASE   = os.getenv("OLLAMA_BASE",  "http://localhost:11434")
GPT4ALL_BASE  = os.getenv("GPT4ALL_BASE", "http://localhost:4891")

OLLAMA_MODEL_PREFS = [
    "llama3.2", "llama3", "llama2",
    "mistral",  "phi3",   "gemma2",
    "gemma",    "qwen2",  "tinyllama",
]

# ── Generation defaults ───────────────────────────────────────
MAX_OUTPUT_TOKENS = 512
TEMPERATURE       = 0.75

# ── CORS ─────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    "https://localhost:3000",
    "http://localhost:3000",
    "https://localhost:5173",
    "http://localhost:5173",
    "null",
]
