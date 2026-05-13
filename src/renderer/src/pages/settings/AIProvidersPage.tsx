import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import {
  Key, Plus, Trash2, AlertCircle, Loader2, Bot, Wifi,
  CheckCircle, XCircle, Activity, Info, Star, Calendar, DollarSign,
} from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import type { DailyUsage } from '@shared/ipc-types'
import type { ProviderKeyConfig, OllamaStatus } from '@shared/types/ai'

// ─── Provider definitions ─────────────────────────────────────────────────────

interface ProviderDef {
  id: string
  label: string
  hint: string
  color: string
  note?: string
}

const PROVIDERS: ProviderDef[] = [
  { id: 'openai',     label: 'OpenAI',            hint: 'sk-…',            color: '#10A37F' },
  {
    id: 'anthropic',  label: 'Claude (Anthropic)', hint: 'sk-ant-api03-…',  color: '#D97706',
    note: 'Claude.ai and Claude Code subscriptions do NOT include API access. Get a separate key at console.anthropic.com → API Keys.',
  },
  {
    id: 'openrouter', label: 'OpenRouter',         hint: 'sk-or-…',         color: '#6366F1',
    note: 'Routes to Claude, GPT-4, Llama and others through a single key — good for testing multiple models.',
  },
  {
    id: 'groq',       label: 'Groq',               hint: 'gsk_…',           color: '#F87171',
    note: 'Ultra-fast inference for open-source models (Llama, Mixtral). Free tier available.',
  },
]

function providerMeta(id: string): ProviderDef {
  return PROVIDERS.find((p) => p.id === id) ?? { id, label: id, hint: '', color: 'var(--color-primary)' }
}

// ─── Cost helpers ─────────────────────────────────────────────────────────────

function todayCost(daily: DailyUsage[]): number {
  const key = new Date().toISOString().slice(0, 10)
  return daily.find((d) => d.date === key)?.totalCostUsd ?? 0
}

function monthCost(daily: DailyUsage[]): number {
  const key = new Date().toISOString().slice(0, 7)
  return daily.filter((d) => d.date.startsWith(key)).reduce((s, d) => s + d.totalCostUsd, 0)
}

function byProviderTotals(daily: DailyUsage[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const d of daily) {
    for (const [provider, cost] of Object.entries(d.byProvider)) {
      acc[provider] = (acc[provider] ?? 0) + cost
    }
  }
  return acc
}

// ─── Add key form ─────────────────────────────────────────────────────────────

