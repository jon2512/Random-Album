import type { Mood } from "@/data/albums";

/** Active listening mode — maps to album moods (or anything). */
export type SpinMode = "any" | Mood;

export type ModeOption = {
  id: SpinMode;
  label: string;
  hint: string;
};

export const SPIN_MODES: ModeOption[] = [
  { id: "any", label: "Anything", hint: "Surprise me" },
  { id: "chill", label: "Chill", hint: "Easy drive" },
  { id: "upbeat", label: "Bright", hint: "Lift the day" },
  { id: "energetic", label: "Energy", hint: "Windows down" },
  { id: "groovy", label: "Groove", hint: "Head-nodders" },
  { id: "dreamy", label: "Dreamy", hint: "Float along" },
  { id: "emotional", label: "Heart", hint: "Feel it" },
  { id: "melancholy", label: "Blue", hint: "Quiet miles" },
  { id: "dark", label: "Dark", hint: "Night run" },
];

export function modeLabel(mode: SpinMode): string {
  return SPIN_MODES.find((m) => m.id === mode)?.label ?? "Anything";
}

export function isSpinMode(value: string | null | undefined): value is SpinMode {
  return SPIN_MODES.some((m) => m.id === value);
}
