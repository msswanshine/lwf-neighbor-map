import type { LetterGrade } from "../features/addresses/types";

/** MapLibre color strings for paint (same palette as Tailwind-accented UI). */
export const GRADE_HEX: Record<LetterGrade, string> = {
  A: "#22c55e",
  B: "#84cc16",
  C: "#eab308",
  D: "#f97316",
  E: "#ef4444",
  F: "#991b1b",
};

export const UNKNOWN_GRADE_HEX = "#64748b";

export const GRADE_ORDER: LetterGrade[] = ["A", "B", "C", "D", "E", "F"];

/** Numeric score for rollup: A=6 .. F=1 (documented for stakeholder tweaks). */
export function gradeToScore(g: LetterGrade): number {
  return 6 - GRADE_ORDER.indexOf(g);
}

export function scoreToGrade(score: number): LetterGrade {
  const clamped = Math.max(1, Math.min(6, Math.round(score)));
  return GRADE_ORDER[6 - clamped];
}

export function gradeToMapColor(grade: LetterGrade | null): string {
  if (!grade) return UNKNOWN_GRADE_HEX;
  return GRADE_HEX[grade];
}

/** Hex like `#22c55e` or `#abc` → `rgba(r,g,b,a)` for halos and shadows. */
export function gradeHexToRgba(hex: string, alpha: number): string {
  const h = hex.replace(/^#/, "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (full.length !== 6) return `rgba(100,116,139,${alpha})`;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
