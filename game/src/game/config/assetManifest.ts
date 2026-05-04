import type { Heritage } from "@game/systems/character/SliderBlob";

/**
 * Asset manifest — maps logical asset ids to URL paths. The runtime loads
 * character meshes by heritage; environment props by zone; weapon meshes by
 * Aspect id.
 *
 * Each heritage gets a distinct base mesh. v1 uses CC0 humanoid glbs from
 * the threejs / Khronos sample CDNs, committed locally so Vercel serves
 * them. When we author Ætherwake-original characters in MakeHuman / Blender,
 * we just swap the URLs here.
 */

export const characterMeshes: Record<Heritage, string> = {
  hjari: "/play/assets/models/character/Michelle.glb",        // mature human female
  sivit: "/play/assets/models/character/Xbot.glb",            // tall stylised humanoid
  korr: "/play/assets/models/character/Soldier.glb",          // bulky armoured silhouette
  vellish: "https://assets.babylonjs.com/meshes/HVGirl.glb",  // chibi (kept for variety)
  ashen: "/play/assets/models/character/CesiumMan.glb",       // angular alien proportions
};

export const aspectWeaponMeshes = {
  tempest: null, // "/play/assets/models/aspects/tempest-greatsword.glb",
  choir: null,
  bloom: null,
  veil: null,
  hymn: null,
  ember: null,
  vow: null,
  hush: null,
} as const;

export const zoneEnvironments = {
  "hyrr-central": null,
  "the-crown": null,
  "the-brass-throat": null,
  "lowering": null,
  "pale-garden": null,
  "the-coil": null,
  "the-hollow-vespers": null,
} as const;

export const animationLibraries = {
  locomotion: null, // "/play/assets/animations/locomotion.glb",
  combat_tempest: null,
  emotes: null,
} as const;
