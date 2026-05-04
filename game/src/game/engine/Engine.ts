import { Engine, Scene, Color4 } from "@babylonjs/core";
import { SceneManager, type SceneId } from "@game/scenes/SceneManager";

/**
 * Top-level engine wrapper. Owns the Babylon Engine, the active Scene, and
 * delegates scene transitions to SceneManager.
 */
export class GameEngine {
  readonly engine: Engine;
  readonly canvas: HTMLCanvasElement;
  readonly sceneManager: SceneManager;

  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: true,
      powerPreference: "high-performance",
      adaptToDeviceRatio: true,
    });
    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
    this.sceneManager = new SceneManager(this.engine, canvas);

    window.addEventListener("resize", this.onResize);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.sceneManager.go("title");
    this.engine.runRenderLoop(() => {
      const scene = this.sceneManager.activeScene;
      if (scene && scene.activeCamera) scene.render();
    });
  }

  go(id: SceneId) {
    this.sceneManager.go(id);
  }

  get activeSceneId() {
    return this.sceneManager.activeId;
  }

  dispose() {
    this.running = false;
    window.removeEventListener("resize", this.onResize);
    this.sceneManager.dispose();
    this.engine.dispose();
  }

  private onResize = () => this.engine.resize();
}

export type { SceneId, Scene, Color4 };
