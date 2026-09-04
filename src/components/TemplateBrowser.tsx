import { useEffect, useMemo, useRef, useState } from 'react';
import { boxTypeById } from '../lib/geometry';
import { TEMPLATES, applyTemplate, type Template } from '../lib/templates';
import { useStore, type Design } from '../lib/store';
import {
  DEFAULT_CATEGORY, SUGGESTED_CATEGORIES, libraryFile, parseLibraryFile, prettyBytes,
  templateBytes, templateDesign, templateDims, templateSwatch, timeAgo, useLibrary,
  type UserTemplate,
} from '../lib/library';
import { download } from '../lib/exporters';
import { BoxThumb } from './Thumb';
import { Icon, I } from './ui';

type Source = 'built' | 'mine';

/**
 * `applyTemplate` rebuilds a whole net + artwork tree, and `BoxThumb` redraws
 * whenever its `design` prop changes identity — so building them inline would
 * re-render every canvas on every keystroke in the search box. Cache per id.
 */
const builtCache = new Map<string, Design>();
const builtDesign = (t: Template) => {
  let d = builtCache.get(t.id);
  if (!d) { d = applyTemplate(t); builtCache.set(t.id, d); }
  return d;
};

const match = (q: string, ...fields: string[]) =>
  !q || fields.join(' ').toLowerCase().includes(q.toLowerCase().trim());

/* ========================= save / rename dialog ========================= */

