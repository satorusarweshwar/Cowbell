import type { Mix, Pattern, VoiceId } from "@/lib/phonk/types";
import { DRUM_IDS } from "@/lib/phonk/types";
import { keyById, midiFor } from "@/lib/phonk/theory";
import { encodeWav } from "@/lib/phonk/wav";

export type Snapshot = {
  drums: Pattern["drums"];
  bass: Pattern["bass"];
  lead: Pattern["lead"];
  bpm: number;
  swing: number;
  root: number;
  mix: Mix;
};

const DUCKED: VoiceId[] = ["hat", "ohat", "lead"];

type Graph = {
  tracks: Record<VoiceId | "tape", GainNode>;
  duck: GainNode;
  drive: WaveShaperNode;
  dry: GainNode;
  wet: GainNode;
  filter: BiquadFilterNode;
  roomGain: GainNode;
  analyser: AnalyserNode;
  noise: AudioBuffer;
};

function noiseBuffer(ctx: BaseAudioContext, seconds = 1.2) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function impulse(ctx: BaseAudioContext) {
  const length = Math.floor(ctx.sampleRate * 1.35);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * (1 - t) ** 2.8;
    }
  }
  return buffer;
}

function driveCurve(amount: number) {
  const curve = new Float32Array(256);
  const k = 2 + amount * 70;
  for (let i = 0; i < curve.length; i++) {
    const x = (i * 2) / curve.length - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function buildGraph(ctx: BaseAudioContext, destination: AudioNode): Graph {
  const mixBus = ctx.createGain();
  const duck = ctx.createGain();
  duck.gain.value = 1;

  const ids: (VoiceId | "tape")[] = [...DRUM_IDS, "bass", "lead", "tape"];
  const tracks = {} as Record<VoiceId | "tape", GainNode>;
  for (const id of ids) {
    const gain = ctx.createGain();
    gain.gain.value = id === "tape" ? 0 : 0.8;
    if (DUCKED.includes(id as VoiceId) || id === "tape") gain.connect(duck);
    else gain.connect(mixBus);
    tracks[id] = gain;
  }
  duck.connect(mixBus);

  const drive = ctx.createWaveShaper();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  mixBus.connect(dry);
  mixBus.connect(drive);
  drive.connect(wet);
  const post = ctx.createGain();
  dry.connect(post);
  wet.connect(post);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 9000;
  filter.Q.value = 0.65;
  post.connect(filter);

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 14;
  comp.ratio.value = 4.5;
  comp.attack.value = 0.004;
  comp.release.value = 0.16;
  filter.connect(comp);

  const room = ctx.createConvolver();
  room.buffer = impulse(ctx);
  const roomGain = ctx.createGain();
  roomGain.gain.value = 0;
  filter.connect(room);
  room.connect(roomGain);

  const master = ctx.createGain();
  master.gain.value = 0.82;
  comp.connect(master);
  roomGain.connect(master);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.72;
  master.connect(analyser);
  analyser.connect(destination);

  return { tracks, duck, drive, dry, wet, filter, roomGain, analyser, noise: noiseBuffer(ctx) };
}

function applyMix(graph: Graph, mix: Mix) {
  for (const id of [...DRUM_IDS, "bass", "lead"] as VoiceId[]) {
    graph.tracks[id].gain.value = mix.mutes[id] ? 0 : mix.volumes[id];
  }
  graph.tracks.tape.gain.value = mix.tape * 0.09;
  graph.drive.curve = driveCurve(mix.drive);
  graph.wet.gain.value = mix.drive;
  graph.dry.gain.value = 1 - mix.drive * 0.45;
  graph.filter.frequency.value = 400 * (20000 / 400) ** mix.cutoff;
  graph.roomGain.gain.value = mix.room * 0.55;
}

function envGain(ctx: BaseAudioContext, time: number, peak: number, decay: number, dest: AudioNode) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(peak, 0.0001), time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
  gain.connect(dest);
  return gain;
}

function playKick(ctx: BaseAudioContext, time: number, vel: number, dest: AudioNode) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(168, time);
  osc.frequency.exponentialRampToValueAtTime(52, time + 0.07);
  osc.frequency.exponentialRampToValueAtTime(34, time + 0.42);
  const gain = envGain(ctx, time, vel * 0.95, 0.48, dest);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + 0.5);

  const click = ctx.createOscillator();
  click.type = "triangle";
  click.frequency.setValueAtTime(980, time);
  click.frequency.exponentialRampToValueAtTime(140, time + 0.02);
  const clickGain = envGain(ctx, time, vel * 0.28, 0.03, dest);
  click.connect(clickGain);
  click.start(time);
  click.stop(time + 0.04);
}

function playNoiseHit(
  ctx: BaseAudioContext,
  noise: AudioBuffer,
  time: number,
  dur: number,
  peak: number,
  dest: AudioNode,
  shape?: (filter: BiquadFilterNode) => void,
) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  shape?.(filter);
  const gain = envGain(ctx, time, peak, dur, dest);
  src.connect(filter);
  filter.connect(gain);
  src.start(time);
  src.stop(time + dur + 0.02);
}

