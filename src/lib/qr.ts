/**
 * QR — a dependency-free ISO/IEC 18004 Model 2 encoder plus three studio
 * styles for putting scannable codes on cartons.
 *
 * Byte mode (UTF-8), versions 1–10, error correction L/M/Q/H. Everything is
 * deterministic: the same text + style always renders the same modules, so
 * thumbnails, sessions and print exports agree.
 *
 * The three platform options:
 *   classic  – crisp square modules, ECC M, maximum compatibility
 *   rounded  – dot/rounded modules on a soft ground, ECC H, friendlier look
 *   branded  – brand colours + centred logo plate, ECC H (the plate sits in
 *              the code's damage budget, so it still scans everywhere)
 */

export type QREcc = 'L' | 'M' | 'Q' | 'H';
export type QRStyle = 'classic' | 'rounded' | 'branded';

export interface QRMatrix { size: number; version: number; dark: Uint8Array; }

export const QR_STYLE_META: Record<QRStyle, { name: string; blurb: string; ecc: QREcc }> = {
  classic: { name: 'Classic', blurb: 'Square modules, quiet zone 4, ECC M — the scanner-proof default.', ecc: 'M' },
  rounded: { name: 'Rounded', blurb: 'Soft dot modules on a tinted ground, ECC H — a friendlier retail look.', ecc: 'H' },
  branded: { name: 'Branded', blurb: 'Brand ink + centred logo plate, ECC H — the code survives the cut-out.', ecc: 'H' },
};

/* ------------------------- GF(256) / Reed–Solomon ------------------------ */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const gmul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** generator polynomial of degree n (leading 1 implicit), high→low */
function rsGenerator(n: number): Uint8Array {
  const g = Array.from({ length: n }, () => 0);
  g[n - 1] = 1;
  let root = 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      g[j] = gmul(g[j], root);
      if (j + 1 < n) g[j] ^= g[j + 1];
    }
    root = gmul(root, 2);
  }
  return Uint8Array.from(g);
}

function rsRemainder(data: Uint8Array, gen: Uint8Array): Uint8Array {
  const res = new Uint8Array(gen.length);
  for (const b of data) {
    const f = b ^ res[0];
    res.copyWithin(0, 1);
    res[res.length - 1] = 0;
    if (f) for (let i = 0; i < gen.length; i++) res[i] ^= gmul(gen[i], f);
  }
  return res;
}

/* ------------------------------- block table ----------------------------- */
/** [ecPerBlock, [blockCount, dataPerBlock][]] per version (1-10) and level */
const TABLE: Record<QREcc, [number, [number, number][]][]> = {
  L: [
    [7, [[1, 19]]], [10, [[1, 34]]], [15, [[1, 55]]], [20, [[1, 80]]], [26, [[1, 108]]],
    [18, [[2, 68]]], [20, [[2, 78]]], [24, [[2, 97]]], [30, [[2, 116]]], [18, [[2, 68], [2, 69]]],
  ],
  M: [
    [10, [[1, 16]]], [16, [[1, 28]]], [26, [[1, 44]]], [18, [[2, 32]]], [24, [[2, 43]]],
    [16, [[4, 27]]], [18, [[4, 31]]], [22, [[2, 38], [2, 39]]], [22, [[3, 36], [2, 37]]], [26, [[4, 43], [1, 44]]],
  ],
  Q: [
    [13, [[1, 13]]], [22, [[1, 22]]], [18, [[2, 17]]], [26, [[2, 24]]], [18, [[2, 15], [2, 16]]],
    [24, [[4, 19]]], [18, [[2, 14], [4, 15]]], [22, [[4, 18], [2, 19]]], [20, [[4, 16], [4, 17]]], [24, [[6, 19], [2, 20]]],
  ],
  H: [
    [17, [[1, 9]]], [28, [[1, 16]]], [22, [[2, 13]]], [16, [[4, 9]]], [22, [[2, 11], [2, 12]]],
    [28, [[4, 15]]], [26, [[4, 13], [1, 14]]], [26, [[4, 14], [2, 15]]], [24, [[4, 12], [4, 13]]], [28, [[6, 15], [2, 16]]],
  ],
};

const ALIGN: number[][] = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

const ECC_BITS: Record<QREcc, number> = { L: 1, M: 0, Q: 3, H: 2 };

