/**
 * Bean Royale match server. Authoritative tick at 30Hz. Players send
 * inputs (wasd, jump, dive) → server simulates → broadcasts state. The
 * server is the source of truth for collisions + match outcome — clients
 * never declare "I bonked you," they ask the server to.
 *
 * Run locally:
 *   cd game/server && npm install && npm run dev
 *
 * Deploy: see fly.toml + Dockerfile (Fly.io).
 */
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import http from "http";
import { BonkRoom } from "./rooms/BonkRoom";

const PORT = Number(process.env.PORT) || 2567;

const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

gameServer.define("bonk", BonkRoom);

server.listen(PORT, () => {
  console.log(`[bean-royale-server] listening on :${PORT}`);
});
