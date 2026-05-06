import { supabase } from "@net/supabase";
import { useChat, useWorld, type ChatLine } from "@state/world";
import type { RealtimeChannel } from "@supabase/supabase-js";

let channel: RealtimeChannel | null = null;
let userId: string | null = null;
let userName: string | null = null;

export function joinHubChannel(uid: string, displayName: string) {
  if (!supabase || channel) return;
  userId = uid;
  userName = displayName;

  channel = supabase.channel("hyrr-central", {
    config: { presence: { key: uid } },
  });

  channel
    .on("broadcast", { event: "say" }, ({ payload }) => {
      const p = payload as ChatBroadcast;
      if (p.user_id === userId) return;
      // Proximity filter: 30m
      const local = useWorld.getState();
      const remote = local.remotePlayers.get(p.user_id);
      if (remote) {
        const dx = remote.position.x - (local.activeCharacter?.position?.x ?? 0);
        const dz = remote.position.z - (local.activeCharacter?.position?.z ?? 0);
        if (Math.hypot(dx, dz) > 30) return;
      }
      useChat.getState().push({ channel: "say", author: p.author, body: p.body });
    })
    .on("broadcast", { event: "shout" }, ({ payload }) => {
      const p = payload as ChatBroadcast;
      if (p.user_id === userId) return;
      useChat.getState().push({ channel: "shout", author: p.author, body: p.body });
    })
    .on("broadcast", { event: "presence_position" }, ({ payload }) => {
      const p = payload as PresenceBroadcast;
      if (p.user_id === userId) return;
      useWorld.getState().upsertRemote({
        user_id: p.user_id,
        name: p.name,
        heritage: p.heritage,
        active_aspect: p.active_aspect,
        position: p.position,
        last_seen: Date.now(),
      });
    })
    .on("presence", { event: "sync" }, () => {
      // No-op for now; we use position broadcasts as the heartbeat
    })
    .on("presence", { event: "leave" }, ({ key }) => {
      useWorld.getState().removeRemote(key as string);
    });

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel?.track({ name: displayName, joined_at: Date.now() });
    }
  });

  // Listen to player movement events from PlayerController
  window.addEventListener("aetherwake:player-move", onPlayerMove as EventListener);
}

export function leaveHubChannel() {
  if (channel) {
    channel.untrack();
    channel.unsubscribe();
    supabase?.removeChannel(channel);
    channel = null;
  }
  window.removeEventListener("aetherwake:player-move", onPlayerMove as EventListener);
  userId = null;
  userName = null;
  useWorld.getState().clearRemotes();
}

function onPlayerMove(e: Event) {
  if (!channel || !userId || !userName) return;
  const detail = (e as CustomEvent).detail as { x: number; y: number; z: number; r: number };
  const c = useWorld.getState().activeCharacter;
  channel.send({
    type: "broadcast",
    event: "presence_position",
    payload: {
      user_id: userId,
      name: userName,
      heritage: c?.heritage ?? "hjari",
      active_aspect: c?.active_aspect ?? "tempest",
      position: detail,
    },
  });
}

export async function sendSay(body: string) {
  if (!channel || !userId || !userName) {
    useChat.getState().push({
      channel: "system",
      author: "",
      body: "Realtime chat is offline. Sign in to /say in Hyrr.",
    });
    return;
  }
  // Show local immediately
  useChat.getState().push({ channel: "say", author: userName, body });
  await channel.send({
    type: "broadcast",
    event: "say",
    payload: { user_id: userId, author: userName, body },
  });
}

export async function sendShout(body: string) {
  if (!channel || !userId || !userName) return;
  useChat.getState().push({ channel: "shout", author: userName, body });
  await channel.send({
    type: "broadcast",
    event: "shout",
    payload: { user_id: userId, author: userName, body },
  });
}

export async function sendWorld(body: string) {
  if (!supabase || !userId || !userName) return;
  const { error } = await supabase.from("chat_messages").insert({
    channel: "world",
    author_id: userId,
    author_name: userName,
    body,
  });
  if (error) {
    useChat.getState().push({
      channel: "system",
      author: "",
      body: `World chat failed: ${error.message}`,
    });
  } else {
    useChat.getState().push({ channel: "world", author: userName, body });
  }
}

export function dispatchSlash(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/say ")) {
    sendSay(trimmed.slice(5).trim());
    return true;
  }
  if (trimmed.startsWith("/shout ") || trimmed.startsWith("/y ")) {
    sendShout(trimmed.slice(trimmed.indexOf(" ") + 1).trim());
    return true;
  }
  if (trimmed.startsWith("/world ") || trimmed.startsWith("/w ")) {
    sendWorld(trimmed.slice(trimmed.indexOf(" ") + 1).trim());
    return true;
  }
  // Default = say
  sendSay(trimmed);
  return true;
}

interface ChatBroadcast {
  user_id: string;
  author: string;
  body: string;
}

interface PresenceBroadcast {
  user_id: string;
  name: string;
  heritage: string;
  active_aspect: string;
  position: { x: number; y: number; z: number; r: number };
}

export type { ChatLine };
