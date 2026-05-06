import type { SliderState, Heritage } from "@game/systems/character/SliderBlob";

export type AspectId =
  | "tempest"
  | "choir"
  | "bloom"
  | "veil"
  | "hymn"
  | "ember"
  | "vow"
  | "hush";

export const ASPECT_IDS: AspectId[] = [
  "tempest",
  "choir",
  "bloom",
  "veil",
  "hymn",
  "ember",
  "vow",
  "hush",
];

export interface CharacterMetadata {
  pronouns?: string;
  display_color?: string;
  motto?: string;
}

export interface Character {
  id: string;
  user_id: string;
  slot: number;
  name: string;
  heritage: Heritage;
  sliders: SliderState;
  metadata: CharacterMetadata;
  active_aspect: AspectId;
  aspect_xp: Partial<Record<AspectId, number>>;
  level: number;
  zone: string;
  position: { x: number; y: number; z: number; r: number };
  playtime_sec: number;
  created_at: string;
  updated_at: string;
}

export interface NewCharacterInput {
  slot: number;
  name: string;
  heritage: Heritage;
  sliders: SliderState;
  metadata?: CharacterMetadata;
  active_aspect?: AspectId;
}
