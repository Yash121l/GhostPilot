// Remaining screens: Trends, Personas, Analytics, Settings.
const { useState, useEffect, useRef, useMemo } = React;

// ═══════════════════════════════════════════════════════════════
// TRENDS
// ═══════════════════════════════════════════════════════════════
function TrendsScreen({ state, set }) {
  const [showConfig, setShowConfig] = useState(false);
  const [keywords, setKeywords] = useState(['ai', 'indie hacking']);
  const [kwInput, setKwInput] = useState('');
  const [sources, setSources] = useState({ hackernews: true, reddit: true });
  const [threshold, setThreshold] = useState(40);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() =>
    state.trends.filter(t => {
      const score = (t.relevance + t.velocity + t.novelty) / 3;
      if (score < threshold) return false;
      if (!sources[t.source]) return false;
      return true;
    })
  , [state.trends, threshold, sources]);

  const doRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); set.toast('Refreshed — 3 new signals'); }, 900);
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: -8, marginBottom: 16 }}>
        <button className={`btn ${showConfig ? 'primary' : ''}`} onClick={() => setShowConfig(!showConfig)}>
          <IconConfigure size={14} /> Configure
        </button>
        <button className="btn" onClick={doRefresh} disabled={refreshing}>
          {refreshing
            ? <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9" strokeLinecap="round" /></svg>
            : <IconRefresh size={14} />}
          Refresh
        </button>
      </div>

      {showConfig && (
        <div className="card fade-in" style={{ padding: 22, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <IconConfigure size={16} />
            <div style={{ fontWeight: 600 }}>Trend Configuration</div>
            <span className="chip linkedin on" style={{ fontSize: 10.5 }}>Affects next refresh</span>
          </div>

          <label className="label">Topics & keywords</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={kwInput}
              onChange={e => setKwInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && kwInput.trim()) { setKeywords([...keywords, kwInput.trim()]); setKwInput(''); } }}
              placeholder="e.g. ai, startup, web3 — press Enter" />
            <button className="btn" onClick={() => { if (kwInput.trim()) { setKeywords([...keywords, kwInput.trim()]); setKwInput(''); } }}>
              <IconPlus size={14} /> Add
            </button>
          </div>
          {keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {keywords.map((k, i) => (
                <span key={i} className="chip" style={{ paddingRight: 6 }}>
                  {k}
                  <button onClick={() => setKeywords(keywords.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, display: 'inline-flex' }}>
                    <IconX_Close size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <label className="label" style={{ marginTop: 16 }}>Sources</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'hackernews', label: 'Hacker News' },
              { id: 'reddit', label: 'Reddit' },
            ].map(s => (
              <button key={s.id}
                onClick={() => setSources({ ...sources, [s.id]: !sources[s.id] })}
                className={`chip ${sources[s.id] ? 'linkedin on' : ''}`}
                style={{ paddingLeft: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%',
                  background: sources[s.id] ? 'var(--accent)' : 'var(--text-4)' }} />
                {s.label}
              </button>
            ))}
          </div>

          <label className="label" style={{ marginTop: 16 }}>
            Minimum score threshold
            <span className="mono" style={{ float: 'right', color: 'var(--text-3)' }}>{threshold}%</span>
          </label>
          <input type="range" min="0" max="100" value={threshold} onChange={e => setThreshold(+e.target.value)}
            style={{ width: '100%', accentColor: 'var(--accent)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
            <span>Show all</span><span>High quality only</span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn primary" onClick={() => { setShowConfig(false); set.toast('Configuration saved'); }}>
              <IconSave size={14} /> Save & Refresh
            </button>
            <button className="btn" onClick={() => { setKeywords([]); setThreshold(40); setSources({ hackernews: true, reddit: true }); }}>
              Reset defaults
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 14 }}>
        {filtered.map(t => <TrendCard key={t.id} trend={t} onDraft={() => {
          set.composer({ draft: `Take on: ${t.title}\n\nMy quick read — ` });
          set.active('composer');
          set.toast('Draft seeded from trend');
        }} />)}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, color: 'var(--text-3)' }}>
            No trends match your filters. Lower the threshold or enable more sources.
          </div>
        )}
      </div>
    </div>
  );
}

