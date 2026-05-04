import { create } from "zustand";
import {
  makeDefaultSliderState,
  type SliderState,
  type Heritage,
} from "@game/systems/character/SliderBlob";

interface CharacterCreatorState {
  sliders: SliderState;
  name: string;
  setHeritage: (h: Heritage) => void;
  setSubBuild: (i: number) => void;
  setName: (n: string) => void;
  set: (mut: (s: SliderState) => void) => void;
  setFaceSlider: (i: number, v: number) => void;
  setBodySlider: (i: number, v: number) => void;
  reset: () => void;
}

export const useCreator = create<CharacterCreatorState>((set) => ({
  sliders: makeDefaultSliderState("hjari"),
  name: "",
  setHeritage: (h) =>
    set((state) => ({
      sliders: { ...state.sliders, heritage: h, subBuild: 0 },
    })),
  setSubBuild: (i) =>
    set((state) => ({
      sliders: { ...state.sliders, subBuild: i },
    })),
  setName: (n) => set({ name: n }),
  set: (mut) =>
    set((state) => {
      const next = { ...state.sliders };
      mut(next);
      return { sliders: next };
    }),
  setFaceSlider: (i, v) =>
    set((state) => {
      const blendshapes = new Uint8Array(state.sliders.faceBlendshapes);
      blendshapes[i] = Math.max(0, Math.min(255, Math.round(v)));
      return { sliders: { ...state.sliders, faceBlendshapes: blendshapes } };
    }),
  setBodySlider: (i, v) =>
    set((state) => {
      const blendshapes = new Uint8Array(state.sliders.bodyBlendshapes);
      blendshapes[i] = Math.max(0, Math.min(255, Math.round(v)));
      return { sliders: { ...state.sliders, bodyBlendshapes: blendshapes } };
    }),
  reset: () =>
    set((state) => ({
      sliders: makeDefaultSliderState(state.sliders.heritage),
      name: "",
    })),
}));
