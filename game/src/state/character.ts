import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  makeDefaultSliderState,
  type SliderState,
  type Heritage,
} from "@game/systems/character/SliderBlob";
import type { Character } from "@game/systems/character/Character";
import type {
  BeanPattern,
  BeanEyeStyle,
  BeanMouthStyle,
  BeanHatId,
  BeanOutfitId,
  BeanAccessoryId,
} from "@game/systems/character/Bean";

export interface CosmeticState {
  pattern: BeanPattern;
  eyeStyle: BeanEyeStyle;
  mouthStyle: BeanMouthStyle;
  hat: BeanHatId;
  outfit: BeanOutfitId;
  accessory: BeanAccessoryId;
}

const defaultCosmetic: CosmeticState = {
  pattern: "none",
  eyeStyle: "round",
  mouthStyle: "smile",
  hat: "none",
  outfit: "none",
  accessory: "none",
};

interface CharacterCreatorState {
  sliders: SliderState;
  name: string;
  saving: boolean;
  cosmetic: CosmeticState;
  setHeritage: (h: Heritage) => void;
  setSubBuild: (i: number) => void;
  setName: (n: string) => void;
  set: (mut: (s: SliderState) => void) => void;
  setFaceSlider: (i: number, v: number) => void;
  setBodySlider: (i: number, v: number) => void;
  setSaving: (b: boolean) => void;
  setCosmetic: (mut: (c: CosmeticState) => void) => void;
  reset: () => void;
}

export const useCreator = create<CharacterCreatorState>((set) => ({
  sliders: makeDefaultSliderState("hjari"),
  name: "",
  saving: false,
  cosmetic: defaultCosmetic,
  setCosmetic: (mut) =>
    set((state) => {
      const next = { ...state.cosmetic };
      mut(next);
      return { cosmetic: next };
    }),
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
  setSaving: (b) => set({ saving: b }),
  reset: () =>
    set((state) => ({
      sliders: makeDefaultSliderState(state.sliders.heritage),
      name: "",
    })),
}));

interface CharactersState {
  list: Character[];
  selected: Character | null;
  loading: boolean;
  setList: (list: Character[]) => void;
  setSelected: (c: Character | null) => void;
  setLoading: (b: boolean) => void;
  add: (c: Character) => void;
  remove: (id: string) => void;
}

export const useCharacters = create<CharactersState>()(
  persist(
    (set) => ({
      list: [],
      selected: null,
      loading: false,
      setList: (list) => set({ list }),
      setSelected: (selected) => set({ selected }),
      setLoading: (loading) => set({ loading }),
      add: (c) => set((s) => ({ list: [...s.list, c].sort((a, b) => a.slot - b.slot) })),
      remove: (id) =>
        set((s) => ({
          list: s.list.filter((c) => c.id !== id),
          selected: s.selected?.id === id ? null : s.selected,
        })),
    }),
    {
      name: "bean-royale-characters",
      storage: createJSONStorage(() => localStorage),
      // `loading` is transient — don't persist it
      partialize: (s) => ({ list: s.list, selected: s.selected }) as Partial<CharactersState>,
    },
  ),
);