function TrendCard({ trend, onDraft }) {
  const tagColor = trend.tag === 'HOT' ? 'var(--error)' : trend.tag === 'RISING' ? 'var(--warning)' : 'var(--text-3)';
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tagColor }}>{trend.tag}</div>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, marginTop: 6, letterSpacing: '-0.005em' }}>
          {trend.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
          {trend.signals} signals from {trend.source === 'hackernews' ? 'Hacker News' : 'Reddit'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ScoreBar label="Relevance" value={trend.relevance} color="var(--accent)" />
        <ScoreBar label="Velocity"  value={trend.velocity}  color="oklch(0.62 0.18 280)" />
        <ScoreBar label="Novelty"   value={trend.novelty}   color="oklch(0.66 0.16 320)" />
      </div>

      <a href={trend.url} onClick={e => e.preventDefault()}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5,
          color: 'var(--text-3)', textDecoration: 'none', overflow: 'hidden' }}>
        <span style={{ fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-2)' }}>
          {trend.source === 'hackernews' ? 'HACKERNEWS' : 'REDDIT'}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {trend.title.toLowerCase().slice(0, 50)}…
        </span>
        <IconExternal size={11} />
      </a>

      <button className="btn" style={{ justifyContent: 'center' }} onClick={onDraft}>
        <IconCompose size={14} /> Draft this topic
      </button>
    </div>
  );
}

