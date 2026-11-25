import { DRUM_IDS, STEPS, type DrumId, type Mix, type Pattern, type VoiceId } from "@/lib/phonk/types";

export const DEFAULT_VOLUMES: Record<VoiceId, number> = {
  kick: 0.92,
  snare: 0.64,
  clap: 0.5,
  hat: 0.36,
  ohat: 0.32,
  cowbell: 0.74,
  rim: 0.3,
  bass: 0.86,
  lead: 0.38,
};

export function defaultMix(over: Partial<Mix> = {}): Mix {
  const voices: VoiceId[] = [...DRUM_IDS, "bass", "lead"];
  const mutes = Object.fromEntries(voices.map((id) => [id, false])) as Record<VoiceId, boolean>;
  return {
    volumes: { ...DEFAULT_VOLUMES, ...over.volumes },
    mutes: { ...mutes, ...over.mutes },
    drive: over.drive ?? 0.46,
    cutoff: over.cutoff ?? 0.94,
    room: over.room ?? 0.18,
    tape: over.tape ?? 0.22,
  };
}

function row(values: number[]): number[] {
  const out = Array<number>(STEPS).fill(0);
  values.forEach((value, index) => {
    if (index < STEPS) out[index] = value;
  });
  return out;
}

function pitches(values: (number | null)[]): (number | null)[] {
  const out: (number | null)[] = Array<number | null>(STEPS).fill(null);
  values.forEach((value, index) => {
    if (index < STEPS) out[index] = value;
  });
  return out;
}

function make(
  name: string,
  bpm: number,
  swing: number,
  drums: Partial<Record<DrumId, number[]>>,
  bass: (number | null)[],
  lead: (number | null)[],
  mix?: Partial<Mix>,
): Pattern {
  const full = Object.fromEntries(DRUM_IDS.map((id) => [id, row(drums[id] ?? [])])) as Record<DrumId, number[]>;
  return {
    name,
    bpm,
    swing,
    keyId: "A",
    drums: full,
    bass: pitches(bass),
    lead: pitches(lead),
    mix: defaultMix(mix),
  };
}

export type Preset = { id: string; pattern: Pattern };

