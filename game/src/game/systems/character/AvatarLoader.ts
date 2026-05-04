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
  MeshBuilder,
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
  /** auto-computed base scale that fits the asset to ~1.95m tall */
  baseScale: number;
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
  /** Drive per-heritage + per-slider proportions on the loaded mesh. */
  applyTransforms: (xform: AvatarTransform) => void;
  dispose: () => void;
}

export interface AvatarTransform {
  heritage: "hjari" | "sivit" | "korr" | "vellish" | "ashen";
  subBuild: number;
  /** 0..1, 0=masc 1=fem */
  bodyType: number;
  /** 0..1 */
  muscle: number;
  /** 0..1 */
  height: number;
  /** 0..1 — overall build width */
  buildWeight: number;
}

const PRIMARY_URL = "https://assets.babylonjs.com/meshes/HVGirl.glb";

export interface LoadAvatarOptions {
  url?: string;
  outline?: boolean;
  scale?: number;
}

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
  options: LoadAvatarOptions = {},
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
  // supplied `scale` is a multiplier (default 1.0) on top of the auto-fit.
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
  const baseScale = autoScale * scale;

  root.scaling = new Vector3(baseScale, baseScale, baseScale);

  // Re-anchor so feet sit at parent.y = 0 (parent in scene supplies the floor)
  if (isFinite(minY)) {
    const offset = -minY * baseScale;
    root.position.y += offset;
  }

  console.info(
    `[AvatarLoader] natural height ${naturalHeight.toFixed(2)} → base scale ${baseScale.toFixed(3)} (target ${targetHeight}m)`,
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

  // Heritage marker meshes — long elf-ears for Sivit, cat ears + tail for
  // Vellish. These are NOT skinned — they're parented to the avatar root,
  // not the head bone, so they orbit with the character's overall sway but
  // not with skeletal head animation. Good enough for a turntable preview.
  const heritageMarkers = new TransformNode("heritage-markers", scene);
  heritageMarkers.parent = root;
  heritageMarkers.setEnabled(false);

  // ============ HERITAGE PROPS ============

  const skinPropMat = new StandardMaterial("skin-prop-mat", scene);
  skinPropMat.diffuseColor = new Color3(0.92, 0.78, 0.62);
  skinPropMat.specularColor = new Color3(0.05, 0.05, 0.06);
  skinPropMat.emissiveColor = new Color3(0.18, 0.14, 0.1);

  // Sivit long ears — flat triangles attached to head sides
  const sivitProps = new TransformNode("sivit-props", scene);
  sivitProps.parent = heritageMarkers;
  for (const side of [-1, 1] as const) {
    const ear = MeshBuilder.CreateBox(
      `sivit-ear-${side}`,
      { width: 0.08, height: 0.45, depth: 0.05 },
      scene,
    );
    ear.parent = sivitProps;
    // Position relative to scaled-up character. Head is at ~y=1.7 in mesh
    // coords for HVGirl after auto-scale. We use approximate offsets that
    // look right after applyTransforms scaling.
    ear.position.set(side * 0.18, 1.75, 0);
    ear.rotation.z = side * 0.2;
    ear.rotation.x = -0.1;
    ear.material = skinPropMat;
  }

  // Vellish cat ears + tail
  const vellishProps = new TransformNode("vellish-props", scene);
  vellishProps.parent = heritageMarkers;
  for (const side of [-1, 1] as const) {
    const cat = MeshBuilder.CreateCylinder(
      `vellish-ear-${side}`,
      { diameterTop: 0.0, diameterBottom: 0.13, height: 0.18, tessellation: 4 },
      scene,
    );
    cat.parent = vellishProps;
    cat.position.set(side * 0.1, 1.95, 0.05);
    cat.rotation.z = side * 0.18;
    cat.material = skinPropMat;
  }
  // tail
  const tail = MeshBuilder.CreateCylinder(
    "vellish-tail",
    { diameterTop: 0.04, diameterBottom: 0.09, height: 0.7, tessellation: 8 },
    scene,
  );
  tail.parent = vellishProps;
  tail.position.set(0, 0.85, -0.18);
  tail.rotation.x = -0.7;
  tail.material = skinPropMat;

  // Korr — beard tuft for Tall-Korr (sub-build 0)
  const korrProps = new TransformNode("korr-props", scene);
  korrProps.parent = heritageMarkers;
  const beard = MeshBuilder.CreateBox(
    "korr-beard",
    { width: 0.18, height: 0.18, depth: 0.1 },
    scene,
  );
  beard.parent = korrProps;
  beard.position.set(0, 1.6, 0.13);
  const beardMat = new StandardMaterial("beard-mat", scene);
  beardMat.diffuseColor = new Color3(0.25, 0.15, 0.08);
  beardMat.specularColor = new Color3(0, 0, 0);
  beard.material = beardMat;

  /**
   * Per-heritage and per-slider proportional transforms. Same base mesh,
   * very different silhouettes — Sivit taller/thinner, Korr short/broad,
   * etc. Body sliders modulate on top.
   */
  const applyTransforms = (xform: AvatarTransform) => {
    const heightSlider = (xform.height - 0.5) * 0.4; // ±20% from slider
    const buildSlider = (xform.buildWeight - 0.5) * 0.4; // ±20%
    const muscleSlider = (xform.muscle - 0.5) * 0.3; // ±15%
    const fem = xform.bodyType; // 0..1

    let heritageY = 1.0;
    let heritageX = 1.0;
    let heritageZ = 1.0;
    switch (xform.heritage) {
      case "sivit":
        heritageY = 1.18; // taller
        heritageX = 0.85; // narrower
        heritageZ = 0.85;
        break;
      case "korr":
        if (xform.subBuild === 1) {
          // Short-Korr — half the height, ~30% wider
          heritageY = 0.62;
          heritageX = 1.3;
          heritageZ = 1.3;
        } else {
          // Tall-Korr — bulkier
          heritageY = 0.88;
          heritageX = 1.25;
          heritageZ = 1.25;
        }
        break;
      case "vellish":
        heritageY = 1.05;
        heritageX = 0.92;
        heritageZ = 0.92;
        break;
      case "ashen":
        heritageY = 1.02;
        heritageX = 0.88;
        heritageZ = 0.88;
        break;
      case "hjari":
      default:
        break;
    }

    // Body type: shifts shoulder/hip width slightly along X
    const bodyTypeX = 1 - (fem - 0.5) * 0.12;
    const bodyTypeZ = 1 + (fem - 0.5) * 0.06;

    const finalY = baseScale * heritageY * (1 + heightSlider);
    const finalX = baseScale * heritageX * (1 + buildSlider) * bodyTypeX * (1 + muscleSlider);
    const finalZ = baseScale * heritageZ * (1 + buildSlider) * bodyTypeZ * (1 + muscleSlider);

    root.scaling.set(finalX, finalY, finalZ);

    // Re-anchor feet to ground after re-scale
    if (isFinite(minY)) {
      const offset = -minY * finalY;
      root.position.y = offset;
    }

    // Show / hide heritage props based on choice
    heritageMarkers.setEnabled(true);
    sivitProps.setEnabled(xform.heritage === "sivit");
    vellishProps.setEnabled(xform.heritage === "vellish");
    korrProps.setEnabled(xform.heritage === "korr" && xform.subBuild === 0);
  };

  return {
    root,
    meshes,
    skeletons,
    baseScale,
    meshesByRegion,
    applyCelMats,
    applyTransforms,
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
