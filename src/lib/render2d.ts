import { defaultImageEdits, type Design, type ImageEdits } from './store';
import { creaseSegment, panelPoly, type Net, type Panel } from './geometry';

/* ---------------- image cache ---------------- */
const cache = new Map<string, HTMLImageElement>();
const pending = new Set<string>();

export function getImage(src: string, onLoad?: () => void): HTMLImageElement | null {
  if (!src) return null;
  const hit = cache.get(src);
  if (hit) return hit.complete && hit.naturalWidth ? hit : null;
  if (pending.has(src)) return null;
  pending.add(src);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => { cache.set(src, img); pending.delete(src); onLoad?.(); };
  img.onerror = () => { pending.delete(src); };
  img.src = src;
  cache.set(src, img);
  return null;
}

export function preloadAll(design: Design): Promise<void[]> {
  const srcs = design.objects.filter((o) => o.type === 'image' && o.src).map((o) => o.src);
  return Promise.all(srcs.map((src) => new Promise<void>((res) => {
    const done = () => res();
    const img = getImage(src, done);
    if (img) res();
    else setTimeout(done, 2500);
  })));
}

/* ---------------- helpers ---------------- */

export function pathPoly(ctx: CanvasRenderingContext2D, poly: [number, number][]) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawText(ctx: CanvasRenderingContext2D, o: Design['objects'][number]) {
  const lines = (o.text || '').split('\n');
  ctx.fillStyle = o.fill;
  ctx.font = `${o.weight} ${o.size}px ${o.font}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = o.align;
  try { (ctx as unknown as { letterSpacing: string }).letterSpacing = `${o.tracking}px`; } catch { /* ignore */ }
  const lh = o.size * o.lineHeight;
  const total = lines.length * lh;
  const cx = o.align === 'left' ? 0 : o.align === 'right' ? o.w : o.w / 2;
  lines.forEach((ln, i) => {
    const y = o.h / 2 - total / 2 + lh * (i + 0.5);
    if (o.stroke !== 'none' && o.strokeW > 0) {
      ctx.lineWidth = o.strokeW;
      ctx.strokeStyle = o.stroke;
      ctx.strokeText(ln, cx, y);
    }
    ctx.fillText(ln, cx, y);
  });
  try { (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px'; } catch { /* ignore */ }
}

/** CSS filter string for the non-destructive photo edits (mm-aware blur). */
export function imageFilter(e: ImageEdits, pxPerMm = 1): string {
  const f: string[] = [];
  if (e.brightness !== 100) f.push(`brightness(${e.brightness}%)`);
  if (e.contrast !== 100) f.push(`contrast(${e.contrast}%)`);
  if (e.saturation !== 100) f.push(`saturate(${e.saturation}%)`);
  if (e.hue) f.push(`hue-rotate(${e.hue}deg)`);
  if (e.grayscale) f.push(`grayscale(${e.grayscale}%)`);
  if (e.sepia) f.push(`sepia(${e.sepia}%)`);
  if (e.invert) f.push(`invert(${e.invert}%)`);
  if (e.blur > 0) f.push(`blur(${(e.blur * pxPerMm).toFixed(3)}px)`);
  return f.length ? f.join(' ') : 'none';
}

function drawImageObj(ctx: CanvasRenderingContext2D, o: Design['objects'][number], repaint?: () => void) {
  if (o.radius > 0) { roundRect(ctx, 0, 0, o.w, o.h, o.radius); ctx.clip(); }
  const img = getImage(o.src, repaint);
  if (!img) {
    ctx.fillStyle = 'rgba(120,130,145,0.25)';
    ctx.fillRect(0, 0, o.w, o.h);
    return;
  }
  const e: ImageEdits = { ...defaultImageEdits(), ...o.img };

  // crop the source rect first — everything downstream sees the cropped photo
  const cl = Math.min(0.9, Math.max(0, e.cropL));
  const cr = Math.min(0.9, Math.max(0, e.cropR));
  const ct = Math.min(0.9, Math.max(0, e.cropT));
  const cb = Math.min(0.9, Math.max(0, e.cropB));
  const baseX = img.naturalWidth * cl;
  const baseY = img.naturalHeight * ct;
  const baseW = Math.max(1, img.naturalWidth * (1 - cl - cr));
  const baseH = Math.max(1, img.naturalHeight * (1 - ct - cb));

  const ir = baseW / baseH;
  const br = o.w / o.h;
  let sx = baseX, sy = baseY, sw = baseW, sh = baseH;
  let dx = 0, dy = 0, dw = o.w, dh = o.h;
  if (o.fit === 'cover') {
    if (ir > br) { sw = baseH * br; sx = baseX + (baseW - sw) / 2; }
    else { sh = baseW / br; sy = baseY + (baseH - sh) / 2; }
  } else if (o.fit === 'contain') {
    if (ir > br) { dh = o.w / ir; dy = (o.h - dh) / 2; }
    else { dw = o.h * ir; dx = (o.w - dw) / 2; }
  }

  // approximate device scale so blur reads the same at any zoom / export dpi
  const m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
  const pxPerMm = m ? Math.max(0.001, Math.hypot(m.a, m.b)) : 1;

  ctx.save();
  const filter = imageFilter(e, 1);
  if (filter !== 'none') {
    try { ctx.filter = imageFilter(e, pxPerMm); } catch { /* no filter support */ }
  }
  if (e.flipH || e.flipV) {
    ctx.translate(e.flipH ? o.w : 0, e.flipV ? o.h : 0);
    ctx.scale(e.flipH ? -1 : 1, e.flipV ? -1 : 1);
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();

  // sharpen: cheap high-pass — the blurred copy lightened over the original
  if (e.sharpen > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = Math.min(1, e.sharpen / 140);
    const base = imageFilter(e, pxPerMm);
    try { ctx.filter = `${base === 'none' ? '' : base} blur(${Math.max(0.6, pxPerMm * 0.25).toFixed(2)}px) contrast(180%)`.trim(); } catch { /* ignore */ }
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
  }

  // exposure wash
  if (e.exposure !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = e.exposure > 0 ? 'screen' : 'multiply';
    ctx.globalAlpha = Math.min(0.85, Math.abs(e.exposure) / 130);
    ctx.fillStyle = e.exposure > 0 ? '#ffffff' : '#000000';
    ctx.fillRect(dx, dy, dw, dh);
    ctx.restore();
  }

  // colour tint (photo filter)
  if (e.tintAmt > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'color';
    ctx.globalAlpha = Math.min(1, e.tintAmt / 100);
    ctx.fillStyle = e.tint || '#ff9a3c';
    ctx.fillRect(dx, dy, dw, dh);
    ctx.restore();
  }

  // vignette
  if (e.vignette > 0) {
    const cx = dx + dw / 2, cy = dy + dh / 2;
    const r = Math.hypot(dw, dh) / 2;
    const g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${Math.min(0.95, e.vignette / 100)})`);
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.restore();
  }
}

