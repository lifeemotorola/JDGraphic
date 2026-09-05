import React from 'react';

export const Icon = ({ d, size = 16, stroke = 1.6 }: { d: string; size?: number; stroke?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {d.split('|').map((p, i) => <path key={i} d={p} />)}
  </svg>
);

export const I = {
  box: 'M21 8 12 3 3 8v8l9 5 9-5V8|M3 8l9 5 9-5|M12 13v8',
  layers: 'M12 2 2 7l10 5 10-5-10-5|M2 17l10 5 10-5|M2 12l10 5 10-5',
  brush: 'M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08|M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z',
  swatch: 'M2 13.5V6a4 4 0 0 1 4-4h1a4 4 0 0 1 4 4v7.5|M11 13.5l4.5-4.5a4 4 0 0 1 5.66 5.66L13.5 22|M2 13.5a4 4 0 0 0 8 0|M6.5 18h.01',
  camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z|M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  down: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3',
  undo: 'M3 7v6h6|M21 17a9 9 0 0 0-15-6.7L3 13',
  redo: 'M21 7v6h-6|M3 17a9 9 0 0 1 15-6.7L21 13',
  plus: 'M12 5v14|M5 12h14',
  trash: 'M3 6h18|M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2|M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  copy: 'M20 9H11a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z|M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-6 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94|M9.9 4.24A9.12 9.12 0 0 1 12 4c6 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19|M1 1l22 22',
  lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z|M7 11V7a5 5 0 0 1 10 0v4',
  unlock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z|M7 11V7a5 5 0 0 1 9.9-1',
  text: 'M4 7V4h16v3|M9 20h6|M12 4v16',
  image: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z|M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z|M21 15l-5-5L5 21',
  square: 'M4 4h16v16H4z',
  circle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  line: 'M4 12h16',
  grid: 'M3 3h7v7H3z|M14 3h7v7h-7z|M14 14h7v7h-7z|M3 14h7v7H3z',
  play: 'M5 3l14 9-14 9V3z',
  pause: 'M6 4h4v16H6z|M14 4h4v16h-4z',
  reset: 'M3 2v6h6|M3.51 15a9 9 0 1 0 2.13-9.36L3 8',
  x: 'M18 6 6 18|M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  ruler: 'M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z|M7.5 10.5l2 2|M10.5 7.5l2 2|M13.5 4.5l2 2|M4.5 13.5l2 2',
  sparkle: 'M12 3v4|M12 17v4|M3 12h4|M17 12h4|M5.6 5.6l2.8 2.8|M15.6 15.6l2.8 2.8|M18.4 5.6l-2.8 2.8|M8.4 15.6l-2.8 2.8',
  arrowR: 'M5 12h14|M13 5l7 7-7 7',
  shuffle: 'M16 3h5v5|M4 20 21 3|M21 16v5h-5|M15 15l6 6|M4 4l5 5',
  alignL: 'M4 3v18|M7 6h9v6H7z|M7 16h5v3H7z',
  alignC: 'M12 3v18|M7 6h10v6H7z|M9 16h6v3H9z',
  alignR: 'M20 3v18|M12 6h5v6h-5z|M16 16h4v3h-4z',
  alignT: 'M3 4h18|M6 7h6v10H6z|M15 7h3v5h-3z',
  alignM: 'M3 12h18|M6 7h6v10H6z|M15 9h3v6h-3z',
  alignB: 'M3 20h18|M6 11h6v9H6z|M15 15h3v5h-3z',
  distH: 'M5 5h3v14H5z|M10.5 5h3v14h-3z|M16 5h3v14h-3z',
  distV: 'M5 5h14v3H5z|M5 10.5h14v3H5z|M5 16h14v3H5z',
  front: 'M4 5h16v14H4z',
  cube: 'M21 16V8l-9-5-9 5v8l9 5 9-5z|M3.3 7.3 12 12l8.7-4.7|M12 12v9',
  star: 'M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.58L12 17.56l-5.9 3.1 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z',
  leaf: 'M5 19C5 9 13 4 20 4c0 8-5 15-15 15z|M5 19c3-5 7-9 11-11',
};

export function Field({ label, hint, children }: { label?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      {label && <div className="flabel"><span>{label}</span>{hint && <b>{hint}</b>}</div>}
      {children}
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label} hint={`${Math.round(value * 100) / 100}${unit}`}>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
    </Field>
  );
}

export function NumIn({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <input className="inp" type="number" value={Math.round(value * 100) / 100} min={min} max={max} step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(min != null && max != null ? Math.max(min, Math.min(max, v)) : v);
        }} />
    </Field>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { v: T; l: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}

export function ColorIn({ label, value, onChange, allowNone }: {
  label?: string; value: string; onChange: (v: string) => void; allowNone?: boolean;
}) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff';
  return (
    <Field label={label}>
      <div className="colr">
        <input type="color" value={safe} onChange={(e) => onChange(e.target.value)} />
        <input className="inp" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
        {allowNone && (
          <button className="ebtn sq" title="No fill" onClick={() => onChange('none')}><Icon d={I.x} size={13} /></button>
        )}
      </div>
    </Field>
  );
}

export function Swatches({ colors, onPick }: { colors: string[]; onPick: (c: string) => void }) {
  return (
    <div className="swatch-row">
      {colors.map((c) => (
        <button key={c} style={{ background: c }} onClick={() => onPick(c)} title={c} />
      ))}
    </div>
  );
}

export function Group({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="pgroup">
      <h4 className="ptitle">{title}{right}</h4>
      {children}
    </div>
  );
}
