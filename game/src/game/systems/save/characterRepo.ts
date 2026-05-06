import { supabase } from "@net/supabase";
import type { Character, NewCharacterInput } from "@game/systems/character/Character";
import {
  packSliderState,
  unpackSliderState,
  blobToBase64,
  base64ToBlob,
  type Heritage,
} from "@game/systems/character/SliderBlob";

interface CharacterRow {
  id: string;
  user_id: string;
  slot: number;
  name: string;
  heritage: string;
  slider_blob: string;
  metadata: Character["metadata"];
  active_aspect: string;
  aspect_xp: Record<string, number>;
  level: number;
  zone: string;
  position: Character["position"];
  playtime_sec: number;
  created_at: string;
  updated_at: string;
}

function rowToCharacter(row: CharacterRow): Character {
  const blob = base64ToBlob(row.slider_blob);
  return {
    id: row.id,
    user_id: row.user_id,
    slot: row.slot,
    name: row.name,
    heritage: row.heritage as Heritage,
    sliders: unpackSliderState(blob),
    metadata: row.metadata ?? {},
    active_aspect: row.active_aspect as Character["active_aspect"],
    aspect_xp: row.aspect_xp ?? {},
    level: row.level,
    zone: row.zone,
    position: row.position,
    playtime_sec: row.playtime_sec,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listCharacters(userId: string): Promise<Character[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", userId)
    .order("slot", { ascending: true });
  if (error) {
    console.error("[characterRepo] listCharacters", error);
    return [];
  }
  return (data as CharacterRow[]).map(rowToCharacter);
}

export async function createCharacter(input: NewCharacterInput): Promise<Character | null> {
  if (!supabase) return null;
  const blob = packSliderState(input.sliders);
  const { data, error } = await supabase
    .from("characters")
    .insert({
      slot: input.slot,
      name: input.name,
      heritage: input.heritage,
      slider_blob: blobToBase64(blob),
      metadata: input.metadata ?? {},
      active_aspect: input.active_aspect ?? "tempest",
    })
    .select()
    .single();
  if (error) {
    console.error("[characterRepo] createCharacter", error);
    return null;
  }
  return rowToCharacter(data as CharacterRow);
}

export async function updateSliders(
  characterId: string,
  sliders: NewCharacterInput["sliders"],
): Promise<boolean> {
  if (!supabase) return false;
  const blob = packSliderState(sliders);
  const { error } = await supabase
    .from("characters")
    .update({ slider_blob: blobToBase64(blob) })
    .eq("id", characterId);
  if (error) {
    console.error("[characterRepo] updateSliders", error);
    return false;
  }
  return true;
}

export async function deleteCharacter(characterId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("characters").delete().eq("id", characterId);
  if (error) {
    console.error("[characterRepo] deleteCharacter", error);
    return false;
  }
  return true;
}
