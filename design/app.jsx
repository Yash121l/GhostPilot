// Main app — state, sidebar, top chrome, screen routing, Tweaks panel.
const { useState: useStateMain, useEffect: useEffectMain, useRef: useRefMain } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#5b5bf0",
  "density": "comfortable",
  "phaseLabel": "PHASE 1"
}/*EDITMODE-END*/;

const ACCENT_PRESETS = {
  '#5b5bf0': { soft: '#ecebff', strong: '#4848e8', ring: 'rgba(91,91,240,0.22)' },
  '#1f8a5b': { soft: '#e2f5ec', strong: '#16703f', ring: 'rgba(31,138,91,0.22)' },
  '#c45c2c': { soft: '#fbe9dd', strong: '#a84a1f', ring: 'rgba(196,92,44,0.22)' },
  '#111111': { soft: '#eeeeee', strong: '#000000', ring: 'rgba(0,0,0,0.18)' },
};

function App() {
  const [active, setActive] = useStateMain('composer');
  const [draft, setDraft] = useStateMain('');
  const [platforms, setPlatforms] = useStateMain(['linkedin', 'twitter', 'instagram']);
  const [variants, setVariants] = useStateMain(null);
  const [generating, setGenerating] = useStateMain(false);
  const [activeVariantTab, setActiveVariantTab] = useStateMain('linkedin');
  const [scheduled, setScheduled] = useStateMain(SEED_POSTS);
  const [connections, setConnections] = useStateMain({ linkedin: false, twitter: false, instagram: false });
  const [goals, setGoals] = useStateMain(SEED_GOALS);
  const [personas, setPersonas] = useStateMain(SEED_PERSONAS);
  const [trends] = useStateMain(SEED_TRENDS);
  const [apiKeys, setApiKeys] = useStateMain([]);
  const [toast, setToast] = useStateMain(null);
  const toastTimer = useRefMain(null);
  const [tweaks, setTweaksLocal] = useStateMain(TWEAK_DEFAULTS);

  // Apply accent var
  useEffectMain(() => {
    const a = tweaks.accent;
    const pal = ACCENT_PRESETS[a] || ACCENT_PRESETS['#5b5bf0'];
    document.documentElement.style.setProperty('--accent', a);
    document.documentElement.style.setProperty('--accent-soft', pal.soft);
    document.documentElement.style.setProperty('--accent-strong', pal.strong);
    document.documentElement.style.setProperty('--accent-ring', pal.ring);
  }, [tweaks.accent]);

  const setTweak = (key, value) => {
    const update = typeof key === 'object' ? key : { [key]: value };
    setTweaksLocal(t => ({ ...t, ...update }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: update }, '*');
  };

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  const set = {
    active: setActive,
    composer: (patch) => {
      if (patch.draft !== undefined) setDraft(patch.draft);
      if (patch.platforms !== undefined) setPlatforms(patch.platforms);
      if (patch.variants !== undefined) setVariants(patch.variants);
      if (patch.generating !== undefined) setGenerating(patch.generating);
      if (patch.activeVariantTab !== undefined) setActiveVariantTab(patch.activeVariantTab);
    },
    scheduled: setScheduled,
    connections: setConnections,
    goals: setGoals,
    personas: setPersonas,
    apiKeys: setApiKeys,
    toast: showToast,
  };

  const state = {
    composer: { draft, platforms, variants, generating, activeVariantTab },
    scheduled, connections, goals, personas, trends, apiKeys,
  };

  const screenMap = {
    composer: ComposerScreen,
    calendar: CalendarScreen,
    connect: ConnectScreen,
    goals: GoalsScreen,
    trends: TrendsScreen,
    personas: PersonasScreen,
    analytics: AnalyticsScreen,
    settings: SettingsScreen,
  };
  const Screen = screenMap[active];

  const screenMeta = {
    composer: { title: 'Composer', subtitle: 'Write once — AI adapts for every platform' },
    calendar: { title: 'Calendar', subtitle: `${scheduled.length} posts · ${scheduled.filter(p => p.status === 'scheduled').length} scheduled` },
    connect:  { title: 'Connect Accounts', subtitle: 'Link your social accounts to start publishing' },
    goals:    { title: 'Goals', subtitle: 'AI breaks your north-star into a weekly posting plan' },
    trends:   { title: 'Trends', subtitle: 'Topics scored for relevance, velocity, and novelty' },
    personas: { title: 'Personas', subtitle: 'Tune voice, pillars, and style per audience' },
    analytics:{ title: 'Analytics', subtitle: 'Publishing performance and AI cost tracking' },
    settings: { title: 'AI Providers', subtitle: 'API keys, local models, and cost tracking' },
  }[active];

  const dense = tweaks.density === 'compact';

  return (
    <>
      <div className="window" style={dense ? { } : {}}>
        {/* TITLEBAR */}
        <div className="titlebar">
          <div className="traffic">
            <div className="dot close" />
            <div className="dot min" />
            <div className="dot max" />
          </div>
          <div className="title">GhostPilot</div>
        </div>

        {/* APP SHELL */}
        <div className="app">
          <Sidebar active={active} setActive={setActive} connections={connections} />
          <div className="main">
            <div className="topbar">
              <div>
                <h1>{screenMeta.title}</h1>
                <div className="subtitle">{screenMeta.subtitle}</div>
              </div>
              <div className="topbar-right">
                <TopbarActions active={active} set={set} state={state} />
                <span className="phase-pill">
                  <IconSparkle size={11} />
                  {tweaks.phaseLabel}
                </span>
              </div>
            </div>

            <div className="content" key={active}>
              <Screen state={state} set={set} />
            </div>

            <div className="statusbar">
              <span className="ok"><IconDatabase size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />DB: Connected</span>
              <span className="warn">
                <IconBolt size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                AI: {apiKeys.length > 0 ? <span style={{ color: 'var(--success)' }}>{apiKeys.length} provider{apiKeys.length>1?'s':''} configured</span> : 'Not configured'}
              </span>
              <span style={{ color: 'var(--text-3)' }}>
                {Object.values(connections).filter(Boolean).length} of 3 accounts connected
              </span>
              <span className="right mono">⌖ v1.0.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className="fade-in" style={{
          position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(20,18,12,0.92)', color: '#fff',
          padding: '10px 18px', borderRadius: 10, fontSize: 13.5, fontWeight: 500,
          boxShadow: '0 12px 32px rgba(0,0,0,0.30)', zIndex: 200,
          display: 'inline-flex', alignItems: 'center', gap: 10,
        }}>
          <IconCheck size={14} style={{ color: 'var(--accent)' }} />
          {toast}
        </div>
      )}

      {/* TWEAKS PANEL */}
      <TweaksPanel>
        <TweakSection label="Theme">
          <TweakColor label="Accent" value={tweaks.accent} options={Object.keys(ACCENT_PRESETS)}
            onChange={v => setTweak('accent', v)} />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakRadio label="Density" value={tweaks.density}
            options={[{ value: 'comfortable', label: 'Comfy' }, { value: 'compact', label: 'Compact' }]}
            onChange={v => setTweak('density', v)} />
        </TweakSection>
        <TweakSection label="Header">
          <TweakText label="Phase badge" value={tweaks.phaseLabel}
            onChange={v => setTweak('phaseLabel', v)} />
        </TweakSection>
        <TweakSection label="Demo helpers">
          <TweakButton label="Connect all accounts" onClick={() => setConnections({ linkedin: true, twitter: true, instagram: true })} />
          <TweakButton label="Reset scheduled posts" onClick={() => setScheduled(SEED_POSTS)} />
          <TweakButton label="Clear all keys" onClick={() => setApiKeys([])} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// ─── SIDEBAR ────────────────────────────────────────────────────