export function SaveTemplateDialog({ toast }: { toast: (m: string) => void }) {
  const dialog = useLibrary((s) => s.dialog);
  const close = useLibrary((s) => s.closeSave);
  const items = useLibrary((s) => s.items);
  const add = useLibrary((s) => s.add);
  const edit = useLibrary((s) => s.edit);
  const replaceDesign = useLibrary((s) => s.replaceDesign);
  const error = useLibrary((s) => s.error);
  const design = useStore((s) => s.design);

  const editing = dialog.open ? items.find((t) => t.id === dialog.id) : undefined;
  const [name, setName] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [blurb, setBlurb] = useState('');
  const [resnap, setResnap] = useState(false);

  useEffect(() => {
    if (!dialog.open) return;
    setName(editing ? editing.name : design.name);
    setCategory(editing ? editing.category : DEFAULT_CATEGORY);
    setBlurb(editing ? editing.blurb : '');
    setResnap(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog.open, dialog.open && dialog.id]);

  if (!dialog.open) return null;

  const cats = Array.from(new Set([...items.map((t) => t.category), ...SUGGESTED_CATEGORIES]));
  const preview = editing && !resnap ? editing.design : design;

  const submit = () => {
    const clean = name.trim() || design.name || 'Untitled template';
    if (editing) {
      edit(editing.id, { name: clean, category: category.trim() || DEFAULT_CATEGORY, blurb: blurb.trim() });
      if (resnap) replaceDesign(editing.id, design);
      toast(resnap ? `${clean} updated from the artboard` : `${clean} updated`);
    } else {
      const saved = add(design, { name: clean, category: category.trim() || DEFAULT_CATEGORY, blurb: blurb.trim() });
      if (!saved) return; // error surfaced below
      toast(`${clean} saved to your templates`);
    }
    close();
  };

  return (
    <div className="modal-bg" onClick={close}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>{editing ? 'Edit template' : 'Save as template'}</h3>
          <div className="spacer" />
          <button className="ebtn sq" onClick={close}><Icon d={I.x} size={14} /></button>
        </div>
        <div className="modal-b save-grid">
          <div className="save-preview">
            <BoxThumb design={preview} h={168} bg="#e9edf3" />
            <div className="save-meta">
              <span className="tb-tag">{boxTypeById(preview.boxType).short}</span>
              <span>
                {Math.round(preview.params.L)} × {Math.round(preview.params.W)} × {Math.round(preview.params.H)} mm
                {' · '}{preview.objects.length} object{preview.objects.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <div className="save-form">
            <label className="fl">Template name</label>
            <input className="inp" value={name} autoFocus maxLength={80}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />

            <label className="fl">Category</label>
            <input className="inp" value={category} list="bc-cats" maxLength={40}
              onChange={(e) => setCategory(e.target.value)} />
            <datalist id="bc-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>

            <label className="fl">Description <em>optional</em></label>
            <textarea className="inp ta" value={blurb} rows={3} maxLength={240}
              placeholder="What is this starting point for?"
              onChange={(e) => setBlurb(e.target.value)} />

            {editing && (
              <label className="chk">
                <input type="checkbox" checked={resnap} onChange={(e) => setResnap(e.target.checked)} />
                Replace the saved design with what is on my artboard now
              </label>
            )}

            {error && <div className="lib-err">{error}</div>}

            <p className="phint">
              Saved in this browser only — nothing is uploaded. Export your library from the
              templates dialog to move it to another machine.
            </p>
            <div className="save-actions">
              <button className="ebtn" onClick={close}>Cancel</button>
              <button className="ebtn pri" onClick={submit}>
                <Icon d={I.check} size={13} /> {editing ? 'Save changes' : 'Save template'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ template browser ============================ */

export function TemplateBrowser({ onClose, onLoad, initialSource = 'built' }: {
  onClose: () => void;
  onLoad: (design: Design, label: string) => void;
  initialSource?: Source;
}) {
  const items = useLibrary((s) => s.items);
  const remove = useLibrary((s) => s.remove);
  const duplicate = useLibrary((s) => s.duplicate);
  const openSave = useLibrary((s) => s.openSave);
  const importTemplates = useLibrary((s) => s.importTemplates);
  const error = useLibrary((s) => s.error);
  const clearError = useLibrary((s) => s.clearError);

  const [src, setSrc] = useState<Source>(initialSource);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => { setCat('All'); setConfirm(null); }, [src]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', h);
    return () => removeEventListener('keydown', h);
  }, [onClose]);

  const pool: (Template | UserTemplate)[] = src === 'built' ? TEMPLATES : items;
  const cats = ['All', ...Array.from(new Set(pool.map((t) => t.category)))];
  const searched = pool.filter((t) => match(q, t.name, t.blurb, t.category));
  const list = cat === 'All' ? searched : searched.filter((t) => t.category === cat);
  const countIn = (c: string) => (c === 'All' ? searched.length : searched.filter((t) => t.category === c).length);

  const libBytes = useMemo(() => items.reduce((n, t) => n + templateBytes(t), 0), [items]);

  const say = (m: string) => { setNote(m); setTimeout(() => setNote(''), 2600); };

  /** Load a random built-in template — respects the current search + category. */
  const surprise = () => {
    const pool = (list.length ? list : searched.length ? searched : TEMPLATES) as Template[];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) onLoad(applyTemplate(pick), pick.name);
  };

  const doImport = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      const parsed = parseLibraryFile(String(r.result));
      if (!parsed) { say('That file did not contain any BoxCraft templates.'); return; }
      const n = importTemplates(parsed);
      if (n) { setSrc('mine'); say(`Imported ${n} template${n === 1 ? '' : 's'}.`); }
    };
    r.readAsText(f);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>{src === 'built' ? 'Start from a template' : 'My templates'}</h3>
          <div className="seg src-seg">
            <button className={src === 'built' ? 'on' : ''} onClick={() => setSrc('built')}>
              BoxCraft <em>{TEMPLATES.length}</em>
            </button>
            <button className={src === 'mine' ? 'on' : ''} onClick={() => setSrc('mine')}>
              Mine <em>{items.length}</em>
            </button>
          </div>
          <div className="spacer" />
          <div className="tpl-search">
            <Icon d={I.sparkle} size={13} />
            <input value={q} placeholder="Search templates" onChange={(e) => setQ(e.target.value)} />
            {q && <button onClick={() => setQ('')}><Icon d={I.x} size={12} /></button>}
          </div>
          <button className="ebtn sq" onClick={onClose}><Icon d={I.x} size={14} /></button>
        </div>

        <div className="modal-cats">
          {cats.map((c) => (
            <button key={c} className={`chip-btn${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>
              {c}<em>{countIn(c)}</em>
            </button>
          ))}
          <div className="spacer" />
          {src === 'mine' ? (
            <>
              <button className="ebtn" onClick={() => openSave()}>
                <Icon d={I.plus} size={13} /> Save current design
              </button>
              <button className="ebtn" onClick={() => file.current?.click()}>
                <Icon d={I.copy} size={13} /> Import
              </button>
              <button className="ebtn" disabled={!items.length}
                onClick={() => {
                  download('boxcraft-library.json',
                    new Blob([JSON.stringify(libraryFile(items), null, 2)], { type: 'application/json' }));
                  say('Library exported.');
                }}>
                <Icon d={I.down} size={13} /> Export all
              </button>
              <input ref={file} type="file" accept=".json,application/json" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
            </>
          ) : (
            <>
              <span className="cats-note">Structure, colour and copy all stay editable.</span>
              <button className="ebtn" onClick={surprise} title="Load a random template">
                <Icon d={I.shuffle} size={13} /> Surprise me
              </button>
            </>
          )}
        </div>

        {(error || note) && (
          <div className={`lib-bar${error ? ' bad' : ''}`}>
            <span>{error || note}</span>
            {error && <button className="ebtn sq" onClick={clearError}><Icon d={I.x} size={12} /></button>}
          </div>
        )}

        <div className="modal-b">
          {src === 'mine' && !items.length && (
            <div className="lib-empty">
              <div className="lib-empty-ico"><Icon d={I.layers} size={22} /></div>
              <h4>Your library is empty</h4>
              <p>
                Design a carton, then hit <b>Save template</b> in the top bar. Your structure,
                board, panel colours and every artwork object are stored in this browser and
                reload in one click — or import a library file a colleague sent you.
              </p>
              <div className="lib-empty-cta">
                <button className="ebtn pri" onClick={() => openSave()}>
                  <Icon d={I.plus} size={13} /> Save the current design
                </button>
                <button className="ebtn" onClick={() => file.current?.click()}>
                  <Icon d={I.copy} size={13} /> Import a library file
                </button>
              </div>
            </div>
          )}

          {!!pool.length && !list.length && (
            <div className="lib-empty"><h4>No matches</h4><p>Nothing here for “{q}”. Try another word or clear the filters.</p></div>
          )}

          <div className="tpl-grid">
            {src === 'built' && (list as Template[]).map((t) => (
              <button key={t.id} onClick={() => onLoad(applyTemplate(t), t.name)}>
                <BoxThumb design={builtDesign(t)} h={132} bg="#e9edf3" />
                <div className="tb">
                  <b>{t.name}</b>
                  <span>{t.blurb}</span>
                  <div className="tb-meta">
                    <span className="tb-tag">{boxTypeById(t.boxType).short}</span>
                    <span>{t.dims.join(' × ')} mm</span>
                  </div>
                </div>
              </button>
            ))}

            {src === 'mine' && (list as UserTemplate[]).map((t) => (
              <div className={`lib-card${confirm === t.id ? ' danger' : ''}`} key={t.id}>
                <button className="lib-open" onClick={() => onLoad(templateDesign(t), t.name)}>
                  <BoxThumb design={t.design} h={132} bg="#e9edf3" />
                  <div className="tb">
                    <b>{t.name}</b>
                    <span>{t.blurb || `${t.category} · saved ${timeAgo(t.updatedAt)}`}</span>
                    <div className="tb-meta">
                      <span className="tb-tag">{boxTypeById(t.design.boxType).short}</span>
                      <span>{templateDims(t).join(' × ')} mm</span>
                      <div className="spacer" />
                      <div className="sw-row">
                        {templateSwatch(t).map((c, i) => <i key={`${c}${i}`} style={{ background: c }} />)}
                      </div>
                    </div>
                  </div>
                </button>
                {confirm === t.id ? (
                  <div className="lib-acts">
                    <span className="del-q">Delete “{t.name}”?</span>
                    <div className="spacer" />
                    <button className="ebtn" onClick={() => setConfirm(null)}>Keep</button>
                    <button className="ebtn danger" onClick={() => { remove(t.id); setConfirm(null); say('Template deleted.'); }}>
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="lib-acts">
                    <button className="ebtn sq" title="Rename / edit" onClick={() => openSave(t.id)}>
                      <Icon d={I.text} size={13} />
                    </button>
                    <button className="ebtn sq" title="Duplicate" onClick={() => { duplicate(t.id); say('Template duplicated.'); }}>
                      <Icon d={I.copy} size={13} />
                    </button>
                    <button className="ebtn sq" title="Download this template"
                      onClick={() => download(`${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.boxcraft-template.json`,
                        new Blob([JSON.stringify(libraryFile([t]), null, 2)], { type: 'application/json' }))}>
                      <Icon d={I.down} size={13} />
                    </button>
                    <div className="spacer" />
                    <span className="lib-age">{timeAgo(t.updatedAt)}</span>
                    <button className="ebtn sq" title="Delete" onClick={() => setConfirm(t.id)}>
                      <Icon d={I.trash} size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {src === 'mine' && !!items.length && (
            <p className="phint lib-foot">
              {items.length} template{items.length === 1 ? '' : 's'} · {prettyBytes(libBytes)} stored in this browser.
              Clearing site data removes them, so export a library file for anything you need to keep.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
