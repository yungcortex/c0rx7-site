import type { Engine, Scene } from "@babylonjs/core";
import { buildTitleScene } from "@game/scenes/title/TitleScene";
import { buildCharacterSelectScene } from "@game/scenes/character-select/CharacterSelectScene";
import { buildCharacterCreatorScene } from "@game/scenes/character-creator/CharacterCreatorScene";
import { buildHubHyrrScene } from "@game/scenes/hub-hyrr/HubHyrrScene";

export type SceneId = "title" | "character-select" | "character-creator" | "hub";

type Builder = (engine: Engine, canvas: HTMLCanvasElement) => Scene;

const builders: Record<SceneId, Builder> = {
  title: buildTitleScene,
  "character-select": buildCharacterSelectScene,
  "character-creator": buildCharacterCreatorScene,
  hub: buildHubHyrrScene,
};

const subscribers = new Set<(id: SceneId) => void>();

export class SceneManager {
  activeScene: Scene | null = null;
  activeId: SceneId | null = null;

  constructor(
    private engine: Engine,
    private canvas: HTMLCanvasElement,
  ) {}

  go(id: SceneId) {
    if (this.activeId === id) return;
    const next = builders[id](this.engine, this.canvas);
    const prev = this.activeScene;
    this.activeScene = next;
    this.activeId = id;
    if (prev) prev.dispose();
    subscribers.forEach((fn) => fn(id));
  }

  onChange(fn: (id: SceneId) => void): () => void {
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }

  dispose() {
    this.activeScene?.dispose();
    this.activeScene = null;
    this.activeId = null;
    subscribers.clear();
  }
}
