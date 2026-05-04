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
  Mesh,
  TransformNode,
  Animation,
  ParticleSystem,
  Texture,
  GlowLayer,
  Quaternion,
} from "@babylonjs/core";
import { applyCelShade } from "@game/shaders/celShade";
import {
  buildPlaceholderAvatar,
  MorphController,
} from "@game/systems/character/MorphController";
import {
  spawnNpc,
  findNearestNpc,
  type NpcInstance,
} from "@game/systems/npc/Npc";
import { HUB_NPCS } from "@game/systems/npc/hubNpcs";
import { PlayerController } from "@game/systems/movement/PlayerController";
import { useWorld, useChat } from "@state/world";
import { makeDefaultSliderState } from "@game/systems/character/SliderBlob";
import { startPresence, stopPresence } from "@game/systems/social/PresenceManager";

export interface HubContext {
  scene: Scene;
  controller: PlayerController;
  npcs: NpcInstance[];
  remoteAvatars: Map<string, ReturnType<typeof buildPlaceholderAvatar>>;
  dispose: () => void;
}

let activeHub: HubContext | null = null;

export function getHubContext(): HubContext | null {
  return activeHub;
}

export function buildHubHyrrScene(engine: Engine, canvas: HTMLCanvasElement): Scene {
  const scene = new Scene(engine);

  // ---- Sky / atmosphere
  scene.clearColor = new Color4(0.13, 0.07, 0.18, 1);
  scene.ambientColor = new Color3(0.4, 0.3, 0.5);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.015;
  scene.fogColor = new Color3(0.18, 0.1, 0.22);

  // ---- Camera (third-person orbit, locked to player)
  const camera = new ArcRotateCamera(
    "hub-cam",
    -Math.PI / 2,
    Math.PI / 2.5,
    6,
    new Vector3(0, 1.2, 0),
    scene,
  );
  camera.attachControl(canvas, true);
  camera.minZ = 0.1;
  camera.fov = 0.95;
  camera.wheelPrecision = 60;
  camera.panningSensibility = 0;
  camera.angularSensibilityX = 1500;
  camera.angularSensibilityY = 1500;

  // ---- Lights
  const sky = new HemisphericLight("sky", new Vector3(0, 1, 0.2), scene);
  sky.intensity = 0.55;
  sky.diffuse = new Color3(0.7, 0.55, 0.85);
  sky.groundColor = new Color3(0.18, 0.1, 0.22);

  const sunset = new DirectionalLight("sunset", new Vector3(-0.5, -0.4, -0.6), scene);
  sunset.intensity = 1.4;
  sunset.diffuse = new Color3(1, 0.65, 0.45);

  const rim = new DirectionalLight("rim", new Vector3(0.6, 0.3, 0.7), scene);
  rim.intensity = 0.5;
  rim.diffuse = new Color3(0.45, 0.7, 0.95);

  // ---- Ground (hex plaza)
  const plaza = MeshBuilder.CreateDisc("plaza", { radius: 26, tessellation: 6 }, scene);
  plaza.rotation.x = Math.PI / 2;
  plaza.position.y = -0.01;
  const plazaMat = new StandardMaterial("plaza-mat", scene);
  plazaMat.diffuseColor = new Color3(0.12, 0.08, 0.16);
  plazaMat.specularColor = new Color3(0.05, 0.05, 0.06);
  plaza.material = plazaMat;

  // Stone tiles — small darker discs as decoration
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const r = 8 + (i % 3) * 5;
    const tile = MeshBuilder.CreateDisc(
      `tile-${i}`,
      { radius: 1.2, tessellation: 6 },
      scene,
    );
    tile.rotation.x = Math.PI / 2;
    tile.position.x = Math.cos(angle) * r;
    tile.position.z = Math.sin(angle) * r;
    tile.position.y = 0.01;
    const m = new StandardMaterial(`tile-mat-${i}`, scene);
    m.diffuseColor = new Color3(0.16 + (i % 4) * 0.015, 0.1, 0.18);
    m.specularColor = new Color3(0, 0, 0);
    tile.material = m;
  }

  // ---- Resonance Spire (centerpiece)
  const spireRoot = new TransformNode("spire-root", scene);

  const spireBase = MeshBuilder.CreateCylinder(
    "spire-base",
    { diameterTop: 4, diameterBottom: 5, height: 1.2, tessellation: 24 },
    scene,
  );
  spireBase.parent = spireRoot;
  spireBase.position.y = 0.6;
  const baseMat = new StandardMaterial("spire-base-mat", scene);
  baseMat.diffuseColor = new Color3(0.18, 0.13, 0.22);
  baseMat.specularColor = new Color3(0.1, 0.1, 0.12);
  spireBase.material = baseMat;

  const spireShaft = MeshBuilder.CreateCylinder(
    "spire-shaft",
    { diameterTop: 0.6, diameterBottom: 2.2, height: 14, tessellation: 8 },
    scene,
  );
  spireShaft.parent = spireRoot;
  spireShaft.position.y = 8;
  const shaftMat = new StandardMaterial("spire-shaft-mat", scene);
  shaftMat.diffuseColor = new Color3(0.32, 0.22, 0.36);
  shaftMat.specularColor = new Color3(0.15, 0.12, 0.18);
  spireShaft.material = shaftMat;

  // 3 gold rings around the shaft
  for (let i = 0; i < 3; i++) {
    const ring = MeshBuilder.CreateTorus(
      `spire-ring-${i}`,
      { diameter: 2.6 - i * 0.4, thickness: 0.18, tessellation: 24 },
      scene,
    );
    ring.parent = spireRoot;
    ring.position.y = 4 + i * 3.5;
    const ringMat = new StandardMaterial(`spire-ring-mat-${i}`, scene);
    ringMat.diffuseColor = new Color3(0.78, 0.66, 0.34);
    ringMat.emissiveColor = new Color3(0.32, 0.24, 0.1);
    ringMat.specularColor = new Color3(1, 0.9, 0.5);
    ring.material = ringMat;

    // Slow counter-rotation
    const spin = new Animation(
      `spire-ring-spin-${i}`,
      "rotation.y",
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    const dir = i % 2 === 0 ? 1 : -1;
    spin.setKeys([
      { frame: 0, value: 0 },
      { frame: 1200, value: Math.PI * 2 * dir },
    ]);
    ring.animations.push(spin);
    scene.beginAnimation(ring, 0, 1200, true, 0.3);
  }

  // Crystal at the top
  const spireCap = MeshBuilder.CreatePolyhedron(
    "spire-cap",
    { type: 1, size: 0.7 },
    scene,
  );
  spireCap.parent = spireRoot;
  spireCap.position.y = 15.5;
  const capMat = new StandardMaterial("spire-cap-mat", scene);
  capMat.diffuseColor = new Color3(0.95, 0.82, 0.45);
  capMat.emissiveColor = new Color3(0.6, 0.45, 0.2);
  capMat.specularColor = new Color3(1, 0.9, 0.5);
  spireCap.material = capMat;

  const capSpin = new Animation(
    "spire-cap-spin",
    "rotation.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  capSpin.setKeys([
    { frame: 0, value: 0 },
    { frame: 600, value: Math.PI * 2 },
  ]);
  spireCap.animations.push(capSpin);
  scene.beginAnimation(spireCap, 0, 600, true, 0.4);

  // ---- Buildings (6 around the plaza)
  const buildingPalette: Color3[] = [
    new Color3(0.32, 0.22, 0.32), // crown
    new Color3(0.42, 0.26, 0.18), // brass throat
    new Color3(0.18, 0.22, 0.32), // lowering
    new Color3(0.28, 0.32, 0.22), // pale garden
    new Color3(0.32, 0.18, 0.22), // coil
    new Color3(0.16, 0.16, 0.22), // hollow vespers
  ];

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const cx = Math.cos(angle) * 22;
    const cz = Math.sin(angle) * 22;
    buildBuilding(scene, cx, cz, angle + Math.PI, buildingPalette[i]!);
  }

  // ---- Brass steam pipes overhead (segmented torus arc)
  for (let i = 0; i < 3; i++) {
    const arc = MeshBuilder.CreateTorus(
      `pipe-arc-${i}`,
      { diameter: 30 + i * 4, thickness: 0.18, tessellation: 32 },
      scene,
    );
    arc.position.y = 8 + i * 1.5;
    arc.rotation.x = Math.PI / 2 + 0.1 * (i - 1);
    const pipeMat = new StandardMaterial(`pipe-mat-${i}`, scene);
    pipeMat.diffuseColor = new Color3(0.55, 0.4, 0.22);
    pipeMat.specularColor = new Color3(0.6, 0.45, 0.25);
    pipeMat.emissiveColor = new Color3(0.05, 0.03, 0.02);
    arc.material = pipeMat;
  }

  // ---- Lanterns
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = 14;
    buildLantern(scene, Math.cos(angle) * r, Math.sin(angle) * r);
  }

  // ---- Ambient particle motes
  const motes = new ParticleSystem("motes", 200, scene);
  motes.particleTexture = createSpriteTexture(scene, "rgba(232, 200, 120, 1)");
  motes.emitter = new Vector3(0, 4, 0);
  motes.minEmitBox = new Vector3(-25, 0, -25);
  motes.maxEmitBox = new Vector3(25, 8, 25);
  motes.color1 = new Color4(0.95, 0.78, 0.4, 0.6);
  motes.color2 = new Color4(0.85, 0.45, 0.7, 0.4);
  motes.colorDead = new Color4(0.5, 0.3, 0.6, 0);
  motes.minSize = 0.04;
  motes.maxSize = 0.12;
  motes.minLifeTime = 5;
  motes.maxLifeTime = 12;
  motes.emitRate = 30;
  motes.gravity = new Vector3(0, 0.05, 0);
  motes.direction1 = new Vector3(-0.1, 0.2, -0.1);
  motes.direction2 = new Vector3(0.1, 0.5, 0.1);
  motes.start();

  // ---- Player avatar
  const playerAvatar = buildPlaceholderAvatar(scene);
  const playerMorph = new MorphController();
  playerMorph.attach(playerAvatar);
  const sliders =
    useWorld.getState().activeCharacter?.sliders ?? makeDefaultSliderState("hjari");
  playerMorph.apply(sliders);
  playerAvatar.root.position = new Vector3(0, 0, 12);
  playerAvatar.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(Math.PI, 0, 0);

  // ---- NPCs
  const npcs: NpcInstance[] = HUB_NPCS.map((def) => spawnNpc(scene, def));

  // ---- Remote players (other connected wakers)
  const remoteAvatars = new Map<string, ReturnType<typeof buildPlaceholderAvatar>>();
  startPresence(scene);

  // ---- Player controller
  const controller = new PlayerController({
    scene,
    root: playerAvatar.root,
    camera,
    onMove: (pos, rot) => {
      // World presence broadcast — wired up in PresenceManager
      window.dispatchEvent(
        new CustomEvent("aetherwake:player-move", {
          detail: { x: pos.x, y: pos.y, z: pos.z, r: rot },
        }),
      );
    },
    onInteract: () => {
      const nearest = findNearestNpc(npcs, playerAvatar.root.position);
      if (nearest?.onInteract) nearest.onInteract(nearest);
    },
  });

  // Welcome message
  setTimeout(() => {
    useChat.getState().push({
      channel: "system",
      author: "",
      body: "Welcome to Hyrr Central. Use WASD to walk, Shift to run, Space to jump, E to talk to NPCs, Enter to chat.",
    });
  }, 600);

  const glow = new GlowLayer("hub-glow", scene);
  glow.intensity = 0.6;

  applyCelShade(scene, camera);

  activeHub = {
    scene,
    controller,
    npcs,
    remoteAvatars,
    dispose: () => {
      controller.dispose();
      playerMorph.detach();
      stopPresence();
      activeHub = null;
    },
  };

  scene.onDisposeObservable.add(() => {
    if (activeHub) activeHub.dispose();
    activeHub = null;
  });

  return scene;
}

