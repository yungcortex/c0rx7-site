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

/**
 * Loads an external rigged humanoid glb. Keeps the asset's original
 * materials (so skinning + bone weights keep working) and uses Babylon's
 * native renderOutline path for the painterly outline. Slider updates
 * re-tint the materials in place.
 *
 * Custom GLSL cel shading on a skinned mesh is non-trivial (needs bone
 * matrices in the vertex shader) — instead we layer painterly look via
 * post-process pipeline and per-mesh colour modulation. Worth upgrading
 * to a proper cel-skinning shader later, but not load-bearing for v1.
 *
 * Source: Babylon's free HVGirl asset on assets.babylonjs.com (CC0).
 *
 * Future: swap the URL for our authored glb in `assets/models/character/`
 * and the rest of the pipeline keeps working.
 */

export interface LoadedAvatar {
  root: TransformNode;
  meshes: AbstractMesh[];
  skeletons: Skeleton[];
  /** Per-region mesh map so we can re-tint when sliders change */
  meshesByRegion: {
    skin: AbstractMesh[];
    hair: AbstractMesh[];
    outfit: AbstractMesh[];
    other: AbstractMesh[];
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
 * Set the material's base colour, regardless of whether it's PBR or Standard.
 */
function setMaterialColor(mat: any, color: Color3) {
  if (mat instanceof PBRMaterial) {
    mat.albedoColor = color;
    mat.emissiveColor = color.scale(0.04); // tiny emissive lift for painterly read
  } else if (mat instanceof StandardMaterial) {
    mat.diffuseColor = color;
    mat.emissiveColor = color.scale(0.04);
  }
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

  // Categorise meshes by region; tint the underlying material instead of
  // replacing it (replacing breaks bone-skinning).
  const meshesByRegion: LoadedAvatar["meshesByRegion"] = {
    skin: [],
    hair: [],
    outfit: [],
    other: [],
  };

  for (const m of meshes) {
    if (!(m instanceof Mesh)) continue;
    const region = classifyMeshName(m.name);
    meshesByRegion[region].push(m);

    // Painterly tweaks to the existing material — preserves skinning
    if (m.material instanceof PBRMaterial) {
      const pbr = m.material;
      pbr.metallic = 0;
      pbr.roughness = 1;
      pbr.environmentIntensity = 0.3;
      pbr.directIntensity = 1.4;
      // A little ambient lift so banded post-FX has somewhere to bite
      if (pbr.ambientColor) pbr.ambientColor = new Color3(0.35, 0.3, 0.42);
    } else if (m.material instanceof StandardMaterial) {
      const std = m.material;
      std.specularColor = new Color3(0.1, 0.1, 0.12);
      std.specularPower = 32;
    }

    // Babylon's native outline renderer — works on skinned meshes
    if (useOutline && region !== "other") {
      m.renderOutline = true;
      m.outlineWidth = region === "hair" ? 0.6 : 0.4;
      m.outlineColor = new Color3(0.04, 0.02, 0.08);
    }
  }

  const applyCelMats = (skinColor: Color3, hairColor: Color3, outfitColor: Color3) => {
    for (const m of meshesByRegion.skin) {
      if (m.material) setMaterialColor(m.material, skinColor);
    }
    for (const m of meshesByRegion.hair) {
      if (m.material) setMaterialColor(m.material, hairColor);
    }
    for (const m of meshesByRegion.outfit) {
      if (m.material) setMaterialColor(m.material, outfitColor);
    }
  };

  return {
    root,
    meshes,
    skeletons,
    meshesByRegion,
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
