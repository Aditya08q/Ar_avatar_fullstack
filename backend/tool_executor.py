"""
tool_executor.py
"""

#  Imports
import subprocess
import webbrowser
import shutil
import logging
import os
import platform
import json

log = logging.getLogger("aria.tools")

#  Config 
GITHUB_REPO_PATH = os.getenv("GITHUB_REPO_PATH", "")

# Whitelisted safe commands — no dangerous ops allowed
SAFE_COMMANDS = {
    "list files":        "ls -la" if platform.system() != "Windows" else "dir",
    "show directory":    "pwd"    if platform.system() != "Windows" else "cd",
    "disk usage":        "df -h"  if platform.system() != "Windows" else "wmic logicaldisk get size,freespace",
    "show processes":    "ps aux" if platform.system() != "Windows" else "tasklist",
    "show ip":           "ifconfig" if platform.system() != "Windows" else "ipconfig",
    "ping google":       "ping -c 3 google.com" if platform.system() != "Windows" else "ping -n 3 google.com",
    "python version":    "python3 --version" if platform.system() != "Windows" else "python --version",
    "node version":      "node --version",
    "git status":        "git status",
    "git log":           "git log --oneline -10",
}

# Blocked keywords — extra safety net for run_command
BLOCKED_KEYWORDS = [
    "rm -rf", "rmdir /s", "format", "mkfs", "dd if=",
    "shutdown", "reboot", "halt", "poweroff",
    ":(){:|:&};:", "fork bomb",
    "wget", "curl -o", "> /dev/",
    "chmod 777", "sudo rm", "del /f",
]

#  Track last executed action globally 
_last_executed_action = None

def is_repeat_action(action: dict) -> bool:
    global _last_executed_action
    try:
        action_str = json.dumps(action, sort_keys=True)
        if _last_executed_action == action_str:
            return True
        _last_executed_action = action_str
        return False
    except Exception:
        return False

#  Execute action 
async def execute_action(action: dict) -> dict:
    """
    Dispatch an action dict returned by ARIA.
    Returns: { success: bool, output: str, action: str }
    """
    if is_repeat_action(action):
        return {"success": False, "output": "(duplicate action skipped)", "action": action.get("action")}

    name = action.get("action", "").lower()
    log.info(f"[Tool] Executing action: {name}")

    handlers = {
        "push_github": _push_github,
        "play_music":  _play_music,
        "open_app":    _open_app,
        "run_command": _run_command,
        "open_tab":    _open_tab,
    }

    handler = handlers.get(name)
    if not handler:
        return {
            "success": False,
            "output":  f"Unknown action: '{name}'. Supported: {list(handlers.keys())}",
            "action":  name,
        }

    try:
        result = await handler(action)
        return {"action": name, **result}
    except Exception as e:
        log.error(f"[Tool] Action '{name}' failed: {e}")
        return {"success": False, "output": f"Action failed: {str(e)}", "action": name}

# push_github 
async def _push_github(action: dict) -> dict:
    msg = action.get("message", "ARIA auto commit").strip() or "ARIA auto commit"
    repo = GITHUB_REPO_PATH or os.getcwd()

    if not os.path.isdir(os.path.join(repo, ".git")):
        return {"success": False, "output": f"No git repo found at: {repo}\nSet GITHUB_REPO_PATH in backend/.env"}

    commands = [
        ["git", "-C", repo, "add", "-A"],
        ["git", "-C", repo, "commit", "-m", msg],
        ["git", "-C", repo, "push"],
    ]

    output_lines = []
    for cmd in commands:
        result = subprocess.run(cmd, capture_output=True, text=True)
        out = (result.stdout + result.stderr).strip()
        if out:
            output_lines.append(out)
        if result.returncode != 0 and "nothing to commit" not in out:
            return {"success": False, "output": "\n".join(output_lines)}

    return {"success": True, "output": f"Pushed to GitHub.\nCommit: \"{msg}\"\n" + "\n".join(output_lines)}

