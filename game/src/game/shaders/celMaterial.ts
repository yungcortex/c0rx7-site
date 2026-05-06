/**
 * Cel-shaded material — painterly 3-band lighting + rim light + optional inverted-hull outline.
 *
 * Why custom: Babylon's StandardMaterial gives smooth Lambert shading. PBR is photoreal.
 * Neither produces the FF/Genshin-style hard shadow bands. NodeMaterial works but is
 * harder to iterate on. Custom GLSL is the load-bearing piece.
 *
 * Usage:
 *   const mat = createCelMaterial(scene, {
 *     baseColor: new Color3(0.9, 0.4, 0.5),
 *     bands: 3,                    // 2 = anime hard, 3 = balanced, 5 = softer
 *     shadowTint: new Color3(0.3, 0.2, 0.4),
 *     rimColor: new Color3(1, 0.8, 0.5),
 *     rimPower: 3,
 *   });
 *   mesh.material = mat;
 *   addOutline(mesh, scene, { thickness: 0.02, color: new Color3(0,0,0) });
 */
import {
  Scene,
  ShaderMaterial,
  Mesh,
  Color3,
  Vector3,
  Effect,
} from "@babylonjs/core";

export interface CelOptions {
  baseColor?: Color3;
  bands?: number;          // # of light bands (2-5)
  shadowTint?: Color3;     // color shadows lean toward (warm shadow trick)
  highlightTint?: Color3;  // color highlights lean toward (cool highlight trick)
  rimColor?: Color3;
  rimPower?: number;       // higher = thinner rim
  rimIntensity?: number;
  ambient?: number;        // floor brightness so darkest band isn't black (0.15-0.30)
  lightDir?: Vector3;      // override scene light dir for art reasons
}

const VERT = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 worldViewProjection;
uniform mat4 world;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec2 vUV;
void main() {
  vec4 wp = world * vec4(position, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(world) * normal);
  vUV = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec2 vUV;
uniform vec3 baseColor;
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform vec3 rimColor;
uniform vec3 lightDir;
uniform vec3 cameraPos;
uniform float bands;
uniform float ambient;
uniform float rimPower;
uniform float rimIntensity;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 L = normalize(-lightDir);                 // light comes FROM lightDir
  vec3 V = normalize(cameraPos - vPosW);

  // Diffuse, banded
  float ndl = max(dot(N, L), 0.0);
  // Map [0,1] to discrete bands then back to [0,1]
  float band = floor(ndl * bands) / max(bands - 1.0, 1.0);
  band = clamp(band, 0.0, 1.0);
  float lit = mix(ambient, 1.0, band);

  // Shadow color leans toward shadowTint, highlight toward highlightTint
  vec3 shaded = mix(baseColor * shadowTint, baseColor * highlightTint, lit);

  // Rim light (Fresnel-ish)
  float rim = pow(1.0 - max(dot(N, V), 0.0), rimPower);
  // Rim only where light hits (not on completely shadowed side)
  rim *= smoothstep(0.0, 0.4, ndl);
  shaded += rimColor * rim * rimIntensity;

  gl_FragColor = vec4(shaded, 1.0);
}
`;

// Outline pass: render back faces, push them OUT along normals, draw flat color.
const OUTLINE_VERT = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 worldViewProjection;
uniform float thickness;
void main() {
  vec3 inflated = position + normal * thickness;
  gl_Position = worldViewProjection * vec4(inflated, 1.0);
}
`;

const OUTLINE_FRAG = `
precision highp float;
uniform vec3 outlineColor;
void main() { gl_FragColor = vec4(outlineColor, 1.0); }
`;

let _shadersRegistered = false;
function registerShaders() {
  if (_shadersRegistered) return;
  Effect.ShadersStore["celVertexShader"] = VERT;
  Effect.ShadersStore["celFragmentShader"] = FRAG;
  Effect.ShadersStore["outlineVertexShader"] = OUTLINE_VERT;
  Effect.ShadersStore["outlineFragmentShader"] = OUTLINE_FRAG;
  _shadersRegistered = true;
}

