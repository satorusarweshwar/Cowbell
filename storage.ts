import { DRUM_IDS, STEPS, type DrumId, type Pattern, type TapeSlot, type VoiceId } from "@/lib/phonk/types";
import { KEYS } from "@/lib/phonk/theory";
import { defaultMix } from "@/lib/phonk/patterns";

const SESSION_KEY = "cowbell-session-v1";
const TAPE_KEY = "cowbell-tape-v1";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isRow(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === STEPS && value.every((cell) => typeof cell === "number" && cell >= 0 && cell <= 1);
}

function isPitches(value: unknown): value is (number | null)[] {
  return (
    Array.isArray(value) &&
    value.length === STEPS &&
    value.every((cell) => cell === null || (typeof cell === "number" && cell >= 0 && cell <= 4 && Number.isInteger(cell)))
  );
}

export function sanitizePattern(value: unknown): Pattern | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Pattern>;
  if (!raw.drums || typeof raw.drums !== "object") return null;
  const drums = {} as Record<DrumId, number[]>;
  for (const id of DRUM_IDS) {
    const row = raw.drums[id];
    if (!isRow(row)) return null;
    drums[id] = row.map((cell) => clamp(cell, 0, 1));
  }
  if (!isPitches(raw.bass) || !isPitches(raw.lead)) return null;
  if (typeof raw.bpm !== "number" || typeof raw.swing !== "number" || typeof raw.name !== "string") return null;
  const keyId = KEYS.some((key) => key.id === raw.keyId) ? raw.keyId! : "A";
  const mix = defaultMix();
  const rawMix = raw.mix;
  if (rawMix && typeof rawMix === "object") {
    for (const id of [...DRUM_IDS, "bass", "lead"] as VoiceId[]) {
      const volume = rawMix.volumes?.[id];
      if (typeof volume === "number") mix.volumes[id] = clamp(volume, 0, 1);
      mix.mutes[id] = Boolean(rawMix.mutes?.[id]);
    }
    if (typeof rawMix.drive === "number") mix.drive = clamp(rawMix.drive, 0, 1);
    if (typeof rawMix.cutoff === "number") mix.cutoff = clamp(rawMix.cutoff, 0, 1);
    if (typeof rawMix.room === "number") mix.room = clamp(rawMix.room, 0, 1);
    if (typeof rawMix.tape === "number") mix.tape = clamp(rawMix.tape, 0, 1);
  }
  return {
    name: raw.name.slice(0, 32) || "Untitled",
    bpm: clamp(Math.round(raw.bpm), 70, 190),
    swing: clamp(raw.swing, 0, 0.75),
    keyId,
    drums,
    bass: raw.bass.slice(),
    lead: raw.lead.slice(),
    mix,
  };
}

export type SessionBlob = { pattern: Pattern; origin: string | null };

export function loadSession(): SessionBlob | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { pattern?: unknown; origin?: unknown };
    const pattern = sanitizePattern(parsed.pattern);
    if (!pattern) return null;
    const origin = typeof parsed.origin === "string" ? parsed.origin : null;
    return { pattern, origin };
  } catch {
    return null;
  }
}

export function saveSession(blob: SessionBlob) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(blob));
}

export function loadTape(): TapeSlot[] {
  try {
    const raw = localStorage.getItem(TAPE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((slot) => {
      if (!slot || typeof slot !== "object") return [];
      const item = slot as Partial<TapeSlot>;
      const pattern = sanitizePattern(item.pattern);
      if (!pattern || typeof item.id !== "string") return [];
      return [{ id: item.id, savedAt: typeof item.savedAt === "number" ? item.savedAt : Date.now(), pattern }];
    });
  } catch {
    return [];
  }
}

export function saveTape(slots: TapeSlot[]) {
  localStorage.setItem(TAPE_KEY, JSON.stringify(slots.slice(0, 16)));
}