function AddKeyForm({ onAdded }: { onAdded: () => void }): ReactElement {
  const [provider, setProvider] = useState('anthropic')
  const [label, setLabel]       = useState('')
  const [secret, setSecret]     = useState('')
  const [adding, setAdding]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [open, setOpen]         = useState(false)

  const handleAdd = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!secret.trim()) { setError('API key is required'); return }
    setAdding(true)
    setError(null)

    const res = await ipc.invoke(IPC_CHANNELS.AI_KEYS_ADD, {
      provider,
      label: label.trim() || `${providerMeta(provider).label} key`,
      secret: secret.trim(),
    })

    setAdding(false)
    if (res.ok) {
      setSecret('')
      setLabel('')
      setOpen(false)
      onAdded()
    } else {
      setError(res.error.message)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn btn-secondary btn-sm w-full justify-center"
      >
        <Plus size={13} />
        Add API Key
      </button>
    )
  }

  const selected = providerMeta(provider)

  return (
    <form onSubmit={handleAdd} className="glass-card space-y-4" style={{ padding: '20px' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Add API Key</h3>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          className="btn btn-ghost btn-icon"
        >
          <XCircle size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Provider</label>
          <select
            className="form-input"
            value={provider}
            onChange={(e) => { setProvider(e.target.value); setError(null) }}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Label (optional)</label>
          <input
            className="form-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Personal key"
          />
        </div>
      </div>

      {selected.note && (
        <div
          className="flex gap-2.5 text-xs px-3 py-3 rounded-lg leading-relaxed"
          style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', color: 'var(--color-text-secondary)' }}
        >
          <Info size={13} className="shrink-0 mt-0.5 text-[var(--color-primary)]" />
          <span>{selected.note}</span>
        </div>
      )}

      <div>
        <label className="form-label">API Key *</label>
        <input
          className="form-input font-mono"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={selected.hint}
          autoComplete="off"
        />
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
          Stored in your OS keychain — never leaves this machine.
        </p>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg"
          style={{ color: 'var(--color-error)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <AlertCircle size={12} className="shrink-0" />
          <span className="line-clamp-2">{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={adding} className="btn btn-primary">
          {adding && <Loader2 size={14} className="animate-spin" />}
          {adding ? 'Adding…' : 'Add Key'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null) }} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Cost ledger ──────────────────────────────────────────────────────────────

function CostLedger({ daily }: { daily: DailyUsage[] }): ReactElement {
  const today     = todayCost(daily)
  const thisMonth = monthCost(daily)
  const total30   = daily.reduce((s, d) => s + d.totalCostUsd, 0)
  const byProvider = byProviderTotals(daily)
  const maxDay    = Math.max(...daily.map((d) => d.totalCostUsd), 0.0001)
  const providers  = Object.entries(byProvider).sort(([, a], [, b]) => b - a)

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Today',        value: today,     Icon: Calendar  },
          { label: 'This month',   value: thisMonth, Icon: Activity  },
          { label: '30-day total', value: total30,   Icon: DollarSign },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="glass-card text-center" style={{ padding: '16px 12px' }}>
            <Icon size={14} className="mx-auto mb-2 text-[var(--color-primary)]" />
            <p className="text-base font-mono font-semibold text-[var(--color-text-primary)]">
              ${value.toFixed(4)}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* By-provider */}
      {providers.length > 0 && (
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-4 flex items-center gap-2">
            <Bot size={12} className="text-[var(--color-primary)]" />
            By Provider
          </p>
          <div className="space-y-3">
            {providers.map(([provider, cost]) => {
              const pct  = total30 > 0 ? (cost / total30) * 100 : 0
              const meta = providerMeta(provider)
              return (
                <div key={provider} className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: `${meta.color}18` }}
                  >
                    <Bot size={11} style={{ color: meta.color }} />
                  </div>
                  <span
                    className="text-xs text-[var(--color-text-secondary)] w-28 shrink-0 truncate capitalize"
                  >
                    {meta.label}
                  </span>
                  <div className="flex-1 progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: meta.color }} />
                  </div>
                  <span className="text-[11px] font-mono text-[var(--color-text-muted)] w-16 text-right shrink-0">
                    ${cost.toFixed(4)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 30-day bar chart */}
      {daily.length > 0 && (
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-4 flex items-center gap-2">
            <Activity size={12} className="text-[var(--color-primary)]" />
            Daily spend — last 30 days
          </p>
          <div className="space-y-2.5">
            {daily.slice(0, 14).map((d) => (
              <div key={d.date} className="flex items-center gap-3 min-w-0">
                <span
                  className="text-[10px] font-mono w-20 shrink-0"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {d.date}
                </span>
                <div className="flex-1 progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${(d.totalCostUsd / maxDay) * 100}%`, background: 'var(--color-primary)' }}
                  />
                </div>
                <span
                  className="text-[11px] font-mono w-16 text-right shrink-0"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  ${d.totalCostUsd.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIProvidersPage(): ReactElement {
  const [keys, setKeys]               = useState<ProviderKeyConfig[]>([])
  const [daily, setDaily]             = useState<DailyUsage[]>([])
  const [ollama, setOllama]           = useState<OllamaStatus | null>(null)
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [testingId, setTestingId]     = useState<string | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [testResult, setTestResult]   = useState<
    Record<string, { ok: boolean; latencyMs?: number; error?: string }>
  >({})

  const loadAll = async (): Promise<void> => {
    setLoadingKeys(true)
    const [keysRes, dailyRes, ollamaRes] = await Promise.all([
      ipc.invoke(IPC_CHANNELS.AI_KEYS_LIST, {}),
      ipc.invoke(IPC_CHANNELS.AI_USAGE_DAILY, { days: 30 }),
      ipc.invoke(IPC_CHANNELS.AI_OLLAMA_STATUS, {}),
    ])

    if (keysRes.ok) {
      setKeys(keysRes.value)
      window.dispatchEvent(
        new CustomEvent('ai:status-changed', {
          detail: {
            hasKeys: keysRes.value.length > 0,
            ollamaAvailable: ollamaRes.ok && ollamaRes.value.available,
          },
        }),
      )
    }
    if (dailyRes.ok) setDaily(dailyRes.value)
    if (ollamaRes.ok) setOllama(ollamaRes.value)
    setLoadingKeys(false)
  }

  useEffect(() => { loadAll() }, [])

  const handleTest = async (id: string): Promise<void> => {
    setTestingId(id)
    const res = await ipc.invoke(IPC_CHANNELS.AI_KEYS_TEST, { id })
    setTestingId(null)
    if (res.ok) {
      setTestResult((prev) => ({ ...prev, [id]: { ok: true, latencyMs: res.value.latencyMs } }))
    } else {
      setTestResult((prev) => ({ ...prev, [id]: { ok: false, error: res.error.message } }))
    }
  }

  const handleSetDefault = async (id: string): Promise<void> => {
    const res = await ipc.invoke(IPC_CHANNELS.AI_KEYS_SET_DEFAULT, { id })
    if (res.ok) loadAll()
  }

  const handleDelete = async (id: string): Promise<void> => {
    setDeletingId(id)
    await ipc.invoke(IPC_CHANNELS.AI_KEYS_DELETE, { id })
    setDeletingId(null)
    setKeys((prev) => prev.filter((k) => k.id !== id))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Providers</h1>
          <p className="page-subtitle">API keys, local models, and cost tracking</p>
        </div>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 600 }} className="space-y-8">

          {/* ── Ollama ── */}
          <section>
            <p className="section-label">Local Inference</p>
            <div
              className="glass-card flex items-center gap-4"
              style={{
                padding: '16px 20px',
                borderColor: ollama?.available ? 'rgba(16,185,129,0.4)' : 'var(--color-border)',
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: ollama?.available ? 'rgba(16,185,129,0.08)' : 'var(--color-surface-3)' }}
              >
                <Wifi
                  size={18}
                  style={{ color: ollama?.available ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Ollama</p>
                <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  {ollama == null
                    ? 'Probing localhost:11434…'
                    : ollama.available
                    ? `${ollama.models.length} model${ollama.models.length !== 1 ? 's' : ''} · ${ollama.models.slice(0, 3).join(', ')}${ollama.models.length > 3 ? '…' : ''}`
                    : 'Not running — start Ollama for free local inference'}
                </p>
              </div>
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                style={{
                  background: ollama?.available ? 'rgba(16,185,129,0.1)' : 'var(--color-surface-3)',
                  color: ollama?.available ? 'var(--color-success)' : 'var(--color-text-muted)',
                }}
              >
                {ollama == null ? 'Checking' : ollama.available ? 'Running' : 'Offline'}
              </span>
            </div>
          </section>

          {/* ── Cloud API keys ── */}
          <section>
            <p className="section-label flex items-center gap-2">
              <Key size={11} />
              Cloud AI — API Keys
            </p>

            {loadingKeys ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={18} className="animate-spin text-[var(--color-primary)]" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Key list */}
                {keys.length > 0 && (
                  <div className="glass-card" style={{ padding: 0 }}>
                    {keys.map((key, idx) => {
                      const result = testResult[key.id]
                      const meta   = providerMeta(key.provider)
                      return (
                        <div
                          key={key.id}
                          className="flex items-center gap-3 min-w-0"
                          style={{
                            padding: '12px 16px',
                            borderTop: idx > 0 ? '1px solid var(--color-border)' : 'none',
                          }}
                        >
                          {/* Provider icon */}
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${meta.color}12` }}
                          >
                            <Bot size={14} style={{ color: meta.color }} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 mb-0.5">
                              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                {key.label}
                              </p>
                              {key.isDefault && (
                                <span
                                  className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0"
                                  style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--color-primary)' }}
                                >
                                  <Star size={8} />
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] capitalize truncate" style={{ color: 'var(--color-text-muted)' }}>
                              {meta.label}
                            </p>
                            {result && (
                              <p
                                className="text-[11px] mt-0.5 flex items-start gap-1"
                                style={{ color: result.ok ? 'var(--color-success)' : 'var(--color-error)' }}
                              >
                                {result.ok
                                  ? <><CheckCircle size={10} className="shrink-0 mt-0.5" /> {result.latencyMs}ms</>
                                  : <><XCircle size={10} className="shrink-0 mt-0.5" /><span className="line-clamp-1">{result.error}</span></>}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            {!key.isDefault && (
                              <button
                                onClick={() => handleSetDefault(key.id)}
                                className="btn btn-ghost btn-icon"
                                title="Set as default"
                              >
                                <Star size={12} />
                              </button>
                            )}
                            <button
                              onClick={() => handleTest(key.id)}
                              disabled={testingId === key.id}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 12 }}
                            >
                              {testingId === key.id
                                ? <Loader2 size={11} className="animate-spin" />
                                : 'Test'}
                            </button>
                            <button
                              onClick={() => handleDelete(key.id)}
                              disabled={deletingId === key.id}
                              className="btn btn-ghost btn-icon"
                              style={{ color: 'var(--color-error)' }}
                            >
                              {deletingId === key.id
                                ? <Loader2 size={12} className="animate-spin" />
                                : <Trash2 size={12} />}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {keys.length === 0 && (
                  <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                    No keys yet. Add one below, or run Ollama locally for free inference.
                  </p>
                )}

                <AddKeyForm onAdded={loadAll} />
              </div>
            )}
          </section>

          {/* ── Cost ledger ── */}
          <section>
            <p className="section-label flex items-center gap-2">
              <Activity size={11} />
              AI Spend
            </p>
            {daily.length === 0 && !loadingKeys ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                No AI usage recorded yet.
              </p>
            ) : (
              <CostLedger daily={daily} />
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
