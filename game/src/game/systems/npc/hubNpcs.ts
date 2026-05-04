import { useDialogue } from "@state/world";
import { makeNpcSliders, type NpcDefinition } from "@game/systems/npc/Npc";

/**
 * Hub city NPCs. Four named figures of the early MSQ.
 * Positions are in plaza coords; the plaza is centered at (0, 0, 0) with the
 * Resonance Spire at center, and ranges roughly r=24.
 */
export const HUB_NPCS: NpcDefinition[] = [
  {
    id: "marin",
    name: "Marin",
    title: "Choir Scout",
    position: [4, 0, 6],
    facing: -Math.PI * 0.6,
    sliders: makeNpcSliders({
      heritage: "hjari",
      bodyType: 200,
      muscle: 90,
      height: 110,
      buildWeight: 100,
      hairHsv: { h: 18, s: 220, v: 90 },
      skinPalette: 4,
      eyesHsv: { h: 60, s: 180, v: 200 },
      eyeGlow: 90,
    }),
    onInteract: () => {
      useDialogue.getState().open([
        {
          speaker: "Marin",
          body: "You're new. Standing too easily for someone who just woke from a Vespers, blade.",
        },
        {
          speaker: "Marin",
          body: "The Choir's archives are at the Crown — that way. Ask for Cadence. Tell her I sent you.",
        },
        {
          speaker: "Marin",
          body: "And listen — when the bell rings early, do not, under any circumstance, run toward it.",
        },
      ]);
    },
  },
  {
    id: "cadence",
    name: "Cadence",
    title: "Archivist of the Choir",
    position: [-7, 0, 4],
    facing: Math.PI * 0.4,
    sliders: makeNpcSliders({
      heritage: "sivit",
      bodyType: 192,
      muscle: 60,
      height: 200,
      buildWeight: 110,
      hairHsv: { h: 200, s: 50, v: 220 },
      skinPalette: 11,
      eyesHsv: { h: 30, s: 100, v: 240 },
      eyeGlow: 60,
    }),
    onInteract: () => {
      useDialogue.getState().open([
        {
          speaker: "Cadence",
          body: "Another one who remembers. We'll need to write you down before the next ringing.",
        },
        {
          speaker: "Cadence",
          body: "Don't worry — I write in stone, in salt, and in three places. The city won't lose you while I'm here.",
        },
        {
          speaker: "Cadence",
          body: "What did you carry, when you woke? An edge? A song? An oath? It matters to me.",
        },
      ]);
    },
  },
  {
    id: "hraedin",
    name: "Hraedin",
    title: "Captain of the Watch",
    position: [8, 0, -5],
    facing: Math.PI * 1.1,
    sliders: makeNpcSliders({
      heritage: "vellish",
      bodyType: 60,
      muscle: 200,
      height: 180,
      buildWeight: 180,
      hairHsv: { h: 20, s: 150, v: 50 },
      skinPalette: 13,
      eyesHsv: { h: 40, s: 220, v: 230 },
      eyeGlow: 70,
    }),
    onInteract: () => {
      useDialogue.getState().open([
        {
          speaker: "Hraedin",
          body: "Don't get comfortable. The Choir trusts you because you're new. I won't make that mistake.",
        },
        {
          speaker: "Hraedin",
          body: "If you want a useful errand, the Brass Throat smith — Dagan — is hiding something. Find out what.",
        },
        {
          speaker: "Hraedin",
          body: "Off the record. The Prior doesn't need to know yet.",
        },
      ]);
    },
  },
  {
    id: "dagan",
    name: "Dagan",
    title: "Aspect-Smith",
    position: [-4, 0, -8],
    facing: Math.PI * 0.2,
    sliders: makeNpcSliders({
      heritage: "korr",
      bodyType: 90,
      muscle: 230,
      height: 150,
      buildWeight: 230,
      hairHsv: { h: 10, s: 30, v: 30 },
      skinPalette: 6,
      eyesHsv: { h: 25, s: 220, v: 200 },
      eyeGlow: 50,
    }),
    onInteract: () => {
      useDialogue.getState().open([
        {
          speaker: "Dagan",
          body: "Mm. New one. Show me your hands.",
        },
        {
          speaker: "Dagan",
          body: "Yes. Smith's calluses, or fighter's. Either works. I can bind you a second Aspect when you're ready.",
        },
        {
          speaker: "Dagan",
          body: "And if anyone tells you the Quiet Hand is a heretic faction, ask them how they'd know.",
        },
      ]);
    },
  },
];
