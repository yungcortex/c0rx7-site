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
import {
  buildPlaceholderAvatar,
  MorphController,
  type CharacterAvatar,
} from "@game/systems/character/MorphController";
import { useCreator } from "@state/character";

export type LightPreset = "sunset" | "dungeon" | "town";

export interface CharacterCreatorContext {
  scene: Scene;
  avatar: CharacterAvatar;
  morphController: MorphController;
  setLightPreset: (preset: LightPreset) => void;
  cycleExpression: () => void;
  dispose: () => void;
}

let activeContext: CharacterCreatorContext | null = null;

export function buildCharacterCreatorScene(
  engine: Engine,
  _canvas: HTMLCanvasElement,
): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.05, 0.03, 0.09, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.05;
  scene.fogColor = new Color3(0.07, 0.05, 0.12);

  const camera = new ArcRotateCamera(
    "creator-cam",
    Math.PI / 2,           // looking from +Z toward origin → sees character's FRONT
    Math.PI / 2.2,
    3.6,
    new Vector3(0, 1.3, 0),
    scene,
  );
  camera.lowerRadiusLimit = 2.0;
  camera.upperRadiusLimit = 8;
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = Math.PI / 1.9;
  camera.minZ = 0.1;
  camera.fov = 0.95;
  camera.attachControl(_canvas, true);
  camera.panningSensibility = 0;
  camera.wheelPrecision = 60;

  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0.2), scene);
  ambient.intensity = 0.55;
  ambient.diffuse = new Color3(0.7, 0.6, 0.8);
  ambient.groundColor = new Color3(0.12, 0.08, 0.2);

  // Key light from upper-front-left (lights the face properly)
  const key = new DirectionalLight("key", new Vector3(-0.4, -0.7, -0.6), scene);
  key.intensity = 1.4;
  key.diffuse = new Color3(1, 0.9, 0.72);

  // Rim from behind-right (kicks the silhouette)
  const rim = new DirectionalLight("rim", new Vector3(0.5, 0.1, 0.8), scene);
  rim.intensity = 0.7;
  rim.diffuse = new Color3(0.55, 0.75, 0.95);

  // Front fill (face stays readable when camera orbits)
  const fill = new DirectionalLight("fill", new Vector3(0, -0.3, -0.95), scene);
  fill.intensity = 0.45;
  fill.diffuse = new Color3(0.7, 0.65, 0.85);

  // Plinth
  const plinth = MeshBuilder.CreateCylinder(
    "plinth",
    { diameterTop: 1.6, diameterBottom: 1.8, height: 0.25, tessellation: 24 },
    scene,
  );
  plinth.position.y = 0;
  const plinthMat = new StandardMaterial("plinth-mat", scene);
  plinthMat.diffuseColor = new Color3(0.16, 0.12, 0.22);
  plinthMat.specularColor = new Color3(0.05, 0.05, 0.05);
  plinth.material = plinthMat;

  // Halo ring on the floor
  const halo = MeshBuilder.CreateTorus(
    "halo",
    { diameter: 2.4, thickness: 0.025, tessellation: 64 },
    scene,
  );
  halo.position.y = 0.13;
  const haloMat = new StandardMaterial("halo-mat", scene);
  haloMat.diffuseColor = new Color3(0.78, 0.66, 0.34);
  haloMat.emissiveColor = new Color3(0.6, 0.45, 0.18);
  halo.material = haloMat;

  // Avatar — front-facing the camera (camera is at +Z, avatar faces +Z, perfect)
  const avatar = buildPlaceholderAvatar(scene);
  avatar.root.position.y = 0.13;

  const morphController = new MorphController();
  morphController.attach(avatar);
  morphController.apply(useCreator.getState().sliders);

  const unsub = useCreator.subscribe((s) => morphController.apply(s.sliders));

  // Slow turntable — small range so face stays visible most of the time
  const turntable = new Animation(
    "turntable",
    "rotation.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  turntable.setKeys([
    { frame: 0,    value: -0.35 },
    { frame: 240,  value:  0.35 },
    { frame: 480,  value: -0.35 },
  ]);
  avatar.root.animations.push(turntable);
  scene.beginAnimation(avatar.root, 0, 480, true, 0.4);

  const glow = new GlowLayer("creator-glow", scene);
  glow.intensity = 0.4;

  applyCelShade(scene, camera);

  const setLightPreset = (preset: LightPreset) => {
    switch (preset) {
      case "sunset":
        scene.fogColor = new Color3(0.18, 0.08, 0.1);
        scene.clearColor = new Color4(0.18, 0.08, 0.1, 1);
        key.diffuse = new Color3(1, 0.6, 0.35);
        key.intensity = 1.5;
        rim.diffuse = new Color3(0.7, 0.3, 0.5);
        ambient.diffuse = new Color3(0.6, 0.4, 0.5);
        break;
      case "dungeon":
        scene.fogColor = new Color3(0.04, 0.05, 0.08);
        scene.clearColor = new Color4(0.04, 0.05, 0.08, 1);
        key.diffuse = new Color3(0.6, 0.7, 1);
        key.intensity = 0.7;
        rim.diffuse = new Color3(0.3, 0.4, 0.7);
        ambient.diffuse = new Color3(0.3, 0.35, 0.55);
        break;
      case "town":
      default:
        scene.fogColor = new Color3(0.07, 0.05, 0.12);
        scene.clearColor = new Color4(0.05, 0.03, 0.09, 1);
        key.diffuse = new Color3(1, 0.9, 0.7);
        key.intensity = 1.2;
        rim.diffuse = new Color3(0.45, 0.7, 0.85);
        ambient.diffuse = new Color3(0.6, 0.55, 0.75);
        break;
    }
  };

  let expressionIdx = 0;
  const cycleExpression = () => {
    expressionIdx = (expressionIdx + 1) % 4;
    // Will plug into morph targets when real mesh lands
  };

  activeContext = {
    scene,
    avatar,
    morphController,
    setLightPreset,
    cycleExpression,
    dispose: () => {
      unsub();
      morphController.detach();
    },
  };

  scene.onDisposeObservable.add(() => {
    if (activeContext) activeContext.dispose();
    activeContext = null;
  });

  return scene;
}

export function getCreatorContext(): CharacterCreatorContext | null {
  return activeContext;
}