function capacity(version: number, ecc: QREcc): number {
  const [, groups] = TABLE[ecc][version - 1];
  return groups.reduce((n, [c, d]) => n + c * d, 0);
}

/* --------------------------------- encoding ------------------------------ */

const toBytes = (text: string): number[] => {
  const out: number[] = [];
  for (const ch of new TextEncoder().encode(text)) out.push(ch);
  return out;
};

function pickVersion(byteLen: number, ecc: QREcc): number {
  for (let v = 1; v <= 10; v++) {
    const ccBits = v <= 9 ? 8 : 16;
    const bits = 4 + ccBits + byteLen * 8;
    if (bits <= capacity(v, ecc) * 8) return v;
  }
  return -1;
}

function buildCodewords(text: string, ecc: QREcc, version: number): Uint8Array {
  const bytes = toBytes(text);
  const [ec, groups] = TABLE[ecc][version - 1];
  const totalData = capacity(version, ecc);
  const ccBits = version <= 9 ? 8 : 16;

  // bit buffer
  let bits = '';
  bits += '0100'; // byte mode
  bits += bytes.length.toString(2).padStart(ccBits, '0');
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');

  const capBits = totalData * 8;
  bits += '0000'.slice(0, Math.min(4, capBits - bits.length)); // terminator
  while (bits.length % 8) bits += '0';
  const pads = [0xec, 0x11];
  for (let i = 0; bits.length < capBits; i++) bits += pads[i % 2].toString(2).padStart(8, '0');

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8), 2));

  // split into blocks, compute EC, interleave
  const blocks: { d: Uint8Array; e: Uint8Array }[] = [];
  const gen = rsGenerator(ec);
  let o = 0;
  for (const [count, per] of groups) {
    for (let b = 0; b < count; b++) {
      const d = Uint8Array.from(data.slice(o, o + per)); o += per;
      blocks.push({ d, e: rsRemainder(d, gen) });
    }
  }
  const out: number[] = [];
  const maxD = Math.max(...blocks.map((b) => b.d.length));
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ec; i++) for (const b of blocks) out.push(b.e[i]);
  return Uint8Array.from(out);
}

/* ---------------------------------- matrix ------------------------------- */

