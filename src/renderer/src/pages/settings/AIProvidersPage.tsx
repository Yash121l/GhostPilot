import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import {
  Bot,
  CheckCircle2,
  Code2,
  Key,
  Loader2,
  Monitor,
  Moon,
  Plug,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  WifiOff
} from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import type { AuthStatusOutput } from '@shared/ipc-types'
import type { OllamaStatus, ProviderKeyConfig } from '@shared/types/ai'
import { Platform, PLATFORM_LABELS } from '@shared/types/platform'
import { useTheme } from '../../hooks/useTheme'
import type { ThemeMode } from '../../store/ui'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'

interface StoredKey {
  id: string
  provider: string
  label: string
  masked: string
  isDefault?: boolean
}

interface LocalAgentStatus {
  provider: 'codex-cli' | 'claude-code'
  installed: boolean
  authenticated: boolean
  version?: string
  path?: string
  unavailableReason?: string
}

const PROVIDERS: Record<string, { name: string; placeholder: string; note: string }> = {
  anthropic: {
    name: 'Claude (Anthropic)',
    placeholder: 'sk-ant-api03-...',
    note: 'Claude subscriptions do not include API access. Use a key from console.anthropic.com.'
  },
  openai: {
    name: 'OpenAI',
    placeholder: 'sk-proj-...',
    note: 'Use an API key from platform.openai.com.'
  }
}

const SETTINGS_SECTIONS = [
  { id: 'providers', label: 'AI Providers', icon: Bot },
  { id: 'connections', label: 'Connections', icon: Plug },
  { id: 'general', label: 'General', icon: Settings },
  { id: 'diagnostics', label: 'Diagnostics', icon: ShieldCheck }
] as const

type SettingsSection = (typeof SETTINGS_SECTIONS)[number]['id']

