import type { Design } from './store';
import type { Net } from './geometry';

/**
 * Standard press sheets, stored **landscape** (long edge first) in millimetres.
 * Ordered by area so the first fit is the smallest sheet that still holds the
 * blank, its bleed and a gripper/mark margin. ISO A sizes are the everyday
 * choices; the SRA/B entries cover oversize press sheets for big cartons.
 */
export const SHEET_SIZES: { id: string; name: string; w: number; h: number }[] = [
  { id: 'a4', name: 'A4', w: 297, h: 210 },
  { id: 'a3', name: 'A3', w: 420, h: 297 },
  { id: 'sra3', name: 'SRA3', w: 450, h: 320 },
  { id: 'a2', name: 'A2', w: 594, h: 420 },
  { id: 'sra2', name: 'SRA2', w: 640, h: 450 },
  { id: 'a1', name: 'A1', w: 841, h: 594 },
  { id: 'sra1', name: 'SRA1', w: 900, h: 640 },
  { id: 'b1', name: 'B1', w: 1000, h: 707 },
  { id: 'a0', name: 'A0', w: 1189, h: 841 },
  { id: 'b0', name: 'B0', w: 1414, h: 1000 },
];

/** Gripper, mark and trimming space left around the bleed box on the sheet. */
export const SHEET_MARGIN = 10;
const EPS = 0.01;

export interface SheetChoice {
  id: string;
  /** 'A4' … 'B0', or 'Custom' for an oversize mill sheet. */
  name: string;
  /** Human label, e.g. 'A4 landscape'. */
  label: string;
  /** Sheet size in mm, long edge first. */
  w: number;
  h: number;
  /** True when the flat blank sits better turned 90° on the landscape sheet. */
  rotated: boolean;
  custom: boolean;
  /** Flat blank including bleed, mm. */
  blankW: number;
  blankH: number;
  /** Share of the sheet outside the blank bounding box, 0–1. */
  trim: number;
}

const up5 = (n: number) => Math.ceil(n / 5) * 5;

/**
 * Pick the print sheet for a design: smallest standard landscape sheet that
 * fits the flat blank + bleed + margin. A4 is the floor, so a small carton
 * still exports on A4 landscape rather than a strip of board, and larger
 * cartons step up through A3, SRA3, A2 … automatically. Anything bigger than
 * B0 is trimmed back to a custom oversize sheet just large enough to hold it.
 */
export function chooseSheet(net: Net, design: Design): SheetChoice {
  const b = net.bounds;
  const bleed = design.params.bleed;
  const blankW = b.w + bleed * 2;
  const blankH = b.h + bleed * 2;
  const needW = blankW + SHEET_MARGIN * 2;
  const needH = blankH + SHEET_MARGIN * 2;

  const make = (
    id: string, name: string, w: number, h: number,
    rotated: boolean, custom: boolean,
  ): SheetChoice => ({
    id, name, label: `${name} landscape`, w, h, rotated, custom,
    blankW, blankH,
    trim: w * h > 0 ? Math.max(0, 1 - (blankW * blankH) / (w * h)) : 0,
  });

  for (const s of SHEET_SIZES) {
    if (needW <= s.w + EPS && needH <= s.h + EPS) return make(s.id, s.name, s.w, s.h, false, false);
    if (needH <= s.w + EPS && needW <= s.h + EPS) return make(s.id, s.name, s.w, s.h, true, false);
  }

  // Oversize: a custom sheet just big enough, rounded up to whole 5 mm.
  const rotated = needH > needW;
  return make(
    'custom', 'Custom',
    up5(Math.max(needW, needH)), up5(Math.min(needW, needH)),
    rotated, true,
  );
}
