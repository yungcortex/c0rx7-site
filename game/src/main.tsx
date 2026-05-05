import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@game/ui/App";
import { GameEngine } from "@game/engine/Engine";
import "@game/ui/styles/global.css";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const root = document.getElementById("root") as HTMLDivElement;

if (!canvas) throw new Error("game-canvas element not found");
if (!root) throw new Error("root element not found");

const engine = new GameEngine(canvas);
engine.start();

// DEBUG: jump straight to character creator if ?debug=creator on URL.
// Useful for screenshot iteration / dev. Has no effect in production
// when no query param is present.
if (typeof window !== "undefined" && window.location.search.includes("debug=creator")) {
  setTimeout(() => engine.go("character-creator"), 100);
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