function playSnare(ctx: BaseAudioContext, noise: AudioBuffer, time: number, vel: number, dest: AudioNode) {
  playNoiseHit(ctx, noise, time, 0.16, vel * 0.55, dest, (filter) => {
    filter.type = "highpass";
    filter.frequency.value = 1400;
  });
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(188, time);
  osc.frequency.exponentialRampToValueAtTime(120, time + 0.08);
  const gain = envGain(ctx, time, vel * 0.4, 0.12, dest);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + 0.14);
}

function playClap(ctx: BaseAudioContext, noise: AudioBuffer, time: number, vel: number, dest: AudioNode) {
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1650;
  filter.Q.value = 0.7;
  filter.connect(dest);
  [0, 0.011, 0.022].forEach((offset, index) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const gain = ctx.createGain();
    const start = time + offset;
    const peak = vel * (index === 2 ? 0.55 : 0.32);
    const decay = index === 2 ? 0.14 : 0.03;
    gain.gain.setValueAtTime(Math.max(peak, 0.0001), start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + decay);
    src.connect(gain);
    gain.connect(filter);
    src.start(start);
    src.stop(start + decay + 0.02);
  });
}

function playHat(ctx: BaseAudioContext, noise: AudioBuffer, time: number, vel: number, open: boolean, dest: AudioNode) {
  playNoiseHit(ctx, noise, time, open ? 0.26 : 0.04, vel * (open ? 0.32 : 0.26), dest, (filter) => {
    filter.type = "highpass";
    filter.frequency.value = open ? 6200 : 7800;
  });
}

function playCowbell(ctx: BaseAudioContext, time: number, vel: number, dest: AudioNode) {
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1250;
  filter.Q.value = 3.2;
  const shaper = ctx.createWaveShaper();
  shaper.curve = driveCurve(0.35);
  const gain = envGain(ctx, time, vel * 0.34, 0.2, dest);
  filter.connect(shaper);
  shaper.connect(gain);
  for (const freq of [587, 845]) {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq;
    const partial = ctx.createGain();
    partial.gain.value = freq === 587 ? 0.7 : 0.5;
    osc.connect(partial);
    partial.connect(filter);
    osc.start(time);
    osc.stop(time + 0.22);
  }
}

function playRim(ctx: BaseAudioContext, time: number, vel: number, dest: AudioNode) {
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = 480;
  const gain = envGain(ctx, time, vel * 0.22, 0.035, dest);
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 800;
  osc.connect(filter);
  filter.connect(gain);
  osc.start(time);
  osc.stop(time + 0.05);
}

function playBass(ctx: BaseAudioContext, time: number, midi: number, vel: number, dest: AudioNode) {
  const freq = 440 * 2 ** ((midi - 69) / 12);
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq * 1.5, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freq, 20), time + 0.05);
  const gain = envGain(ctx, time, vel * 0.85, 0.38, dest);
  osc.connect(gain);
  osc.start(time);
  osc.stop(time + 0.42);

  const saw = ctx.createOscillator();
  saw.type = "sawtooth";
  saw.frequency.value = freq;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 240;
  const sawGain = envGain(ctx, time, vel * 0.16, 0.28, filter);
  filter.connect(dest);
  saw.connect(sawGain);
  saw.start(time);
  saw.stop(time + 0.32);
}

function playLead(ctx: BaseAudioContext, time: number, midi: number, vel: number, dest: AudioNode) {
  const freq = 440 * 2 ** ((midi - 69) / 12);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(freq * 4, time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.4, 80), time + 0.18);
  filter.Q.value = 5;
  const gain = envGain(ctx, time, vel * 0.28, 0.32, dest);
  filter.connect(gain);
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = freq;
  const tone = ctx.createOscillator();
  tone.type = "triangle";
  tone.frequency.value = freq * 2.005;
  const toneGain = ctx.createGain();
  toneGain.gain.value = 0.45;
  osc.connect(filter);
  tone.connect(toneGain);
  toneGain.connect(filter);
  osc.start(time);
  tone.start(time);
  osc.stop(time + 0.36);
  tone.stop(time + 0.36);
}