export const PRESETS: Preset[] = [
  {
    id: "drift",
    pattern: make(
      "Night Drift",
      152,
      0.02,
      {
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 0.95, 0, 0, 0, 0, 0, 0, 0, 0.95, 0, 0, 0],
        clap: [0, 0, 0, 0, 0.62, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0],
        hat: [0.72, 0, 0.4, 0, 0.68, 0, 0.38, 0, 0.72, 0, 0.4, 0, 0.66, 0, 0.5, 0.28],
        ohat: [0, 0, 0, 0, 0, 0, 0, 0.48, 0, 0, 0, 0, 0, 0, 0, 0.42],
        cowbell: [1, 0, 0, 0.72, 0, 0, 0.9, 0, 1, 0, 0, 0.72, 0, 0, 0.88, 0],
        rim: [0, 0, 0.34, 0, 0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0],
      },
      [0, null, null, null, 0, null, 2, null, 0, null, null, null, 4, null, 2, null],
      [null, null, 0, null, null, null, 1, null, null, null, 0, null, 3, null, null, null],
      { drive: 0.5, cutoff: 0.9, room: 0.16, tape: 0.24 },
    ),
  },
  {
    id: "memphis",
    pattern: make(
      "Memphis",
      132,
      0.32,
      {
        kick: [1, 0, 0, 0.72, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0.58, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0.22, 0, 0, 0, 0, 1, 0, 0, 0.28],
        clap: [0, 0, 0, 0, 0.78, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0],
        hat: [0.55, 0.22, 0.4, 0.18, 0.5, 0.2, 0.42, 0.16, 0.58, 0.24, 0.38, 0.28, 0.48, 0.18, 0.4, 0.2],
        ohat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0],
        cowbell: [0, 0, 0.86, 0, 0, 0, 0.7, 0, 0, 0, 0.9, 0, 0, 0, 0.4, 0],
        rim: [0, 0, 0, 0, 0, 0.36, 0, 0, 0, 0, 0, 0, 0, 0, 0.32, 0],
      },
      [0, null, null, 0, null, null, null, null, 0, null, null, null, 3, null, null, 4],
      [null, null, null, 0, null, null, 1, null, null, null, null, 0, null, 4, null, null],
      { drive: 0.34, cutoff: 0.8, room: 0.14, tape: 0.3 },
    ),
  },
  {
    id: "cowbell",
    pattern: make(
      "Cowbell",
      160,
      0,
      {
        kick: [1, 0, 0, 0, 1, 0, 0.7, 0, 1, 0, 0, 0, 1, 0, 0.65, 0],
        snare: [0, 0, 0, 0, 0.92, 0, 0, 0, 0, 0, 0, 0, 0.92, 0, 0, 0],
        clap: [0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0, 0.66, 0, 0, 0],
        hat: [0.6, 0.2, 0.45, 0.18, 0.6, 0.2, 0.45, 0.18, 0.6, 0.22, 0.7, 0.55, 0.8, 0.5, 0.72, 0.4],
        ohat: [0, 0, 0, 0, 0, 0, 0, 0.4, 0, 0, 0, 0, 0, 0, 0, 0.55],
        cowbell: [1, 0, 0.78, 0, 1, 0, 0.78, 0.42, 1, 0, 0.78, 0, 1, 0, 0.92, 0],
        rim: [0, 0.3, 0, 0, 0, 0, 0.28, 0, 0, 0.3, 0, 0, 0, 0, 0.34, 0],
      },
      [0, null, 0, null, 0, null, 2, null, 0, null, 0, null, 4, null, 3, null],
      [0, null, 1, null, 0, null, 3, null, 0, null, 1, null, 4, null, 1, null],
      { drive: 0.55, cutoff: 1, room: 0.12, tape: 0.16, volumes: { ...DEFAULT_VOLUMES, cowbell: 0.9 } },
    ),
  },
  {
    id: "baile",
    pattern: make(
      "Baile",
      148,
      0.08,
      {
        kick: [1, 0, 0, 1, 0, 0.88, 0, 0, 1, 0, 0, 1, 0, 0.82, 0, 0],
        snare: [0, 0, 0, 0, 0.9, 0, 0, 0.24, 0, 0, 0, 0, 0.95, 0, 0.3, 0],
        clap: [0, 0, 0, 0, 0.55, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0],
        hat: [0.5, 0.28, 0.42, 0.22, 0.48, 0.3, 0.4, 0.2, 0.52, 0.26, 0.44, 0.24, 0.5, 0.32, 0.4, 0.22],
        ohat: [0, 0, 0, 0, 0, 0, 0, 0.36, 0, 0, 0, 0, 0, 0, 0, 0.4],
        cowbell: [0.95, 0, 0, 0.7, 0, 0.85, 0, 0, 0.95, 0, 0, 0.68, 0, 0.8, 0, 0],
        rim: [0, 0, 0.4, 0, 0, 0, 0.32, 0, 0, 0, 0.36, 0, 0, 0, 0.3, 0],
      },
      [0, null, null, 0, null, 2, null, null, 0, null, null, 0, null, 4, null, null],
      [null, 0, null, null, 1, null, null, 0, null, null, 3, null, null, 1, null, null],
      { drive: 0.42, cutoff: 0.92, room: 0.2, tape: 0.18 },
    ),
  },
  {
    id: "slowed",
    pattern: make(
      "Slowed",
      96,
      0.06,
      {
        kick: [1, 0, 0, 0, 0, 0, 0.55, 0, 0, 0, 0.8, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0.25],
        clap: [0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0],
        hat: [0.45, 0, 0.28, 0, 0.4, 0, 0.24, 0, 0.48, 0, 0.3, 0, 0.36, 0, 0.22, 0],
        ohat: [0, 0, 0, 0, 0, 0, 0, 0.4, 0, 0, 0, 0, 0, 0, 0, 0.5],
        cowbell: [0.8, 0, 0, 0, 0.55, 0, 0, 0, 0.85, 0, 0, 0.5, 0, 0, 0, 0],
        rim: [0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0, 0, 0, 0.28, 0],
      },
      [0, null, null, null, null, null, 0, null, null, null, 3, null, null, null, 4, null],
      [0, null, null, null, null, null, 1, null, null, null, null, null, 4, null, null, null],
      { drive: 0.62, cutoff: 0.42, room: 0.58, tape: 0.4 },
    ),
  },
  {
    id: "blank",
    pattern: make("Blank", 140, 0, {}, [], [], { drive: 0.4, room: 0.16, tape: 0.12 }),
  },
];

