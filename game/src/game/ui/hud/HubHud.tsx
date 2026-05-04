import { useEffect } from "react";
import { useAuth } from "@state/auth";
import { useWorld } from "@state/world";
import { ChatOverlay } from "@ui/hud/ChatOverlay";
import { DialogueOverlay } from "@ui/hud/DialogueOverlay";
import { InteractPrompt } from "@ui/hud/InteractPrompt";
import { joinHubChannel, leaveHubChannel } from "@game/systems/chat/chatBus";

export function HubHud() {
  const user = useAuth((s) => s.user);
  const activeCharacter = useWorld((s) => s.activeCharacter);
  const remotePlayers = useWorld((s) => s.remotePlayers);

  useEffect(() => {
    if (!user || !activeCharacter) return;
    joinHubChannel(user.id, activeCharacter.name);
    return () => leaveHubChannel();
  }, [user, activeCharacter]);

  return (
    <>
      <header className="hub-top">
        <div className="hub-zone">
          <span className="zone-label">Hyrr Central</span>
          <span className="zone-sub">{activeCharacter?.name ?? "—"}</span>
        </div>
        <div className="hub-roster">
          <span className="roster-count">{remotePlayers.size + 1}</span>
          <span className="roster-label">in zone</span>
        </div>
      </header>
      <ChatOverlay />
      <InteractPrompt />
      <DialogueOverlay />
    </>
  );
}
