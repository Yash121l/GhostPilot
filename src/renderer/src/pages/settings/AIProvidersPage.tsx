import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { Plus, Trash2, Loader2, WifiOff, Key, BarChart2, HelpCircle, X } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import type { ProviderKeyConfig, OllamaStatus } from '@shared/types/ai'

interface StoredKey {
  id: string
  provider: string
  label: string
  masked: string
  isDefault?: boolean
}

const PROVIDERS: Record<string, { name: string; placeholder: string; note: string }> = {
  anthropic: {
    name: 'Claude (Anthropic)',
    placeholder: 'sk-ant-api03-…',
    note: 'Claude.ai and Claude Code subscriptions do NOT include API access. Get a separate key at console.anthropic.com → API Keys.'
  },
  openai: {
    name: 'OpenAI (GPT-4o, GPT-5)',
    placeholder: 'sk-proj-…',
    note: 'Get an API key at platform.openai.com → API keys.'
  },
  google: {
    name: 'Google (Gemini)',
    placeholder: 'AIza…',
    note: 'Get a key at aistudio.google.com → API Keys.'
  },
  groq: {
    name: 'Groq',
    placeholder: 'gsk_…',
    note: 'Fast Llama inference. Get a key at console.groq.com.'
  }
}

function AddKeyForm({ onAdded }: { onAdded: () => void }): ReactElement {
  const [provider, setProvider] = useState('anthropic')
  const [label, setLabel] = useState('')
  const [secret, setSecret] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!secret.trim()) {
      setError('API key is required')
      return
    }
    setAdding(true)
    setError(null)
    const res = await ipc.invoke(IPC_CHANNELS.AI_KEYS_ADD, {
      provider,
      label: label.trim() || PROVIDERS[provider]?.name || provider,
      secret: secret.trim()
    })
    setAdding(false)
    if (res.ok) {
      setSecret('')
      setLabel('')
      onAdded()
    } else setError(res.error.message)
  }

  const prov = PROVIDERS[provider] ?? PROVIDERS.anthropic

  return (
    <div className="card fade-in" style={{ padding: 22, marginTop: 12, position: 'relative' }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>Add API Key</div>
      <form onSubmit={handleAdd}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="label">Provider</label>
            <select
              className="select"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value)
                setError(null)
              }}
            >
              {Object.entries(PROVIDERS).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Label (optional)</label>
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Personal key"
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            background: 'var(--accent-soft)',
            border: '1px solid rgba(91,91,240,0.18)',
            borderRadius: 8,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start'
          }}
        >
          <HelpCircle size={14} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>{prov.note}</div>
        </div>

        <label className="label" style={{ marginTop: 14 }}>
          API Key *
        </label>
        <input
          className="input mono"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={prov.placeholder}
          style={{ fontSize: 13 }}
          autoComplete="off"
        />
        <div className="helper">Stored in your OS keychain — never leaves this machine.</div>

        {error && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              background: 'rgba(192,57,43,0.06)',
              border: '1px solid rgba(192,57,43,0.2)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--error)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <X size={12} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button type="submit" className="btn primary" disabled={adding}>
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {adding ? 'Adding…' : 'Add Key'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function AIProvidersPage(): ReactElement {
  const [keys, setKeys] = useState<StoredKey[]>([])
  const [ollama, setOllama] = useState<OllamaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [monthCost] = useState(4.82)
  const [totalCalls] = useState(719)

  const loadAll = async (): Promise<void> => {
    setLoading(true)
    const [keysRes, ollamaRes] = await Promise.all([
      ipc.invoke(IPC_CHANNELS.AI_KEYS_LIST, {}),
      ipc.invoke(IPC_CHANNELS.AI_OLLAMA_STATUS, {})
    ])
    if (keysRes.ok) {
      const mapped: StoredKey[] = (keysRes.value as ProviderKeyConfig[]).map((k) => ({
        id: k.id,
        provider: k.provider,
        label: k.label,
        masked: (k.label.slice(0, 7) + '…').padEnd(20, '·'),
        isDefault: k.isDefault
      }))
      setKeys(mapped)
      window.dispatchEvent(
        new CustomEvent('ai:status-changed', {
          detail: {
            hasKeys: mapped.length > 0,
            ollamaAvailable: ollamaRes.ok && (ollamaRes.value as OllamaStatus).available
          }
        })
      )
    }
    if (ollamaRes.ok) setOllama(ollamaRes.value as OllamaStatus)
    setLoading(false)
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const handleDelete = async (id: string): Promise<void> => {
    setDeletingId(id)
    await ipc.invoke(IPC_CHANNELS.AI_KEYS_DELETE, { id })
    setDeletingId(null)
    setKeys((prev) => prev.filter((k) => k.id !== id))
    void ipc.invoke(IPC_CHANNELS.AI_KEYS_LIST, {}).then((res) => {
      if (res.ok) {
        window.dispatchEvent(
          new CustomEvent('ai:status-changed', {
            detail: { hasKeys: res.value.length > 0, ollamaAvailable: ollama?.available ?? false }
          })
        )
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">API keys, local models, and spend</p>
        </div>
      </div>

      <div className="page-body">
        <div className="fade-in" style={{ maxWidth: 820 }}>
          {/* Local inference */}
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
            Local inference
          </div>
          <div
            className="card"
            style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                flexShrink: 0,
                background: ollama?.available ? 'rgba(31,157,85,0.08)' : 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: ollama?.available ? 'var(--success)' : 'var(--text-3)',
                border: '1px solid var(--border)'
              }}
            >
              <WifiOff size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Ollama</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                {ollama == null
                  ? 'Probing localhost:11434…'
                  : ollama.available
                    ? `${ollama.models.length} model${ollama.models.length !== 1 ? 's' : ''} available`
                    : 'Not running — start Ollama for free local inference'}
              </div>
            </div>
            <span
              className="chip"
              style={
                ollama?.available
                  ? {
                      background: 'rgba(31,157,85,0.1)',
                      color: 'var(--success)',
                      borderColor: 'rgba(31,157,85,0.22)'
                    }
                  : {}
              }
            >
              {ollama == null ? 'Checking' : ollama.available ? 'Running' : 'Offline'}
            </span>
          </div>

          {/* Cloud API keys */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 24,
              marginBottom: 12
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-3)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Key size={12} /> Cloud AI — API keys
            </div>
            {!adding && (
              <button className="btn primary" onClick={() => setAdding(true)}>
                <Plus size={14} /> Add Key
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : (
            <>
              {keys.length === 0 && !adding && (
                <div
                  className="card"
                  style={{ padding: 22, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}
                >
                  No keys yet. Add one above, or run Ollama locally for free inference.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {keys.map((k) => (
                  <div
                    key={k.id}
                    className="card"
                    style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        flexShrink: 0,
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      ⚡
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{k.label}</div>
                      <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {k.masked}
                      </div>
                    </div>
                    <span
                      className="chip"
                      style={{
                        background: 'rgba(31,157,85,0.12)',
                        color: 'var(--success)',
                        borderColor: 'rgba(31,157,85,0.22)'
                      }}
                    >
                      ● Active
                    </span>
                    <button
                      className="btn ghost icon"
                      disabled={deletingId === k.id}
                      onClick={() => handleDelete(k.id)}
                    >
                      {deletingId === k.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
              {adding && (
                <AddKeyForm
                  onAdded={() => {
                    void loadAll()
                    setAdding(false)
                  }}
                />
              )}
            </>
          )}

          {/* AI spend */}
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
            <BarChart2 size={12} /> AI spend
          </div>
          {keys.length === 0 ? (
            <div className="card" style={{ padding: 16, color: 'var(--text-3)', fontSize: 14 }}>
              No AI usage recorded yet.
            </div>
          ) : (
            <div
              className="card"
              style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}
            >
              <div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
                  ${monthCost.toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  This month · {totalCalls} calls
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="progress" style={{ height: 8 }}>
                  <div className="fill" style={{ width: '32%' }} />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: 'var(--text-3)',
                    marginTop: 4
                  }}
                >
                  <span>$0</span>
                  <span>Budget cap: $15.00</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
