export const STEPS = 16;

export const DRUM_IDS = ["kick", "snare", "clap", "hat", "ohat", "cowbell", "rim"] as const;
export type DrumId = (typeof DRUM_IDS)[number];

export const VOICE_IDS = [...DRUM_IDS, "bass", "lead"] as const;
export type VoiceId = (typeof VOICE_IDS)[number];

export type Mix = {
  volumes: Record<VoiceId, number>;
  mutes: Record<VoiceId, boolean>;
  drive: number;
  cutoff: number;
  room: number;
  tape: number;
};

export type Pattern = {
  name: string;
  bpm: number;
  swing: number;
  keyId: string;
  drums: Record<DrumId, number[]>;
  bass: (number | null)[];
  lead: (number | null)[];
  mix: Mix;
};

export type TapeSlot = {
  id: string;
  savedAt: number;
  pattern: Pattern;
};

export const DRUM_LABELS: Record<DrumId, { short: string; name: string }> = {
  kick: { short: "808", name: "808 kick" },
  snare: { short: "SNR", name: "Snare" },
  clap: { short: "CLP", name: "Clap" },
  hat: { short: "HAT", name: "Closed hat" },
  ohat: { short: "OPN", name: "Open hat" },
  cowbell: { short: "BELL", name: "Cowbell" },
  rim: { short: "RIM", name: "Rim" },
};