function scheduleStep(ctx: BaseAudioContext, graph: Graph, snap: Snapshot, step: number, time: number) {
  const drums = snap.drums;
  if (drums.kick[step]! > 0) {
    playKick(ctx, time, drums.kick[step]!, graph.tracks.kick);
    const duck = graph.duck.gain;
    duck.cancelScheduledValues(time);
    duck.setValueAtTime(1, time);
    duck.linearRampToValueAtTime(0.58, time + 0.025);
    duck.linearRampToValueAtTime(1, time + 0.16);
  }
  if (drums.snare[step]! > 0) playSnare(ctx, graph.noise, time, drums.snare[step]!, graph.tracks.snare);
  if (drums.clap[step]! > 0) playClap(ctx, graph.noise, time, drums.clap[step]!, graph.tracks.clap);
  if (drums.hat[step]! > 0) playHat(ctx, graph.noise, time, drums.hat[step]!, false, graph.tracks.hat);
  if (drums.ohat[step]! > 0) playHat(ctx, graph.noise, time, drums.ohat[step]!, true, graph.tracks.ohat);
  if (drums.cowbell[step]! > 0) playCowbell(ctx, time, drums.cowbell[step]!, graph.tracks.cowbell);
  if (drums.rim[step]! > 0) playRim(ctx, time, drums.rim[step]!, graph.tracks.rim);
  const bass = snap.bass[step];
  if (bass !== null) playBass(ctx, time, midiFor(snap.root, bass, 0), 0.92, graph.tracks.bass);
  const lead = snap.lead[step];
  if (lead !== null) playLead(ctx, time, midiFor(snap.root, lead, 24), 0.85, graph.tracks.lead);
}

function startTape(ctx: BaseAudioContext, graph: Graph, when: number, duration?: number) {
  const src = ctx.createBufferSource();
  src.buffer = graph.noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 2400;
  src.connect(filter);
  filter.connect(graph.tracks.tape);
  src.start(when);
  if (duration) src.stop(when + duration);
  return src;
}

export function snapshotFrom(pattern: Pattern): Snapshot {
  return {
    drums: pattern.drums,
    bass: pattern.bass,
    lead: pattern.lead,
    bpm: pattern.bpm,
    swing: pattern.swing,
    root: keyById(pattern.keyId).root,
    mix: pattern.mix,
  };
}

export class Engine {
  private ctx: AudioContext | null = null;
  private graph: Graph | null = null;
  private timer = 0;
  private step = 0;
  private nextTime = 0;
  private playing = false;
  private tape: AudioBufferSourceNode | null = null;
  private snapshot: Snapshot | null = null;
  private marks: { step: number; time: number }[] = [];
  private shown = -1;
  onStep: (step: number) => void = () => {};

  sync(snapshot: Snapshot) {
    this.snapshot = snapshot;
    if (this.graph) applyMix(this.graph, snapshot.mix);
  }

  isPlaying() {
    return this.playing;
  }

  analyser() {
    return this.graph?.analyser ?? null;
  }

  private ensure() {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.graph = buildGraph(ctx, ctx.destination);
      if (this.snapshot) applyMix(this.graph, this.snapshot.mix);
    }
    return { ctx: this.ctx, graph: this.graph! };
  }

  async toggle() {
    if (this.playing) {
      this.stop();
      return false;
    }
    const { ctx, graph } = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
    if (!this.snapshot) return false;
    this.playing = true;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.05;
    this.tape = startTape(ctx, graph, ctx.currentTime);
    this.pump();
    this.timer = window.setInterval(() => this.pump(), 25);
    return true;
  }

  stop() {
    this.playing = false;
    window.clearInterval(this.timer);
    this.timer = 0;
    try {
      this.tape?.stop();
    } catch {
      /* already stopped */
    }
    this.tape = null;
    this.marks = [];
    this.shown = -1;
    this.onStep(-1);
  }

  private pump() {
    const ctx = this.ctx;
    const graph = this.graph;
    const snap = this.snapshot;
    if (!ctx || !graph || !snap || !this.playing) return;
    const stepDur = 60 / snap.bpm / 4;
    const horizon = ctx.currentTime + 0.12;
    while (this.nextTime < horizon) {
      const step = this.step;
      const swung = this.nextTime + (step % 2 === 1 ? stepDur * snap.swing * 0.5 : 0);
      const when = Math.max(swung, ctx.currentTime);
      scheduleStep(ctx, graph, snap, step, when);
      this.marks.push({ step, time: when });
      this.step = (step + 1) % 16;
      this.nextTime += stepDur;
    }
    const now = ctx.currentTime;
    let visible = -1;
    for (const mark of this.marks) {
      if (mark.time <= now + 0.02) visible = mark.step;
    }
    this.marks = this.marks.filter((mark) => mark.time > now - 0.2);
    if (visible !== -1 && visible !== this.shown) {
      this.shown = visible;
      this.onStep(visible);
    }
  }

  async bounce(pattern: Pattern, bars = 4): Promise<Blob> {
    const snap = snapshotFrom(pattern);
    const stepDur = 60 / snap.bpm / 4;
    const total = bars * 16;
    const duration = total * stepDur + 0.85;
    const rate = 44100;
    const offline = new OfflineAudioContext(2, Math.ceil(rate * duration), rate);
    const graph = buildGraph(offline, offline.destination);
    applyMix(graph, snap.mix);
    startTape(offline, graph, 0, duration);
    for (let index = 0; index < total; index++) {
      const step = index % 16;
      const base = index * stepDur;
      const when = base + (step % 2 === 1 ? stepDur * snap.swing * 0.5 : 0);
      scheduleStep(offline, graph, snap, step, when);
    }
    const rendered = await offline.startRendering();
    return encodeWav(rendered);
  }
}

export const engine = new Engine();
