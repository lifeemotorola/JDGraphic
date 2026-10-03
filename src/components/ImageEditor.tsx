import { useEffect, useRef, useState } from 'react';
import { defaultImageEdits, isPristine, type DesignObject, type ImageEdits } from '../lib/store';
import { useStore } from '../lib/store';
import { clampObjectToBounds, getImage, hostPanelFor, imageAspect, imageFilter } from '../lib/render2d';
import { ColorIn, Field, Group, Icon, I, Segmented, Slider } from './ui';

/* ------------------------------------------------------------------ *
 * Photoshop-style photo editor for the selected image layer.
 * Everything here is non-destructive: the edits live on the object and
 * are re-applied at draw time by render2d, so the artboard, the 3D
 * preview and every export stay in sync.
 * ------------------------------------------------------------------ */

type Tab = 'adjust' | 'filters' | 'crop';

interface Preset { id: string; name: string; edits: Partial<ImageEdits> }

const PRESETS: Preset[] = [
  { id: 'original', name: 'Original', edits: {} },
  { id: 'punch', name: 'Punch', edits: { contrast: 122, saturation: 126, sharpen: 30 } },
  { id: 'matte', name: 'Matte', edits: { contrast: 88, saturation: 92, exposure: 12, vignette: 12 } },
  { id: 'mono', name: 'Mono', edits: { grayscale: 100, contrast: 118 } },
  { id: 'noir', name: 'Noir', edits: { grayscale: 100, contrast: 150, brightness: 92, vignette: 42 } },
  { id: 'vintage', name: 'Vintage', edits: { sepia: 45, saturation: 84, contrast: 94, vignette: 26 } },
  { id: 'warm', name: 'Warm', edits: { tint: '#ff9a3c', tintAmt: 26, saturation: 110 } },
  { id: 'cool', name: 'Cool', edits: { tint: '#3ca4ff', tintAmt: 26, saturation: 104 } },
  { id: 'fade', name: 'Fade', edits: { contrast: 82, exposure: 20, saturation: 78 } },
  { id: 'bright', name: 'Bright', edits: { brightness: 116, exposure: 10, contrast: 104 } },
  { id: 'dark', name: 'Moody', edits: { brightness: 88, contrast: 126, vignette: 34, saturation: 92 } },
  { id: 'invert', name: 'Invert', edits: { invert: 100 } },
];

