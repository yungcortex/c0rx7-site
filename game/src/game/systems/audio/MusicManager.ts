/**
 * Procedural ambient music. Three loops — title, lobby, match — built from
 * layered OscillatorNode pads + a soft arpeggio. Switching loops fades the
 * previous one out over ~1s and starts the next.
 *
 * No external audio files. Synthesizing in WebAudio gives us a 0KB cost and
 * a forever-loop with zero seams.
 */

type LoopId = "title" | "lobby" | "match" | "off";

class MusicManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private current: LoopId = "off";
  private nodes: AudioNode[] = [];
  private muted = false;
  private targetVol = 0.18;

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.targetVol;
  }

  isMuted() { return this.muted; }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.targetVol;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  play(loop: LoopId) {
    if (loop === this.current) return;
    this.stop();
    this.current = loop;
    if (loop === "off") return;
    const ctx = this.ensureCtx();
    if (loop === "title") this.buildTitle(ctx);
    else if (loop === "lobby") this.buildLobby(ctx);
    else if (loop === "match") this.buildMatch(ctx);
  }

  stop() {
    for (const n of this.nodes) {
      try { (n as OscillatorNode).stop?.(); } catch { /* ignore */ }
      try { n.disconnect(); } catch { /* ignore */ }
    }
    this.nodes = [];
  }

  // -------- TITLE: dreamy slow pad in C minor (Cmin7 → Fmin7 → Abmaj7 → Gmin7) ----------
  private buildTitle(ctx: AudioContext) {
    const chordHz = [
      [261.63, 311.13, 392.00, 466.16],
      [349.23, 415.30, 523.25, 622.25],
      [415.30, 523.25, 622.25, 783.99],
      [392.00, 466.16, 587.33, 698.46],
    ];
    this.scheduleChordLoop(ctx, chordHz, 4.5, "sine");
  }

  // -------- LOBBY: bouncy chiptune in C major (CMaj → FMaj → GMaj → CMaj) ----------
  private buildLobby(ctx: AudioContext) {
    const chordHz = [
      [261.63, 329.63, 392.00],
      [349.23, 440.00, 523.25],
      [392.00, 493.88, 587.33],
      [261.63, 329.63, 392.00],
    ];
    this.scheduleChordLoop(ctx, chordHz, 2.0, "triangle");
    // Add an arpeggio on top
    this.scheduleArpeggio(ctx, [261.63, 329.63, 392.00, 523.25], 0.2, "square");
  }

  // -------- MATCH: tense in D minor with a drum-like bass pulse ----------
  private buildMatch(ctx: AudioContext) {
    const chordHz = [
      [293.66, 349.23, 440.00],
      [261.63, 311.13, 392.00],
      [220.00, 261.63, 329.63],
      [246.94, 311.13, 392.00],
    ];
    this.scheduleChordLoop(ctx, chordHz, 1.6, "sawtooth");
    this.schedulePulse(ctx, 0.4); // pulse every 0.4s
  }

  // -------- HELPERS --------

  /**
   * Schedule a looping chord progression. Each chord plays for `holdSec`,
   * envelope crossfades chords for smoothness.
   */
  private scheduleChordLoop(
    ctx: AudioContext,
    progression: number[][],
    holdSec: number,
    wave: OscillatorType,
  ) {
    const oscillators: OscillatorNode[] = [];
    const envelopes: GainNode[] = [];

    // Build one oscillator per chord *voice*; we re-pitch them on chord change.
    const voices = Math.max(...progression.map((c) => c.length));
    for (let i = 0; i < voices; i++) {
      const osc = ctx.createOscillator();
      osc.type = wave;
      const env = ctx.createGain();
      env.gain.value = 0;
      osc.connect(env).connect(this.master!);
      osc.start();
      oscillators.push(osc);
      envelopes.push(env);
      this.nodes.push(osc, env);
    }

    let chordIdx = 0;
    const tick = () => {
      const chord = progression[chordIdx % progression.length]!;
      for (let i = 0; i < voices; i++) {
        const hz = chord[i] ?? chord[chord.length - 1]!;
        oscillators[i]!.frequency.exponentialRampToValueAtTime(
          hz,
          ctx.currentTime + 0.4,
        );
        envelopes[i]!.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.4);
      }
      chordIdx++;
    };
    tick();
    const intervalId = window.setInterval(tick, holdSec * 1000);
    // Save so we can clear on stop
    this.nodes.push({ disconnect: () => window.clearInterval(intervalId) } as unknown as AudioNode);
  }

  private scheduleArpeggio(
    ctx: AudioContext,
    notes: number[],
    stepSec: number,
    wave: OscillatorType,
  ) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    env.gain.value = 0;
    osc.connect(env).connect(this.master!);
    osc.start();
    this.nodes.push(osc, env);

    let i = 0;
    const tick = () => {
      const hz = notes[i % notes.length]!;
      osc.frequency.setValueAtTime(hz, ctx.currentTime);
      env.gain.cancelScheduledValues(ctx.currentTime);
      env.gain.setValueAtTime(0.08, ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + stepSec * 0.9);
      i++;
    };
    tick();
    const id = window.setInterval(tick, stepSec * 1000);
    this.nodes.push({ disconnect: () => window.clearInterval(id) } as unknown as AudioNode);
  }

  /**
   * Bass pulse — short sub-bass thump on a regular interval (gives the match
   * loop a heartbeat).
   */
  private schedulePulse(ctx: AudioContext, intervalSec: number) {
    const tick = () => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(70, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.18);
      env.gain.setValueAtTime(0.22, ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(env).connect(this.master!);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    };
    tick();
    const id = window.setInterval(tick, intervalSec * 1000);
    this.nodes.push({ disconnect: () => window.clearInterval(id) } as unknown as AudioNode);
  }
}

export const music = new MusicManager();
