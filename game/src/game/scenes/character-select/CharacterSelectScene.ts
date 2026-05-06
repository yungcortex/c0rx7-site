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
  GlowLayer,
} from "@babylonjs/core";
import { applyCelShade } from "@game/shaders/celShade";

/**
 * Character-select stub — three plinths in a hall, capsules on top as
 * placeholders for the player's saved characters. Real character meshes
 * load here once the creator + save pipeline lands in Phase 1.
 */
export function buildCharacterSelectScene(engine: Engine, _canvas: HTMLCanvasElement): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.04, 0.025, 0.075, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.06;
  scene.fogColor = new Color3(0.05, 0.03, 0.09);

  const camera = new ArcRotateCamera(
    "select-cam",
    -Math.PI / 2,
    Math.PI / 2.6,
    11,
    new Vector3(0, 1, 0),
    scene,
  );
  camera.minZ = 0.1;
  camera.fov = 0.85;

  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.3;
  ambient.diffuse = new Color3(0.45, 0.4, 0.6);

  const key = new DirectionalLight("key", new Vector3(-0.3, -0.8, -0.4), scene);
  key.intensity = 1.1;
  key.diffuse = new Color3(0.95, 0.85, 0.65);

  const plinthSpacing = 3.2;
  for (let i = -1; i <= 1; i++) {
    const x = i * plinthSpacing;

    const plinth = MeshBuilder.CreateBox(
      `plinth-${i}`,
      { width: 1.6, height: 1.0, depth: 1.6 },
      scene,
    );
    plinth.position.set(x, 0, 0);
    const plinthMat = new StandardMaterial(`plinth-mat-${i}`, scene);
    plinthMat.diffuseColor = new Color3(0.18, 0.13, 0.24);
    plinthMat.specularColor = new Color3(0.1, 0.1, 0.1);
    plinth.material = plinthMat;

    const figure = MeshBuilder.CreateCapsule(
      `figure-${i}`,
      { radius: 0.35, height: 1.8, tessellation: 12 },
      scene,
    );
    figure.position.set(x, 1.65, 0);
    const figMat = new StandardMaterial(`fig-mat-${i}`, scene);
    figMat.diffuseColor = new Color3(0.7, 0.62, 0.5);
    figMat.specularColor = new Color3(0.5, 0.45, 0.35);
    figMat.emissiveColor = new Color3(0.05, 0.04, 0.03);
    figure.material = figMat;

    const spin = new Animation(
      `fig-spin-${i}`,
      "rotation.y",
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    spin.setKeys([
      { frame: 0, value: 0 },
      { frame: 480, value: Math.PI * 2 },
    ]);
    figure.animations.push(spin);
    scene.beginAnimation(figure, 0, 480, true, 1);
  }

  const floor = MeshBuilder.CreateGround("floor", { width: 30, height: 30 }, scene);
  floor.position.y = -0.5;
  const floorMat = new StandardMaterial("floor-mat", scene);
  floorMat.diffuseColor = new Color3(0.06, 0.04, 0.1);
  floorMat.specularColor = new Color3(0.2, 0.18, 0.28);
  floor.material = floorMat;

  const glow = new GlowLayer("select-glow", scene);
  glow.intensity = 0.4;

  applyCelShade(scene, camera);

  return scene;
}