/** Small live thumbnail that renders the photo through the current edits. */
function Preview({ o }: { o: DesignObject }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [, bump] = useState(0);
  const e: ImageEdits = { ...defaultImageEdits(), ...o.img };

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const W = 244, H = 150;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const img = getImage(o.src, () => bump((n) => n + 1));
    if (!img) {
      ctx.fillStyle = 'rgba(120,130,145,0.22)';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const cl = Math.min(0.9, Math.max(0, e.cropL));
    const cr = Math.min(0.9, Math.max(0, e.cropR));
    const ct = Math.min(0.9, Math.max(0, e.cropT));
    const cb = Math.min(0.9, Math.max(0, e.cropB));
    const sx = img.naturalWidth * cl;
    const sy = img.naturalHeight * ct;
    const sw = Math.max(1, img.naturalWidth * (1 - cl - cr));
    const sh = Math.max(1, img.naturalHeight * (1 - ct - cb));
    const ir = sw / sh, br = W / H;
    let dx = 0, dy = 0, dw = W, dh = H;
    if (o.fit !== 'stretch') {
      if (ir > br) { dh = W / ir; dy = (H - dh) / 2; }
      else { dw = H * ir; dx = (W - dw) / 2; }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, dy, dw, dh);
    ctx.clip();

    ctx.save();
    try { ctx.filter = imageFilter(e, 1); } catch { /* ignore */ }
    if (e.flipH || e.flipV) {
      ctx.translate(e.flipH ? dx * 2 + dw : 0, e.flipV ? dy * 2 + dh : 0);
      ctx.scale(e.flipH ? -1 : 1, e.flipV ? -1 : 1);
    }
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();

    if (e.sharpen > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = Math.min(1, e.sharpen / 140);
      try { ctx.filter = 'blur(0.7px) contrast(180%)'; } catch { /* ignore */ }
      if (e.flipH || e.flipV) {
        ctx.translate(e.flipH ? dx * 2 + dw : 0, e.flipV ? dy * 2 + dh : 0);
        ctx.scale(e.flipH ? -1 : 1, e.flipV ? -1 : 1);
      }
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      ctx.restore();
    }
    if (e.exposure !== 0) {
      ctx.save();
      ctx.globalCompositeOperation = e.exposure > 0 ? 'screen' : 'multiply';
      ctx.globalAlpha = Math.min(0.85, Math.abs(e.exposure) / 130);
      ctx.fillStyle = e.exposure > 0 ? '#fff' : '#000';
      ctx.fillRect(dx, dy, dw, dh);
      ctx.restore();
    }
    if (e.tintAmt > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'color';
      ctx.globalAlpha = Math.min(1, e.tintAmt / 100);
      ctx.fillStyle = e.tint;
      ctx.fillRect(dx, dy, dw, dh);
      ctx.restore();
    }
    if (e.vignette > 0) {
      const cx = dx + dw / 2, cy = dy + dh / 2;
      const r = Math.hypot(dw, dh) / 2;
      const g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${Math.min(0.95, e.vignette / 100)})`);
      ctx.fillStyle = g;
      ctx.fillRect(dx, dy, dw, dh);
    }
    ctx.restore();
  });

  return <canvas ref={ref} className="imgfx-preview" />;
}

export default function ImageEditor({ o }: { o: DesignObject }) {
  const update = useStore((s) => s.updateObject);
  const net = useStore((s) => s.net);
  const [tab, setTab] = useState<Tab>('adjust');
  const [compare, setCompare] = useState(false);

  const e: ImageEdits = { ...defaultImageEdits(), ...o.img };

  const boundsForObject = () => {
    const p = hostPanelFor(net, o.x, o.y, o.w, o.h);
    const inPanel =
      o.x >= p.x - 1 &&
      o.y >= p.y - 1 &&
      o.x + o.w <= p.x + p.w + 1 &&
      o.y + o.h <= p.y + p.h + 1;
    return inPanel ? p : net.bounds;
  };

  const syncFrame = (nextEdits: ImageEdits, nextRot = o.rot, nextFit?: DesignObject['fit']) => {
    const fit: DesignObject['fit'] = nextFit ?? (o.fit === 'cover' ? 'contain' : o.fit);
    const ar = fit === 'stretch' ? null : imageAspect({ src: o.src, img: nextEdits });
    let w = o.w;
    let h = o.h;
    if (ar && ar > 0) {
      const area = Math.max(4, o.w * o.h);
      h = Math.max(2, Math.sqrt(area / ar));
      w = Math.max(2, h * ar);
    }
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    const clamped = clampObjectToBounds(
      { x: cx - w / 2, y: cy - h / 2, w, h, rot: nextRot },
      boundsForObject(),
      ar,
    );
    return { ...clamped, rot: nextRot, fit, img: nextEdits };
  };

  const set = (patch: Partial<ImageEdits>, key?: string) => {
    const nextEdits: ImageEdits = { ...e, ...patch };
    const cropChanged =
      patch.cropT !== undefined ||
      patch.cropB !== undefined ||
      patch.cropL !== undefined ||
      patch.cropR !== undefined;
    if (cropChanged) {
      update(o.id, syncFrame(nextEdits), key);
    } else {
      update(
        o.id,
        { img: nextEdits, ...(o.fit === 'cover' ? { fit: 'contain' as const } : {}) },
        key,
      );
    }
  };
  const shown = compare ? { ...o, img: defaultImageEdits() } : o;

  const applyPreset = (p: Preset) =>
    update(o.id, {
      img: { ...defaultImageEdits(), tint: e.tint, ...p.edits },
      ...(o.fit === 'cover' ? { fit: 'contain' as const } : {}),
    });

  return (
    <Group
      title="Photo editor"
      right={
        <span style={{ display: 'flex', gap: 4 }}>
          <button
            className={`mini${compare ? ' on' : ''}`}
            title="Hold to compare with the original"
            onMouseDown={() => setCompare(true)}
            onMouseUp={() => setCompare(false)}
            onMouseLeave={() => setCompare(false)}
            onTouchStart={() => setCompare(true)}
            onTouchEnd={() => setCompare(false)}
          >
            <Icon d={I.eye} size={12} />
          </button>
          <button className="mini" title="Reset all edits"
            onClick={() => update(o.id, syncFrame(defaultImageEdits()))}>
            <Icon d={I.reset} size={12} />
          </button>
        </span>
      }
    >
      <div className="imgfx-stage">
        <Preview o={shown} />
        {compare && <span className="imgfx-badge">Original</span>}
        {!compare && !isPristine(e) && <span className="imgfx-badge on">Edited</span>}
      </div>

      <div className="seg" style={{ margin: '8px 0 10px' }}>
        {(['adjust', 'filters', 'crop'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'adjust' ? 'Adjust' : t === 'filters' ? 'Filters' : 'Crop'}
          </button>
        ))}
      </div>

      {tab === 'adjust' && (
        <>
          <Slider label="Exposure" value={e.exposure} min={-100} max={100} step={1}
            onChange={(v) => set({ exposure: v }, 'fx-exp')} />
          <Slider label="Brightness" value={e.brightness} min={0} max={200} step={1} unit="%"
            onChange={(v) => set({ brightness: v }, 'fx-bri')} />
          <Slider label="Contrast" value={e.contrast} min={0} max={220} step={1} unit="%"
            onChange={(v) => set({ contrast: v }, 'fx-con')} />
          <Slider label="Saturation" value={e.saturation} min={0} max={250} step={1} unit="%"
            onChange={(v) => set({ saturation: v }, 'fx-sat')} />
          <Slider label="Hue shift" value={e.hue} min={-180} max={180} step={1} unit="°"
            onChange={(v) => set({ hue: v }, 'fx-hue')} />
          <Slider label="Sharpen" value={e.sharpen} min={0} max={100} step={1}
            onChange={(v) => set({ sharpen: v }, 'fx-shp')} />
          <Slider label="Blur" value={e.blur} min={0} max={8} step={0.1} unit=" mm"
            onChange={(v) => set({ blur: v }, 'fx-blur')} />
          <p className="phint">Adjustments are non-destructive — the original pixels stay untouched and every export re-renders from them.</p>
        </>
      )}

      {tab === 'filters' && (
        <>
          <div className="fx-grid">
            {PRESETS.map((p) => (
              <button key={p.id} className="fx-chip" onClick={() => applyPreset(p)} title={p.name}>
                {p.name}
              </button>
            ))}
          </div>
          <Slider label="Black & white" value={e.grayscale} min={0} max={100} step={1} unit="%"
            onChange={(v) => set({ grayscale: v }, 'fx-gs')} />
          <Slider label="Sepia" value={e.sepia} min={0} max={100} step={1} unit="%"
            onChange={(v) => set({ sepia: v }, 'fx-sep')} />
          <Slider label="Invert" value={e.invert} min={0} max={100} step={1} unit="%"
            onChange={(v) => set({ invert: v }, 'fx-inv')} />
          <Slider label="Vignette" value={e.vignette} min={0} max={100} step={1}
            onChange={(v) => set({ vignette: v }, 'fx-vig')} />
          <ColorIn label="Photo tint" value={e.tint} onChange={(v) => set({ tint: v }, 'fx-tint')} />
          <Slider label="Tint strength" value={e.tintAmt} min={0} max={100} step={1} unit="%"
            onChange={(v) => set({ tintAmt: v }, 'fx-tinta')} />
        </>
      )}

      {tab === 'crop' && (
        <>
          <Field label="Fit inside the frame">
            <Segmented value={o.fit}
              options={[{ v: 'cover', l: 'Cover' }, { v: 'contain', l: 'Contain' }, { v: 'stretch', l: 'Stretch' }]}
              onChange={(v) => {
                const nextFit = v as DesignObject['fit'];
                update(o.id, syncFrame(e, o.rot, nextFit));
              }} />
          </Field>
          <Slider label="Crop top" value={e.cropT * 100} min={0} max={80} step={1} unit="%"
            onChange={(v) => set({ cropT: Math.min(0.85 - e.cropB, v / 100) }, 'fx-ct')} />
          <Slider label="Crop bottom" value={e.cropB * 100} min={0} max={80} step={1} unit="%"
            onChange={(v) => set({ cropB: Math.min(0.85 - e.cropT, v / 100) }, 'fx-cb')} />
          <Slider label="Crop left" value={e.cropL * 100} min={0} max={80} step={1} unit="%"
            onChange={(v) => set({ cropL: Math.min(0.85 - e.cropR, v / 100) }, 'fx-cl')} />
          <Slider label="Crop right" value={e.cropR * 100} min={0} max={80} step={1} unit="%"
            onChange={(v) => set({ cropR: Math.min(0.85 - e.cropL, v / 100) }, 'fx-cr')} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className={`ebtn${e.flipH ? ' on' : ''}`} onClick={() => set({ flipH: !e.flipH })}>Flip H</button>
            <button className={`ebtn${e.flipV ? ' on' : ''}`} onClick={() => set({ flipV: !e.flipV })}>Flip V</button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button
              className="ebtn"
              onClick={() => update(o.id, syncFrame(e, ((o.rot - 90 + 540) % 360) - 180))}
            >
              Rotate −90°
            </button>
            <button
              className="ebtn"
              onClick={() => update(o.id, syncFrame(e, ((o.rot + 90 + 540) % 360) - 180))}
            >
              Rotate +90°
            </button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="ebtn" onClick={() => set({ cropT: 0, cropR: 0, cropB: 0, cropL: 0 })}>Clear crop</button>
          </div>
          <Slider label="Corner radius" value={o.radius} min={0} max={200} step={0.5} unit=" mm"
            onChange={(v) => update(o.id, { radius: v }, 'fx-rad')} />
        </>
      )}
    </Group>
  );
}
