import {
  Scene,
  TransformNode,
  Vector3,
  Animation,
  StandardMaterial,
  Color3,
  MeshBuilder,
  DynamicTexture,
} from "@babylonjs/core";
import {
  buildPlaceholderAvatar,
  MorphController,
  type CharacterAvatar,
} from "@game/systems/character/MorphController";
import {
  makeDefaultSliderState,
  type SliderState,
} from "@game/systems/character/SliderBlob";

export interface NpcDefinition {
  id: string;
  name: string;
  title?: string;
  position: [number, number, number];
  facing?: number;
  sliders: SliderState;
  interactionRange?: number;
  onInteract?: (npc: NpcInstance) => void;
}

export interface NpcInstance {
  id: string;
  name: string;
  title?: string;
  root: TransformNode;
  avatar: CharacterAvatar;
  morph: MorphController;
  position: Vector3;
  interactionRange: number;
  namePlate: TransformNode;
  onInteract?: (npc: NpcInstance) => void;
}

export function spawnNpc(scene: Scene, def: NpcDefinition): NpcInstance {
  const avatar = buildPlaceholderAvatar(scene);
  const morph = new MorphController();
  morph.attach(avatar);
  morph.apply(def.sliders);

  avatar.root.name = `npc-${def.id}`;
  avatar.root.position = new Vector3(def.position[0], def.position[1], def.position[2]);
  avatar.root.rotation.y = def.facing ?? 0;

  // Idle bob
  const bob = new Animation(
    `npc-bob-${def.id}`,
    "position.y",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  const baseY = avatar.root.position.y;
  bob.setKeys([
    { frame: 0, value: baseY },
    { frame: 60, value: baseY + 0.05 },
    { frame: 120, value: baseY },
  ]);
  avatar.root.animations.push(bob);
  scene.beginAnimation(avatar.root, 0, 120, true, 0.5 + Math.random() * 0.3);

  // Name plate (textured plane that always faces camera)
  const namePlate = buildNamePlate(scene, def.name, def.title);
  namePlate.parent = avatar.root;
  namePlate.position.y = 2.4;

  return {
    id: def.id,
    name: def.name,
    title: def.title,
    root: avatar.root,
    avatar,
    morph,
    position: avatar.root.position,
    interactionRange: def.interactionRange ?? 3.5,
    namePlate,
    onInteract: def.onInteract,
  };
}

function buildNamePlate(scene: Scene, name: string, title?: string): TransformNode {
  const root = new TransformNode("nameplate", scene);
  const plate = MeshBuilder.CreatePlane("nameplate-plane", { width: 2.4, height: 0.7 }, scene);
  plate.parent = root;
  plate.billboardMode = 7; // BILLBOARDMODE_ALL

  const tex = new DynamicTexture(
    "nameplate-tex",
    { width: 480, height: 140 },
    scene,
    false,
  );
  tex.hasAlpha = true;
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 480, 140);
  ctx.font = "600 38px Cormorant Garamond, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(7,4,13,0.65)";
  ctx.fillRect(0, 30, 480, 80);
  ctx.fillStyle = "#e8c878";
  ctx.fillText(name, 240, title ? 60 : 70);
  if (title) {
    ctx.font = "400 22px Inter, sans-serif";
    ctx.fillStyle = "#d8cdb1";
    ctx.fillText(title, 240, 100);
  }
  tex.update();

  const mat = new StandardMaterial("nameplate-mat", scene);
  mat.diffuseTexture = tex;
  mat.opacityTexture = tex;
  mat.emissiveColor = new Color3(1, 1, 1);
  mat.specularColor = new Color3(0, 0, 0);
  mat.disableLighting = true;
  plate.material = mat;
  plate.isPickable = false;
  return root;
}

export function findNearestNpc(npcs: NpcInstance[], pos: Vector3): NpcInstance | null {
  let nearest: NpcInstance | null = null;
  let bestDist = Infinity;
  for (const n of npcs) {
    const d = Vector3.Distance(pos, n.position);
    if (d < n.interactionRange && d < bestDist) {
      bestDist = d;
      nearest = n;
    }
  }
  return nearest;
}

export function makeNpcSliders(opts: {
  heritage?: SliderState["heritage"];
  bodyType?: number;
  muscle?: number;
  height?: number;
  buildWeight?: number;
  hairHsv?: { h: number; s: number; v: number };
  skinPalette?: number;
  eyesHsv?: { h: number; s: number; v: number };
  eyeGlow?: number;
}): SliderState {
  const s = makeDefaultSliderState(opts.heritage ?? "hjari");
  if (opts.bodyType !== undefined) s.bodyType = opts.bodyType;
  if (opts.muscle !== undefined) s.muscle = opts.muscle;
  if (opts.height !== undefined) s.height = opts.height;
  if (opts.buildWeight !== undefined) s.buildWeight = opts.buildWeight;
  if (opts.hairHsv) s.hair.gradient[0] = opts.hairHsv;
  if (opts.skinPalette !== undefined) s.skin.paletteIndex = opts.skinPalette;
  if (opts.eyesHsv) {
    s.eyes.leftHsv = { ...opts.eyesHsv };
    s.eyes.rightHsv = { ...opts.eyesHsv };
  }
  if (opts.eyeGlow !== undefined) s.eyes.glow = opts.eyeGlow;
  return s;
}
