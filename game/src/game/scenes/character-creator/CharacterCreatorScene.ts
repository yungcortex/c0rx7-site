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
  GlowLayer,
  TransformNode,
  Animation,
} from "@babylonjs/core";
import { applyCelShade } from "@game/shaders/celShade";
import { useCreator } from "@state/character";
import {
  buildBean,
  type Bean,
  type BeanLook,
} from "@game/systems/character/Bean";
import {
  hsvToRgbColor,
  paletteIndexToColor,
} from "@game/systems/character/colorMap";

export type LightPreset = "sunset" | "dungeon" | "town";

export interface CharacterCreatorContext {
  scene: Scene;
  bean: Bean | null;
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
  scene.fogDensity = 0.04;
  scene.fogColor = new Color3(0.07, 0.05, 0.12);

  const camera = new ArcRotateCamera(
    "creator-cam",
    Math.PI / 2,
    Math.PI / 2.2,
    4.0,
    new Vector3(0, 1.0, 0),
    scene,
  );
  camera.lowerRadiusLimit = 1.8;
  camera.upperRadiusLimit = 9;
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = Math.PI / 1.7;
  camera.minZ = 0.05;
  camera.fov = 0.85;
  camera.attachControl(_canvas, true);
  camera.panningSensibility = 0;
  camera.wheelPrecision = 35;
  camera.angularSensibilityX = 1500;
  camera.angularSensibilityY = 1500;

