import { useEffect, useState } from "react";
import { useScene } from "@state/scene";
import { useDialogue } from "@state/world";
import { getHubContext } from "@game/scenes/hub-hyrr/HubHyrrScene";
import { findNearestNpc, type NpcInstance } from "@game/systems/npc/Npc";

export function InteractPrompt() {
  const sceneId = useScene((s) => s.current);
  const dialogueOpen = useDialogue((s) => !!s.active);
  const [nearby, setNearby] = useState<NpcInstance | null>(null);

  useEffect(() => {
    if (sceneId !== "hub" || dialogueOpen) {
      setNearby(null);
      return;
    }
    const id = window.setInterval(() => {
      const ctx = getHubContext();
      if (!ctx) return setNearby(null);
      const player = ctx.controller;
      // Player root is camera's lockedTarget
      const root = (player as any).root ?? null;
      const pos = root?.position ?? null;
      if (!pos) return setNearby(null);
      const npc = findNearestNpc(ctx.npcs, pos);
      setNearby(npc);
    }, 150);
    return () => window.clearInterval(id);
  }, [sceneId, dialogueOpen]);

  if (sceneId !== "hub" || !nearby || dialogueOpen) return null;

  return (
    <div className="interact-prompt">
      <span className="interact-key">E</span>
      <span className="interact-label">
        Speak with <strong>{nearby.name}</strong>
        {nearby.title && <span className="interact-title">— {nearby.title}</span>}
      </span>
    </div>
  );
}
