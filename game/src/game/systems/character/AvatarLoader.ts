import {
  Scene,
  TransformNode,
  Mesh,
  AbstractMesh,
  SceneLoader,
  Color3,
  StandardMaterial,
  PBRMaterial,
  AssetContainer,
  Vector3,
  Skeleton,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { createCelMaterial, addOutline } from "@game/shaders/celMaterial";

/**
 * Loads an external rigged humanoid glb and dresses every sub-mesh in our
 * cel shader. The result is a real character (~13K tris, properly skinned)
 * with the painterly art direction applied on top.
 *
 * Source: Babylon's free HVGirl asset on assets.babylonjs.com (CC0).
 * It's a stylized humanoid with face geometry, hair, clothing, and a
 * working skeleton — perfect placeholder until our own meshes are authored.
 *
 * Future: swap the URL for our authored glb in `assets/models/character/`
 * and the rest of the pipeline keeps working.
 */

export interface LoadedAvatar {
  root: TransformNode;
  meshes: AbstractMesh[];
  skeletons: Skeleton[];
  /** Per-region material map so we can re-tint when sliders change */
  materialsByRegion: {
    skin: ReturnType<typeof createCelMaterial>[];
    hair: ReturnType<typeof createCelMaterial>[];
    outfit: ReturnType<typeof createCelMaterial>[];
    other: ReturnType<typeof createCelMaterial>[];
  };
  applyCelMats: (
    skinColor: Color3,
    hairColor: Color3,
    outfitColor: Color3,
  ) => void;
  dispose: () => void;
}

const PRIMARY_URL = "https://assets.babylonjs.com/meshes/HVGirl.glb";

/**
 * Detect what region a sub-mesh belongs to by name heuristics. HVGirl uses
 * descriptive mesh names (Hair, Body, Eye, etc.) so we can route them.
 */
function classifyMeshName(name: string): "skin" | "hair" | "outfit" | "other" {
  const n = name.toLowerCase();
  if (n.includes("hair")) return "hair";
  if (n.includes("eye") || n.includes("brow") || n.includes("lash")) return "other";
  if (n.includes("face") || n.includes("head") || n.includes("body") || n.includes("skin") || n.includes("arm") || n.includes("leg") || n.includes("hand"))
    return "skin";
  if (n.includes("cloth") || n.includes("shirt") || n.includes("dress") || n.includes("pant") || n.includes("skirt") || n.includes("shoe") || n.includes("boot") || n.includes("top") || n.includes("bottom"))
    return "outfit";
  return "outfit"; // default unknown to outfit (clothing is most common)
}

/**
 * Extract the dominant base color from a loaded material so we preserve
 * the original asset's per-region tints when no slider override is given.
 */
function extractBaseColor(mat: any): Color3 {
  if (mat instanceof PBRMaterial) {
    return mat.albedoColor?.clone() ?? new Color3(0.8, 0.7, 0.6);
  }
  if (mat instanceof StandardMaterial) {
    return mat.diffuseColor?.clone() ?? new Color3(0.8, 0.7, 0.6);
  }
  return new Color3(0.8, 0.7, 0.6);
}

export async function loadAvatar(
  scene: Scene,
  parent: TransformNode,
  options: { url?: string; outline?: boolean; scale?: number } = {},
): Promise<LoadedAvatar> {
  const url = options.url ?? PRIMARY_URL;
  const useOutline = options.outline ?? true;
  const scale = options.scale ?? 0.04; // HVGirl is ~50 units tall, scale to ~2m

  const container: AssetContainer = await SceneLoader.LoadAssetContainerAsync(
    url,
    "",
    scene,
  );

  // Add to scene; track everything so we can dispose later
  container.addAllToScene();

  const meshes = container.meshes;
  const skeletons = container.skeletons;

  // Place under our parent transform
  const root = parent;
  for (const m of meshes) {
    if (!m.parent) {
      m.parent = root;
    }
  }
  root.scaling = new Vector3(scale, scale, scale);

  // Replace materials with cel shaders, classified by region
  const materialsByRegion: LoadedAvatar["materialsByRegion"] = {
    skin: [],
    hair: [],
    outfit: [],
    other: [],
  };

  for (const m of meshes) {
    if (!(m instanceof Mesh)) continue;
    if (!m.material) continue;
    const region = classifyMeshName(m.name);
    const baseColor = extractBaseColor(m.material);

    const celOpts = {
      skin: {
        baseColor,
        bands: 3,
        shadowTint: new Color3(0.65, 0.45, 0.55),
        highlightTint: new Color3(1.08, 1.02, 0.95),
        rimColor: new Color3(1.0, 0.85, 0.65),
        rimPower: 3.5,
        rimIntensity: 0.5,
        ambient: 0.45,
      },
      hair: {
        baseColor,
        bands: 4,
        shadowTint: new Color3(0.35, 0.25, 0.45),
        highlightTint: new Color3(1.5, 1.25, 0.95),
        rimColor: new Color3(1, 0.9, 0.7),
        rimPower: 2.2,
        rimIntensity: 1.6,
        ambient: 0.28,
      },
      outfit: {
        baseColor,
        bands: 3,
        shadowTint: new Color3(0.45, 0.3, 0.55),
        highlightTint: new Color3(1.08, 1.0, 1.08),
        rimColor: new Color3(0.65, 0.75, 1.0),
        rimPower: 3,
        rimIntensity: 0.55,
        ambient: 0.32,
      },
      other: {
        baseColor,
        bands: 2,
        rimIntensity: 0.6,
        ambient: 0.55,
      },
    }[region];

    const cel = createCelMaterial(scene, celOpts);
    m.material = cel;
    materialsByRegion[region].push(cel);

    if (useOutline && region !== "other") {
      try {
        addOutline(m, scene, {
          thickness: region === "hair" ? 0.5 : 0.4, // world-space thickness scales with mesh, our scale is 0.04
          color: new Color3(0.04, 0.02, 0.08),
        });
      } catch (e) {
        // Some glb sub-meshes don't support cloning (lines, etc) — skip silently
      }
    }
  }

  const applyCelMats = (skinColor: Color3, hairColor: Color3, outfitColor: Color3) => {
    materialsByRegion.skin.forEach((m) => m.setColor3("baseColor", skinColor));
    materialsByRegion.hair.forEach((m) => m.setColor3("baseColor", hairColor));
    materialsByRegion.outfit.forEach((m) => m.setColor3("baseColor", outfitColor));
  };

  return {
    root,
    meshes,
    skeletons,
    materialsByRegion,
    applyCelMats,
    dispose: () => {
      container.removeAllFromScene();
      container.dispose();
    },
  };
}

/**
 * Best-effort idle animation playback (HVGirl ships with a few clips).
 */
export function playIdle(_loaded: LoadedAvatar, scene: Scene) {
  const groups = scene.animationGroups;
  const idle =
    groups.find((g) => g.name.toLowerCase().includes("idle")) ??
    groups.find((g) => g.name.toLowerCase().includes("breath")) ??
    groups[0];
  if (idle) {
    idle.play(true);
    idle.speedRatio = 0.7;
  }
}