function buildBuilding(
  scene: Scene,
  x: number,
  z: number,
  facing: number,
  baseColor: Color3,
) {
  const root = new TransformNode(`bld-${x}-${z}`, scene);
  root.position.set(x, 0, z);
  root.rotation.y = facing;

  const body: Mesh = MeshBuilder.CreateBox(
    "bld-body",
    { width: 6, height: 7, depth: 5 },
    scene,
  );
  body.parent = root;
  body.position.y = 3.5;
  const bodyMat = new StandardMaterial("bld-body-mat", scene);
  bodyMat.diffuseColor = baseColor;
  bodyMat.specularColor = new Color3(0.05, 0.05, 0.05);
  body.material = bodyMat;

  const roof: Mesh = MeshBuilder.CreateCylinder(
    "bld-roof",
    { diameterTop: 0.1, diameterBottom: 7.5, height: 3, tessellation: 4 },
    scene,
  );
  roof.parent = root;
  roof.position.y = 8.5;
  roof.rotation.y = Math.PI / 4;
  const roofMat = new StandardMaterial("bld-roof-mat", scene);
  roofMat.diffuseColor = baseColor.scale(0.6);
  roofMat.specularColor = new Color3(0.05, 0.05, 0.05);
  roof.material = roofMat;

  // Door
  const door = MeshBuilder.CreateBox(
    "bld-door",
    { width: 1.2, height: 2.4, depth: 0.1 },
    scene,
  );
  door.parent = root;
  door.position.set(0, 1.2, 2.55);
  const doorMat = new StandardMaterial("bld-door-mat", scene);
  doorMat.diffuseColor = new Color3(0.78, 0.66, 0.34);
  doorMat.emissiveColor = new Color3(0.18, 0.13, 0.04);
  door.material = doorMat;

  // Window panes (lit)
  for (let i = 0; i < 2; i++) {
    const win = MeshBuilder.CreatePlane(
      "bld-win",
      { width: 0.7, height: 1 },
      scene,
    );
    win.parent = root;
    win.position.set(-1.7 + i * 3.4, 4.3, 2.51);
    const winMat = new StandardMaterial("bld-win-mat", scene);
    winMat.diffuseColor = new Color3(0.9, 0.65, 0.3);
    winMat.emissiveColor = new Color3(0.65, 0.4, 0.15);
    winMat.specularColor = new Color3(0, 0, 0);
    win.material = winMat;
  }
}

