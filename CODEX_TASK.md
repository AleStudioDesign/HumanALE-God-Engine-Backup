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

## New visual direction from user

### 6. Remove black shadow and make the binary itself adaptive
- Remove the dark/black radial silhouette or any large black shadow behind the head.
- Keep the window genuinely transparent.
- Do NOT implement a simple "light desktop" vs "dark desktop" mode.
- Instead, make the binary glyph system itself adapt continuously to whatever is behind it.
- Each glyph/particle can evolve its hue, brightness, saturation, opacity, glow, and local contrast over time and in response to the visual context.
- Let nearby binary glyphs shift through related color families rather than snapping the whole avatar to one palette.
- Use smooth color evolution: gradients, hue drift, pulse energy, signal intensity, and local contrast adaptation.
- Keep the face readable over both bright and dark areas without adding a black plate or opaque backdrop.
- Prefer the binary itself to become the contrast mechanism.
- The adaptive behavior should feel alive: color should evolve organically instead of switching between preset themes.
- Avoid rapid flashing or harsh strobing.

### 7. Make avatar and panels even smaller
- Reduce avatar size further while preserving face detail.
- Reduce control/chat panel width, padding, text, and button footprint further.
- Keep controls usable at 100%, 125%, and 150% Windows scaling.
- Preserve viewport-safe scrolling.

### 8. Magnetic binary particles
- Strengthen the magnetic interaction when the mouse pointer passes near binary particles.
- Binary glyphs should bend, orbit, scatter, or be gently attracted/repelled around the pointer, then smoothly settle back.
- Keep movement fluid and not excessively jittery.
- Do not break click-through behavior in transparent zones.

### 9. Neural roots / data-flow behind the head
- Add a visible network of root-like neural strands emerging from behind the neck/back of head toward the brain area.
- Animate data/signal pulses traveling along these strands toward and through the brain.
- Layer frequency-like waves, pulses, and packet/signal motion.
- Keep the effect readable but not cluttered.
- It should feel like live data, neural signals, and frequencies flowing into the brain.

### 10. Speaking mouth animation
- Improve mouth/lip motion while Dudidam speaks.
- Lip movement should react to speech activity/energy rather than only a static open/close loop.
- Keep animation subtle enough to preserve the face shape.

### 11. Add neck and limited head rotation
- Add a visible neck so the floating head feels anatomically anchored.
- Allow head rotation/yaw up to about 30 degrees left/right.
- Preserve face readability and avoid excessive distortion.
- Neck and neural-root geometry should follow the head rotation naturally.
- Keep mouse-following motion smooth and capped.

### 12. Visual priority
The desired appearance is:
- transparent floating AI human head;
- no black backdrop/shadow;
- compact avatar;
- compact control panels;
- binary glyphs that continuously adapt and evolve their own color/contrast over the real desktop;
- no fixed light/dark theme switch;
- smooth living color evolution across glyphs and neural signals;
- strong but smooth mouse magnetic response;
- neural/data roots feeding the brain from behind the head;
- visible signal/frequency flow;
- lips moving during speech;
- neck present;
- head can rotate about 30 degrees.

Implement this without weakening the existing security boundaries or mouse click-through behavior.

## Deliverable
Commit fixes to `codex/entitasale170925` with concise commit messages.
Before finishing, report:
- files changed,
- exact bugs fixed,
- commands/tests run,
- visual changes made,
- any remaining known limitation.