function formatBits(ecc: QREcc, mask: number): number {
  const data = (ECC_BITS[ecc] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function versionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

export function qrEncode(text: string, ecc: QREcc = 'M', forceMask = -1): QRMatrix {
  const bytes = toBytes(text);
  const version = pickVersion(bytes.length, ecc);
  if (version < 0) throw new Error(`QR text is too long for the built-in encoder (${bytes.length} bytes). Keep it under ${capacity(10, ecc)} bytes.`);

  const size = 17 + version * 4;
  const dark = new Uint8Array(size * size);
  const fn = new Uint8Array(size * size); // function-module map
  const at = (r: number, c: number) => dark[r * size + c];
  const set = (r: number, c: number, v: number, f = true) => {
    dark[r * size + c] = v ? 1 : 0;
    if (f) fn[r * size + c] = 1;
  };

  // finder + separators
  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = r0 + r, cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      const on = r >= 0 && r <= 6 && c >= 0 && c <= 6 &&
        (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      set(rr, cc, on ? 1 : 0);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  // timing
  for (let i = 8; i < size - 8; i++) {
    set(6, i, (i % 2 === 0) ? 1 : 0);
    set(i, 6, (i % 2 === 0) ? 1 : 0);
  }

  // alignment
  const centers = ALIGN[version];
  for (const r of centers) for (const c of centers) {
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1 ? 1 : 0);
    }
  }

  // dark module + reserve format areas
  set(size - 8, 8, 1);
  for (let i = 0; i < 9; i++) { if (!fn[8 * size + i] ) fn[8 * size + i] = 1; if (!fn[i * size + 8]) fn[i * size + 8] = 1; }
  for (let i = 0; i < 8; i++) { fn[8 * size + (size - 1 - i)] = 1; fn[(size - 1 - i) * size + 8] = 1; }

  // version info (v >= 7)
  if (version >= 7) {
    const vb = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (vb >> i) & 1;
      const r = Math.floor(i / 3), c = size - 11 + (i % 3);
      set(r, c, bit); set(c, r, bit);
    }
  }

  // data placement (zigzag)
  const cw = buildCodewords(text, ecc, version);
  const place = (mask: number) => {
    let bi = 0; // bit index
    const totalBits = cw.length * 8;
    let col = size - 1;
    let upward = true;
    while (col > 0) {
      if (col === 6) col--;
      for (let i = 0; i < size; i++) {
        const r = upward ? size - 1 - i : i;
        for (let k = 0; k < 2; k++) {
          const c = col - k;
          if (fn[r * size + c]) continue;
          let bit = 0;
          if (bi < totalBits) bit = (cw[bi >> 3] >> (7 - (bi & 7))) & 1;
          bi++;
          if (MASKS[mask](r, c)) bit ^= 1;
          dark[r * size + c] = bit;
        }
      }
      upward = !upward;
      col -= 2;
    }
  };

  const penalty = (): number => {
    let p = 0;
    const run = (vals: number[]) => {
      let cur = vals[0], len = 1;
      for (let i = 1; i < vals.length; i++) {
        if (vals[i] === cur) len++;
        else { if (len >= 5) p += 3 + len - 5; cur = vals[i]; len = 1; }
      }
      if (len >= 5) p += 3 + len - 5;
    };
    for (let r = 0; r < size; r++) run(Array.from({ length: size }, (_, c) => at(r, c)));
    for (let c = 0; c < size; c++) run(Array.from({ length: size }, (_, r) => at(r, c)));
    for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
      const v = at(r, c);
      if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) p += 3;
    }
    const pat = (vals: number[]) => {
      for (let i = 0; i + 10 < vals.length; i++) {
        const w = vals.slice(i, i + 11).join('');
        if (w === '10111010000' || w === '00001011101') p += 40;
      }
    };
    for (let r = 0; r < size; r++) pat(Array.from({ length: size }, (_, c) => at(r, c)));
    for (let c = 0; c < size; c++) pat(Array.from({ length: size }, (_, r) => at(r, c)));
    let darkCount = 0;
    for (let i = 0; i < dark.length; i++) darkCount += dark[i];
    p += 10 * Math.floor(Math.abs((darkCount * 100) / (size * size) - 50) / 5);
    return p;
  };

  let best = forceMask;
  if (best < 0) {
    let bestP = Infinity;
    for (let m = 0; m < 8; m++) {
      place(m);
      const p = penalty();
      if (p < bestP) { bestP = p; best = m; }
    }
  }
  place(best);

  // format info, two copies (row, col per ISO 18004 figure 25)
  const fb = formatBits(ecc, best);
  const setF = (i: number, bit: number) => {
    // first copy around the top-left finder
    if (i <= 5) set(i, 8, bit, true);
    else if (i === 6) set(7, 8, bit, true);
    else if (i === 7) set(8, 8, bit, true);
    else if (i === 8) set(8, 7, bit, true);
    else set(8, 14 - i, bit, true);
    // second copy: below top-left / right of top-left
    if (i < 8) set(8, size - 1 - i, bit, true);
    else set(size - 15 + i, 8, bit, true);
  };
  for (let i = 0; i < 15; i++) setF(i, (fb >> i) & 1);

  return { size, version, dark };
}

/* -------------------------------- rendering ------------------------------ */

export interface QRDrawOpts {
  style: QRStyle;
  fg: string;
  bg: string;           // '' = transparent
  quiet: number;        // modules of quiet zone
  px: number;           // pixels per module
  label?: string;       // branded plate text (1–2 chars)
}

export const QR_DEFAULTS: Record<QRStyle, QRDrawOpts> = {
  classic: { style: 'classic', fg: '#17181c', bg: '#ffffff', quiet: 4, px: 16 },
  rounded: { style: 'rounded', fg: '#12343b', bg: '#f6f1e7', quiet: 4, px: 16 },
  branded: { style: 'branded', fg: '#7a2e1d', bg: '#ffffff', quiet: 4, px: 16, label: 'BC' },
};

