import type { Net } from './geometry';
import type { Design, PressSheetSettings, SheetPresetId } from './store';

/** Default gripper / trim margin used by automatic press-sheet selection. */
export const SHEET_MARGIN = 10;
const EPS = 0.01;

interface PaperSize {
  id: Exclude<SheetPresetId, 'auto' | 'custom'>;
  name: string;
  /** Stored landscape (long edge first), in millimetres. */
  w: number;
  h: number;
}

const PAPER_SIZES: PaperSize[] = [
  { id: 'letter', name: 'Letter', w: 279.4, h: 215.9 },
  { id: 'a4', name: 'A4', w: 297, h: 210 },
  { id: 'legal', name: 'Legal', w: 355.6, h: 215.9 },
  { id: 'tabloid', name: 'Tabloid', w: 431.8, h: 279.4 },
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

/**
 * Sizes offered in the editor. Letter is selectable but intentionally not an
 * automatic choice: Auto keeps A4 as its smallest default press sheet.
 */
export const SHEET_PRESET_OPTIONS: { id: SheetPresetId; name: string }[] = [
  { id: 'auto', name: 'Auto · smallest fit' },
  { id: 'a4', name: 'A4' },
  { id: 'legal', name: 'Legal' },
  { id: 'letter', name: 'Letter' },
  { id: 'tabloid', name: 'Tabloid' },
  ...PAPER_SIZES.filter((s) => !['a4', 'legal', 'letter', 'tabloid'].includes(s.id))
    .map(({ id, name }) => ({ id, name })),
  { id: 'custom', name: 'Other / custom size' },
];

const VALID_PRESETS = new Set<string>(SHEET_PRESET_OPTIONS.map((s) => s.id));
export const isSheetPresetId = (value: unknown): value is SheetPresetId =>
  typeof value === 'string' && VALID_PRESETS.has(value);

/** Standard sheets Auto can choose, in ascending area. A4 remains the floor. */
export const SHEET_SIZES: { id: string; name: string; w: number; h: number }[] = [
  { id: 'a4', name: 'A4', w: 297, h: 210 },
  { id: 'legal', name: 'Legal', w: 355.6, h: 215.9 },
  { id: 'tabloid', name: 'Tabloid', w: 431.8, h: 279.4 },
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

export interface SheetChoice {
  id: string;
  /** 'A4' … 'B0', Legal, Letter, Tabloid, or Custom. */
  name: string;
  /** Display label, e.g. 'A4 landscape'. */
  label: string;
  /** Final page size in mm. */
  w: number;
  h: number;
  /** True when the flat blank is turned 90° on the page. */
  rotated: boolean;
  custom: boolean;
  /** Flat blank including bleed, before scale or rotation, in mm. */
  blankW: number;
  blankH: number;
  /** Effective print scale as a multiplier (1 = 100%). */
  scale: number;
  /** Requested scale as a multiplier (1 = 100%). */
  requestedScale: number;
  /** Largest scale that fits within the margin and position offsets. */
  maxScale: number;
  /** Sheet adjustment values in mm. */
  margin: number;
  offsetX: number;
  offsetY: number;
  /** Share of page area occupied by the scaled blank, 0–1. */
  trim: number;
  /** False only when no usable printable area remains. */
  fits: boolean;
  /** Requested scale was reduced to keep the complete blank on the page. */
  scaledToFit: boolean;
}

const up5 = (n: number) => Math.ceil(n / 5) * 5;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const fallbackSettings = (): PressSheetSettings => ({
  preset: 'auto', orientation: 'landscape', customW: 297, customH: 210,
  fitToSheet: true, scale: 100, margin: SHEET_MARGIN, offsetX: 0, offsetY: 0,
});

/**
 * Resolve an automatic or user-selected sheet. Manual sheets preserve the
 * chosen page size, while fit-to-sheet and the scale/offset controls ensure
 * the entire dieline (including bleed) remains on the exported page.
 */
export function chooseSheet(net: Net, design: Design, input?: Partial<PressSheetSettings>): SheetChoice {
  const settings = { ...fallbackSettings(), ...design.pressSheet, ...input };
  const b = net.bounds;
  const bleed = design.params.bleed;
  const blankW = b.w + bleed * 2;
  const blankH = b.h + bleed * 2;
  // Crop marks extend 5 mm outside the bleed box, so keep at least that much clear.
  const margin = clamp(Number.isFinite(settings.margin) ? settings.margin : SHEET_MARGIN, 5, 100);
  const offsetX = clamp(Number.isFinite(settings.offsetX) ? settings.offsetX : 0, -1000, 1000);
  const offsetY = clamp(Number.isFinite(settings.offsetY) ? settings.offsetY : 0, -1000, 1000);
  const requestedScale = settings.fitToSheet
    ? 1
    : clamp(Number.isFinite(settings.scale) ? settings.scale : 100, 10, 200) / 100;

  const make = (id: string, name: string, w: number, h: number, custom: boolean): SheetChoice => {
    const availableW = w - 2 * (margin + Math.abs(offsetX));
    const availableH = h - 2 * (margin + Math.abs(offsetY));
    const normalScale = Math.min(availableW / blankW, availableH / blankH);
    const rotatedScale = Math.min(availableW / blankH, availableH / blankW);
    const rotated = rotatedScale > normalScale + EPS;
    const maxScale = Math.max(0, normalScale, rotatedScale);
    const scale = maxScale > 0 ? Math.min(requestedScale, maxScale) : 0.01;
    const contentW = (rotated ? blankH : blankW) * scale;
    const contentH = (rotated ? blankW : blankH) * scale;
    const x = (w - contentW) / 2 + offsetX;
    const y = (h - contentH) / 2 + offsetY;
    const fits = maxScale > 0
      && x >= margin - EPS && y >= margin - EPS
      && x + contentW <= w - margin + EPS
      && y + contentH <= h - margin + EPS;
    const orientation = w >= h ? 'landscape' : 'portrait';
    const label = custom && id === 'custom'
      ? `Custom ${orientation}`
      : `${name} ${orientation}`;
    return {
      id, name, label, w, h, rotated, custom, blankW, blankH,
      scale, requestedScale, maxScale, margin, offsetX, offsetY,
      trim: w * h > 0 ? Math.max(0, 1 - (contentW * contentH) / (w * h)) : 0,
      fits, scaledToFit: scale + EPS < requestedScale,
    };
  };

  if (settings.preset === 'auto') {
    const portrait = settings.orientation === 'portrait';
    for (const s of SHEET_SIZES) {
      const choice = make(s.id, s.name, portrait ? s.h : s.w, portrait ? s.w : s.h, false);
      if (choice.maxScale >= requestedScale - EPS) return choice;
    }

    // Oversize designs get an exact custom page, rounded up to 5 mm.
    const neededW = Math.max(blankW * requestedScale + 2 * (margin + Math.abs(offsetX)), blankH * requestedScale + 2 * (margin + Math.abs(offsetY)));
    const neededH = Math.min(blankW * requestedScale + 2 * (margin + Math.abs(offsetX)), blankH * requestedScale + 2 * (margin + Math.abs(offsetY)));
    const long = up5(neededW);
    const short = up5(neededH);
    return make('custom', 'Custom', portrait ? short : long, portrait ? long : short, true);
  }

  if (settings.preset === 'custom') {
    const w = clamp(Number.isFinite(settings.customW) ? settings.customW : 297, 50, 2000);
    const h = clamp(Number.isFinite(settings.customH) ? settings.customH : 210, 50, 2000);
    return make('custom', 'Custom', w, h, true);
  }

  const preset = PAPER_SIZES.find((s) => s.id === settings.preset);
  if (!preset) {
    const first = SHEET_SIZES[0];
    return make(first.id, first.name, first.w, first.h, false);
  }
  const portrait = settings.orientation === 'portrait';
  return make(
    preset.id, preset.name,
    portrait ? preset.h : preset.w,
    portrait ? preset.w : preset.h,
    false,
  );
}