export function createCelMaterial(scene: Scene, opts: CelOptions = {}): ShaderMaterial {
  registerShaders();
  const baseColor = opts.baseColor ?? new Color3(0.85, 0.6, 0.7);
  const shadowTint = opts.shadowTint ?? new Color3(0.5, 0.35, 0.6);     // warm purple shadow
  const highlightTint = opts.highlightTint ?? new Color3(1.05, 1.0, 0.95); // cool highlight
  const rimColor = opts.rimColor ?? new Color3(1.0, 0.85, 0.6);
  const bands = opts.bands ?? 3;
  const ambient = opts.ambient ?? 0.25;
  const rimPower = opts.rimPower ?? 3.0;
  const rimIntensity = opts.rimIntensity ?? 0.8;
  const lightDir = opts.lightDir ?? new Vector3(-0.5, -1.0, -0.3).normalize();

  const mat = new ShaderMaterial("cel", scene, "cel", {
    attributes: ["position", "normal", "uv"],
    uniforms: [
      "world", "worldViewProjection",
      "baseColor", "shadowTint", "highlightTint", "rimColor",
      "lightDir", "cameraPos",
      "bands", "ambient", "rimPower", "rimIntensity",
    ],
  });
  mat.setColor3("baseColor", baseColor);
  mat.setColor3("shadowTint", shadowTint);
  mat.setColor3("highlightTint", highlightTint);
  mat.setColor3("rimColor", rimColor);
  mat.setVector3("lightDir", lightDir);
  mat.setFloat("bands", bands);
  mat.setFloat("ambient", ambient);
  mat.setFloat("rimPower", rimPower);
  mat.setFloat("rimIntensity", rimIntensity);

  // Update camera position each frame
  scene.onBeforeRenderObservable.add(() => {
    const cam = scene.activeCamera;
    if (cam) mat.setVector3("cameraPos", cam.position);
  });

  return mat;
}

export interface OutlineOptions {
  thickness?: number;       // world-space thickness, scale-relative (0.01-0.05 typical)
  color?: Color3;
}

/** Adds an inverted-hull outline by cloning the mesh, scaling, and rendering back-faces only. */
export function addOutline(mesh: Mesh, scene: Scene, opts: OutlineOptions = {}): Mesh {
  registerShaders();
  const thickness = opts.thickness ?? 0.025;
  const color = opts.color ?? new Color3(0, 0, 0);

  const outlineMesh = mesh.clone(`${mesh.name}__outline`, mesh.parent);
  outlineMesh.scaling = mesh.scaling.clone();
  outlineMesh.position = mesh.position.clone();
  outlineMesh.rotation = mesh.rotation.clone();
  outlineMesh.parent = mesh;
  outlineMesh.position = Vector3.Zero();
  outlineMesh.rotation = Vector3.Zero();
  outlineMesh.scaling = new Vector3(1, 1, 1);

  const outlineMat = new ShaderMaterial(`${mesh.name}__outlineMat`, scene, "outline", {
    attributes: ["position", "normal"],
    uniforms: ["worldViewProjection", "thickness", "outlineColor"],
  });
  outlineMat.setFloat("thickness", thickness);
  outlineMat.setColor3("outlineColor", color);
  // Inverted-hull trick: flip winding so the inflated front faces become back-faced
  // and get culled, leaving only the inflated back-faces visible as the outline.
  outlineMesh.flipFaces(true);

  outlineMesh.material = outlineMat;
  outlineMesh.isPickable = false;
  outlineMesh.renderingGroupId = 0;

  return outlineMesh;
}

/**
 * Convenience: apply cel + outline to a mesh in one call.
 * Returns the cel material (in case you want to tweak it later).
 */
export function applyStylizedToMesh(
  mesh: Mesh,
  scene: Scene,
  cel: CelOptions = {},
  outline: OutlineOptions | false = {},
): ShaderMaterial {
  const mat = createCelMaterial(scene, cel);
  mesh.material = mat;
  if (outline !== false) {
    addOutline(mesh, scene, outline);
  }
  return mat;
}
