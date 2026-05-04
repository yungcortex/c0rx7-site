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
 * descriptive mesh names; this is a permissive matcher so we route most
 * possible namings cleanly.
 */
function classifyMeshName(name: string): "skin" | "hair" | "outfit" | "other" {
  const n = name.toLowerCase();
  if (n.includes("hair") || n.includes("ponytail") || n.includes("braid") || n.includes("fringe")) return "hair";
  if (n.includes("eye") || n.includes("brow") || n.includes("lash") || n.includes("teeth") || n.includes("tongue") || n.includes("pupil") || n.includes("iris")) return "other";
  if (
    n.includes("face") ||
    n.includes("head") ||
    n.includes("body") ||
    n.includes("skin") ||
    n.includes("arm") ||
    n.includes("leg") ||
    n.includes("hand") ||
    n.includes("foot") ||
    n.includes("torso") ||
    n.includes("neck")
  )
    return "skin";
  if (
    n.includes("cloth") ||
    n.includes("shirt") ||
    n.includes("dress") ||
    n.includes("pant") ||
    n.includes("skirt") ||
    n.includes("shoe") ||
    n.includes("boot") ||
    n.includes("top") ||
    n.includes("bottom") ||
    n.includes("jacket") ||
    n.includes("robe") ||
    n.includes("suit") ||
    n.includes("uniform") ||
    n.includes("vest") ||
    n.includes("collar") ||
    n.includes("hood") ||
    n.includes("hat") ||
    n.includes("cape") ||
    n.includes("scarf") ||
    n.includes("glove") ||
    n.includes("sock") ||
    n.includes("legs") ||
    n.includes("upper") ||
    n.includes("lower")
  )
    return "outfit";
  // Unknown → treat as skin so tinting still does something visible
  return "skin";
}

/**
 * Tint a PBR/Standard material toward `color`. PBR multiplies albedoColor
 * with the albedo texture, so subtle hue shifts get washed out. We use a
 * heavy emissive add to guarantee the slider hue is unmistakable.
 */