function buildLantern(scene: Scene, x: number, z: number) {
  const post = MeshBuilder.CreateCylinder(
    "lantern-post",
    { diameter: 0.12, height: 2.6, tessellation: 8 },
    scene,
  );
  post.position.set(x, 1.3, z);
  const postMat = new StandardMaterial("lantern-post-mat", scene);
  postMat.diffuseColor = new Color3(0.18, 0.14, 0.22);
  postMat.specularColor = new Color3(0.05, 0.05, 0.05);
  post.material = postMat;

  const bulb = MeshBuilder.CreateSphere("lantern-bulb", { diameter: 0.45 }, scene);
  bulb.position.set(x, 2.7, z);
  const bulbMat = new StandardMaterial("lantern-bulb-mat", scene);
  bulbMat.diffuseColor = new Color3(0.95, 0.7, 0.35);
  bulbMat.emissiveColor = new Color3(0.85, 0.55, 0.25);
  bulbMat.specularColor = new Color3(0, 0, 0);
  bulb.material = bulbMat;
}

function createSpriteTexture(scene: Scene, color: string): Texture {
  const size = 32;
  const cnv = document.createElement("canvas");
  cnv.width = size;
  cnv.height = size;
  const ctx = cnv.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.6, color.replace(/, 1\)/, ", 0.6)").replace(/, 0.4\)/, ", 0.4)"));
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new Texture(cnv.toDataURL(), scene);
  tex.hasAlpha = true;
  return tex;
}
