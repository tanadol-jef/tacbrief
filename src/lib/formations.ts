// Formation geometry — positions of wingmen relative to the lead.
// All offsets are in the lead's local frame:
//   forward-along-heading = +y
//   right-of-heading      = +x
// Output `slots` is for wingmen #2, #3, #4 (slot index 0..2).
//
// Spacing scales the side-to-side offsets, stagger scales fore-aft.

export type FormationPreset =
  | "line-abreast"
  | "trail"
  | "wedge"
  | "echelon-left"
  | "echelon-right"
  | "finger-four"
  | "box";

export type Slot = { x: number; y: number; altOffsetFt?: number };

/**
 * Returns up to 3 slot offsets in dimensionless units (×spacing for x,
 * ×stagger for y). Lead occupies slot 0 implicitly.
 */
export function slotsFor(preset: FormationPreset): Slot[] {
  switch (preset) {
    case "line-abreast":
      return [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 2, y: 0 },
      ];
    case "trail":
      return [
        { x: 0, y: -1 },
        { x: 0, y: -2 },
        { x: 0, y: -3 },
      ];
    case "wedge":
      return [
        { x: 1, y: -1 },
        { x: -1, y: -1 },
        { x: 0, y: -2 },
      ];
    case "echelon-right":
      return [
        { x: 1, y: -1 },
        { x: 2, y: -2 },
        { x: 3, y: -3 },
      ];
    case "echelon-left":
      return [
        { x: -1, y: -1 },
        { x: -2, y: -2 },
        { x: -3, y: -3 },
      ];
    case "finger-four":
      // #2 trail-right, #3 line-abreast-left, #4 trail-left of #3
      return [
        { x: 1, y: -1 },
        { x: -1, y: 0 },
        { x: -2, y: -1 },
      ];
    case "box":
      return [
        { x: 1, y: 0 },
        { x: 0, y: -1 },
        { x: 1, y: -1 },
      ];
  }
}

export const FORMATION_LIST: { id: FormationPreset; label: string }[] = [
  { id: "line-abreast", label: "Line Abreast" },
  { id: "trail", label: "Trail" },
  { id: "wedge", label: "Wedge / Vic" },
  { id: "echelon-right", label: "Echelon R" },
  { id: "echelon-left", label: "Echelon L" },
  { id: "finger-four", label: "Finger Four" },
  { id: "box", label: "Box" },
];