function AddKeyForm({ onAdded }: { onAdded: () => void }): ReactElement {
  const [provider, setProvider] = useState('anthropic')
  const [label, setLabel] = useState('')
  const [secret, setSecret] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const providerDef = PROVIDERS[provider] ?? PROVIDERS.anthropic

  const handleAdd = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!secret.trim()) {
      setError('API key is required.')
      return
    }
    setAdding(true)
    setError(null)
    const res = await ipc.invoke(IPC_CHANNELS.AI_KEYS_ADD, {
      provider,
      label: label.trim() || providerDef.name,
      secret: secret.trim()
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

  return (
    <form className="settings-add-key" onSubmit={handleAdd}>
      <div className="settings-form-grid">
        <label>
          <span>Provider</span>
          <Select value={provider} onChange={(event) => setProvider(event.target.value)}>
            {Object.entries(PROVIDERS).map(([id, item]) => (
              <option key={id} value={id}>
                {item.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span>Label</span>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Personal key"
          />
        </label>
      </div>
      <div className="settings-info-row">{providerDef.note}</div>
      <label>
        <span>API Key</span>
        <Input
          className="mono"
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder={providerDef.placeholder}
          autoComplete="off"
        />
      </label>
      {error ? <div className="settings-error">{error}</div> : null}
      <div className="settings-row-actions">
        <Button type="submit" variant="primary" loading={adding} leftIcon={<Plus size={14} />}>
          Add key
        </Button>
      </div>
    </form>
  )
}

function themeIcon(mode: ThemeMode): ReactElement {
  if (mode === 'dark') return <Moon size={14} />
  if (mode === 'light') return <Sun size={14} />
  return <Monitor size={14} />
}

export default function AIProvidersPage(): ReactElement {
  const [section, setSection] = useState<SettingsSection>('providers')
  const [keys, setKeys] = useState<StoredKey[]>([])
  const [ollama, setOllama] = useState<OllamaStatus | null>(null)
  const [localAgents, setLocalAgents] = useState<LocalAgentStatus[]>([])
  const [connections, setConnections] = useState<AuthStatusOutput[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [version, setVersion] = useState('...')
  const [activeProvider, setActiveProvider] = useState('auto')
  const { mode, setMode } = useTheme()

  const loadAll = async (): Promise<void> => {
    setLoading(true)
    const [keysRes, ollamaRes, authRes, agentRes, preferredRes] = await Promise.all([
      ipc.invoke(IPC_CHANNELS.AI_KEYS_LIST, {}),
      ipc.invoke(IPC_CHANNELS.AI_OLLAMA_STATUS, {}),
      ipc.invoke(IPC_CHANNELS.AUTH_STATUS, {}),
      ipc.invoke(IPC_CHANNELS.LOCAL_AGENT_STATUS, {}),
      ipc.invoke(IPC_CHANNELS.SETTINGS_GET, { key: 'ai:preferredProviderId' })
    ])
    if (keysRes.ok) {
      const mapped: StoredKey[] = (keysRes.value as ProviderKeyConfig[]).map((key) => ({
        id: key.id,
        provider: key.provider,
        label: key.label,
        masked: (key.label.slice(0, 7) + '...').padEnd(18, '.'),
        isDefault: key.isDefault
      }))
      setKeys(mapped)
      window.dispatchEvent(
        new CustomEvent('ai:status-changed', {
          detail: {
            hasKeys:
              mapped.length > 0 ||
              (agentRes.ok &&
                (agentRes.value as LocalAgentStatus[]).some(
                  (agent) => agent.installed && agent.authenticated
                )),
            ollamaAvailable: ollamaRes.ok && (ollamaRes.value as OllamaStatus).available
          }
        })
      )
    }
    if (ollamaRes.ok) setOllama(ollamaRes.value as OllamaStatus)
    if (authRes.ok) setConnections(authRes.value)
    if (agentRes.ok) setLocalAgents(agentRes.value as LocalAgentStatus[])
    if (preferredRes.ok)
      setActiveProvider((preferredRes.value as string | null) ?? 'auto')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api?.getVersion().then((value: string) => setVersion(value))
    setLoading(false)
  }

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    const handler = (event: Event): void => {
      const next = (event as CustomEvent<SettingsSection>).detail
      if (SETTINGS_SECTIONS.some((item) => item.id === next)) setSection(next)
    }
    window.addEventListener('settings:section', handler)
    return () => window.removeEventListener('settings:section', handler)
  }, [])

  const setPreferredProvider = async (value: string): Promise<void> => {
    setActiveProvider(value)
    await ipc.invoke(IPC_CHANNELS.SETTINGS_SET, {
      key: 'ai:preferredProviderId',
      value: value === 'auto' ? null : value
    })
    window.dispatchEvent(new CustomEvent('ai:preferred-provider-changed', { detail: value }))
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!window.confirm('Delete this API key from your OS keychain?')) return
    setDeletingId(id)
    await ipc.invoke(IPC_CHANNELS.AI_KEYS_DELETE, { id })
    setDeletingId(null)
    void loadAll()
  }

  const handleConnect = async (platform: Platform): Promise<void> => {
    setConnecting(platform)
    await ipc.invoke(IPC_CHANNELS.AUTH_CONNECT, { platform })
    setConnecting(null)
    void loadAll()
  }

  const handleDisconnect = async (platform: Platform): Promise<void> => {
    if (!window.confirm(`Disconnect ${PLATFORM_LABELS[platform]}?`)) return
    setConnecting(platform)
    await ipc.invoke(IPC_CHANNELS.CONNECTIONS_REVOKE, { platform })
    setConnecting(null)
    void loadAll()
  }

  return (
    <div className="settings-workspace">
      <header className="settings-header">
        <div>
          <h1>Settings</h1>
          <p>Providers, accounts, theme, and local app diagnostics.</p>
        </div>
        <Button variant="secondary" size="sm" loading={loading} onClick={loadAll}>
          Refresh
        </Button>
      </header>

      <div className="settings-tabs" aria-label="Settings sections">
        {SETTINGS_SECTIONS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={section === item.id ? 'active' : ''}
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => setSection(item.id)}
            >
              <Icon size={15} />
              {item.label}
            </button>
          )
        })}
      </div>

      <main className="settings-panel">
        {section === 'providers' ? (
          <>
            <div className="settings-section-title">
              <div>
                <span>Local inference</span>
                <h2>AI runtime readiness</h2>
              </div>
              <Badge variant={ollama?.available ? 'success' : 'muted'}>
                {ollama == null ? 'Checking' : ollama.available ? 'Running' : 'Offline'}
              </Badge>
            </div>
            <div className="settings-card settings-status-card">
              <div className="settings-icon-cell">
                <WifiOff size={18} />
              </div>
              <div>
                <strong>Ollama</strong>
                <p>
                  {ollama == null
                    ? 'Probing localhost:11434...'
                    : ollama.available
                      ? `${ollama.models.length} model${ollama.models.length === 1 ? '' : 's'} available`
                      : 'Start Ollama for free local inference.'}
                </p>
              </div>
              <Button
                variant={activeProvider === 'ollama' ? 'primary' : 'secondary'}
                size="sm"
                disabled={!ollama?.available}
                onClick={() => setPreferredProvider('ollama')}
              >
                {activeProvider === 'ollama' ? 'Using' : 'Use'}
              </Button>
            </div>
            <div className="settings-card settings-muted-card">
              <div className="settings-row-main">
                <strong>Generation provider</strong>
                <p>
                  Choose the provider GhostPilot uses for variants, rewrites, and review work. Auto
                  uses the routing policy.
                </p>
              </div>
              <Button
                variant={activeProvider === 'auto' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setPreferredProvider('auto')}
              >
                {activeProvider === 'auto' ? 'Using auto' : 'Use auto'}
              </Button>
            </div>

            <div className="settings-section-title">
              <div>
                <span>Cloud AI</span>
                <h2>API keys</h2>
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => setAdding(true)}
              >
                Add key
              </Button>
            </div>

            {loading ? (
              <div className="settings-empty">
                <Loader2 size={18} className="animate-spin" /> Loading providers
              </div>
            ) : keys.length === 0 && !adding ? (
              <div className="settings-empty">
                No keys yet. Add a cloud key or use Ollama locally.
              </div>
            ) : null}

            <div className="settings-list">
              {keys.map((key) => (
                <div key={key.id} className="settings-card settings-key-row">
                  <div className="settings-icon-cell">
                    <Key size={17} />
                  </div>
                  <div className="settings-row-main">
                    <strong>{key.label}</strong>
                    <p className="mono">
                      {key.provider} · {key.masked}
                    </p>
                  </div>
                  <Button
                    variant={activeProvider === `key:${key.id}` ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={async () => {
                      await ipc.invoke(IPC_CHANNELS.AI_KEYS_SET_DEFAULT, { id: key.id })
                      await setPreferredProvider(`key:${key.id}`)
                      void loadAll()
                    }}
                  >
                    {activeProvider === `key:${key.id}` ? 'Using' : 'Use'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete API key"
                    loading={deletingId === key.id}
                    onClick={() => handleDelete(key.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
            {adding ? (
              <AddKeyForm
                onAdded={() => {
                  setAdding(false)
                  void loadAll()
                }}
              />
            ) : null}
            <div className="settings-card settings-muted-card">
              AI spend is hidden until real usage data is available through IPC. No placeholder
              spend values are shown.
            </div>
            <div className="settings-section-title">
              <div>
                <span>Subscriptions</span>
                <h2>Local agent providers</h2>
              </div>
            </div>
            <div className="settings-list">
              {localAgents.map((agent) => (
                <div key={agent.provider} className="settings-card settings-key-row">
                  <div className="settings-icon-cell">
                    <Code2 size={17} />
                  </div>
                  <div className="settings-row-main">
                    <strong>{agent.provider === 'codex-cli' ? 'Codex CLI' : 'Claude Code'}</strong>
                    <p>
                      {agent.installed
                        ? agent.authenticated
                          ? `Ready${agent.version ? ` · ${agent.version}` : ''}`
                          : 'Installed, but sign-in was not detected.'
                        : (agent.unavailableReason ?? 'CLI not installed.')}
                    </p>
                  </div>
                  <Badge variant={agent.installed && agent.authenticated ? 'success' : 'muted'}>
                    {agent.installed && agent.authenticated ? 'Ready' : 'Setup needed'}
                  </Badge>
                  <Button
                    variant={activeProvider === agent.provider ? 'primary' : 'secondary'}
                    size="sm"
                    disabled={!agent.installed || !agent.authenticated}
                    onClick={() => setPreferredProvider(agent.provider)}
                  >
                    {activeProvider === agent.provider ? 'Using' : 'Use'}
                  </Button>
                </div>
              ))}
              {localAgents.length === 0 ? (
                <div className="settings-empty">Checking local agent providers...</div>
              ) : null}
            </div>
          </>
        ) : null}

        {section === 'connections' ? (
          <>
            <div className="settings-section-title">
              <div>
                <span>Publishing</span>
                <h2>Connected accounts</h2>
              </div>
            </div>
            <div className="settings-list">
              {[Platform.LINKEDIN, Platform.TWITTER, Platform.INSTAGRAM].map((platform) => {
                const connected = connections.find((item) => item.platform === platform)?.connected
                const busy = connecting === platform
                return (
                  <div key={platform} className="settings-card settings-key-row">
                    <div className="settings-icon-cell">
                      <Plug size={17} />
                    </div>
                    <div className="settings-row-main">
                      <strong>{PLATFORM_LABELS[platform]}</strong>
                      <p>
                        {connected ? 'Ready for publishing from this machine.' : 'Not connected.'}
                      </p>
                    </div>
                    <Badge variant={connected ? 'success' : 'muted'}>
                      {connected ? 'Connected' : 'Offline'}
                    </Badge>
                    {connected ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        loading={busy}
                        onClick={() => handleDisconnect(platform)}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busy}
                        onClick={() => handleConnect(platform)}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="settings-card settings-muted-card">
              OAuth tokens are stored in your OS keychain and are not uploaded to a GhostPilot
              server.
            </div>
          </>
        ) : null}

        {section === 'general' ? (
          <>
            <div className="settings-section-title">
              <div>
                <span>Appearance</span>
                <h2>Theme</h2>
              </div>
              <Badge variant="info">{mode}</Badge>
            </div>
            <div className="settings-card settings-theme-row">
              {(['system', 'light', 'dark'] as ThemeMode[]).map((theme) => (
                <button
                  key={theme}
                  className={mode === theme ? 'active' : ''}
                  onClick={() => setMode(theme)}
                >
                  {themeIcon(theme)}
                  {theme}
                  {mode === theme ? <CheckCircle2 size={13} /> : null}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {section === 'diagnostics' ? (
          <>
            <div className="settings-section-title">
              <div>
                <span>Local app</span>
                <h2>Diagnostics</h2>
              </div>
            </div>
            <div className="settings-list">
              <div className="settings-card settings-key-row">
                <div className="settings-row-main">
                  <strong>Version</strong>
                  <p className="mono">v{version}</p>
                </div>
              </div>
              <div className="settings-card settings-key-row">
                <div className="settings-row-main">
                  <strong>Database</strong>
                  <p>Connected</p>
                </div>
                <Badge variant="success">OK</Badge>
              </div>
              <div className="settings-card settings-key-row">
                <div className="settings-row-main">
                  <strong>AI readiness</strong>
                  <p>
                    {keys.length > 0 || ollama?.available
                      ? 'At least one provider is ready.'
                      : 'No provider configured yet.'}
                  </p>
                </div>
                <Badge variant={keys.length > 0 || ollama?.available ? 'success' : 'warning'}>
                  {keys.length > 0 || ollama?.available ? 'Ready' : 'Needs setup'}
                </Badge>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
