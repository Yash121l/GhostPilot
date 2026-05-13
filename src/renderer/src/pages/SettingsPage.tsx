import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { Key, Plus, Trash2, AlertCircle, Loader2, Bot, Wifi } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../lib/ipc'
import type { DailyUsage } from '@shared/ipc-types'
import type { ProviderKeyConfig } from '@shared/types/ai'

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI', hint: 'sk-...' },
  { id: 'anthropic', label: 'Anthropic', hint: 'sk-ant-...' },
  { id: 'openrouter', label: 'OpenRouter', hint: 'sk-or-...' },
  { id: 'groq', label: 'Groq', hint: 'gsk_...' },
]

function AddKeyForm({ onAdded }: { onAdded: () => void }): ReactElement {
  const [provider, setProvider] = useState('openai')
  const [label, setLabel] = useState('')
  const [secret, setSecret] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!secret.trim()) { setError('API key is required'); return }
    setAdding(true)
    setError(null)

    const res = await ipc.invoke(IPC_CHANNELS.AI_KEYS_ADD, {
      provider,
      label: label.trim() || `${PROVIDERS.find((p) => p.id === provider)?.label} key`,
      secret: secret.trim(),
    })

    setAdding(false)
    if (res.ok) {
      setSecret('')
      setLabel('')
      onAdded()
    } else {
      setError(res.error.message)
    }
  }

  const inputClass = 'w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-primary)] transition-colors'

  return (
    <form onSubmit={handleAdd} className="glass-card p-5 rounded-2xl space-y-4">
      <h3 className="text-sm font-semibold text-white/90">Add API Key</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Provider</label>
          <select className={inputClass} value={provider} onChange={(e) => setProvider(e.target.value)}>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Label (optional)</label>
          <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My key" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">API Key *</label>
        <input
          className={inputClass}
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={PROVIDERS.find((p) => p.id === provider)?.hint}
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Stored in your OS keychain — never leaves this machine.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[var(--color-error)] text-xs">
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={adding}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
        style={{ background: 'hsla(265,89%,65%,0.9)' }}
      >
        {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        Add Key
      </button>
    </form>
  )
}

function CostChart({ daily }: { daily: DailyUsage[] }): ReactElement {
  const total = daily.reduce((s, d) => s + d.totalCostUsd, 0)
  const maxCost = Math.max(...daily.map((d) => d.totalCostUsd), 0.001)

  return (
    <div className="glass-card p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/90">AI Spend (30 days)</h3>
        <span className="text-sm font-mono text-[var(--color-brand-primary)]">${total.toFixed(4)}</span>
      </div>

      {daily.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-4">No AI usage yet</p>
      ) : (
        <div className="space-y-2">
          {daily.slice(0, 14).map((d) => (
            <div key={d.date} className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-text-muted)] w-20 shrink-0">{d.date}</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(d.totalCostUsd / maxCost) * 100}%`,
                    background: 'var(--color-brand-primary)',
                  }}
                />
              </div>
              <span className="text-xs font-mono text-[var(--color-text-secondary)] w-16 text-right">
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
    if (res.ok) {
      setTestResult((prev) => ({ ...prev, [id]: { ok: true, latencyMs: res.value.latencyMs } }))
    } else {
      setTestResult((prev) => ({ ...prev, [id]: { ok: false, error: res.error.message } }))
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    setDeletingId(id)
    await ipc.invoke(IPC_CHANNELS.AI_KEYS_DELETE, { id })
    setDeletingId(null)
    setKeys((prev) => prev.filter((k) => k.id !== id))
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto animate-slide-up">
      <div className="px-6 py-4 border-b border-[var(--color-border-subtle)]">
        <h1 className="text-base font-semibold text-white/90">Settings</h1>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Configure AI providers and platform connections</p>
      </div>

      <div className="px-6 py-6 space-y-6 max-w-2xl">
        {/* Ollama status */}
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center gap-3">
            <Wifi size={16} className={ollamaStatus?.available ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'} />
            <div>
              <p className="text-sm font-medium text-white/90">Ollama (Local LLM)</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {ollamaStatus == null
                  ? 'Probing…'
                  : ollamaStatus.available
                  ? `Connected · ${ollamaStatus.models.length} model${ollamaStatus.models.length !== 1 ? 's' : ''}: ${ollamaStatus.models.slice(0, 3).join(', ')}`
                  : 'Not running — start Ollama for free local inference'}
              </p>
            </div>
            <div
              className="ml-auto w-2 h-2 rounded-full"
              style={{ background: ollamaStatus?.available ? 'var(--color-success)' : 'var(--color-error)' }}
            />
          </div>
        </div>

        {/* API Keys list */}
        <div>
          <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Key size={12} />
            API Keys
          </h2>

          {loadingKeys ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin text-[var(--color-brand-primary)]" />
            </div>
          ) : keys.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] py-2">No keys added yet.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {keys.map((key) => {
                const result = testResult[key.id]
                return (
                  <div key={key.id} className="glass-card p-4 rounded-xl flex items-center gap-3">
                    <Bot size={14} className="text-[var(--color-brand-primary)]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90">{key.label}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{key.provider}</p>
                      {result && (
                        <p className={`text-xs mt-0.5 ${result.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                          {result.ok ? `✓ ${result.latencyMs}ms` : result.error}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTest(key.id)}
                        disabled={testingId === key.id}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]"
                      >
                        {testingId === key.id ? <Loader2 size={11} className="animate-spin" /> : 'Test'}
                      </button>
                      <button
                        onClick={() => handleDelete(key.id)}
                        disabled={deletingId === key.id}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        {deletingId === key.id
                          ? <Loader2 size={12} className="animate-spin text-[var(--color-error)]" />
                          : <Trash2 size={12} className="text-[var(--color-error)]" />
                        }
                      </button>
                    </div>
                  </div>
                )
              })}
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