export function drawObject(ctx: CanvasRenderingContext2D, o: Design['objects'][number], repaint?: () => void) {
  if (o.hidden) return;
  ctx.save();
  ctx.globalAlpha = o.opacity;
  ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
  ctx.rotate((o.rot * Math.PI) / 180);
  ctx.translate(-o.w / 2, -o.h / 2);
  switch (o.type) {
    case 'rect':
      roundRect(ctx, 0, 0, o.w, o.h, o.radius);
      ctx.fillStyle = o.fill; ctx.fill();
      if (o.stroke !== 'none' && o.strokeW > 0) { ctx.lineWidth = o.strokeW; ctx.strokeStyle = o.stroke; ctx.stroke(); }
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(o.w / 2, o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = o.fill; ctx.fill();
      if (o.stroke !== 'none' && o.strokeW > 0) { ctx.lineWidth = o.strokeW; ctx.strokeStyle = o.stroke; ctx.stroke(); }
      break;
    case 'line':
      ctx.strokeStyle = o.fill;
      ctx.lineWidth = Math.max(0.2, o.h);
      ctx.beginPath(); ctx.moveTo(0, o.h / 2); ctx.lineTo(o.w, o.h / 2); ctx.stroke();
      break;
    case 'text': drawText(ctx, o); break;
    case 'image': drawImageObj(ctx, o, repaint); break;
  }
  ctx.restore();
}

/** Union silhouette of the whole net as a clip path. */
export function clipToNet(ctx: CanvasRenderingContext2D, net: Net) {
  ctx.beginPath();
  for (const p of net.panels) {
    const poly = panelPoly(p);
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
  ctx.clip();
}

export interface ArtOpts {
  clip?: boolean;
  repaint?: () => void;
  /** draw a subtle paper grain */
  grain?: number;
}

/** Draw the printed artwork in mm space (caller sets the transform). */
export function drawArtwork(ctx: CanvasRenderingContext2D, design: Design, net: Net, opts: ArtOpts = {}) {
  const b = net.bounds;
  ctx.save();
  if (opts.clip) clipToNet(ctx, net);
  // base board colour (bleed generously past the net)
  ctx.fillStyle = design.boardColor;
  ctx.fillRect(b.x - 30, b.y - 30, b.w + 60, b.h + 60);
  // panel fills
  for (const p of net.panels) {
    const fill = design.panelFills[p.id];
    if (!fill || fill === 'none') continue;
    ctx.save();
    pathPoly(ctx, panelPoly(p));
    ctx.clip();
    ctx.fillStyle = fill;
    ctx.fillRect(p.x - 20, p.y - 20, p.w + 40, p.h + 40);
    ctx.restore();
  }
  for (const o of design.objects) drawObject(ctx, o, opts.repaint);
  ctx.restore();
}

/* ---------------- dieline overlay ---------------- */

export interface DielineStyle {
  cut: string; crease: string; bleed: string; safe: string;
  lw: number; labels: boolean; showBleed: boolean; showSafe: boolean;
  labelSize: number;
}

export function drawDieline(
  ctx: CanvasRenderingContext2D, net: Net, style: DielineStyle, bleed = 3, safe = 4,
) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (style.showBleed) {
    const b = net.bounds;
    ctx.strokeStyle = style.bleed;
    ctx.lineWidth = style.lw;
    ctx.setLineDash([style.lw * 6, style.lw * 4]);
    ctx.strokeRect(b.x - bleed, b.y - bleed, b.w + bleed * 2, b.h + bleed * 2);
    ctx.setLineDash([]);
  }

  // cut outline: draw every panel outline, then overpaint creases
  ctx.strokeStyle = style.cut;
  ctx.lineWidth = style.lw;
  for (const p of net.panels) { pathPoly(ctx, panelPoly(p)); ctx.stroke(); }

  // creases
  ctx.strokeStyle = style.crease;
  ctx.lineWidth = style.lw * 1.1;
  ctx.setLineDash([style.lw * 5, style.lw * 3.5]);
  for (const p of net.panels) {
    if (!p.parent) continue;
    const parent = net.byId[p.parent];
    const seg = creaseSegment(p, parent);
    if (!seg) continue;
    ctx.beginPath(); ctx.moveTo(seg[0], seg[1]); ctx.lineTo(seg[2], seg[3]); ctx.stroke();
  }
  ctx.setLineDash([]);

  if (style.showSafe) {
    ctx.strokeStyle = style.safe;
    ctx.lineWidth = style.lw * 0.8;
    ctx.setLineDash([style.lw * 2.5, style.lw * 2.5]);
    for (const p of net.panels) {
      if (p.kind !== 'panel') continue;
      if (p.w > safe * 2.5 && p.h > safe * 2.5) ctx.strokeRect(p.x + safe, p.y + safe, p.w - safe * 2, p.h - safe * 2);
    }
    ctx.setLineDash([]);
  }

  if (style.labels) {
    ctx.fillStyle = style.cut;
    ctx.globalAlpha = 0.55;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of net.panels) {
      const s = Math.min(style.labelSize, p.w / 4.2, p.h / 2.2);
      if (s < 1.2) continue;
      ctx.font = `600 ${s}px Inter, system-ui, sans-serif`;
      ctx.fillText(p.label.toUpperCase(), p.x + p.w / 2, p.y + p.h / 2);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Offscreen artwork texture sized to the net bounds. */
export function renderTexture(design: Design, net: Net, pxPerMm: number, max = 4096): HTMLCanvasElement {
  const b = net.bounds;
  let s = pxPerMm;
  if (b.w * s > max || b.h * s > max) s = Math.min(max / b.w, max / b.h);
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(b.w * s));
  c.height = Math.max(2, Math.round(b.h * s));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(s, s);
  ctx.translate(-b.x, -b.y);
  drawArtwork(ctx, design, net, {});
  return c;
}

/** Inner-face texture (plain liner + optional subtle print). */
export function renderInnerTexture(color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 8, 8);
  return c;
}

export function hitTest(design: Design, mx: number, my: number): string | null {
  for (let i = design.objects.length - 1; i >= 0; i--) {
    const o = design.objects[i];
    if (o.locked || o.hidden) continue;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const a = (-o.rot * Math.PI) / 180;
    const dx = mx - cx, dy = my - cy;
    const lx = dx * Math.cos(a) - dy * Math.sin(a) + o.w / 2;
    const ly = dx * Math.sin(a) + dy * Math.cos(a) + o.h / 2;
    const pad = o.type === 'line' ? 2 : 0;
    if (lx >= -pad && lx <= o.w + pad && ly >= -pad && ly <= o.h + pad) return o.id;
  }
  return null;
}

export function panelAt(net: Net, mx: number, my: number): Panel | null {
  for (let i = net.panels.length - 1; i >= 0; i--) {
    const p = net.panels[i];
    const poly = panelPoly(p);
    let inside = false;
    for (let j = 0, k = poly.length - 1; j < poly.length; k = j++) {
      const [xi, yi] = poly[j], [xj, yj] = poly[k];
      if ((yi > my) !== (yj > my) && mx < ((xj - xi) * (my - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return p;
  }
  return null;
}
