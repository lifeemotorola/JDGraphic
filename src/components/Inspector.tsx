import { useStore } from '../lib/store';
import { clampObjectToBounds, fitBoxInRect, hostPanelFor, imageAspect } from '../lib/render2d';
import { ColorIn, Field, Group, Icon, I, NumIn, Segmented, Slider } from './ui';
import ImageEditor from './ImageEditor';

const FONTS = [
  { v: 'Inter, system-ui, sans-serif', l: 'Inter / System' },
  { v: 'Georgia, "Times New Roman", serif', l: 'Georgia Serif' },
  { v: '"Helvetica Neue", Arial, sans-serif', l: 'Helvetica' },
  { v: '"Courier New", ui-monospace, monospace', l: 'Courier Mono' },
  { v: 'Impact, "Arial Black", sans-serif', l: 'Impact' },
  { v: '"Trebuchet MS", sans-serif', l: 'Trebuchet' },
  { v: 'Verdana, Geneva, sans-serif', l: 'Verdana' },
  { v: 'Palatino, "Palatino Linotype", serif', l: 'Palatino' },
];

const typeIcon = (t: string) =>
  t === 'text' ? I.text : t === 'image' ? I.image : t === 'ellipse' ? I.circle : t === 'line' ? I.line : I.square;

const ARRANGE: { mode: 'align-l' | 'align-c' | 'align-r' | 'align-t' | 'align-m' | 'align-b' | 'dist-h' | 'dist-v'; icon: string; tip: string }[] = [
  { mode: 'align-l', icon: I.alignL, tip: 'Align left edges' },
  { mode: 'align-c', icon: I.alignC, tip: 'Align horizontal centres' },
  { mode: 'align-r', icon: I.alignR, tip: 'Align right edges' },
  { mode: 'align-t', icon: I.alignT, tip: 'Align top edges' },
  { mode: 'align-m', icon: I.alignM, tip: 'Align vertical centres' },
  { mode: 'align-b', icon: I.alignB, tip: 'Align bottom edges' },
  { mode: 'dist-h', icon: I.distH, tip: 'Distribute horizontally' },
  { mode: 'dist-v', icon: I.distV, tip: 'Distribute vertically' },
];