function Sidebar({ active, setActive, connections }) {
  return (
    <div className="sidebar">
      <div className="brand">
        <div className="brand-mark"><IconGhost size={22} stroke={1.7} /></div>
        <div className="brand-name">GHOSTPILOT</div>
      </div>

      <div className="nav-section">Workspace</div>
      <div className="nav">
        {NAV_ITEMS.map(item => {
          const Ico = window[item.icon];
          return (
            <button key={item.id}
              className={`nav-item ${active === item.id ? 'active' : ''}`}
              onClick={() => setActive(item.id)}>
              <Ico className="icon" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="nav-spacer" />

      <div className="connections">
        <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--text-3)', fontWeight: 600, marginBottom: 6 }}>Connections</div>
        {[
          { id: 'linkedin', label: 'LinkedIn', icon: IconLinkedIn },
          { id: 'twitter',  label: 'X',        icon: IconAt },
          { id: 'instagram',label: 'Instagram',icon: IconInstagram },
        ].map(c => (
          <div key={c.id} className="connections-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <c.icon size={13} style={{ color: connections[c.id] ? 'var(--text-2)' : 'var(--text-4)' }} />
              <span style={{ color: connections[c.id] ? 'var(--text-2)' : 'var(--text-4)' }}>{c.label}</span>
            </span>
            <span className={`conn-status ${connections[c.id] ? 'on' : ''}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TOPBAR ACTIONS (per screen) ────────────────────────────────
function TopbarActions({ active, set, state }) {
  if (active === 'composer') {
    return (
      <button className="btn primary" onClick={() => {
        if (!state.composer.platforms.length) return;
        set.composer({ generating: true, variants: null });
        setTimeout(() => set.composer({ generating: false, variants: generateVariants(state.composer.draft) }), 1100);
      }} disabled={state.composer.generating || !state.composer.platforms.length}>
        <IconSparkle size={14} />
        Generate Variants
      </button>
    );
  }
  if (active === 'calendar') {
    return <button className="btn icon" onClick={() => set.toast('Calendar refreshed')}><IconRefresh size={14} /></button>;
  }
  if (active === 'connect') {
    return <button className="btn icon" onClick={() => set.toast('Connection status refreshed')}><IconRefresh size={14} /></button>;
  }
  if (active === 'analytics') {
    return <button className="btn icon" onClick={() => set.toast('Analytics refreshed')}><IconRefresh size={14} /></button>;
  }
  return null;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
