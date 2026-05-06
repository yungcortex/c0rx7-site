import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@game/ui/App";
import { GameEngine } from "@game/engine/Engine";
import "@game/ui/styles/global.css";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const root = document.getElementById("root") as HTMLDivElement;

if (!canvas) throw new Error("game-canvas element not found");
if (!root) throw new Error("root element not found");

// Make the canvas keyboard-focusable + grab focus on first paint so WASD
// works without the user having to click the world first.
canvas.tabIndex = 0;
canvas.style.outline = "none";
const focusCanvas = () => {
  try { canvas.focus({ preventScroll: true } as FocusOptions); } catch { canvas.focus(); }
};
focusCanvas();
// Re-focus whenever any non-input click happens — covers the case where a
// modal closed and stole focus.
window.addEventListener("pointerdown", (e) => {
  const tgt = e.target as HTMLElement | null;
  if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
  focusCanvas();
});
// Also forward keyboard events from window → canvas. Some browsers only
// dispatch to the focused element; this guarantees Babylon's
// scene.onKeyboardObservable receives them even if focus is on body.
const forwardKey = (type: "keydown" | "keyup") => (e: KeyboardEvent) => {
  if (document.activeElement === canvas) return; // already going to canvas
  const tgt = e.target as HTMLElement | null;
  if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
  // Re-dispatch on canvas so Babylon's listener picks it up
  const cloned = new KeyboardEvent(type, {
    key: e.key,
    code: e.code,
    keyCode: e.keyCode,
    which: e.which,
    bubbles: true,
    cancelable: true,
  });
  canvas.dispatchEvent(cloned);
};
window.addEventListener("keydown", forwardKey("keydown"));
window.addEventListener("keyup", forwardKey("keyup"));

const engine = new GameEngine(canvas);
engine.start();
// Focus the canvas every time the scene changes
engine.sceneManager.onChange(() => focusCanvas());

// DEBUG: jump straight to a scene via ?debug=<scene> on URL.
// Useful for screenshot iteration / dev. Has no effect in production
// when no query param is present.
if (typeof window !== "undefined") {
  const m = window.location.search.match(/debug=([a-z-]+)/);
  if (m) {
    const target = m[1];
    setTimeout(() => {
      if (target === "creator") engine.go("character-creator");
      else if (target === "arena") engine.go("arena-bonk");
      else if (target === "hub") engine.go("hub");
    }, 100);
  }
}

createRoot(root).render(
  <StrictMode>
    <App engine={engine} />
  </StrictMode>,
);

const boot = document.getElementById("boot");
if (boot) {
  setTimeout(() => {
    boot.classList.add("hidden");
    setTimeout(() => boot.remove(), 800);
  }, 600);
}

window.addEventListener("beforeunload", () => engine.dispose());
