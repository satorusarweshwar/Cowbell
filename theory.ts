export const PENTA = [0, 3, 5, 7, 10] as const;

export const KEYS = [
  { id: "A", root: 33, name: "A min" },
  { id: "C", root: 36, name: "C min" },
  { id: "D", root: 38, name: "D min" },
  { id: "E", root: 40, name: "E min" },
  { id: "F", root: 41, name: "F min" },
  { id: "G", root: 43, name: "G min" },
] as const;

export type KeyId = (typeof KEYS)[number]["id"];

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function keyById(id: string) {
  return KEYS.find((key) => key.id === id) ?? KEYS[0];
}

export function degreeName(rootMidi: number, degree: number): string {
  const midi = rootMidi + PENTA[degree]!;
  return NAMES[((midi % 12) + 12) % 12]!;
}

export function midiFor(root: number, degree: number, octaveShift: number): number {
  return root + octaveShift + PENTA[degree]!;
}
