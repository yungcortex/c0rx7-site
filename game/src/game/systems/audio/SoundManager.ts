/**
 * Lightweight WebAudio-based sound effects. We synthesize cute bloops via
 * OscillatorNode rather than shipping audio files — every SFX is procedural
 * and < 1ms to generate. Master volume on a single GainNode for easy mute.
 *
 * SFX vocabulary:
 *   jump   — quick rising sine bloop
 *   land   — short percussive thud (filtered noise)
 *   dive   — descending sweep + light noise
 *   bonk   — punchy noise + low pitch hit
 *   ko     — descending sad-trumpet portamento
 *   win    — three-note cheer
 *   click  — UI tap
 *
 * Lazy-init the AudioContext on first use to satisfy autoplay rules.
 */

type SfxId = "jump" | "land" | "dive" | "bonk" | "ko" | "win" | "click";

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.6;
  }

  isMuted() {
    return this.muted;
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  play(id: SfxId) {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    switch (id) {
      case "jump": return this.bloop(ctx, 660, 880, 0.12, "sine");
      case "land": return this.thud(ctx, 80, 0.1);
      case "dive": return this.bloop(ctx, 720, 320, 0.18, "triangle");
      case "bonk": return this.bonk(ctx);
      case "ko": return this.koTrumpet(ctx);
      case "win": return this.fanfare(ctx);
      case "click": return this.bloop(ctx, 1200, 1400, 0.05, "square");
    }
  }

  private bloop(
    ctx: AudioContext,
    fromHz: number,
    toHz: number,
    durSec: number,
    wave: OscillatorType = "sine",
  ) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(fromHz, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, toHz), ctx.currentTime + durSec);
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durSec);
    osc.connect(env).connect(this.master!);
    osc.start();
    osc.stop(ctx.currentTime + durSec + 0.05);
  }

  private thud(ctx: AudioContext, hz: number, durSec: number) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(hz, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + durSec);
    env.gain.setValueAtTime(0.6, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durSec);
    osc.connect(env).connect(this.master!);
    osc.start();
    osc.stop(ctx.currentTime + durSec + 0.02);
  }

  private bonk(ctx: AudioContext) {
    // Punchy short noise burst + bass hit
    const noise = this.makeNoise(ctx, 0.05);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.18);
    env.gain.setValueAtTime(0.55, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(env).connect(this.master!);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    noise.connect(this.master!);
  }

  private koTrumpet(ctx: AudioContext) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.6);
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(env).connect(this.master!);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  }

  private fanfare(ctx: AudioContext) {
    // Three quick rising notes
    const notes = [523, 659, 784]; // C, E, G
    notes.forEach((hz, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      const start = ctx.currentTime + i * 0.13;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(hz, start);
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(0.45, start + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(env).connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  private makeNoise(ctx: AudioContext, durSec: number): GainNode {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * durSec, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.5, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durSec);
    src.connect(env);
    src.start();
    src.stop(ctx.currentTime + durSec + 0.02);
    return env;
  }
}

export const sound = new SoundManager();

export function playSfx(id: Parameters<SoundManager["play"]>[0]) {
  sound.play(id);
}
