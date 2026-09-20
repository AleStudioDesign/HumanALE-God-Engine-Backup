# Codex Task — Dudidam / entitasale170925

Repository: `Kmpsnr26/entitashuman`
Target branch: `codex/entitasale170925`

## Current state already fixed
- Local build no longer hard-fails when `.openai/hosting.json` is missing.
- Desktop window reduced to ~460x520.
- Avatar reduced to ~440px.
- Control/chat panels reduced to ~360px.
- Dynamic transparent-area mouse click-through added.
- Renderer keeps avatar/panels interactive while transparent area should pass clicks through.

Recent commits:
- `1b564a71cb4b55e8f727dfed9ff76d16afffd0d2` — build fix
- `6fa116dedb5429e6b32e3ad933d573b12a672697` — compact desktop + Electron click-through
- `5d159583486524873be6de2bf6ed07b4ce36c88b` — preload passthrough API
- `69386390fd364146b6842d026225a0c3055b5ff4` — renderer passthrough logic
- `b4f095c904712a78aab6dd23c708e04c5cb522e0` — compact UI CSS

## Work to do now

### 1. Microphone / "tidak mendengar"
The current renderer depends on `SpeechRecognition` / `webkitSpeechRecognition`, which is not reliable in Electron.

Please:
- verify microphone permission handling in Electron;
- add a real microphone input-health check using `navigator.mediaDevices.getUserMedia({audio:true})`;
- distinguish these cases in the UI:
  - no microphone device,
  - permission denied,
  - device present but SpeechRecognition unavailable,
  - recognizer network/service error;
- do not claim speech recognition works if only raw mic capture works;
- keep text input as a fallback;
- avoid persistent recording: stop all tracks immediately after the health check.

### 2. Mouse click-through
Please test and harden the current dynamic click-through logic:
- transparent background must pass clicks to the app/desktop behind;
- avatar itself must remain draggable/clickable;
- controls/chat dialogs must remain fully interactive;
- bubble/toast/reveal button must remain interactive;
- opening a dialog must always disable click-through;
- closing/leaving the widget should restore click-through without trapping the mouse;
- verify no state can leave the whole window permanently non-interactive.

### 3. Compact sizing
Verify on common Windows display scaling:
- 100%, 125%, 150%.
- Desktop window should remain compact.
- Panel must not exceed viewport height.
- Avoid oversized text/buttons.
- Keep avatar visually centered.

### 4. Startup/runtime robustness
Please run:
- `npm install`
- `npm run build`
- `npm run desktop`
- any existing tests
- add focused tests for pure helper logic where practical.

Check:
- missing Codex CLI,
- Codex CLI not logged in,
- app startup when internet is unavailable,
- clean shutdown,
- no unhandled promise rejections.

### 5. Security constraints
Do not weaken:
- `nodeIntegration:false`
- `contextIsolation:true`
- `sandbox:true`
- trusted-origin checks for IPC
- no credential/token scraping
- no arbitrary shell/tool access from renderer

## Deliverable
Commit fixes to `codex/entitasale170925` with concise commit messages.
Before finishing, report:
- files changed,
- exact bugs fixed,
- commands/tests run,
- any remaining known limitation.
