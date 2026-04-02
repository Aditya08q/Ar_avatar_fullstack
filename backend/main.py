"""
main.py
FastAPI backend for ARIA.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import logging

from config import ALLOWED_ORIGINS
from groq_service import ask_groq
from ollama_service import ask_offline_llm
from agent_logic import get_demo_reply
from tool_executor import execute_action
from intent_parser import detect_intent

#  Logging 
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
log = logging.getLogger("aria.main")

#  App 
app = FastAPI(
    title="ARIA Backend",
    description="AI query handler for the ARIA AR Avatar system.",
    version="1.0.0"
)

#  CORS 
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

#  Request / Response models 

class HistoryEntry(BaseModel):
    role: str      
    content: str

class QueryRequest(BaseModel):
    userMsg:      str
    systemPrompt: str                        
    history:      Optional[List[HistoryEntry]] = []
    useOffline:   Optional[bool] = False    

class QueryResponse(BaseModel):
    text:       str
    source:     str                     
    action:     Optional[str]   = None   
    actionResult: Optional[str] = None   

class ActionRequest(BaseModel):
    action:     str
    message:    Optional[str] = None
    query:      Optional[str] = None
    app_name:   Optional[str] = None
    command:    Optional[str] = None

#  Routes

@app.get("/health")
async def health():
    
    return {"status": "ok", "service": "aria-backend"}


@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest):
  
    log.info(f"[/query] msg={req.userMsg[:60]!r}  offline={req.useOffline}")

        # STEP 0: Intent detection (NEW)
    action = detect_intent(req.userMsg)

    if action:
        log.info(f"[/query] rule-based action: {action['action']}")
        result = await execute_action(action)
        friendly = result.get("output", "Action completed.")
        return QueryResponse(
            text=friendly,
            source="rule-based",
            action=action["action"],
            actionResult=friendly,
        )

    #  1. Offline LLM (if requested) 
    if req.useOffline:
        try:
            text = await ask_offline_llm(req.systemPrompt, req.userMsg)
            if text:
                log.info("[/query] answered by offline LLM")
                return QueryResponse(text=text, source="ollama")
        except Exception as e:
            log.warning(f"[/query] offline LLM failed: {e}")

    #  2. Groq 
    from config import GROQ_API_KEY
    if GROQ_API_KEY:
        try:
            text = await ask_groq(
                system_prompt=req.systemPrompt,
                user_msg=req.userMsg,
                history=[(h.role, h.content) for h in (req.history or [])],
            )
            log.info("[/query] answered by Groq")

            #  Tool-call detection
            # If ARIA returned a JSON action, execute it server-side
            stripped = text.strip()
            if stripped.startswith("{") and stripped.endswith("}"):
                try:
                    import json
                    action_dict = json.loads(stripped)
                    if "action" in action_dict:
                        log.info(f"[/query] tool call detected: {action_dict['action']}")
                        result = await execute_action(action_dict)
                        friendly = result.get("output", "Action completed.")
                        return QueryResponse(
                            text=friendly,
                            source="groq",
                            action=action_dict["action"],
                            actionResult=friendly,
                        )
                except Exception as parse_err:
                    log.warning(f"[/query] JSON parse failed: {parse_err}")

            return QueryResponse(text=text, source="groq")

        except Exception as e:
            log.error(f"[/query] Groq error: {e}")
            raise HTTPException(status_code=502, detail=str(e))

    #  3. Demo mode
    log.info("[/query] demo mode — no API key configured")
    text = get_demo_reply(req.userMsg)
    return QueryResponse(text=text, source="demo")


@app.post("/action")
async def action(req: ActionRequest):
    """
    Direct action endpoint — frontend can call this explicitly
    to trigger a tool without going through the AI.
    """
    action_dict = req.dict(exclude_none=True)
    log.info(f"[/action] direct call: {action_dict}")
    result = await execute_action(action_dict)
    return result
