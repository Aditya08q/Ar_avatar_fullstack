# ARIA — Web AR AI Avatar
> Browser-based AI avatar with AR camera, voice, memory, and agent intelligence.

---

##  Project Structure

```
ar-avatar/
├── index.html              ← Main HTML
├── manifest.json           ← PWA manifest
├── serve.js                ← Local HTTPS dev server
├── css/
│   └── style.css           ← All styles
├── js/
│   ├── main.js             ← Entry point (connects everything)
│   ├── sceneAR.js          ← Three.js scene + VRM loader + AR camera
│   ├── aiAgent.js          ← Gemini AI integration
│   ├── agentSystem.js      ← Planner + Executor agents
│   ├── memoryService.js    ← localStorage memory system
│   ├── emotionEngine.js    ← Emotion detection from text
│   ├── voiceService.js     ← Speech recognition + synthesis
│   └── uiController.js    ← DOM management
├── models/
│   └── avatar.vrm          ← ⬅ PUT YOUR VRM FILE HERE
└── assets/
    ├── icon-192.png        ← PWA icon (optional)
    └── icon-512.png        ← PWA icon (optional)
```

---

##  Quick Start

### Step 1 — Prerequisites
- Node.js installed (any version)
- A modern browser (Chrome/Edge recommended)

### Step 2 — Start the server
```bash
cd frontend
node serve.js

for backend
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Open: **https://localhost:3000**  
*(Accept the self-signed certificate warning)*

### Step 3 — Get a Gemini/Groq API Key (free)
1. Go to https://aistudio.google.com
2. In my case I use Groq as Gemini has compatibility issue
3. Click **Get API Key** → **Create API key**
4. Copy the key (starts with `AIza…`)
5. Paste it into the ARIA config modal when the app opens

### Step 4 — Add a VRM Avatar (optional but recommended)
1. Download a free VRM from https://hub.vroid.com
2. Rename it to `avatar.vrm`
3. Put it in the `models/` folder
4. Restart the server

Without a VRM, ARIA uses a built-in placeholder avatar.

---

## Mobile Testing
1. Find your laptop's local IP (e.g. `192.168.1.5`)
2. Open `https://192.168.1.5:3000` on your phone
3. Accept the cert warning
4. Tap the camera icon to enable AR mode

---

## Architecture

```
User Input
    ↓
Emotion Detection (emotionEngine.js)
    ↓
Planner Agent  →  classify intent (quiz? study plan? chat?)
    ↓
Executor Agent →  build task-specific system prompt
    ↓
Memory Context →  inject user profile + stored facts
    ↓
Gemini API     →  generate response
    ↓
Memory Update  →  auto-extract and save facts
    ↓
Avatar Animation  ←  emotion → VRM expression
Voice Output      ←  text-to-speech
```

---

##  Features
- **VRM avatar** with blink, expressions, lip-sync
- **AR camera** background (real world view)
- **Voice input** (speech-to-text)  
- **Voice output** (text-to-speech)
- **Emotion detection** from text → avatar expression
- **Agent system**: quiz generator, study plan creator
- **Memory**: remembers your name, goals, topics
- **Demo mode**: works without API key

---

## Customization

### Change avatar color / style
Edit `/css/style.css` — all colors use CSS variables at the top:
```css
:root {
  --primary: #6366f1;    /* Purple — main accent */
  --accent:  #22d3ee;    /* Cyan — highlights */
  ...
}
```

### Add new agent tasks
In `agentSystem.js`, add a new entry to `TASK_PATTERNS` and handle it in `executeTask`.

### Change AI personality
In `aiAgent.js`, edit the `ARIA_PERSONA` constant.

### Add more emotion keywords
In `emotionEngine.js`, extend the `EMOTION_MAP` object.

---

##  Troubleshooting

| Issue | Fix |
|-------|-----|
| Black screen | Check browser console for JS errors |
| Voice not working | Use Chrome/Edge; allow microphone permission |
| Camera not working | Must be HTTPS or localhost |
| VRM not loading | Check file is in `models/avatar.vrm`, check console |
| Gemini errors | Verify API key is correct; check quota at aistudio.google.com |
| Cert warning on mobile | Tap "Advanced" → "Proceed" |

---

## Next Steps (Steps 4–10)
- Step 4: Enhance AR with surface detection
- Step 5: Add more voice languages
- Step 6: Add goal tracking UI  
- Step 7: Firebase for cross-device memory
- Step 8: Add more agent types (code helper, math solver)
- Step 9: Improve lip sync with audio analysis
- Step 10: PWA offline mode + service worker
