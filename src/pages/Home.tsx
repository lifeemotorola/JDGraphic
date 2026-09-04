import { useEffect, useMemo, useState } from 'react';
import { BOX_TYPES } from '../lib/geometry';
import { TEMPLATES, applyTemplate } from '../lib/templates';
import { useStore } from '../lib/store';
import { templateDesign, timeAgo, useLibrary } from '../lib/library';
import { Icon, I } from '../components/ui';
import { NetThumb, BoxThumb } from '../components/Thumb';
import MiniViewer from '../components/MiniViewer';

const HERO_IDS = ['aurora-skin', 'roast-coffee', 'lumen-tech', 'garden-tea'];

export default function Home({ nav }: { nav: (p: string) => void }) {
  const load = useStore((s) => s.loadDesign);
  const mine = useLibrary((s) => s.items);
  const [i, setI] = useState(0);
  const [fold, setFold] = useState(1);

  const heroDesigns = useMemo(
    () => HERO_IDS.map((id) => applyTemplate(TEMPLATES.find((t) => t.id === id)!)),
    [],
  );

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % heroDesigns.length), 7000);
    return () => clearInterval(t);
  }, [heroDesigns.length]);

  const open = (tplId?: string) => {
    if (tplId) {
      const t = TEMPLATES.find((x) => x.id === tplId);
      if (t) load(applyTemplate(t));
    }
    nav('/editor');
  };

  const openMine = (id: string) => {
    const t = mine.find((x) => x.id === id);
    if (t) load(templateDesign(t));
    nav('/editor');
  };

  return (
    <div className="site">
      <nav className="nav">
        <div className="site-inner nav-in">
          <a className="logo" href="#/"><span className="logo-mark"><Icon d={I.box} size={16} /></span> BoxCraft</a>
          <div className="nav-links">
            <a href="#styles">Structures</a>
            <a href="#templates">Templates</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="nav-right">
            <a className="btn btn-ghost" href="#/editor" onClick={(e) => { e.preventDefault(); open(); }}>Open studio</a>
            <a className="btn btn-accent" href="#/editor" onClick={(e) => { e.preventDefault(); open('aurora-skin'); }}>
              Start free <Icon d={I.arrowR} size={15} />
            </a>
          </div>
        </div>
      </nav>

      {/* ---------------- hero ---------------- */}
      <header className="hero">
        <div className="site-inner hero-grid">
          <div>
            <div className="eyebrow"><span className="dot" /> Parametric dielines · real-time 3D · print-ready output</div>
            <h1 className="display">Design a carton,<br />get the <em>dieline</em> free.</h1>
            <p className="lede">
              BoxCraft turns three numbers into a manufacturable folding carton. Type your dimensions,
              drop artwork onto the flat, and watch the same geometry fold into a photoreal box —
              then export cut-and-crease files your converter can actually run.
            </p>
            <div className="hero-cta">
              <button className="btn btn-accent btn-lg" onClick={() => open('aurora-skin')}>
                Create a box <Icon d={I.arrowR} size={16} />
              </button>
              <button className="btn btn-ghost btn-lg" onClick={() => setFold((f) => (f > 0.5 ? 0 : 1))}>
                <Icon d={I.play} size={15} /> {fold > 0.5 ? 'Unfold the blank' : 'Fold it up'}
              </button>
            </div>
            <p className="hero-note">No account, no install. Everything renders and exports in your browser.</p>
            <div className="marq">
              <span>FOLDING CARTONS</span><span>CORRUGATED</span><span>SLEEVES</span><span>MAILERS</span><span>TRAYS</span>
            </div>
          </div>
          <div className="stage">
            <MiniViewer design={heroDesigns[i]} fold={fold} />
            <div className="stage-tag"><span className="live-dot" /> Live WebGL · {heroDesigns[i].name}</div>
          </div>
        </div>
      </header>

      {/* ---------------- value ---------------- */}
      <section className="section alt">
        <div className="site-inner">
          <div className="section-head center">
            <div className="kicker">One model, three outputs</div>
            <h2 className="sh">The dieline, the render and the spec sheet stay in sync</h2>
            <p className="sub">
              Most tools give you a pretty mockup or a technical drawing. BoxCraft derives both from the same
              parametric net — change the height and the flaps, creases, board area and quote all move with it.
            </p>
          </div>
          <div className="cards">
            {[
              { i: I.ruler, h: 'True parametric structures', p: 'Seven industry structures — STE, RTE, seal end, RSC, roll-end mailer, sleeve and tray — rebuilt live from L × W × H, caliper and glue-flap rules.' },
              { i: I.cube, h: 'Folding you can watch', p: 'Every panel is hinged to its parent, so the blank folds in sequence: dust flaps, then lids, then tucks. Scrub the fold slider to check clearances.' },
              { i: I.brush, h: 'Design straight on the flat', p: 'Type, shapes and logos sit on the artboard in millimetres, snap to panel edges, and map onto the 3D surface instantly.' },
              { i: I.swatch, h: 'Board that behaves', p: 'SBS, kraft, black board, recycled grey and E/B flute — each with real caliper, gsm and surface roughness feeding both the render and the weight calc.' },
              { i: I.file, h: 'Files a converter accepts', p: 'Layered SVG with separate cut and crease groups, vector PDF dielines, 300–600 dpi artwork with bleed, and a one-page spec sheet.' },
              { i: I.zap, h: 'Costing while you design', p: 'Board consumption, trim waste, blank weight and an indicative unit price at your order quantity — before you email a single supplier.' },
            ].map((c) => (
              <div className="card" key={c.h}>
                <div className="ico"><Icon d={c.i} size={20} /></div>
                <h3>{c.h}</h3>
                <p>{c.p}</p>
              </div>
            ))}
          </div>
          <div className="stat-row">
            <div className="stat"><b>7</b><span>Parametric structures</span></div>
            <div className="stat"><b>0.1 mm</b><span>Dieline precision</span></div>
            <div className="stat"><b>600 dpi</b><span>Artwork export</span></div>
            <div className="stat"><b>100%</b><span>Runs in your browser</span></div>
          </div>
        </div>
      </section>

      {/* ---------------- structures ---------------- */}
      <section className="section" id="styles">
        <div className="site-inner">
          <div className="section-head">
            <div className="kicker">Structure library</div>
            <h2 className="sh">Pick a style, then bend it to your product</h2>
            <p className="sub">Each structure is code, not a static file. Dimensions, board thickness and glue flaps regenerate the whole net.</p>
          </div>
          <div className="styles-row">
            {BOX_TYPES.map((t) => (
              <button className="style-card" key={t.id} onClick={() => {
                const st = useStore.getState();
                st.commit((d) => {
                  d.boxType = t.id;
                  const [L, W, H] = t.defaults;
                  d.params = { ...d.params, L, W, H };
                });
                nav('/editor');
              }}>
                <NetThumb type={t.id} w={230} h={92} color="#9aa3b2" />
                <span className="style-short">{t.short}</span>
                <h4>{t.name}</h4>
                <p>{t.desc}</p>
                <div className="chips">{t.tags.slice(0, 2).map((x) => <span className="chip" key={x}>{x}</span>)}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- templates ---------------- */}
      <section className="section alt" id="templates">
        <div className="site-inner">
          <div className="section-head">
            <div className="kicker">Templates</div>
            <h2 className="sh">Ship a concept before lunch</h2>
            <p className="sub">{TEMPLATES.length} fully editable starting points — colours, copy and structure all stay live.</p>
          </div>
          {!!mine.length && (
            <>
              <div className="mine-head">
                <div>
                  <div className="kicker">Your library</div>
                  <h3>{mine.length} template{mine.length === 1 ? '' : 's'} saved in this browser</h3>
                  <p>Your own structures, boards and artwork — reopen one and keep designing.</p>
                </div>
                <button className="btn btn-ghost" onClick={() => open()}>
                  Manage in the studio <Icon d={I.arrowR} size={15} />
                </button>
              </div>
              <div className="mine-strip">
                {mine.slice(0, 4).map((t) => (
                  <button className="mine-card" key={t.id} onClick={() => openMine(t.id)}>
                    <BoxThumb design={t.design} h={140} bg="#eef1f6" />
                    <div className="mc-b">
                      <h4>{t.name}</h4>
                      <p>{t.blurb || `${t.category} · saved ${timeAgo(t.updatedAt)}`}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="tgrid">
            {TEMPLATES.slice(0, 8).map((t) => {
              const d = applyTemplate(t);
              return (
                <button className="tcard" key={t.id} onClick={() => open(t.id)}>
                  <BoxThumb design={d} h={168} bg="#eef1f6" />
                  <div className="tcard-b">
                    <h4>{t.name}</h4>
                    <p>{t.blurb}</p>
                    <div className="chips"><span className="chip">{t.category}</span><span className="chip">{t.dims.join(' × ')} mm</span></div>
                    <div className="swatches">{t.swatch.map((c) => <span className="sw" key={c} style={{ background: c }} />)}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="tgrid-more">
            <button className="btn btn-ghost btn-lg" onClick={() => open()}>
              Browse all {TEMPLATES.length} templates in the studio <Icon d={I.arrowR} size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ---------------- how ---------------- */}
      <section className="section" id="how">
        <div className="site-inner split">
          <div>
            <div className="kicker">How it works</div>
            <h2 className="sh">From dimensions to die-cut in four moves</h2>
            <div className="feat-list">
              {[
                ['Set the structure', 'Choose a style and type your internal dimensions. The net, flap sizes and glue seam are generated to standard folding-carton rules.'],
                ['Lay out the artwork', 'Work on the flat with bleed and safe-area guides on. Elements snap to panel edges and centres so nothing lands on a crease.'],
                ['Check it in 3D', 'The same net folds panel by panel. Orbit it, change the board and lighting, and confirm the back panel copy is the right way up.'],
                ['Export and quote', 'Layered SVG or PDF dieline, high-res artwork, marketing renders and a spec sheet with board area, weight and unit cost.'],
              ].map(([h, p], n) => (
                <div className="feat" key={h}>
                  <div className="feat-n">{n + 1}</div>
                  <div><h4>{h}</h4><p>{p}</p></div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 30 }}>
              <button className="btn btn-primary btn-lg" onClick={() => open()}>Open the studio <Icon d={I.arrowR} size={16} /></button>
            </div>
          </div>
          <div className="stage" style={{ height: 430 }}>
            <MiniViewer design={heroDesigns[(i + 2) % heroDesigns.length]} spin />
            <div className="stage-tag"><span className="live-dot" /> Drag to orbit · scroll to zoom</div>
          </div>
        </div>
      </section>

      {/* ---------------- pricing ---------------- */}
      <section className="section alt" id="pricing">
        <div className="site-inner">
          <div className="section-head center">
            <div className="kicker">Pricing</div>
            <h2 className="sh">Free to design. Pay when you produce.</h2>
          </div>
          <div className="price-grid">
            {[
              { n: 'Starter', a: '$0', s: 'forever', f: ['All 7 structures', 'Unlimited 3D previews', 'SVG dieline export', 'PNG renders with watermark-free 1×', 'Local project files'], b: 'Start designing', pop: false },
              { n: 'Studio', a: '$19', s: '/ month', f: ['Everything in Starter', '600 dpi print PDF with bleed', 'Transparent + 2× renders', 'Manufacturing spec sheets', 'Brand palettes and fonts', 'Priority render queue'], b: 'Go Studio', pop: true },
              { n: 'Converter', a: 'Custom', s: 'per seat', f: ['Embed the editor in your web-to-print flow', 'Your own structure library', 'CAD/CFF2 + DXF pipeline', 'SSO and shared team assets', 'Onboarding and SLA'], b: 'Talk to us', pop: false },
            ].map((p) => (
              <div className={`price ${p.pop ? 'pop' : ''}`} key={p.n}>
                {p.pop && <span className="badge-pop">Most popular</span>}
                <h3>{p.n}</h3>
                <div className="amt">{p.a} <small>{p.s}</small></div>
                <ul>{p.f.map((x) => <li key={x}><span className="tick">✓</span>{x}</li>)}</ul>
                <button className={`btn ${p.pop ? 'btn-accent' : 'btn-ghost'}`} onClick={() => open()}>{p.b}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- faq ---------------- */}
      <section className="section">
        <div className="site-inner">
          <div className="section-head center">
            <div className="kicker">FAQ</div>
            <h2 className="sh">The practical questions</h2>
          </div>
          <div className="faq">
            {[
              ['Are the dielines actually production ready?', 'The SVG and PDF exports carry separate cut, crease and bleed layers at 1:1 scale in millimetres. Flap and tuck geometry follows standard folding-carton practice, but always send a sample file to your converter — every plant has its own nicks, relief and glue-lap preferences.'],
              ['What is bleed and how much do I need?', 'Bleed is artwork extended past the trim so a slight cutting shift never leaves a white edge. 3 mm is the common default for cartons; the slider lets you match your printer’s spec, and the guide is drawn on the flat while you work.'],
              ['Can I upload my own logo or artwork?', 'Yes — drop in PNG, JPG or SVG raster art. Images are placed in millimetres on the flat, so what you measure is what prints. Files never leave your machine; everything is processed in the browser.'],
              ['Does the 3D preview reflect the real board?', 'Caliper drives the panel thickness and layer offsets, gsm drives the weight estimate, and the substrate sets colour and surface roughness. Corrugated adds a visible edge. It is a design-stage check, not an engineering simulation.'],
              ['Which structure should I choose?', 'Reverse tuck end is the cheapest to run and the default for most retail products. Straight tuck end gives a cleaner front face. Seal end suits automated filling. Use RSC or a roll-end mailer for anything that ships on its own.'],
              ['Can I embed this in my own storefront?', 'The Converter plan wraps the same engine as an embeddable editor so your customers configure a box, see it in 3D, and drop a print-ready file straight into your order pipeline.'],
            ].map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="site-inner">
          <div className="cta-band">
            <h2>Your next carton is three numbers away</h2>
            <p>Open the studio, type your dimensions and export a dieline in the next five minutes.</p>
            <button className="btn btn-accent btn-lg" onClick={() => open('roast-coffee')}>Create a box now <Icon d={I.arrowR} size={16} /></button>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="site-inner">
          <div className="footer-grid">
            <div>
              <div className="logo" style={{ color: '#fff', marginBottom: 14 }}>
                <span className="logo-mark"><Icon d={I.box} size={16} /></span> BoxCraft
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.65, maxWidth: 320, margin: 0 }}>
                Browser-based packaging design: parametric dielines, real-time 3D and production files
                without a CAD licence.
              </p>
            </div>
            <div>
              <h5>Product</h5>
              <ul>
                <li><a href="#styles">Structures</a></li>
                <li><a href="#templates">Templates</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#/editor" onClick={(e) => { e.preventDefault(); open(); }}>Studio</a></li>
              </ul>
            </div>
            <div>
              <h5>Resources</h5>
              <ul>
                <li><a href="#how">How it works</a></li>
                <li><a href="#faq">Dieline guide</a></li>
                <li><a href="#pricing">For converters</a></li>
                <li><a href="#templates">Inspiration</a></li>
              </ul>
            </div>
            <div>
              <h5>Company</h5>
              <ul>
                <li><a href="#/">About</a></li>
                <li><a href="#/">Contact</a></li>
                <li><a href="#/">Privacy</a></li>
                <li><a href="#/">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bot">
            <span>© {new Date().getFullYear()} BoxCraft — a demo packaging studio.</span>
            <span>Built with WebGL. Dimensions in millimetres.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