const BELL_MOTIFS: number[][] = [
  [1, 0, 0, 0.72, 0, 0, 0.88, 0, 1, 0, 0, 0.72, 0, 0, 0.88, 0],
  [0, 0, 0.9, 0, 0, 0.75, 0, 0, 0, 0, 0.95, 0, 0, 0.7, 0, 0.45],
  [1, 0, 0.7, 0, 1, 0, 0.7, 0.4, 1, 0, 0.7, 0, 0.95, 0, 0.8, 0],
  [0.9, 0, 0, 0.65, 0, 0.85, 0, 0, 0.9, 0, 0, 0.6, 0, 0.8, 0, 0],
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollPattern(): Pattern {
  const rand = mulberry32((Math.random() * 0xffffffff) | 0);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
  const style = pick(["drift", "memphis", "baile"] as const);

  const kick = row([]);
  const snare = row([]);
  const clap = row([]);
  const hat = row([]);
  const ohat = row([]);
  const rim = row([]);
  const bass = pitches([]);
  const lead = pitches([]);

  if (style === "drift") {
    [0, 4, 8, 12].forEach((step) => {
      kick[step] = 1;
    });
    if (rand() > 0.45) kick[14] = 0.62;
  } else if (style === "memphis") {
    kick[0] = 1;
    kick[8] = 1;
    if (rand() > 0.3) kick[3] = 0.7;
    if (rand() > 0.4) kick[13] = 0.55;
  } else {
    [0, 3, 5, 8, 11, 13].forEach((step, index) => {
      kick[step] = index % 2 === 0 ? 1 : 0.82;
    });
  }

  snare[4] = 0.95;
  snare[12] = 1;
  clap[4] = 0.6;
  clap[12] = 0.66;
  if (rand() > 0.55) snare[15] = 0.26;
  if (style === "memphis" && rand() > 0.4) snare[7] = 0.22;

  for (let step = 0; step < STEPS; step++) {
    if (step % 2 === 0) hat[step] = 0.46 + rand() * 0.28;
    else if (rand() < (style === "drift" ? 0.22 : 0.48)) hat[step] = 0.18 + rand() * 0.16;
  }
  if (rand() > 0.4) {
    hat[12] = 0.75;
    hat[13] = 0.48;
    hat[14] = 0.7;
    hat[15] = 0.4;
  }
  ohat[7] = rand() > 0.5 ? 0.42 : 0;
  ohat[15] = 0.36 + rand() * 0.2;
  if (rand() > 0.5) rim[2] = 0.32;
  if (rand() > 0.5) rim[10] = 0.3;

  const motif = pick(BELL_MOTIFS).map((value) => (rand() > 0.88 ? 0 : value));
  const cowbell = row(motif);

  const bassSteps = style === "baile" ? [0, 3, 5, 8, 11] : style === "memphis" ? [0, 3, 8, 12] : [0, 4, 8, 12];
  bassSteps.forEach((step, index) => {
    const roll = rand();
    bass[step] = roll > 0.72 ? (index % 2 === 0 ? 2 : 4) : 0;
  });

  const leadSteps = [2, 6, 10, 14].filter(() => rand() > 0.25);
  const motifDegrees = [0, 1, 0, 3, 4, 1];
  leadSteps.forEach((step, index) => {
    lead[step] = motifDegrees[index % motifDegrees.length] ?? 0;
  });

  const bpm = style === "drift" ? 146 + Math.floor(rand() * 16) : style === "memphis" ? 124 + Math.floor(rand() * 16) : 140 + Math.floor(rand() * 14);
  const swing = style === "memphis" ? 0.18 + rand() * 0.2 : rand() * 0.08;
  const label = style === "drift" ? "Drift" : style === "memphis" ? "Memphis" : "Baile";
  const take = 10 + Math.floor(rand() * 90);

  return make(
    `${label} ${take}`,
    bpm,
    swing,
    { kick, snare, clap, hat, ohat, cowbell, rim },
    bass,
    lead,
    {
      drive: 0.34 + rand() * 0.28,
      cutoff: style === "memphis" ? 0.55 + rand() * 0.2 : 0.64 + rand() * 0.22,
      room: 0.1 + rand() * 0.22,
      tape: 0.12 + rand() * 0.22,
    },
  );
}

export function clonePattern(pattern: Pattern): Pattern {
  return structuredClone(pattern);
}
