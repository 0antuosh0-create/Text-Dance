import { StyleId } from './themes';

/**
 * AudioEngine — produces a MediaStreamDestination that combines a procedural
 * ambient bed (per scene) and an optional user-supplied audio file.
 * Used to feed MediaRecorder so the exported video has synchronized audio.
 */
export class AudioEngine {
  ctx: AudioContext;
  dest: MediaStreamAudioDestinationNode;
  master: GainNode;
  ambientGain: GainNode;
  userGain: GainNode;
  // live preview path (what the user hears)
  monitorGain: GainNode;
  private nodes: AudioNode[] = [];
  private userSource: AudioBufferSourceNode | null = null;
  private userBuffer: AudioBuffer | null = null;

  constructor() {
    this.ctx = new AudioContext();
    this.dest = this.ctx.createMediaStreamDestination();
    this.master = this.ctx.createGain();
    this.ambientGain = this.ctx.createGain();
    this.userGain = this.ctx.createGain();
    this.monitorGain = this.ctx.createGain();

    this.ambientGain.gain.value = 0.35;
    this.userGain.gain.value = 0.6;
    this.monitorGain.gain.value = 0; // silent by default; user opts in

    this.ambientGain.connect(this.master);
    this.userGain.connect(this.master);
    this.master.connect(this.dest); // always recorded
    this.master.connect(this.monitorGain);
    this.monitorGain.connect(this.ctx.destination); // only audible if enabled

    // Try to resume — succeeds once a user gesture has occurred.
    this.ctx.resume().catch(() => {});
  }

  /** Manually resume after a user gesture (required by autoplay policies). */
  resume() {
    this.ctx.resume().catch(() => {});
  }