#  play_music 
async def _play_music(action: dict) -> dict:
    query = action.get("query", "music").strip()
    search_url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
    webbrowser.open(search_url)
    return {"success": True, "output": f"Opening YouTube search for: \"{query}\""}

#  open_app 
async def _open_app(action: dict) -> dict:
    app_name = action.get("app_name", "").strip()
    if not app_name:
        return {"success": False, "output": "No app name provided."}

    system = platform.system()
    APP_MAP = {
        "google chrome":  {"Darwin": "open -a 'Google Chrome'", "Linux": "google-chrome", "Windows": "start chrome"},
        "chrome":         {"Darwin": "open -a 'Google Chrome'", "Linux": "google-chrome", "Windows": "start chrome"},
        "firefox":        {"Darwin": "open -a Firefox", "Linux": "firefox", "Windows": "start firefox"},
        "vscode":         {"Darwin": "open -a 'Visual Studio Code'", "Linux": "code", "Windows": "code"},
        "visual studio code": {"Darwin": "open -a 'Visual Studio Code'", "Linux": "code", "Windows": "code"},
        "terminal":       {"Darwin": "open -a Terminal", "Linux": "x-terminal-emulator", "Windows": "start cmd"},
        "calculator":     {"Darwin": "open -a Calculator", "Linux": "gnome-calculator", "Windows": "calc"},
        "notepad":        {"Darwin": "open -a TextEdit", "Linux": "gedit", "Windows": "notepad"},
        "finder":         {"Darwin": "open .", "Linux": "nautilus .", "Windows": "explorer ."},
        "spotify":        {"Darwin": "open -a Spotify", "Linux": "spotify", "Windows": "start spotify"},
        "apple music":    {"Darwin": "open -a 'Music'", "Linux": "rhythmbox", "Windows": "start mswindowsmusic:"},
        "apple tv":       {"Darwin": "open -a 'Apple TV'", "Linux": "vlc", "Windows": "start AppleTV:"},
    }

    key = app_name.lower()
    cmd_map = APP_MAP.get(key)
    if cmd_map:
        cmd = cmd_map.get(system)
    else:
        cmd = f"open -a '{app_name}'" if system == "Darwin" else (app_name.lower().replace(" ", "-") if system == "Linux" else f"start {app_name}")

    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode == 0:
        return {"success": True, "output": f"Opened {app_name}"}
    else:
        err = (result.stderr or result.stdout).strip()
        return {"success": False, "output": f"Failed to open {app_name}: {err}"}

#  run_command
async def _run_command(action: dict) -> dict:
    raw_cmd = action.get("command", "").strip()
    if not raw_cmd:
        return {"success": False, "output": "No command provided."}

    lower = raw_cmd.lower()
    for blocked in BLOCKED_KEYWORDS:
        if blocked in lower:
            log.warning(f"[Tool] Blocked dangerous command: {raw_cmd!r}")
            return {"success": False, "output": f"Blocked: '{raw_cmd}' contains a disallowed pattern."}

    matched_cmd = None
    for label, safe_cmd in SAFE_COMMANDS.items():
        if label in lower or safe_cmd.split()[0] in lower:
            matched_cmd = safe_cmd
            break
    if not matched_cmd:
        if raw_cmd in SAFE_COMMANDS.values():
            matched_cmd = raw_cmd
        else:
            return {"success": False, "output": f"'{raw_cmd}' is not allowed. Allowed: {', '.join(SAFE_COMMANDS.keys())}"}

    result = subprocess.run(matched_cmd, shell=True, capture_output=True, text=True, timeout=15)
    output = (result.stdout + result.stderr).strip() or "(no output)"
    return {"success": result.returncode == 0, "output": f"$ {matched_cmd}\n{output}"}

#  open_tab 
async def _open_tab(action: dict) -> dict:
    query = action.get("query", "").strip()
    if not query:
        return {"success": False, "output": "No query provided."}
    search_url = query if query.startswith("http") else f"https://www.google.com/search?q={query.replace(' ', '+')}"
    webbrowser.open(search_url)
    return {"success": True, "output": f"Opened tab: {search_url}"}