/** Draw an encoded matrix with one of the three platform styles. */
export function qrDraw(ctx: CanvasRenderingContext2D, m: QRMatrix, o: QRDrawOpts, ox = 0, oy = 0): void {
  const { size } = m;
  const px = o.px;
  const q = o.quiet * px;
  const full = (size + o.quiet * 2) * px;

  if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(ox, oy, full, full); }

  ctx.fillStyle = o.fg;
  const darkAt = (r: number, c: number) => r >= 0 && c >= 0 && r < size && c < size && m.dark[r * size + c] === 1;

  const drawFinder = (r0: number, c0: number) => {
    const X = ox + q + c0 * px, Y = oy + q + r0 * px;
    if (o.style === 'rounded') {
      // radii kept ≤ ~1.7·px so every finder module centre stays on the
      // right side of the ink — soft look, spec-correct ratios
      const rad = px * 1.4;
      ctx.beginPath();
      ctx.roundRect(X, Y, 7 * px, 7 * px, rad);
      const hole = px;
      ctx.roundRect(X + hole, Y + hole, 7 * px - hole * 2, 7 * px - hole * 2, px * 1.1);
      ctx.fill('evenodd');
      ctx.beginPath();
      ctx.roundRect(X + 2 * px, Y + 2 * px, 3 * px, 3 * px, px * 0.9);
      ctx.fill();
    } else if (o.style === 'branded') {
      ctx.beginPath();
      ctx.roundRect(X, Y, 7 * px, 7 * px, px * 1.6);
      ctx.roundRect(X + px, Y + px, 5 * px, 5 * px, px);
      ctx.fill('evenodd');
      ctx.beginPath();
      ctx.roundRect(X + 2 * px, Y + 2 * px, 3 * px, 3 * px, px * 0.8);
      ctx.fill();
    } else {
      ctx.fillRect(X, Y, 7 * px, px); ctx.fillRect(X, Y + 6 * px, 7 * px, px);
      ctx.fillRect(X, Y, px, 7 * px); ctx.fillRect(X + 6 * px, Y, px, 7 * px);
      ctx.fillRect(X + 2 * px, Y + 2 * px, 3 * px, 3 * px);
    }
  };

  // finder zones are handled by their own stylised drawing
  const inFinder = (r: number, c: number) =>
    (r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!darkAt(r, c) || inFinder(r, c)) continue;
      const X = ox + q + c * px, Y = oy + q + r * px;
      if (o.style === 'rounded') {
        // merge vertical neighbours into pills for a softer weave; keep the
        // duty cycle high enough (≥86%) that cheap scanners still lock on
        const drawable = (rr: number, cc: number) => darkAt(rr, cc) && !inFinder(rr, cc);
        if (drawable(r - 1, c)) continue; // top of a run draws the whole pill
        let len = 1;
        while (drawable(r + len, c)) len++;
        // bridge horizontally into a dark right neighbour so runs read solid
        const w = px * 0.9 + (drawable(r, c + 1) ? px * 0.15 : 0);
        ctx.beginPath();
        ctx.roundRect(X + px * 0.05, Y + px * 0.05, w, px * 0.9 + (len - 1) * px, px * 0.42);
        ctx.fill();
      } else if (o.style === 'branded') {
        ctx.beginPath();
        ctx.roundRect(X + px * 0.06, Y + px * 0.06, px * 0.88, px * 0.88, px * 0.26);
        ctx.fill();
      } else {
        ctx.fillRect(X, Y, px, px);
      }
    }
  }

  drawFinder(0, 0); drawFinder(0, size - 7); drawFinder(size - 7, 0);

  if (o.style === 'branded' && o.label) {
    const side = size * 0.26;
    const cx = ox + q + (size * px) / 2, cy = oy + q + (size * px) / 2;
    const half = (side * px) / 2 + px;
    ctx.fillStyle = o.bg || '#ffffff';
    ctx.beginPath();
    ctx.roundRect(cx - half, cy - half, half * 2, half * 2, px * 1.4);
    ctx.fill();
    ctx.fillStyle = o.fg;
    ctx.font = `800 ${px * 3}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.label.slice(0, 2).toUpperCase(), cx, cy + px * 0.2);
  }
}

/** Browser-side rasteriser → PNG data URL (crisp at print size). */
export function qrDataURL(text: string, o: QRDrawOpts): string {
  const ecc = o.style === 'classic' ? 'M' : 'H';
  const m = qrEncode(text, ecc);
  const full = (m.size + o.quiet * 2) * o.px;
  const c = document.createElement('canvas');
  c.width = c.height = full;
  const ctx = c.getContext('2d')!;
  qrDraw(ctx, m, o);
  return c.toDataURL('image/png');
}
