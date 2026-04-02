"""
intent_parser.py
"""

import re


def detect_intent(user_msg: str):
    if not user_msg:
        return None

    msg = user_msg.lower().strip()

    #  OPEN APP 
    if re.match(r"^(open|launch|start)\s+", msg):
        app = re.sub(r"^(open|launch|start)\s+", "", msg).strip()
        if app:
            return {
                "action": "open_app",
                "app_name": app.title()
            }

    #  PLAY MUSIC 
    if re.match(r"^(play)\s+", msg):
        query = re.sub(r"^(play)\s+", "", msg).strip()
        if query:
            return {
                "action": "play_music",
                "query": query
            }

    #  SEARCH / OPEN TAB 
    if re.match(r"^(search|open tab|browse)\s+", msg):
        query = re.sub(r"^(search|open tab|browse)\s+", "", msg).strip()
        if query:
            return {
                "action": "open_tab",
                "query": query
            }

    # GITHUB ACTIONS 
    if re.search(r"\b(push|commit|upload)\b", msg):
        return {
            "action": "push_github",
            "message": "ARIA auto commit"
        }

    #  SAFE SYSTEM COMMANDS 
    SAFE_COMMAND_LABELS = [
        "list files",
        "show directory",
        "disk usage",
        "show processes",
        "show ip",
        "python version",
        "node version",
        "git status",
        "git log",
    ]

    if msg in SAFE_COMMAND_LABELS:
        return {
            "action": "run_command",
            "command": msg
        }

    #  NOT AN ACTION 
    return None