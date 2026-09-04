import { useStore } from '../lib/store';
import { ColorIn, Field, Group, Icon, I, NumIn, Segmented, Slider } from './ui';

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

export default function Inspector({ open = false }: { open?: boolean }) {
  const design = useStore((s) => s.design);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const update = useStore((s) => s.updateObject);
  const remove = useStore((s) => s.removeObjects);
  const dup = useStore((s) => s.duplicate);
  const reorder = useStore((s) => s.reorder);
  const net = useStore((s) => s.net);

  const o = design.objects.find((x) => x.id === selection[0]) ?? null;
  const list = [...design.objects].reverse();

  return (
    <div className={`panel right${open ? ' open' : ''}`}>
      <Group title="Layers" right={<span style={{ color: 'var(--txt-3)', fontWeight: 600 }}>{design.objects.length}</span>}>
        {list.length === 0 && <div className="empty">No artwork elements yet.<br />Add text, shapes or upload a logo from the Design tab.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {list.map((x) => (
            <div key={x.id} className={`layer ${selection.includes(x.id) ? 'on' : ''}`} onClick={() => select([x.id])}>
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

      {o && (
        <>
          <Group title={`${o.type} properties`} right={
            <span style={{ display: 'flex', gap: 4 }}>
              <button className="mini" title="Duplicate" onClick={() => dup([o.id])}><Icon d={I.copy} size={12} /></button>
              <button className="mini" title="Delete" onClick={() => remove([o.id])}><Icon d={I.trash} size={12} /></button>
            </span>
          }>
            <div className="grid2">
              <NumIn label="X (mm)" value={o.x} step={0.5} onChange={(v) => update(o.id, { x: v })} />
              <NumIn label="Y (mm)" value={o.y} step={0.5} onChange={(v) => update(o.id, { y: v })} />
              <NumIn label="W (mm)" value={o.w} step={0.5} min={0.5} onChange={(v) => update(o.id, { w: v })} />
              <NumIn label="H (mm)" value={o.h} step={0.5} min={0.5} onChange={(v) => update(o.id, { h: v })} />
            </div>
            <Slider label="Rotation" value={o.rot} min={-180} max={180} step={1} unit="°" onChange={(v) => update(o.id, { rot: v }, 'rot')} />
            <Slider label="Opacity" value={o.opacity} min={0} max={1} step={0.01} onChange={(v) => update(o.id, { opacity: v }, 'op')} />
            <div className="row">
              <button className="ebtn" onClick={() => reorder(o.id, 'front')}>Bring front</button>
              <button className="ebtn" onClick={() => reorder(o.id, 'back')}>Send back</button>
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
            <Group title="Image">
              <Field label="Fit">
                <Segmented value={o.fit} options={[{ v: 'cover', l: 'Cover' }, { v: 'contain', l: 'Contain' }, { v: 'stretch', l: 'Stretch' }]}
                  onChange={(v) => update(o.id, { fit: v })} />
              </Field>
              {o.src && <img src={o.src} alt="" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--line)' }} />}
            </Group>
          )}

          <Group title="Snap to panel">
            <select className="inp" defaultValue="" onChange={(e) => {
              const p = net.byId[e.target.value];
              if (!p) return;
              update(o.id, { x: p.x + (p.w - o.w) / 2, y: p.y + (p.h - o.h) / 2 });
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