function ScoreBar({ label, value, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-3)' }}>
        <span>{label}</span>
        <span className="mono" style={{ color: 'var(--text-2)', fontWeight: 500 }}>{value}</span>
      </div>
      <div className="progress" style={{ height: 3, marginTop: 2 }}>
        <div className="fill" style={{ width: value + '%', background: color }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PERSONAS
// ═══════════════════════════════════════════════════════════════
function PersonasScreen({ state, set }) {
  const [selected, setSelected] = useState(state.personas[0]?.id || null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', bio: '', pillars: '', style: '' });

  const persona = state.personas.find(p => p.id === selected);

  const save = () => {
    if (!draft.name.trim()) return;
    const p = { id: 'pers'+Date.now(), name: draft.name, bio: draft.bio, pillars: draft.pillars, style: draft.style, posts: 0, voice: 50 };
    set.personas([...state.personas, p]);
    setSelected(p.id); setCreating(false); setDraft({ name: '', bio: '', pillars: '', style: '' });
    set.toast('Persona created. AI will tune voice over your next 5 posts.');
  };

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 0, height: '100%',
      border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)' }}>
      {/* list */}
      <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Personas</div>
          <button className="btn ghost icon" onClick={() => { setCreating(true); setSelected(null); }}>
            <IconPlus size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 6 }}>
          {state.personas.map(p => (
            <button key={p.id}
              onClick={() => { setSelected(p.id); setCreating(false); }}
              style={{ width: '100%', textAlign: 'left', background: selected === p.id ? 'var(--accent-soft)' : 'transparent',
                border: 'none', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2,
                color: selected === p.id ? 'var(--accent)' : 'var(--text)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%',
                background: selected === p.id ? 'var(--accent)' : 'var(--bg-subtle)',
                color: selected === p.id ? '#fff' : 'var(--text-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600,
                border: '1px solid ' + (selected === p.id ? 'var(--accent)' : 'var(--border)') }}>
                {p.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.posts} posts · voice {p.voice}%</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* detail / create */}
      <div style={{ overflow: 'auto', padding: 28 }}>
        {creating ? (
          <PersonaForm draft={draft} setDraft={setDraft} onSave={save}
            onCancel={() => { setCreating(false); setSelected(state.personas[0]?.id); }} />
        ) : persona ? (
          <PersonaDetail persona={persona} onDelete={() => {
            set.personas(state.personas.filter(p => p.id !== persona.id));
            setSelected(state.personas.find(p => p.id !== persona.id)?.id);
            set.toast('Persona deleted');
          }} />
        ) : (
          <div style={{ color: 'var(--text-3)' }}>Select a persona or create a new one.</div>
        )}
      </div>
    </div>
  );
}

function PersonaForm({ draft, setDraft, onSave, onCancel }) {
  return (
    <div style={{ maxWidth: 580 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>New Persona</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 22 }}>
        Personas let GhostPilot adapt voice, pillars, and style per audience.
      </div>
      <label className="label">Name *</label>
      <input className="input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
        placeholder="e.g. Yash — Tech Founder" autoFocus />
      <label className="label" style={{ marginTop: 16 }}>Bio</label>
      <textarea className="textarea" value={draft.bio} onChange={e => setDraft({ ...draft, bio: e.target.value })}
        placeholder="Short bio — AI uses this as context when writing in your voice…" style={{ minHeight: 90 }} />
      <label className="label" style={{ marginTop: 16 }}>Content pillars</label>
      <input className="input" value={draft.pillars} onChange={e => setDraft({ ...draft, pillars: e.target.value })}
        placeholder="AI, indie hacking, product building" />
      <div className="helper">Comma-separated topics you consistently post about</div>
      <label className="label" style={{ marginTop: 16 }}>Style hints</label>
      <textarea className="textarea" value={draft.style} onChange={e => setDraft({ ...draft, style: e.target.value })}
        placeholder="Casual and direct, use short sentences, avoid corporate jargon…" />

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button className="btn primary" onClick={onSave}><IconSave size={14} /> Create Persona</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function PersonaDetail({ persona, onDelete }) {
  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>
            {persona.name.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{persona.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{persona.posts} posts · voice match {persona.voice}%</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn"><IconEdit size={14} /> Edit</button>
          <button className="btn danger" onClick={onDelete}><IconTrash size={14} /> Delete</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 24 }}>
        <PersonaField label="Bio" value={persona.bio} />
        <PersonaField label="Content pillars" value={persona.pillars}
          render={v => v.split(',').map((p, i) => <span key={i} className="chip" style={{ marginRight: 6, marginBottom: 6 }}>{p.trim()}</span>)} />
        <PersonaField label="Style hints" value={persona.style} />
      </div>

      <div style={{ marginTop: 28, padding: 18, background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconSparkle size={12} /> Voice training
        </div>
        <div style={{ marginBottom: 8, fontSize: 13 }}>
          AI matches your voice with <strong>{persona.voice}% confidence</strong> based on {persona.posts} published posts.
        </div>
        <div className="progress"><div className="fill" style={{ width: persona.voice + '%' }} /></div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
          {persona.voice >= 75 ? 'Your voice is well-trained. AI variants should feel native.'
            : 'Publish 5+ posts to improve voice accuracy.'}
        </div>
      </div>
    </div>
  );
}

function PersonaField({ label, value, render }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
        {render ? render(value) : value}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════
function AnalyticsScreen({ state, set }) {
  const a = SEED_ANALYTICS;
  // build sparkline
  const maxT = Math.max(...a.trend);
  const points = a.trend.map((v, i) => {
    const x = (i / (a.trend.length - 1)) * 100;
    const y = 100 - (v / maxT) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Kpi label="Followers"    value={a.followers.toLocaleString()} delta="+12.4%" positive />
        <Kpi label="Impressions"  value={(a.impressions/1000).toFixed(1)+'K'} delta="+38.2%" positive />
        <Kpi label="Engagement"   value={a.engagement + '%'} delta="+0.4 pp" positive />
        <Kpi label="AI Spend"     value={'$' + a.spend.toFixed(2)} delta="this month" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* impressions trend */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>Impressions · last 14d</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{(a.impressions/1000).toFixed(1)}K</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['7d','14d','30d','90d'].map(r => (
                <button key={r} className="chip" style={{ background: r==='14d'?'var(--accent-soft)':undefined, color: r==='14d'?'var(--accent)':undefined, borderColor: r==='14d'?'rgba(91,91,240,0.18)':undefined }}>{r}</button>
              ))}
            </div>
          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 160 }}>
            <defs>
              <linearGradient id="trendGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`0,100 ${points} 100,100`} fill="url(#trendGrad)" />
            <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round" />
            {a.trend.map((v, i) => {
              const x = (i / (a.trend.length - 1)) * 100;
              const y = 100 - (v / maxT) * 100;
              return <circle key={i} cx={x} cy={y} r="0.7" fill="var(--accent)" />;
            })}
          </svg>
        </div>

        {/* platform breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, marginBottom: 14 }}>
            By platform
          </div>
          {a.byPlatform.map(p => {
            const Ico = p.id === 'linkedin' ? IconLinkedIn : p.id === 'twitter' ? IconAt : IconInstagram;
            return (
              <div key={p.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <Ico size={14} /> {p.label}
                  </span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{p.posts} posts</span>
                </div>
                <div className="progress" style={{ height: 6 }}>
                  <div className="fill" style={{ width: (p.eng/10*100)+'%', background: p.color }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
                  {p.eng}% engagement
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* top posts */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, marginBottom: 12 }}>
          Top posts · last 30 days
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {a.topPosts.map((p, i) => {
            const Ico = p.platform === 'linkedin' ? IconLinkedIn : p.platform === 'twitter' ? IconAt : IconInstagram;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 4px',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div className="mono" style={{ width: 24, color: 'var(--text-4)', fontSize: 13 }}>{i+1}</div>
                <Ico size={14} />
                <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{p.title}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', width: 70, textAlign: 'right' }}>{p.reach.toLocaleString()}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--success)', width: 50, textAlign: 'right' }}>{p.eng}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ai spend breakdown */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>
            AI spend breakdown
          </div>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>May 2026</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <SpendStat label="Claude Haiku 4.5" amount="$2.84" calls="412 calls" pct={0.59} />
          <SpendStat label="GPT-4o-mini"      amount="$1.62" calls="218 calls" pct={0.34} />
          <SpendStat label="Local Llama"       amount="$0.36" calls="89 calls"  pct={0.07} color="var(--success)" />
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta, positive }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 8, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 12, marginTop: 4, color: positive ? 'var(--success)' : 'var(--text-3)' }}>{delta}</div>
    </div>
  );
}

function SpendStat({ label, amount, calls, pct, color = 'var(--accent)' }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{amount}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 6 }}>{calls}</div>
      <div className="progress"><div className="fill" style={{ width: pct*100+'%', background: color }} /></div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════
