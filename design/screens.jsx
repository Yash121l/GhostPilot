// All screens for the GhostPilot prototype.
const { useState, useEffect, useRef, useMemo } = React

// ═══════════════════════════════════════════════════════════════
// COMPOSER
// ═══════════════════════════════════════════════════════════════
function ComposerScreen({ state, set }) {
  const { draft, platforms, variants, generating, activeVariantTab } = state.composer
  const charCount = draft.length

  const togglePlatform = (id) => {
    const next = platforms.includes(id) ? platforms.filter((p) => p !== id) : [...platforms, id]
    set.composer({ platforms: next })
  }

  const onGenerate = () => {
    if (!platforms.length) return
    set.composer({ generating: true, variants: null })
    setTimeout(() => {
      set.composer({ generating: false, variants: generateVariants(draft) })
    }, 1100)
  }

  const onScheduled = () => {
    const newPost = {
      id: 'p' + Date.now(),
      day: new Date().getDate() + 1,
      hour: 10,
      platform: activeVariantTab,
      title: (draft.split(/[.!?]/)[0] || 'New post').slice(0, 60) + '…',
      status: 'scheduled'
    }
    set.scheduled([newPost, ...state.scheduled])
    set.toast('Scheduled for tomorrow at 10:00')
  }

  const toolbarItems = [
    { id: 'ai', label: 'AI', icon: 'IconSparkle' },
    { id: 'rewrite', label: 'Rewrite', icon: 'IconRewrite' },
    { id: 'shorten', label: 'Shorten', icon: 'IconArrowDown' },
    { id: 'hook', label: 'Add Hook', icon: 'IconHook' },
    { id: 'cta', label: 'Add CTA', icon: 'IconCTA' }
  ]

  return (
    <div
      className="fade-in"
      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, height: '100%' }}
    >
      {/* DRAFT PANEL */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              fontWeight: 600
            }}
          >
            Platforms
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {PLATFORMS.map((p) => {
              const Ico = window[p.icon]
              const on = platforms.includes(p.id)
              return (
                <button
                  key={p.id}
                  className={`chip ${p.id} ${on ? 'on' : ''}`}
                  onClick={() => togglePlatform(p.id)}
                >
                  <Ico size={13} />
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        <div
          className="card"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '8px 10px',
              borderBottom: '1px solid var(--border)'
            }}
          >
            {toolbarItems.map((t) => {
              const Ico = window[t.icon]
              return (
                <button
                  key={t.id}
                  className="btn ghost"
                  style={{ padding: '6px 10px', fontSize: 13 }}
                  onClick={() => set.toast(`${t.label} not wired up in prototype`)}
                >
                  <Ico size={14} />
                  {t.label}
                </button>
              )
            })}
          </div>
          <textarea
            className="textarea"
            value={draft}
            onChange={(e) => set.composer({ draft: e.target.value })}
            placeholder="Write your post — a rough idea, full draft, or anything in between. AI will adapt it for each platform…"
            style={{ border: 'none', flex: 1, padding: 18, fontSize: 15, borderRadius: 0 }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-subtle)',
              color: 'var(--text-3)',
              fontSize: 12
            }}
          >
            <div style={{ display: 'flex', gap: 14 }}>
              <span>📎 0 attachments</span>
              <span>
                Persona: <strong style={{ color: 'var(--text-2)' }}>Yash — Indie Founder</strong>
              </span>
            </div>
            <span className="mono">{charCount} chars</span>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
          <button
            className="btn primary"
            onClick={onGenerate}
            disabled={generating || !platforms.length}
            style={{ flex: 1, justifyContent: 'center', padding: '11px 18px' }}
          >
            {generating ? (
              <>
                <svg
                  className="spin"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12a9 9 0 1 1-9-9" strokeLinecap="round" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <IconSparkle size={14} />
                Generate Variants
              </>
            )}
          </button>
          <button className="btn" onClick={() => set.composer({ draft: '', variants: null })}>
            <IconTrash size={14} /> Clear
          </button>
        </div>
      </div>

      {/* VARIANTS PANEL */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="tabrow" style={{ marginBottom: 14 }}>
          {PLATFORMS.map((p) => {
            const Ico = window[p.icon]
            return (
              <button
                key={p.id}
                className={`tab ${activeVariantTab === p.id ? 'active' : ''}`}
                onClick={() => set.composer({ activeVariantTab: p.id })}
              >
                <Ico size={14} />
                {p.label}
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {generating && <VariantSkeleton />}
          {!generating && !variants && <VariantEmpty />}
          {!generating && variants && (
            <VariantCard
              variant={variants[activeVariantTab]}
              platform={activeVariantTab}
              onSchedule={onScheduled}
              onCopy={() => set.toast('Copied to clipboard')}
              onPublish={() => set.toast('Publishing requires a connected account')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function VariantEmpty() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 14,
        color: 'var(--text-3)'
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: 'var(--bg-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border)'
        }}
      >
        <IconSparkle size={22} stroke={1.4} />
      </div>
      <div>
        <div style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600 }}>No variant yet</div>
        <div style={{ marginTop: 4, maxWidth: 280 }}>
          Write your draft on the left, then hit Generate to see platform-specific variants.
        </div>
      </div>
    </div>
  )
}

function VariantSkeleton() {
  return (
    <div
      className="card"
      style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div className="skeleton" style={{ height: 14, width: '85%' }} />
      <div className="skeleton" style={{ height: 14, width: '92%' }} />
      <div className="skeleton" style={{ height: 14, width: '70%' }} />
      <div className="skeleton" style={{ height: 14, width: '0', marginTop: 6 }} />
      <div className="skeleton" style={{ height: 14, width: '60%' }} />
      <div className="skeleton" style={{ height: 14, width: '78%' }} />
    </div>
  )
}

function VariantCard({ variant, platform, onSchedule, onCopy, onPublish }) {
  const content =
    platform === 'twitter' ? (
      variant.thread.map((t, i) => (
        <div
          key={i}
          style={{
            padding: '10px 0',
            borderBottom: i < variant.thread.length - 1 ? '1px dashed var(--border)' : 'none'
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12, paddingTop: 2 }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, fontSize: 14, lineHeight: 1.55 }}>{t}</div>
          </div>
        </div>
      ))
    ) : (
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.65 }}>
        {platform === 'linkedin' ? variant.body : variant.caption}
      </div>
    )

  return (
    <div className="card fade-in" style={{ padding: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            fontWeight: 600
          }}
        >
          Variant · {platform}
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-3)' }}>
          <span className="mono">{variant.chars} chars</span>
          <span style={{ color: 'var(--text-4)' }}>opt: {variant.optimal}</span>
        </div>
      </div>
      <div style={{ padding: '4px 0 14px' }}>{content}</div>
      <div
        style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}
      >
        <button className="btn" onClick={onCopy}>
          Copy
        </button>
        <button className="btn" onClick={onSchedule}>
          <IconClock size={14} />
          Schedule
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn primary" onClick={onPublish}>
          <IconSend size={14} />
          Publish now
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════════════════════════
function CalendarScreen({ state, set }) {
  const [selectedDay, setSelectedDay] = useState(14)
  const month = 'May 2026'
  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  // May 2026 starts on Friday
  const startOffset = 5
  const cells = [...Array(startOffset).fill(null), ...days]

  const postsForDay = (d) => state.scheduled.filter((p) => p.day === d)

  return (
    <div
      className="fade-in"
      style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, height: '100%' }}
    >
      {/* DAY DETAIL / TIMELINE */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Wed, May {selectedDay}
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>
            {postsForDay(selectedDay).length} scheduled
          </div>
        </div>

        <div className="card" style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {postsForDay(selectedDay).length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  margin: '0 auto 14px',
                  borderRadius: 12,
                  background: 'var(--bg-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border)'
                }}
              >
                <IconCalendar size={20} stroke={1.4} />
              </div>
              <div style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600 }}>
                Nothing scheduled
              </div>
              <div style={{ marginTop: 4 }}>Open Composer to draft and schedule a post.</div>
              <button
                className="btn primary"
                style={{ marginTop: 18 }}
                onClick={() => set.active('composer')}
              >
                Open Composer
              </button>
            </div>
          ) : (
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {postsForDay(selectedDay)
                .sort((a, b) => a.hour - b.hour)
                .map((p) => (
                  <SchedulePostRow
                    key={p.id}
                    post={p}
                    onDelete={() => {
                      set.scheduled(state.scheduled.filter((x) => x.id !== p.id))
                      set.toast('Post unscheduled')
                    }}
                  />
                ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-3)',
                fontWeight: 600
              }}
            >
              {month}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn ghost icon" style={{ width: 26, height: 26 }}>
                <IconChevron size={14} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <button className="btn ghost icon" style={{ width: 26, height: 26 }}>
                <IconChevron size={14} />
              </button>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7,1fr)',
              gap: 4,
              marginBottom: 6
            }}
          >
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div
                key={d}
                style={{
                  fontSize: 10,
                  color: 'var(--text-3)',
                  textAlign: 'center',
                  fontWeight: 600,
                  letterSpacing: '0.04em'
                }}
              >
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />
              const has = postsForDay(d).length
              const isSel = d === selectedDay
              const isToday = d === 13
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(d)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 8,
                    border: 'none',
                    background: isSel
                      ? 'var(--accent)'
                      : isToday
                        ? 'var(--accent-soft)'
                        : 'transparent',
                    color: isSel ? '#fff' : isToday ? 'var(--accent)' : 'var(--text-2)',
                    fontSize: 12,
                    fontWeight: isSel || isToday ? 600 : 500,
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {d}
                  {has > 0 && !isSel && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 3,
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: 'var(--accent)'
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              fontWeight: 600,
              marginBottom: 12
            }}
          >
            Rate limits
          </div>
          {[
            { id: 'linkedin', label: 'LinkedIn', val: 488, cap: 500, color: 'var(--linkedin)' },
            { id: 'twitter', label: 'X', val: 96, cap: 100, color: '#111' },
            { id: 'instagram', label: 'Instagram', val: 48, cap: 50, color: 'var(--instagram)' }
          ].map((r) => {
            const Ico =
              r.id === 'linkedin' ? IconLinkedIn : r.id === 'twitter' ? IconAt : IconInstagram
            const pct = r.val / r.cap
            return (
              <div key={r.id} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    marginBottom: 4
                  }}
                >
                  <span
                    style={{
                      color: 'var(--text-2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Ico size={12} /> {r.label}
                  </span>
                  <span className="mono" style={{ color: 'var(--text-3)' }}>
                    {r.val}/{r.cap}
                  </span>
                </div>
                <div className="progress">
                  <div className="fill" style={{ width: pct * 100 + '%', background: r.color }} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              fontWeight: 600,
              marginBottom: 10
            }}
          >
            This Week
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {state.scheduled.filter((p) => p.status === 'scheduled').length}
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Scheduled</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {state.scheduled.filter((p) => p.status === 'draft').length}
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Drafts</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>12</div>
              <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Published</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SchedulePostRow({ post, onDelete }) {
  const platform = PLATFORMS.find((p) => p.id === post.platform)
  const Ico = window[platform.icon]
  const colorMap = { linkedin: 'var(--linkedin)', twitter: '#111', instagram: 'var(--instagram)' }
  const bgMap = {
    linkedin: 'var(--linkedin-soft)',
    twitter: 'var(--twitter-soft)',
    instagram: 'var(--instagram-soft)'
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 12px',
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--bg-card)'
      }}
    >
      <div className="mono" style={{ width: 50, color: 'var(--text-3)', fontSize: 13 }}>
        {String(post.hour).padStart(2, '0')}:00
      </div>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: bgMap[post.platform],
          color: colorMap[post.platform],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Ico size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {post.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
          {post.status === 'scheduled' ? (
            <span style={{ color: 'var(--success)' }}>● Scheduled</span>
          ) : (
            <span>○ Draft</span>
          )}
          {' · '}
          {platform.label}
        </div>
      </div>
      <button className="btn ghost icon" onClick={onDelete}>
        <IconTrash size={14} />
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// CONNECT
// ═══════════════════════════════════════════════════════════════
function ConnectScreen({ state, set }) {
  const items = [
    {
      id: 'linkedin',
      name: 'LinkedIn',
      desc: 'Professional posts, articles, and thought leadership',
      icon: 'IconLinkedIn'
    },
    {
      id: 'twitter',
      name: 'X (Twitter)',
      desc: 'Tweets, threads, and real-time engagement',
      icon: 'IconAt'
    },
    {
      id: 'instagram',
      name: 'Instagram',
      desc: 'Visual content, carousels, and caption publishing',
      icon: 'IconInstagram'
    }
  ]

  return (
    <div className="fade-in" style={{ maxWidth: 780 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          fontWeight: 600,
          marginBottom: 12
        }}
      >
        Platforms
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((p) => {
          const Ico = window[p.icon]
          const connected = state.connections[p.id]
          const colorMap = {
            linkedin: 'var(--linkedin)',
            twitter: '#111',
            instagram: 'var(--instagram)'
          }
          const bgMap = {
            linkedin: 'var(--linkedin-soft)',
            twitter: 'var(--twitter-soft)',
            instagram: 'var(--instagram-soft)'
          }
          return (
            <div
              key={p.id}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16 }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: bgMap[p.id],
                  color: colorMap[p.id],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Ico size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</div>
                  {connected ? (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--success)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontWeight: 500
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'var(--success)'
                        }}
                      />
                      Connected as @yashbuilds
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text-3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <IconX_Close size={10} /> Not connected
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{p.desc}</div>
              </div>
              {connected ? (
                <button
                  className="btn danger"
                  onClick={() => set.connections({ ...state.connections, [p.id]: false })}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  className="btn primary"
                  onClick={() => {
                    set.connections({ ...state.connections, [p.id]: true })
                    set.toast(`${p.name} connected via OAuth`)
                  }}
                >
                  <IconLink size={14} /> Connect
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div
        style={{
          marginTop: 28,
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          fontWeight: 600,
          marginBottom: 10,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        <IconShield size={12} /> Privacy &amp; Security
      </div>
      <div
        className="card"
        style={{ padding: 18, fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7 }}
      >
        <p style={{ margin: '0 0 10px' }}>
          OAuth tokens are stored exclusively in your OS keychain (macOS Keychain / Windows
          Credential Manager / libsecret on Linux). They are <strong>never uploaded</strong> to any
          server or stored in the database.
        </p>
        <p style={{ margin: 0 }}>
          All publishing requests originate directly from this machine. Disconnecting immediately
          deletes the local token.
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// GOALS
// ═══════════════════════════════════════════════════════════════
function GoalsScreen({ state, set }) {
  const [creating, setCreating] = useState(false)
  const [northStar, setNorthStar] = useState('')

  if (creating) {
    return (
      <div className="fade-in" style={{ maxWidth: 640 }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>New Goal</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 22 }}>
            Tell GhostPilot what you want to achieve — AI decomposes it into measurable key results.
          </div>
          <label className="label">North-star outcome *</label>
          <input
            className="input"
            value={northStar}
            onChange={(e) => setNorthStar(e.target.value)}
            placeholder="e.g. Reach 10,000 LinkedIn followers by Q4"
            autoFocus
          />
          <label className="label" style={{ marginTop: 16 }}>
            Timeframe
          </label>
          <select className="select" defaultValue="6 months">
            <option>4 weeks</option>
            <option>12 weeks</option>
            <option>6 months</option>
            <option>1 year</option>
          </select>
          <label className="label" style={{ marginTop: 16 }}>
            Primary platform
          </label>
          <select className="select">
            <option>LinkedIn</option>
            <option>X (Twitter)</option>
            <option>Instagram</option>
            <option>All platforms</option>
          </select>
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button
              className="btn primary"
              onClick={() => {
                if (!northStar.trim()) return
                const g = {
                  id: 'g' + Date.now(),
                  name: northStar,
                  north: northStar,
                  progress: 0.05,
                  current: 124,
                  target: 5000,
                  weekly: 4,
                  keyResults: [
                    {
                      label: 'Publish 4 LinkedIn posts / week',
                      done: false,
                      current: 1,
                      target: 4
                    },
                    { label: 'Reach 5%+ engagement rate', done: false, current: 0, target: 5 },
                    { label: 'Build a 3-week content backlog', done: false, current: 0, target: 3 }
                  ]
                }
                set.goals([g, ...state.goals])
                setCreating(false)
                setNorthStar('')
                set.toast('Goal created. AI generated 3 key results.')
              }}
            >
              <IconSparkle size={14} /> Decompose with AI
            </button>
            <button className="btn" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8 }}>
        <button className="btn primary" onClick={() => setCreating(true)}>
          <IconPlus size={14} /> New Goal
        </button>
      </div>
      {state.goals.map((g) => (
        <GoalCard key={g.id} goal={g} set={set} />
      ))}
    </div>
  )
}

function GoalCard({ goal, set }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              fontWeight: 600
            }}
          >
            North star
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, letterSpacing: '-0.01em' }}>
            {goal.name}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
            {goal.current.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            of {goal.target.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="progress" style={{ marginTop: 14 }}>
        <div className="fill" style={{ width: goal.progress * 100 + '%' }} />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontSize: 12,
          color: 'var(--text-3)'
        }}
      >
        <span>{Math.round(goal.progress * 100)}% to goal</span>
        <span>Posting {goal.weekly}/wk to stay on track</span>
      </div>

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            fontWeight: 600,
            marginBottom: 10
          }}
        >
          Key results
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {goal.keyResults.map((kr, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: '1.5px solid ' + (kr.done ? 'var(--success)' : 'var(--border-strong)'),
                  background: kr.done ? 'var(--success)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff'
                }}
              >
                {kr.done && <IconCheck size={11} />}
              </div>
              <div
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: kr.done ? 'var(--text-3)' : 'var(--text)',
                  textDecoration: kr.done ? 'line-through' : 'none'
                }}
              >
                {kr.label}
              </div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {kr.current}/{kr.target}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

Object.assign(window, { ComposerScreen, CalendarScreen, ConnectScreen, GoalsScreen })
