# GhostPilot

**Local-first, BYOK desktop app for AI-powered social publishing.**

Write once. GhostPilot adapts your draft for LinkedIn, X (Twitter), and Instagram using your own AI keys. Runs entirely on your Mac — no subscriptions, no cloud, no data leaving your machine.

🌐 **Website:** [ghostpilot.yashlunawat.com](https://ghostpilot.yashlunawat.com)  
📖 **Setup guide:** [SETUP.md](./SETUP.md)

---

## What it does

- **Composer** — Write a draft, hit Generate, get platform-native variants for LinkedIn, X, and Instagram simultaneously via AI
- **Scheduler** — Schedule posts to publish at a specific time; a background worker dispatches them automatically
- **Personas** — Create authoring identities with bio, content pillars, and style hints so AI writes in your voice
- **Goals** — Set OKR-style north-star goals; AI decomposes them into a weekly posting plan
- **Trends** — Pull trending topics from Hacker News and Reddit, scored for relevance, velocity, and novelty
- **Analytics** — Real post counts, AI token usage, and spend breakdown by provider
- **Connections** — OAuth 2.0 flows for LinkedIn, X, and Instagram; tokens stored in macOS Keychain

---

## Tech stack

| Layer | Tech |
|---|---|
| Desktop shell | Electron 39 |
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| Build | electron-vite, electron-builder |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| AI | OpenAI, Anthropic, Groq, OpenRouter, Ollama (BYOK) |
| Secrets | macOS Keychain via keytar |
| Tests | Vitest (unit/integration), Playwright (e2e) |

---

## Quick start

```bash
# Install
npm install

# Development (hot reload)
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint
```

## Build

```bash
npm run build:mac      # macOS (arm64 + x64)
npm run build:win      # Windows x64
npm run build:linux    # Linux AppImage + deb
```

## Tests

```bash
npm test                  # unit + integration (Vitest)
npm run test:coverage     # with coverage report
npm run test:e2e          # e2e (Playwright + Electron, requires npm run build first)
```

## Database

```bash
npm run db:generate   # generate migration from schema changes
npm run db:migrate    # apply migrations
```

Reset the local database:
```bash
rm ~/Library/Application\ Support/ghostpilot/ghostpilot.db
```

---

## Project structure

```
src/
├── main/                    Electron main process (Node.js)
│   ├── application/         Use-case layer (audit, auth)
│   ├── domain/              Domain models
│   ├── infrastructure/      DB, keychain, logger, social connectors
│   ├── ipc/                 IPC handler registrations
│   ├── services/            Business logic (AI, posts, personas, scheduler, OAuth)
│   └── workers/             Publisher worker thread
├── preload/                 Electron context bridge
├── renderer/                React frontend (pages, components, hooks, stores)
└── shared/                  Types and constants shared across processes

tests/
├── helpers/                 In-memory DB + mock factories
├── unit/                    Service unit tests
├── integration/             Full post lifecycle test
└── e2e/                     Playwright e2e tests

website/                     ghostpilot.yashlunawat.com (GitHub Pages)
build/                       Electron builder resources (icons, entitlements)
```

---

## Connecting platforms

See [SETUP.md](./SETUP.md) for step-by-step instructions for LinkedIn, X, and Instagram.

**Redirect URI to register in all platform OAuth apps:**
```
https://ghostpilot.yashlunawat.com/oauth/callback
```

---

## Recommended IDE setup

[VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