  setAmbientVolume(v: number) {
    this.ambientGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.05);
  }
  setUserVolume(v: number) {
    this.userGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.05);
  }
  setMonitor(on: boolean) {
    this.monitorGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  }

  /** Build a style-specific ambient bed and connect to ambientGain. */
  startAmbient(style: StyleId, duration: number) {
    this.stopAmbient();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const endAt = now + duration;

    // Common fade envelope
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1, now + 0.8);
    env.gain.setValueAtTime(1, Math.max(now + 0.81, endAt - 0.8));
    env.gain.linearRampToValueAtTime(0, endAt);
    env.connect(this.ambientGain);

    const buildDrone = (freq: number, detune = 0, type: OscillatorType = 'sine', vol = 0.25) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = vol;
      osc.connect(g).connect(env);
      osc.start(now);
      osc.stop(endAt + 0.1);
      this.nodes.push(osc);
      return osc;
    };

    const buildNoise = (color: 'white' | 'pink' | 'brown', vol = 0.15, filterFreq = 1200, q = 0.8) => {
      const bufferSize = ctx.sampleRate * Math.min(duration + 0.2, 30);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (color === 'white') data[i] = white;
        else if (color === 'pink') {
          b0 = 0.99765 * b0 + white * 0.099046;
          b1 = 0.963 * b1 + white * 0.2965164;
          b2 = 0.57 * b2 + white * 1.0526913;
          data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
        } else {
          b0 = 0.997 * b0 + white * 0.04;
          data[i] = b0 * 3.5;
        }
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'lowpass';
      bp.frequency.value = filterFreq;
      bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(bp).connect(g).connect(env);
      src.start(now);
      src.stop(endAt + 0.1);
      this.nodes.push(src);
      return { src, filter: bp };
    };

    // LFO to modulate a parameter
    const lfo = (freq: number, depth: number, target: AudioParam) => {
      const o = ctx.createOscillator();
      o.frequency.value = freq;
      o.type = 'sine';
      const amp = ctx.createGain();
      amp.gain.value = depth;
      o.connect(amp).connect(target);
      o.start(now);
      o.stop(endAt + 0.1);
      this.nodes.push(o);
    };

    // Style-specific beds
    switch (style) {
      case 'nebula': {
        buildDrone(55, -7, 'sawtooth', 0.06);
        buildDrone(82.5, 5, 'sine', 0.12);
        buildDrone(220, 12, 'sine', 0.04);
        const { filter } = buildNoise('pink', 0.08, 1800);
        lfo(0.1, 600, filter.frequency);
        break;
      }
      case 'aurora': {
        buildDrone(110, 0, 'sine', 0.1);
        buildDrone(164.81, 7, 'sine', 0.07);
        buildDrone(220, -5, 'triangle', 0.05);
        buildDrone(329.63, 11, 'sine', 0.03);
        buildNoise('pink', 0.05, 2500);
        break;
      }
      case 'ocean': {
        const { filter } = buildNoise('brown', 0.35, 400, 0.9);
        lfo(0.12, 220, filter.frequency);
        buildDrone(55, 0, 'sine', 0.08);
        buildDrone(82.5, 4, 'sine', 0.05);
        break;
      }
      case 'starfield': {
        buildDrone(40, 0, 'sine', 0.14);
        buildDrone(60, 7, 'sawtooth', 0.05);
        buildNoise('white', 0.06, 6000, 1.5);
        buildDrone(880, 0, 'sine', 0.015);
        buildDrone(1320, 10, 'sine', 0.01);
        break;
      }
      case 'embers': {
        buildDrone(55, 0, 'sawtooth', 0.1);
        buildDrone(110, 5, 'triangle', 0.07);
        buildNoise('pink', 0.12, 900);
        // crackle: filtered bursts
        const crackle = ctx.createBufferSource();
        const cb = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
        const cd = cb.getChannelData(0);
        for (let i = 0; i < cd.length; i++) {
          if (Math.random() < 0.001) cd[i] = (Math.random() * 2 - 1) * 0.9;
          else cd[i] = cd[i - 1] * 0.92;
        }
        crackle.buffer = cb;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 3500;
        bp.Q.value = 2;
        const cg = ctx.createGain();
        cg.gain.value = 0.15;
        crackle.connect(bp).connect(cg).connect(env);
        crackle.start(now);
        crackle.stop(endAt + 0.1);
        this.nodes.push(crackle);
        break;
      }
      case 'matrix': {
        buildDrone(55, 0, 'square', 0.04);
        buildDrone(110, 3, 'sawtooth', 0.03);
        buildNoise('white', 0.05, 8000);
        // rhythmic pulses
        const pulseOsc = ctx.createOscillator();
        pulseOsc.type = 'square';
        pulseOsc.frequency.value = 220;
        const pulseG = ctx.createGain();
        pulseG.gain.value = 0;
        pulseOsc.connect(pulseG).connect(env);
        pulseOsc.start(now);
        pulseOsc.stop(endAt + 0.1);
        this.nodes.push(pulseOsc);
        // gate the pulse at 4 Hz
        const gate = ctx.createOscillator();
        gate.type = 'square';
        gate.frequency.value = 4;
        const gateG = ctx.createGain();
        gateG.gain.value = 0.06;
        gate.connect(gateG).connect(pulseG.gain);
        gate.start(now);
        gate.stop(endAt + 0.1);
        this.nodes.push(gate);
        break;
      }
      case 'geometric': {
        buildDrone(110, 0, 'triangle', 0.1);
        buildDrone(164.81, 0, 'sine', 0.08);
        buildDrone(220, 7, 'sine', 0.05);
        // bell-like tones every few seconds
        const bellTimes = Math.floor(duration / 2.5);
        for (let i = 0; i < bellTimes; i++) {
          const t = now + 1 + i * 2.5;
          if (t > endAt - 0.4) break;
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = [523.25, 659.25, 783.99, 987.77][i % 4];
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.08, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
          o.connect(g).connect(env);
          o.start(t);
          o.stop(t + 2.3);
          this.nodes.push(o);
        }
        break;
      }
      case 'network': {
        buildDrone(82.5, 0, 'sine', 0.1);
        buildDrone(123.47, 3, 'triangle', 0.07);
        const { filter } = buildNoise('pink', 0.07, 1500);
        lfo(0.3, 400, filter.frequency);
        // soft pings
        for (let i = 0; i < Math.floor(duration / 0.8); i++) {
          const t = now + 0.5 + i * 0.8 + Math.random() * 0.3;
          if (t > endAt - 0.2) break;
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = 800 + Math.random() * 1200;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.04, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0005, t + 0.6);
          o.connect(g).connect(env);
          o.start(t);
          o.stop(t + 0.7);
          this.nodes.push(o);
        }
        break;
      }
      case 'synthwave': {
        // pulsing bass
        const bass = ctx.createOscillator();
        bass.type = 'sawtooth';
        bass.frequency.value = 55;
        const bassF = ctx.createBiquadFilter();
        bassF.type = 'lowpass';
        bassF.frequency.value = 600;
        bassF.Q.value = 6;
        const bassG = ctx.createGain();
        bassG.gain.value = 0.18;
        bass.connect(bassF).connect(bassG).connect(env);
        bass.start(now);
        bass.stop(endAt + 0.1);
        this.nodes.push(bass);
        lfo(2, 0.15, bassG.gain);
        // pad
        buildDrone(220, 7, 'sawtooth', 0.05);
        buildDrone(277.18, -5, 'sawtooth', 0.04);
        buildDrone(329.63, 9, 'sawtooth', 0.04);
        const { filter } = buildNoise('white', 0.04, 12000);
        lfo(0.08, 4000, filter.frequency);
        break;
      }
      case 'plasma': {
        buildDrone(80, 0, 'sine', 0.12);
        buildDrone(120, 5, 'triangle', 0.08);
        buildDrone(160, -3, 'sine', 0.06);
        const { filter } = buildNoise('pink', 0.08, 800);
        lfo(0.06, 500, filter.frequency);
        // slow morph: detune modulation
        const morphOsc = buildDrone(240, 0, 'sine', 0.04);
        lfo(0.15, 20, morphOsc.detune);
        break;
      }
      case 'snow': {
        const { filter } = buildNoise('white', 0.14, 3500);
        lfo(0.08, 1200, filter.frequency);
        buildDrone(110, 0, 'sine', 0.06);
        buildDrone(164.81, 3, 'sine', 0.04);
        buildDrone(220, -5, 'triangle', 0.03);
        break;
      }
      case 'bubbles': {
        buildDrone(82.5, 0, 'sine', 0.1);
        buildDrone(123.47, 5, 'sine', 0.07);
        const { filter } = buildNoise('pink', 0.08, 1800);
        lfo(0.15, 500, filter.frequency);
        // bubble pings
        for (let i = 0; i < Math.floor(duration / 0.4); i++) {
          const t = now + Math.random() * duration;
          if (t > endAt - 0.3) continue;
          const o = ctx.createOscillator();
          o.type = 'sine';
          const startF = 400 + Math.random() * 800;
          o.frequency.setValueAtTime(startF, t);
          o.frequency.exponentialRampToValueAtTime(startF * 2.5, t + 0.18);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.035, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0005, t + 0.3);
          o.connect(g).connect(env);
          o.start(t);
          o.stop(t + 0.35);
          this.nodes.push(o);
        }
        break;
      }
      case 'darksouls': {
        // Deep ominous drone
        buildDrone(41.2, 0, 'sawtooth', 0.08);
        buildDrone(55, 3, 'sine', 0.12);
        buildDrone(82.41, -5, 'sine', 0.06);
        // Distant wind (brown noise lowpass)
        const { filter } = buildNoise('brown', 0.2, 500, 0.6);
        lfo(0.08, 200, filter.frequency);
        // Bonfire crackle (sparse random impulses)
        const crackle = ctx.createBufferSource();
        const cb = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
        const cd = cb.getChannelData(0);
        for (let i = 0; i < cd.length; i++) {
          if (Math.random() < 0.0008) cd[i] = (Math.random() * 2 - 1) * 0.9;
          else cd[i] = cd[i - 1] * 0.9;
        }
        crackle.buffer = cb;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2800;
        bp.Q.value = 1.5;
        const cg = ctx.createGain();
        cg.gain.value = 0.1;
        crackle.connect(bp).connect(cg).connect(env);
        crackle.start(now);
        crackle.stop(endAt + 0.1);
        this.nodes.push(crackle);
        // Slow haunting bell every 4s
        for (let i = 0; i < Math.floor(duration / 4); i++) {
          const t = now + 1 + i * 4;
          if (t > endAt - 1) break;
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = 164.81; // E3 bell
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.07, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0005, t + 3.5);
          o.connect(g).connect(env);
          o.start(t);
          o.stop(t + 3.6);
          this.nodes.push(o);
        }
        break;
      }
    }
  }

  stopAmbient() {
    const now = this.ctx.currentTime;
    const oldGain = this.ambientGain;
    oldGain.gain.setTargetAtTime(0, now, 0.02);

    // Stop oscillators and buffer sources immediately instead of allowing
    // disconnected graphs to keep consuming CPU until the video duration ends.
    this.nodes.forEach((node) => {
      try { (node as AudioScheduledSourceNode).stop(now + 0.04); } catch {}
      try { node.disconnect(); } catch {}
    });
    this.nodes = [];

    // Rotate the gain synchronously. A delayed mutation of this.ambientGain
    // used to disconnect newly-created soundscapes when settings changed fast.
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.35;
    this.ambientGain.connect(this.master);
    setTimeout(() => {
      try { oldGain.disconnect(); } catch {}
    }, 60);
  }

  /** Decode a user-uploaded file and prepare it for playback. */
  async loadUserFile(file: File): Promise<number> {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.userBuffer = buffer;
    return buffer.duration;
  }

  clearUserFile() {
    this.userBuffer = null;
    if (this.userSource) {
      try { this.userSource.stop(); } catch {}
      this.userSource = null;
    }
  }

  /** Play the loaded user audio for `duration` seconds, looping if needed. */
  startUser(duration: number, offset = 0) {
    if (!this.userBuffer) return;
    this.stopUser();
    const src = this.ctx.createBufferSource();
    src.buffer = this.userBuffer;
    src.loop = true;
    src.connect(this.userGain);
    src.start(this.ctx.currentTime, offset);
    src.stop(this.ctx.currentTime + duration + 0.1);
    this.userSource = src;
  }

  stopUser() {
    if (this.userSource) {
      try { this.userSource.stop(); } catch {}
      this.userSource = null;
    }
  }

  /** Close everything and release the AudioContext. */
  dispose() {
    try { this.stopAmbient(); } catch {}
    try { this.stopUser(); } catch {}
    this.nodes.forEach((n) => { try { (n as any).stop?.(); } catch {} try { n.disconnect(); } catch {} });
    this.nodes = [];
    this.ctx.close().catch(() => {});
  }
}