export default function Inspector({ open = false }: { open?: boolean }) {
  const design = useStore((s) => s.design);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const update = useStore((s) => s.updateObject);
  const remove = useStore((s) => s.removeObjects);
  const dup = useStore((s) => s.duplicate);
  const reorder = useStore((s) => s.reorder);
  const arrange = useStore((s) => s.arrange);
  const net = useStore((s) => s.net);

  const o = design.objects.find((x) => x.id === selection[0]) ?? null;
  const list = [...design.objects].reverse();

  return (
    <div className={`panel right${open ? ' open' : ''}`}>
      <Group title="Layers" right={
        <span style={{ color: 'var(--txt-3)', fontWeight: 600 }}>
          {design.objects.length}
          {list.length > 0 && (
            <button className="link-mini" style={{ marginLeft: 8 }}
              onClick={() => select(selection.length ? [] : list.map((y) => y.id))}>
              {selection.length ? 'Clear' : 'Select all'}
            </button>
          )}
        </span>
      }>
        {list.length === 0 && <div className="empty">No artwork elements yet.<br />Add text, shapes or upload a logo from the Design tab.</div>}
        {list.length > 0 && <p className="phint" style={{ margin: '0 0 6px' }}>Click to select · ⌘/Ctrl adds · Shift picks a run</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {list.map((x, i) => (
            <div
              key={x.id}
              className={`layer ${selection.includes(x.id) ? 'on' : ''}`}
              onClick={(e) => {
                if (e.shiftKey && selection.length) {
                  const marked = list.map((y, j) => selection.includes(y.id) ? j : -1).filter((j) => j >= 0);
                  const lo = Math.min(i, ...marked);
                  const hi = Math.max(i, ...marked);
                  select(list.slice(lo, hi + 1).map((y) => y.id));
                } else if (e.metaKey || e.ctrlKey) {
                  select(selection.includes(x.id)
                    ? selection.filter((id) => id !== x.id)
                    : [...selection, x.id]);
                } else {
                  select([x.id]);
                }
              }}
            >
              <Icon d={typeIcon(x.type)} size={13} />
              <span className="lname">{x.type === 'text' ? (x.text.split('\n')[0] || 'Text') : x.name}</span>
              <button className="mini" title={x.hidden ? 'Show' : 'Hide'}
                onClick={(e) => { e.stopPropagation(); update(x.id, { hidden: !x.hidden }); }}>
                <Icon d={x.hidden ? I.eyeOff : I.eye} size={12} />
              </button>
              <button className="mini" title={x.locked ? 'Unlock' : 'Lock'}
                onClick={(e) => { e.stopPropagation(); update(x.id, { locked: !x.locked }); }}>
                <Icon d={x.locked ? I.lock : I.unlock} size={12} />
              </button>
            </div>
          ))}
        </div>
      </Group>

      {selection.length > 1 && (
        <Group title={`Arrange · ${selection.length} selected`}>
          <div className="arr-grid">
            {ARRANGE.map((a) => (
              <button key={a.mode} className="arr-btn" title={a.tip}
                onClick={() => arrange(selection, a.mode)}>
                <Icon d={a.icon} size={13} />
              </button>
            ))}
          </div>
          <p className="phint">Aligns to the selection bounding box. Distribute spaces objects evenly — ⌘Z undoes.</p>
        </Group>
      )}

      {o && (
        <>
          <Group title={`${o.type} properties`} right={
            <span style={{ display: 'flex', gap: 4 }}>
              <button className="mini" title="Duplicate" onClick={() => dup([o.id])}><Icon d={I.copy} size={12} /></button>
              <button className="mini" title="Delete" onClick={() => remove([o.id])}><Icon d={I.trash} size={12} /></button>
            </span>
          }>
            <div className="grid2">
              <NumIn
                label="X (mm)"
                value={o.x}
                step={0.5}
                onChange={(v) => {
                  if (o.type === 'image') {
                    const c = clampObjectToBounds({ x: v, y: o.y, w: o.w, h: o.h, rot: o.rot }, net.bounds);
                    update(o.id, { x: c.x, y: c.y });
                  } else {
                    update(o.id, { x: v });
                  }
                }}
              />
              <NumIn
                label="Y (mm)"
                value={o.y}
                step={0.5}
                onChange={(v) => {
                  if (o.type === 'image') {
                    const c = clampObjectToBounds({ x: o.x, y: v, w: o.w, h: o.h, rot: o.rot }, net.bounds);
                    update(o.id, { x: c.x, y: c.y });
                  } else {
                    update(o.id, { y: v });
                  }
                }}
              />
              <NumIn
                label="W (mm)"
                value={o.w}
                step={0.5}
                min={0.5}
                onChange={(v) => {
                  if (o.type === 'image' && o.fit !== 'stretch') {
                    const ar = imageAspect(o) ?? (o.w / Math.max(0.1, o.h));
                    const nh = Math.max(0.5, v / ar);
                    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
                    const c = clampObjectToBounds(
                      { x: cx - v / 2, y: cy - nh / 2, w: v, h: nh, rot: o.rot },
                      net.bounds,
                      ar,
                    );
                    update(o.id, { ...c, ...(o.fit === 'cover' ? { fit: 'contain' as const } : {}) });
                  } else {
                    update(o.id, { w: v });
                  }
                }}
              />
              <NumIn
                label="H (mm)"
                value={o.h}
                step={0.5}
                min={0.5}
                onChange={(v) => {
                  if (o.type === 'image' && o.fit !== 'stretch') {
                    const ar = imageAspect(o) ?? (o.w / Math.max(0.1, o.h));
                    const nw = Math.max(0.5, v * ar);
                    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
                    const c = clampObjectToBounds(
                      { x: cx - nw / 2, y: cy - v / 2, w: nw, h: v, rot: o.rot },
                      net.bounds,
                      ar,
                    );
                    update(o.id, { ...c, ...(o.fit === 'cover' ? { fit: 'contain' as const } : {}) });
                  } else {
                    update(o.id, { h: v });
                  }
                }}
              />
            </div>
            <Slider
              label="Rotation"
              value={o.rot}
              min={-180}
              max={180}
              step={1}
              unit="°"
              onChange={(v) => {
                if (o.type === 'image') {
                  const host = hostPanelFor(net, o.x, o.y, o.w, o.h);
                  const inPanel =
                    o.x >= host.x - 1 &&
                    o.y >= host.y - 1 &&
                    o.x + o.w <= host.x + host.w + 1 &&
                    o.y + o.h <= host.y + host.h + 1;
                  const ar = o.fit === 'stretch' ? null : (imageAspect(o) ?? (o.w / Math.max(0.1, o.h)));
                  const c = clampObjectToBounds(
                    { x: o.x, y: o.y, w: o.w, h: o.h, rot: v },
                    inPanel ? host : net.bounds,
                    ar,
                  );
                  update(
                    o.id,
                    { ...c, rot: v, ...(o.fit === 'cover' ? { fit: 'contain' as const } : {}) },
                    'rot',
                  );
                } else {
                  update(o.id, { rot: v }, 'rot');
                }
              }}
            />
            <Slider label="Opacity" value={o.opacity} min={0} max={1} step={0.01} onChange={(v) => update(o.id, { opacity: v }, 'op')} />
            <div className="row">
              <button className="ebtn" onClick={() => reorder(o.id, 'front')}>Bring front</button>
              <button className="ebtn" onClick={() => reorder(o.id, 'back')}>Send back</button>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button
                className="ebtn"
                title="Rotate 90° counter-clockwise"
                onClick={() => {
                  const nextRot = ((o.rot - 90 + 540) % 360) - 180;
                  if (o.type === 'image') {
                    const host = hostPanelFor(net, o.x, o.y, o.w, o.h);
                    const inPanel =
                      o.x >= host.x - 1 &&
                      o.y >= host.y - 1 &&
                      o.x + o.w <= host.x + host.w + 1 &&
                      o.y + o.h <= host.y + host.h + 1;
                    const ar = o.fit === 'stretch' ? null : (imageAspect(o) ?? (o.w / Math.max(0.1, o.h)));
                    const c = clampObjectToBounds(
                      { x: o.x, y: o.y, w: o.w, h: o.h, rot: nextRot },
                      inPanel ? host : net.bounds,
                      ar,
                    );
                    update(o.id, { ...c, rot: nextRot, ...(o.fit === 'cover' ? { fit: 'contain' as const } : {}) });
                  } else {
                    update(o.id, { rot: nextRot });
                  }
                }}
              >
                Rotate −90°
              </button>
              <button
                className="ebtn"
                title="Rotate 90° clockwise"
                onClick={() => {
                  const nextRot = ((o.rot + 90 + 540) % 360) - 180;
                  if (o.type === 'image') {
                    const host = hostPanelFor(net, o.x, o.y, o.w, o.h);
                    const inPanel =
                      o.x >= host.x - 1 &&
                      o.y >= host.y - 1 &&
                      o.x + o.w <= host.x + host.w + 1 &&
                      o.y + o.h <= host.y + host.h + 1;
                    const ar = o.fit === 'stretch' ? null : (imageAspect(o) ?? (o.w / Math.max(0.1, o.h)));
                    const c = clampObjectToBounds(
                      { x: o.x, y: o.y, w: o.w, h: o.h, rot: nextRot },
                      inPanel ? host : net.bounds,
                      ar,
                    );
                    update(o.id, { ...c, rot: nextRot, ...(o.fit === 'cover' ? { fit: 'contain' as const } : {}) });
                  } else {
                    update(o.id, { rot: nextRot });
                  }
                }}
              >
                Rotate +90°
              </button>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button
                className="ebtn"
                title="Resize this element to fill the panel it sits on, with a small margin"
                onClick={() => {
                  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
                  const host = net.panels.find((p) =>
                    p.kind === 'panel' && cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h)
                    ?? net.byId['front'] ?? net.root;
                  const m = Math.min(host.w, host.h) * 0.08;
                  const availW = host.w - m * 2;
                  const availH = host.h - m * 2;
                  if (o.type === 'image') {
                    const ar = o.fit === 'stretch' ? availW / Math.max(1, availH) : (imageAspect(o) ?? (o.w / Math.max(0.1, o.h)));
                    const fit = fitBoxInRect(availW, availH, ar, o.rot);
                    update(o.id, {
                      x: host.x + (host.w - fit.w) / 2,
                      y: host.y + (host.h - fit.h) / 2,
                      w: fit.w,
                      h: fit.h,
                      ...(o.fit === 'cover' ? { fit: 'contain' as const } : {}),
                    });
                    return;
                  }
                  const patch: Record<string, number> = {
                    x: host.x + m, y: host.y + m, w: availW, h: availH,
                  };
                  if (o.type === 'text' && o.h > 0) patch.size = Math.max(1, o.size * (patch.h / o.h));
                  update(o.id, patch);
                }}
              >
                Fit to panel
              </button>
            </div>
          </Group>

          {o.type === 'text' && (
            <Group title="Type">
              <Field label="Content">
                <textarea className="inp" value={o.text} rows={3} onChange={(e) => update(o.id, { text: e.target.value }, 'txt')} />
              </Field>
              <Field label="Typeface">
                <select className="inp" value={o.font} onChange={(e) => update(o.id, { font: e.target.value })}>
                  {FONTS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
                </select>
              </Field>
              <div className="grid2">
                <NumIn label="Size (mm)" value={o.size} min={1} max={80} step={0.5} onChange={(v) => update(o.id, { size: v })} />
                <NumIn label="Weight" value={o.weight} min={100} max={900} step={100} onChange={(v) => update(o.id, { weight: v })} />
              </div>
              <div className="grid2">
                <NumIn label="Tracking" value={o.tracking} min={-2} max={20} step={0.2} onChange={(v) => update(o.id, { tracking: v })} />
                <NumIn label="Line height" value={o.lineHeight} min={0.8} max={2.5} step={0.05} onChange={(v) => update(o.id, { lineHeight: v })} />
              </div>
              <Field label="Alignment">
                <Segmented value={o.align as string}
                  options={[{ v: 'left', l: 'Left' }, { v: 'center', l: 'Center' }, { v: 'right', l: 'Right' }]}
                  onChange={(v) => update(o.id, { align: v as CanvasTextAlign })} />
              </Field>
              <ColorIn label="Colour" value={o.fill} onChange={(v) => update(o.id, { fill: v }, 'fill')} />
            </Group>
          )}

          {(o.type === 'rect' || o.type === 'ellipse' || o.type === 'line') && (
            <Group title="Appearance">
              <ColorIn label="Fill" value={o.fill} onChange={(v) => update(o.id, { fill: v }, 'fill')} />
              {o.type === 'rect' && <NumIn label="Corner radius (mm)" value={o.radius} min={0} max={40} step={0.5} onChange={(v) => update(o.id, { radius: v })} />}
              {o.type !== 'line' && (
                <>
                  <ColorIn label="Stroke" value={o.stroke} onChange={(v) => update(o.id, { stroke: v }, 'stk')} allowNone />
                  <NumIn label="Stroke width (mm)" value={o.strokeW} min={0} max={10} step={0.1} onChange={(v) => update(o.id, { strokeW: v })} />
                </>
              )}
            </Group>
          )}

          {o.type === 'image' && (
            <>
              <ImageEditor o={o} />
              {o.src && (
                <Group title="Source">
                  <img src={o.src} alt="" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--line)' }} />
                  <p className="phint">Original placed pixels — edits above never overwrite them.</p>
                </Group>
              )}
            </>
          )}

          <Group title="Snap to panel">
            <select className="inp" defaultValue="" onChange={(e) => {
              const p = net.byId[e.target.value];
              if (!p) return;
              if (o.type === 'image') {
                const ar = o.fit === 'stretch' ? null : (imageAspect(o) ?? (o.w / Math.max(0.1, o.h)));
                const m = Math.min(p.w, p.h) * 0.04;
                const c = clampObjectToBounds(
                  { x: p.x + (p.w - o.w) / 2, y: p.y + (p.h - o.h) / 2, w: o.w, h: o.h, rot: o.rot },
                  { x: p.x + m, y: p.y + m, w: p.w - m * 2, h: p.h - m * 2 },
                  ar,
                );
                update(o.id, { ...c, ...(o.fit === 'cover' ? { fit: 'contain' as const } : {}) });
              } else {
                update(o.id, { x: p.x + (p.w - o.w) / 2, y: p.y + (p.h - o.h) / 2 });
              }
              e.target.value = '';
            }}>
              <option value="">Center on panel…</option>
              {net.panels.filter((p) => p.kind === 'panel').map((p) => (
                <option key={p.id} value={p.id}>{p.label} ({p.w.toFixed(0)}×{p.h.toFixed(0)})</option>
              ))}
            </select>
          </Group>
        </>
      )}
    </div>
  );
}
