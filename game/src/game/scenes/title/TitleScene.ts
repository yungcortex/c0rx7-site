import {
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  Engine,
  Animation,
  CubicEase,
  EasingFunction,
  GlowLayer,
} from "@babylonjs/core";
import { applyCelShade } from "@game/shaders/celShade";
import { applyStylizedToMesh } from "@game/shaders/celMaterial";

/**
 * Title scene — painterly purple void, rotating placeholder Aspect crystal,
 * single key light. React mounts the title UI on top.
 *
 * The mesh is a temporary stand-in for the animated logo crystal; in Phase 1
 * we swap in a glb logo + spinning Aspect weapon previews.
 */
export function buildTitleScene(engine: Engine, _canvas: HTMLCanvasElement): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.027, 0.016, 0.051, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.04;
  scene.fogColor = new Color3(0.06, 0.04, 0.11);

  const camera = new ArcRotateCamera(
    "title-cam",
    -Math.PI / 2,
    Math.PI / 2.4,
    8,
    new Vector3(0, 0.4, 0),
    scene,
  );
  camera.minZ = 0.1;
  camera.fov = 0.9;

  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.35;
  ambient.diffuse = new Color3(0.5, 0.4, 0.7);
  ambient.groundColor = new Color3(0.1, 0.05, 0.2);

  const key = new DirectionalLight("key", new Vector3(-0.4, -0.7, -0.5), scene);
  key.intensity = 1.4;
  key.diffuse = new Color3(1, 0.85, 0.6);

  const rim = new DirectionalLight("rim", new Vector3(0.6, 0.2, 0.8), scene);
  rim.intensity = 0.6;
  rim.diffuse = new Color3(0.42, 0.66, 0.83);

  // Placeholder Aspect crystal — octahedron with cel shader + outline
  const crystal = MeshBuilder.CreatePolyhedron(
    "aspect-crystal",
    { type: 1, size: 1.1 },
    scene,
  );
  crystal.position.y = 0.4;
  applyStylizedToMesh(
    crystal,
    scene,
    {
      baseColor: new Color3(0.95, 0.78, 0.42),       // gold
      shadowTint: new Color3(0.55, 0.35, 0.6),       // warm purple shadow
      highlightTint: new Color3(1.1, 1.0, 0.85),     // warm highlight
      rimColor: new Color3(0.8, 0.65, 1.0),          // cyan-purple rim against scene purple
      rimPower: 2.5,
      rimIntensity: 1.2,
      bands: 3,
      ambient: 0.3,
      lightDir: new Vector3(-0.4, -0.7, -0.5).normalize(),
    },
    { thickness: 0.04, color: new Color3(0.05, 0.02, 0.08) },
  );

  // Slow rotation animation
  const anim = new Animation(
    "crystal-spin",
    "rotation.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  anim.setKeys([
    { frame: 0, value: 0 },
    { frame: 360, value: Math.PI * 2 },
  ]);
  const ease = new CubicEase();
  ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
  crystal.animations.push(anim);
  scene.beginAnimation(crystal, 0, 360, true, 0.25);

  // Subtle bob
  const bob = new Animation(
    "crystal-bob",
    "position.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  bob.setKeys([
    { frame: 0, value: 0.4 },
    { frame: 60, value: 0.55 },
    { frame: 120, value: 0.4 },
  ]);
  bob.setEasingFunction(ease);
  crystal.animations.push(bob);
  scene.beginAnimation(crystal, 0, 120, true, 0.4);

  // Ground / floor halo — flat ring
  const halo = MeshBuilder.CreateDisc("halo", { radius: 3, tessellation: 64 }, scene);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -0.5;
  const haloMat = new StandardMaterial("halo-mat", scene);
  haloMat.diffuseColor = new Color3(0.12, 0.07, 0.22);
  haloMat.emissiveColor = new Color3(0.08, 0.04, 0.16);
  haloMat.specularColor = new Color3(0, 0, 0);
  halo.material = haloMat;

  const glow = new GlowLayer("title-glow", scene);
  glow.intensity = 0.55;

  applyCelShade(scene, camera);

  return scene;
}
