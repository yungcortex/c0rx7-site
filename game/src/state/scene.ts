import { create } from "zustand";
import type { SceneId } from "@game/scenes/SceneManager";

interface SceneState {
  current: SceneId;
  setCurrent: (id: SceneId) => void;
}

export const useScene = create<SceneState>((set) => ({
  current: "title",
  setCurrent: (id) => set({ current: id }),
}));