  // ---- Lights — bright friendly key + cool rim. Beans look best with strong
  // direct light + minimal ambient (keeps colours vivid).
  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0.2), scene);
  ambient.intensity = 0.75;
  ambient.diffuse = new Color3(0.9, 0.85, 0.95);
  ambient.groundColor = new Color3(0.18, 0.12, 0.24);

  const key = new DirectionalLight("key", new Vector3(-0.4, -0.6, -0.6), scene);
  key.intensity = 1.4;
  key.diffuse = new Color3(1, 0.95, 0.85);

  const rim = new DirectionalLight("rim", new Vector3(0.5, 0.1, 0.8), scene);
  rim.intensity = 0.6;
  rim.diffuse = new Color3(0.65, 0.85, 1.0);

  // ---- Plinth (platform the bean stands on)
  const plinthBase = MeshBuilder.CreateCylinder(
    "plinth-base",
    { diameterTop: 2.2, diameterBottom: 2.4, height: 0.2, tessellation: 32 },
    scene,
  );
  plinthBase.position.y = 0;
  const plinthMat = new StandardMaterial("plinth-mat", scene);
  plinthMat.diffuseColor = new Color3(0.16, 0.12, 0.24);
  plinthMat.specularColor = new Color3(0.05, 0.05, 0.05);
  plinthBase.material = plinthMat;

  const plinthMid = MeshBuilder.CreateCylinder(
    "plinth-mid",
    { diameterTop: 1.85, diameterBottom: 2.0, height: 0.1, tessellation: 32 },
    scene,
  );
  plinthMid.position.y = 0.15;
  const plinthMidMat = new StandardMaterial("plinth-mid-mat", scene);
  plinthMidMat.diffuseColor = new Color3(0.45, 0.35, 0.18);
  plinthMidMat.specularColor = new Color3(0.32, 0.25, 0.14);
  plinthMidMat.emissiveColor = new Color3(0.16, 0.12, 0.05);
  plinthMid.material = plinthMidMat;

  // Halo ring on the floor
  const halo = MeshBuilder.CreateTorus(
    "halo",
    { diameter: 2.6, thickness: 0.04, tessellation: 64 },
    scene,
  );
  halo.position.y = 0.21;
  const haloMat = new StandardMaterial("halo-mat", scene);
  haloMat.diffuseColor = new Color3(0.95, 0.78, 0.32);
  haloMat.emissiveColor = new Color3(0.85, 0.62, 0.22);
  halo.material = haloMat;

  // ---- BEAN (the character)
  const beanRoot = new TransformNode("bean-root", scene);
  beanRoot.position.y = 0.21; // sit on plinth top

  // Slow turntable (small sway so face stays visible)
  const turntable = new Animation(
    "turntable",
    "rotation.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  turntable.setKeys([
    { frame: 0,   value: -0.4 },
    { frame: 240, value:  0.4 },
    { frame: 480, value: -0.4 },
  ]);
  beanRoot.animations.push(turntable);
  scene.beginAnimation(beanRoot, 0, 480, true, 0.5);

  let bean: Bean | null = null;

  const refreshBean = () => {
    const s = useCreator.getState();
    const sliders = s.sliders;
    const skin = paletteIndexToColor(sliders.skin.paletteIndex);
    const hairStop = sliders.hair.gradient[0] ?? { h: 30, s: 80, v: 32 };
    const hair = hsvToRgbColor(hairStop.h, hairStop.s, hairStop.v);
    const eyeStop = sliders.eyes.leftHsv;
    const eyeColor = hsvToRgbColor(eyeStop.h, eyeStop.s, eyeStop.v);

    const cosmetic = s.cosmetic;
    const look: BeanLook = {
      heritage: sliders.heritage,
      bodyColor: skin,
      patternColor: hair,
      eyeColor,
      pattern: cosmetic?.pattern ?? "none",
      eyeStyle: cosmetic?.eyeStyle ?? "round",
      mouthStyle: cosmetic?.mouthStyle ?? "smile",
      hat: cosmetic?.hat ?? "none",
      outfit: cosmetic?.outfit ?? "none",
      accessory: cosmetic?.accessory ?? "none",
      proportions: {
        width: sliders.buildWeight / 255,
        height: sliders.height / 255,
        headSize: (sliders.faceBlendshapes[8] ?? 128) / 255,    // re-purpose face slider 8 as head size
        eyeSize: (sliders.faceBlendshapes[4] ?? 128) / 255,     // face slider 4 as eye size
        eyeSpacing: (sliders.faceBlendshapes[2] ?? 128) / 255,  // face slider 2 as eye spacing
        handSize: (sliders.bodyBlendshapes[3] ?? 128) / 255,    // body slider 3 as hand size
        footSize: (sliders.bodyBlendshapes[7] ?? 128) / 255,    // body slider 7 as foot size (calf)
        outline: sliders.muscle / 255,                          // muscle as outline thickness
      },
    };

    if (!bean) {
      bean = buildBean(scene, beanRoot, look);
    } else {
      // Heritage change requires rebuild (different proportions)
      const sameHeritage = bean.root.metadata?.heritage === look.heritage;
      if (!sameHeritage) {
        bean.dispose();
        bean = buildBean(scene, beanRoot, look);
      } else {
        bean.setLook(look);
        if (look.proportions) bean.setProportions(look.proportions);
      }
    }
    if (bean) bean.root.metadata = { heritage: look.heritage };
  };

  refreshBean();

  const unsub = useCreator.subscribe(() => refreshBean());

  const glow = new GlowLayer("creator-glow", scene);
  glow.intensity = 0.55;

  applyCelShade(scene, camera);

  const setLightPreset = (preset: LightPreset) => {
    switch (preset) {
      case "sunset":
        scene.fogColor = new Color3(0.22, 0.1, 0.12);
        scene.clearColor = new Color4(0.18, 0.08, 0.1, 1);
        key.diffuse = new Color3(1, 0.6, 0.35);
        key.intensity = 1.5;
        rim.diffuse = new Color3(0.7, 0.3, 0.5);
        ambient.diffuse = new Color3(0.85, 0.55, 0.65);
        break;
      case "dungeon":
        scene.fogColor = new Color3(0.04, 0.05, 0.08);
        scene.clearColor = new Color4(0.04, 0.05, 0.08, 1);
        key.diffuse = new Color3(0.6, 0.7, 1);
        key.intensity = 0.9;
        rim.diffuse = new Color3(0.3, 0.4, 0.7);
        ambient.diffuse = new Color3(0.45, 0.5, 0.7);
        break;
      case "town":
      default:
        scene.fogColor = new Color3(0.07, 0.05, 0.12);
        scene.clearColor = new Color4(0.05, 0.03, 0.09, 1);
        key.diffuse = new Color3(1, 0.95, 0.85);
        key.intensity = 1.4;
        rim.diffuse = new Color3(0.65, 0.85, 1.0);
        ambient.diffuse = new Color3(0.9, 0.85, 0.95);
        break;
    }
  };

  const cycleExpression = () => {
    // Cycle mouth styles via cosmetic store update — handled in UI
  };

  activeContext = {
    scene,
    bean,
    setLightPreset,
    cycleExpression,
    dispose: () => {
      unsub();
      bean?.dispose();
      activeContext = null;
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
