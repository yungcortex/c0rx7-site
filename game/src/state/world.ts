import { create } from "zustand";
import type { Character } from "@game/systems/character/Character";

export interface RemotePlayer {
  user_id: string;
  name: string;
  heritage: string;
  active_aspect: string;
  position: { x: number; y: number; z: number; r: number };
  last_seen: number;
}

interface WorldState {
  activeCharacter: Character | null;
  remotePlayers: Map<string, RemotePlayer>;
  setActiveCharacter: (c: Character | null) => void;
  upsertRemote: (p: RemotePlayer) => void;
  removeRemote: (user_id: string) => void;
  clearRemotes: () => void;
}

export const useWorld = create<WorldState>((set) => ({
  activeCharacter: null,
  remotePlayers: new Map(),
  setActiveCharacter: (c) => set({ activeCharacter: c }),
  upsertRemote: (p) =>
    set((state) => {
      const next = new Map(state.remotePlayers);
      next.set(p.user_id, p);
      return { remotePlayers: next };
    }),
  removeRemote: (user_id) =>
    set((state) => {
      const next = new Map(state.remotePlayers);
      next.delete(user_id);
      return { remotePlayers: next };
    }),
  clearRemotes: () => set({ remotePlayers: new Map() }),
}));

export interface ChatLine {
  id: string;
  channel: "say" | "shout" | "yell" | "world" | "system" | "whisper";
  author: string;
  body: string;
  ts: number;
}

interface ChatState {
  lines: ChatLine[];
  inputOpen: boolean;
  push: (line: Omit<ChatLine, "id" | "ts">) => void;
  setInputOpen: (b: boolean) => void;
  clear: () => void;
}

export const useChat = create<ChatState>((set) => ({
  lines: [],
  inputOpen: false,
  push: (line) =>
    set((state) => {
      const id = Math.random().toString(36).slice(2, 10);
      const next = [...state.lines, { ...line, id, ts: Date.now() }];
      // Cap at 200 lines
      return { lines: next.length > 200 ? next.slice(next.length - 200) : next };
    }),
  setInputOpen: (b) => set({ inputOpen: b }),
  clear: () => set({ lines: [] }),
}));

interface DialogueLine {
  speaker: string;
  body: string;
  portrait?: string;
}

interface DialogueState {
  active: DialogueLine[] | null;
  index: number;
  open: (lines: DialogueLine[]) => void;
  next: () => void;
  close: () => void;
}

export const useDialogue = create<DialogueState>((set, get) => ({
  active: null,
  index: 0,
  open: (lines) => set({ active: lines, index: 0 }),
  next: () => {
    const { active, index } = get();
    if (!active) return;
    if (index + 1 >= active.length) set({ active: null, index: 0 });
    else set({ index: index + 1 });
  },
  close: () => set({ active: null, index: 0 }),
}));