function setMaterialColor(mat: any, color: Color3, strength = 0.55) {
  if (mat instanceof PBRMaterial) {
    mat.albedoColor = color;
    mat.emissiveColor = color.scale(strength);
    mat.environmentIntensity = 0.15;
    mat.directIntensity = 1.4;
    mat.metallic = 0;
    mat.roughness = 1;
  } else if (mat instanceof StandardMaterial) {
    mat.diffuseColor = color;
    mat.emissiveColor = color.scale(strength);
    mat.specularColor = new Color3(0, 0, 0);
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

  // Compute the bounding box of all loaded meshes so we can auto-fit the
  // character to ~2m tall regardless of the source asset's units. The user-
  // supplied `scale` becomes a multiplier on top of the auto-fit.
  let minY = Infinity;
  let maxY = -Infinity;
  for (const m of meshes) {
    if (m.getTotalVertices && m.getTotalVertices() > 0) {
      m.computeWorldMatrix(true);
      const bb = m.getBoundingInfo().boundingBox;
      const lowY = bb.minimumWorld.y;
      const highY = bb.maximumWorld.y;
      if (lowY < minY) minY = lowY;
      if (highY > maxY) maxY = highY;
    }
  }
  const naturalHeight = maxY - minY;
  const targetHeight = 1.95; // metres
  const autoScale =
    naturalHeight > 0.01 && isFinite(naturalHeight) ? targetHeight / naturalHeight : 1;
  const finalScale = autoScale * scale * 25; // scale arg now acts as a tweaker

  root.scaling = new Vector3(finalScale, finalScale, finalScale);
  console.info(
    `[AvatarLoader] natural height ${naturalHeight.toFixed(2)} → final scale ${finalScale.toFixed(3)}`,
  );

  // Categorise meshes by region; tint the underlying material instead of
  // replacing it (replacing breaks bone-skinning).
  //
  // We classify by NAME first; if everything falls into "skin" (because the
  // asset uses generic names), we re-classify by VERTICAL POSITION as a
  // fallback so hair/outfit sliders still have meshes to target.
  const meshesByRegion: LoadedAvatar["meshesByRegion"] = {
    skin: [],
    hair: [],
    outfit: [],
    other: [],
  };

  const meshNamesByRegion: Record<string, string[]> = {
    skin: [],
    hair: [],
    outfit: [],
    other: [],
  };

  const regionByMesh = new Map<Mesh, "skin" | "hair" | "outfit" | "other">();

  for (const m of meshes) {
    if (!(m instanceof Mesh)) continue;
    if (!m.material) continue;
    const region = classifyMeshName(m.name);
    meshesByRegion[region].push(m);
    meshNamesByRegion[region]!.push(m.name);
    regionByMesh.set(m, region);

    // Painterly tweaks to the existing material — preserves skinning
    if (m.material instanceof PBRMaterial) {
      const pbr = m.material;
      pbr.metallic = 0;
      pbr.roughness = 1;
      pbr.environmentIntensity = 0.25;
      pbr.directIntensity = 1.6;
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

  // Fallback: if name-based classification produced 0 hair AND 0 outfit
  // meshes, classify by mesh-local Y position so the sliders still target
  // distinct regions.
  if (meshesByRegion.hair.length === 0 || meshesByRegion.outfit.length === 0) {
    const heights: { mesh: Mesh; centerY: number }[] = [];
    for (const m of meshes) {
      if (!(m instanceof Mesh) || !m.material) continue;
      m.computeWorldMatrix(true);
      const bb = m.getBoundingInfo().boundingBox;
      const cy = (bb.minimumWorld.y + bb.maximumWorld.y) / 2;
      heights.push({ mesh: m, centerY: cy });
    }
    if (heights.length > 1) {
      const ys = heights.map((h) => h.centerY).sort((a, b) => a - b);
      const totalLow = ys[0]!;
      const totalHigh = ys[ys.length - 1]!;
      const range = Math.max(0.01, totalHigh - totalLow);
      const headThreshold = totalHigh - range * 0.2; // top 20%
      const torsoThreshold = totalLow + range * 0.45; // mid

      for (const h of heights) {
        const existing = regionByMesh.get(h.mesh);
        // Only re-route meshes that fell into the default "skin" bucket
        if (existing !== "skin") continue;
        let newRegion: "skin" | "hair" | "outfit" = "skin";
        if (h.centerY >= headThreshold) {
          // Top of character — likely head/hair. If the mesh is small and
          // dark, lean hair; if it's a face, leave as skin. We can't easily
          // detect that here, so route to hair (works for most assets).
          newRegion = "hair";
        } else if (h.centerY < torsoThreshold) {
          newRegion = "outfit"; // legs
        } else {
          newRegion = "outfit"; // torso
        }
        // newRegion is always hair or outfit here (top of character → hair,
        // otherwise → outfit). Move the mesh from skin to its new bucket.
        const skinIdx = meshesByRegion.skin.indexOf(h.mesh);
        if (skinIdx >= 0) meshesByRegion.skin.splice(skinIdx, 1);
        meshesByRegion[newRegion].push(h.mesh);
        regionByMesh.set(h.mesh, newRegion);
        meshNamesByRegion[newRegion]!.push(h.mesh.name + " (by-pos)");
      }
    }
  }

  // Diagnostic: log the breakdown so we can tune the classifier
  console.info(
    "[AvatarLoader] mesh classification:",
    Object.fromEntries(
      Object.entries(meshNamesByRegion).map(([k, v]) => [k, v.length ? v : "(none)"]),
    ),
  );

  const applyCelMats = (skinColor: Color3, hairColor: Color3, outfitColor: Color3) => {
    // Pass 1: paint EVERY mesh with the skin color first (worst case if
    // classifier missed: at least skin slider drives the whole character).
    for (const m of meshes) {
      if (m instanceof Mesh && m.material) {
        setMaterialColor(m.material, skinColor, 0.45);
      }
    }
    // Pass 2: hair-classified meshes get hair color (overrides pass 1).
    for (const m of meshesByRegion.hair) {
      if (m.material) setMaterialColor(m.material, hairColor, 0.7);
    }
    // Pass 3: outfit-classified meshes get outfit color (overrides pass 1).
    for (const m of meshesByRegion.outfit) {
      if (m.material) setMaterialColor(m.material, outfitColor, 0.6);
    }
    console.info(
      `[AvatarLoader] tint applied — skin: rgb(${(skinColor.r * 255) | 0}, ${
        (skinColor.g * 255) | 0
      }, ${(skinColor.b * 255) | 0})`,
    );
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
