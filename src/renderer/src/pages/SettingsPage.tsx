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
    <form onSubmit={handleAdd} className="glass-card p-5 rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">Add API Key</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn btn-ghost btn-icon"
          style={{ color: 'var(--color-text-muted)', fontSize: 18, lineHeight: 1 }}
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

      {/* Provider-specific note */}
      {selectedProvider?.note && (
        <div
          className="flex gap-2.5 text-xs px-3 py-3 rounded-xl leading-relaxed"
          style={{ background: 'hsla(265,89%,65%,0.07)', border: '1px solid hsla(265,89%,65%,0.15)', color: 'var(--color-text-secondary)' }}
        >
          <Info size={13} className="shrink-0 mt-0.5 text-[var(--color-brand-primary)]" />
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
          className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl"
          style={{ color: 'var(--color-error)', background: 'hsla(0,84%,60%,0.08)', border: '1px solid hsla(0,84%,60%,0.2)' }}
        >
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      <div className="flex gap-2">
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
    <div className="glass-card p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-[var(--color-brand-primary)]" />
          <h3 className="text-sm font-semibold text-white/90">AI Spend — 30 days</h3>
        </div>
        <span className="text-sm font-mono text-[var(--color-brand-primary)]">${total.toFixed(4)}</span>
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
                  style={{ width: `${(d.totalCostUsd / maxCost) * 100}%`, background: 'var(--color-brand-primary)' }}
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
    if (keysRes.ok) setKeys(keysRes.value)
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
    PROVIDERS.find((p) => p.id === id) ?? { id, label: id, hint: '', color: 'var(--color-brand-primary)' }

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">AI providers, API keys, and cost tracking</p>
        </div>
      </div>

      <div className="page-body space-y-6" style={{ maxWidth: 600 }}>

        {/* Ollama status */}
        <div>
          <p className="section-label">Local Inference</p>
          <div
            className="glass-card p-5 rounded-2xl flex items-center gap-4"
            style={{
              borderColor: ollamaStatus?.available ? 'hsla(142,71%,45%,0.3)' : 'var(--color-border-subtle)',
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: ollamaStatus?.available ? 'hsla(142,71%,45%,0.12)' : 'var(--color-surface-3)' }}
            >
              <Wifi
                size={18}
                style={{ color: ollamaStatus?.available ? 'var(--color-success)' : 'var(--color-text-muted)' }}
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white/90">Ollama (Local LLM)</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {ollamaStatus == null
                  ? 'Probing localhost:11434…'
                  : ollamaStatus.available
                  ? `${ollamaStatus.models.length} model${ollamaStatus.models.length !== 1 ? 's' : ''} available: ${ollamaStatus.models.slice(0, 3).join(', ')}`
                  : 'Not running — start Ollama for free local inference'}
              </p>
            </div>
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: ollamaStatus?.available ? 'var(--color-success)' : 'var(--color-error)' }}
            />
          </div>
        </div>

        {/* API keys */}
        <div>
          <p className="section-label flex items-center gap-2">
            <Key size={11} />
            Cloud AI — API Keys
          </p>

          {loadingKeys ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={18} className="animate-spin text-[var(--color-brand-primary)]" />
            </div>
          ) : (
            <div className="flex flex-col gap-3 mb-4">
              {keys.map((key) => {
                const result = testResult[key.id]
                const meta = providerMeta(key.provider)
                return (
                  <div
                    key={key.id}
                    className="glass-card px-4 py-4 rounded-xl flex items-center gap-3"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${meta.color}18` }}
                    >
                      <Bot size={15} style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/90">{key.label}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 capitalize">{meta.label}</p>
                      {result && (
                        <p
                          className="text-xs mt-1 flex items-center gap-1"
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
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11 }}
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

              {keys.length === 0 && !loadingKeys && (
                <p className="text-xs text-[var(--color-text-muted)] py-1">
                  No keys yet. Add Claude below, or run Ollama locally for free inference.
                </p>
              )}
            </div>
          )}

          <AddKeyForm onAdded={loadAll} />
        </div>

        {/* Cost chart */}
        <CostChart daily={daily} />
      </div>
    </div>
  )
}
