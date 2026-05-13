import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { Key, Plus, Trash2, AlertCircle, Loader2, Bot, Wifi, CheckCircle, XCircle, Activity, Info } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import type { DailyUsage } from '@shared/ipc-types'
import type { ProviderKeyConfig } from '@shared/types/ai'

interface ProviderDef {
  id: string
  label: string
  hint: string
  color: string
  note?: string
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    hint: 'sk-…',
    color: '#10A37F',
  },
  {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    hint: 'sk-ant-api03-…',
    color: '#D97706',
    note: 'Claude.ai and Claude Code subscriptions do NOT include API access. Get a separate API key at console.anthropic.com → API Keys.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'sk-or-…',
    color: '#6366F1',
    note: 'Routes to Claude, GPT-4, Llama and others through a single key — good for testing.',
  },
  {
    id: 'groq',
    label: 'Groq',
    hint: 'gsk_…',
    color: '#F87171',
    note: 'Ultra-fast inference for open-source models (Llama, Mixtral). Free tier available.',
  },
]

function AddKeyForm({ onAdded }: { onAdded: () => void }): ReactElement {
  const [provider, setProvider] = useState('anthropic')
  const [label, setLabel] = useState('')
  const [secret, setSecret] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const handleAdd = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!secret.trim()) { setError('API key is required'); return }
    setAdding(true)
    setError(null)

    const res = await ipc.invoke(IPC_CHANNELS.AI_KEYS_ADD, {
      provider,
      label: label.trim() || `${PROVIDERS.find((p) => p.id === provider)?.label ?? provider} key`,
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
      <button onClick={() => setOpen(true)} className="btn btn-secondary btn-sm w-full justify-center">
        <Plus size={13} />
        Add API Key
      </button>
    )
  }

  const selectedProvider = PROVIDERS.find((p) => p.id === provider)

  return (
    <form onSubmit={handleAdd} className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Add API Key</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn btn-ghost btn-icon"
        >
          ×
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
            placeholder="My key"
          />
        </div>
      </div>

      {selectedProvider?.note && (
        <div
          className="flex gap-2.5 text-xs px-3 py-3 rounded-lg leading-relaxed"
          style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', color: 'var(--color-text-secondary)' }}
        >
          <Info size={13} className="shrink-0 mt-0.5 text-[var(--color-primary)]" />
          <span>{selectedProvider.note}</span>
        </div>
      )}

      <div>
        <label className="form-label">API Key *</label>
        <input
          className="form-input font-mono text-sm"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={selectedProvider?.hint ?? ''}
        />
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
          Stored in your OS keychain — never leaves this machine.
        </p>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg"
          style={{ color: 'var(--color-error)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={adding} className="btn btn-primary">
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add Key
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  )
}

function CostChart({ daily }: { daily: DailyUsage[] }): ReactElement {
  const total = daily.reduce((s, d) => s + d.totalCostUsd, 0)
  const maxCost = Math.max(...daily.map((d) => d.totalCostUsd), 0.001)

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-[var(--color-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">AI Spend — 30 days</h3>
        </div>
        <span className="text-sm font-mono text-[var(--color-primary)]">${total.toFixed(4)}</span>
      </div>

      {daily.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-6">No AI usage recorded yet</p>
      ) : (
        <div className="space-y-2.5">
          {daily.slice(0, 14).map((d) => (
            <div key={d.date} className="flex items-center gap-3">
              <span className="text-[10px] text-[var(--color-text-muted)] w-20 shrink-0 font-mono">{d.date}</span>
              <div className="flex-1 progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${(d.totalCostUsd / maxCost) * 100}%`, background: 'var(--color-primary)' }}
                />
              </div>
              <span className="text-[11px] font-mono text-[var(--color-text-muted)] w-16 text-right">
                ${d.totalCostUsd.toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SettingsPage(): ReactElement {
  const [keys, setKeys] = useState<ProviderKeyConfig[]>([])
  const [daily, setDaily] = useState<DailyUsage[]>([])
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; models: string[] } | null>(null)
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; latencyMs?: number; error?: string }>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
          detail: { hasKeys: keysRes.value.length > 0, ollamaAvailable: ollamaRes.ok && ollamaRes.value.available },
        }),
      )
    }
    if (dailyRes.ok) setDaily(dailyRes.value)
    if (ollamaRes.ok) setOllamaStatus(ollamaRes.value)
    setLoadingKeys(false)
  }

  useEffect(() => { loadAll() }, [])

  const handleTest = async (id: string): Promise<void> => {
    setTestingId(id)
    const res = await ipc.invoke(IPC_CHANNELS.AI_KEYS_TEST, { id })
    setTestingId(null)
    if (res.ok) setTestResult((prev) => ({ ...prev, [id]: { ok: true, latencyMs: res.value.latencyMs } }))
    else setTestResult((prev) => ({ ...prev, [id]: { ok: false, error: res.error.message } }))
  }

  const handleDelete = async (id: string): Promise<void> => {
    setDeletingId(id)
    await ipc.invoke(IPC_CHANNELS.AI_KEYS_DELETE, { id })
    setDeletingId(null)
    setKeys((prev) => prev.filter((k) => k.id !== id))
  }

  const providerMeta = (id: string): ProviderDef =>
    PROVIDERS.find((p) => p.id === id) ?? { id, label: id, hint: '', color: 'var(--color-primary)' }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">AI providers, API keys, and cost tracking</p>
        </div>
      </div>

      {/* Body — centered column */}
      <div className="page-body">
        <div className="max-w-[600px] mx-auto space-y-8">

          {/* ── Local Inference ── */}
          <section>
            <p className="section-label">Local Inference</p>
            <div
              className="glass-card p-4 flex items-center gap-4"
              style={{ borderColor: ollamaStatus?.available ? 'rgba(16,185,129,0.4)' : 'var(--color-border)' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: ollamaStatus?.available ? 'rgba(16,185,129,0.08)' : 'var(--color-surface-alt)' }}
              >
                <Wifi size={18} style={{ color: ollamaStatus?.available ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Ollama</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {ollamaStatus == null
                    ? 'Probing localhost:11434…'
                    : ollamaStatus.available
                    ? `${ollamaStatus.models.length} model${ollamaStatus.models.length !== 1 ? 's' : ''} available · ${ollamaStatus.models.slice(0, 3).join(', ')}`
                    : 'Not running — start Ollama for free local inference'}
                </p>
              </div>
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                style={{
                  background: ollamaStatus?.available ? 'rgba(16,185,129,0.1)' : 'var(--color-surface-alt)',
                  color: ollamaStatus?.available ? 'var(--color-success)' : 'var(--color-text-muted)',
                }}
              >
                {ollamaStatus == null ? 'Checking' : ollamaStatus.available ? 'Running' : 'Offline'}
              </span>
            </div>
          </section>

          {/* ── Cloud AI Keys ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="section-label" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
                <Key size={11} />
                Cloud AI — API Keys
              </p>
            </div>
            <div
              style={{ borderBottom: '1px solid var(--color-border)', marginBottom: 16 }}
            />

            {loadingKeys ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={18} className="animate-spin text-[var(--color-primary)]" />
              </div>
            ) : (
              <>
                {keys.length > 0 && (
                  <div
                    className="rounded-xl overflow-hidden mb-4"
                    style={{ border: '1px solid var(--color-border)' }}
                  >
                    {keys.map((key, idx) => {
                      const result = testResult[key.id]
                      const meta = providerMeta(key.provider)
                      return (
                        <div
                          key={key.id}
                          className="flex items-center gap-3 px-4 py-3.5 bg-[var(--color-surface)] transition-colors hover:bg-[var(--color-surface-alt)]"
                          style={{
                            borderTop: idx > 0 ? '1px solid var(--color-border)' : 'none',
                          }}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${meta.color}12` }}
                          >
                            <Bot size={14} style={{ color: meta.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">{key.label}</p>
                            <p className="text-xs text-[var(--color-text-muted)] capitalize">{meta.label}</p>
                            {result && (
                              <p
                                className="text-[11px] mt-0.5 flex items-center gap-1"
                                style={{ color: result.ok ? 'var(--color-success)' : 'var(--color-error)' }}
                              >
                                {result.ok
                                  ? <><CheckCircle size={10} /> {result.latencyMs}ms</>
                                  : <><XCircle size={10} /> {result.error}</>}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleTest(key.id)}
                              disabled={testingId === key.id}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 12 }}
                            >
                              {testingId === key.id ? <Loader2 size={11} className="animate-spin" /> : 'Test'}
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
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">
                    No keys yet. Add one below, or run Ollama locally for free inference.
                  </p>
                )}

                <AddKeyForm onAdded={loadAll} />
              </>
            )}
          </section>

          {/* ── AI Spend ── */}
          <section>
            <p className="section-label">
              <Activity size={11} />
              AI Spend
            </p>
            <CostChart daily={daily} />
          </section>

        </div>
      </div>
    </div>
  )
}
