import type { Heritage } from "@game/systems/character/SliderBlob";

/**
 * Asset manifest — maps logical asset ids to URL paths. The runtime loads
 * character meshes by heritage; environment props by zone; weapon meshes by
 * Aspect id.
 *
 * Phase 1: most paths are stubs — the runtime falls back to the parametric
 * placeholder when a glb isn't present (see MorphController.buildPlaceholder).
 */

export const characterMeshes: Record<Heritage, string | null> = {
  hjari: null, // "/play/assets/models/character/base-hjari.glb",
  sivit: null,
  korr: null,
  vellish: null,
  ashen: null,
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