function SettingsScreen({ state, set }) {
  const [adding, setAdding] = useState(false);
  const [provider, setProvider] = useState('anthropic');
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');

  const providers = {
    anthropic: { name: 'Claude (Anthropic)', placeholder: 'sk-ant-api03-…',
      note: 'Claude.ai and Claude Code subscriptions do NOT include API access. Get a separate key at console.anthropic.com → API Keys.' },
    openai: { name: 'OpenAI (GPT-4o, GPT-5)', placeholder: 'sk-proj-…',
      note: 'Get an API key at platform.openai.com → API keys.' },
    google: { name: 'Google (Gemini)', placeholder: 'AIza…',
      note: 'Get a key at aistudio.google.com → API Keys.' },
    groq: { name: 'Groq', placeholder: 'gsk_…',
      note: 'Fast Llama inference. Get a key at console.groq.com.' },
  };

  const addKey = () => {
    if (!key.trim()) return;
    set.apiKeys([...state.apiKeys, { id: 'k'+Date.now(), provider, label: label || providers[provider].name, masked: key.slice(0, 7) + '…' + key.slice(-4) }]);
    setAdding(false); setKey(''); setLabel('');
    set.toast('Key stored in OS keychain');
  };

  return (
    <div className="fade-in" style={{ maxWidth: 820 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, marginBottom: 12 }}>
        Local inference
      </div>
      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)',
          border: '1px solid var(--border)' }}>
          <IconWifiOff size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Ollama</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
            Not running — start Ollama for free local inference
          </div>
        </div>
        <span className="chip">Offline</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconKey size={12} /> Cloud AI — API keys
        </div>
        {!adding && <button className="btn primary" onClick={() => setAdding(true)}><IconPlus size={14} /> Add Key</button>}
      </div>

      {state.apiKeys.length === 0 && !adding && (
        <div className="card" style={{ padding: 22, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
          No keys yet. Add one above, or run Ollama locally for free inference.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {state.apiKeys.map(k => (
          <div key={k.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-soft)',
              color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconBolt size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{k.label}</div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{k.masked}</div>
            </div>
            <span className="chip linkedin on" style={{ background: 'rgba(31,157,85,0.12)', color: 'var(--success)', borderColor: 'rgba(31,157,85,0.22)' }}>● Active</span>
            <button className="btn ghost icon" onClick={() => {
              set.apiKeys(state.apiKeys.filter(x => x.id !== k.id));
              set.toast('Key removed');
            }}><IconTrash size={14} /></button>
          </div>
        ))}
      </div>

      {adding && (
        <div className="card fade-in" style={{ padding: 22, marginTop: 12, position: 'relative' }}>
          <button className="btn ghost icon" style={{ position: 'absolute', top: 12, right: 12 }} onClick={() => setAdding(false)}>
            <IconX_Close size={14} />
          </button>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>Add API Key</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="label">Provider</label>
              <select className="select" value={provider} onChange={e => setProvider(e.target.value)}>
                {Object.entries(providers).map(([id, p]) => <option key={id} value={id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Label (optional)</label>
              <input className="input" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Personal key" />
            </div>
          </div>

          <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--accent-soft)',
            border: '1px solid rgba(91,91,240,0.18)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <IconHelp size={14} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
              {providers[provider].note}
            </div>
          </div>

          <label className="label" style={{ marginTop: 14 }}>API Key *</label>
          <input className="input mono" value={key} onChange={e => setKey(e.target.value)}
            placeholder={providers[provider].placeholder} style={{ fontSize: 13 }} />
          <div className="helper">Stored in your OS keychain — never leaves this machine.</div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn primary" onClick={addKey}><IconPlus size={14} /> Add Key</button>
            <button className="btn" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 28, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <IconChart size={12} /> AI spend
      </div>
      {state.apiKeys.length === 0 ? (
        <div className="card" style={{ padding: 16, color: 'var(--text-3)', fontSize: 14 }}>
          No AI usage recorded yet.
        </div>
      ) : (
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>$4.82</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>This month · 719 calls</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="progress" style={{ height: 8 }}>
              <div className="fill" style={{ width: '32%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              <span>$0</span>
              <span>Budget cap: $15.00</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { TrendsScreen, PersonasScreen, AnalyticsScreen, SettingsScreen });
