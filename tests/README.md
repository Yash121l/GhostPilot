# GhostPilot — Test Suite

## Structure

```
tests/
├── README.md
├── helpers/
│   ├── db.ts          In-memory SQLite with full schema (no Electron needed)
│   └── mocks.ts       Shared mock factories (audit, AI, connectors, keychain)
├── unit/
│   ├── shared/
│   │   ├── error.test.ts        AppError, ok(), err(), Result type
│   │   ├── platform.test.ts     Platform enum, char limits
│   │   └── constants.test.ts    All app constants
│   └── services/
│       ├── post.service.test.ts         CRUD, state machine, cascade deletes
│       ├── persona.service.test.ts      CRUD, JSON parsing, fingerprint mapping
│       ├── variant-generator.test.ts    AI calls, persona fallback, char limits
│       ├── scheduler.service.test.ts    Dispatch, retry logic, failure paths
│       ├── linkedin.connector.test.ts   Auth URL, scope encoding, rate limits
│       ├── oauth-manager.test.ts        State validation, TTL, keychain, DB
│       ├── intent.service.test.ts       AI decompose, fallback, CRUD
│       └── ai-gateway.test.ts           Spend cap, provider errors, cost calc
└── integration/
│   └── post-lifecycle.test.ts   Full flow: persona→post→variants→schedule→publish
└── e2e/
    ├── fixtures/
    │   ├── electron.ts    Playwright Electron launch fixture
    │   └── pages.ts       Page Object Models for all app pages
    ├── app-shell.e2e.ts   Launch, navigation, status bar
    ├── composer.e2e.ts    Draft editing, platform chips, variant generation
    ├── personas.e2e.ts    Create, view, delete personas
    ├── connect.e2e.ts     Platform connection UI
    ├── calendar.e2e.ts    Mini calendar, day view, post deletion
    ├── goals.e2e.ts       Create goals, AI decomposition
    ├── trends.e2e.ts      Fetch trends, configure, draft from trend
    └── analytics.e2e.ts   KPI cards, charts, AI spend
```

## Running Tests

### Unit + Integration tests (Vitest)

```bash
# Run all unit/integration tests once
npm test

# Watch mode
npm run test:watch

# With coverage report
npm run test:coverage
```

### E2E tests (Playwright + Electron)

E2E tests launch the real Electron app. You must build first:

```bash
# 1. Build the app
npm run build

# 2. Run e2e tests
npm run test:e2e

# With Playwright UI (interactive)
npm run test:e2e:ui

# Headed mode (see the window)
npm run test:e2e:headed
```

### Environment flags for conditional e2e tests

Some e2e tests are skipped by default because they require external services:

| Flag | What it enables |
|------|----------------|
| `GHOSTPILOT_AI_CONFIGURED=1` | Tests that call the AI (Generate Variants, Goals decompose) |
| `GHOSTPILOT_LINKEDIN_CONNECTED=1` | Tests that require LinkedIn to be connected |
| `GHOSTPILOT_HAS_POSTS=1` | Tests that require existing posts in the DB |
| `GHOSTPILOT_HAS_TRENDS=1` | Tests that require fetched trend cards |

Example:
```bash
GHOSTPILOT_AI_CONFIGURED=1 npm run test:e2e
```

## Test Design Principles

**Unit tests:**
- Use in-memory SQLite — no Electron, no file system, no real keychain
- `vi.mock('electron', ...)` prevents Electron imports from crashing in Node
- Each test file calls `clearTestDb()` in `beforeEach` for full isolation
- Mocks are minimal and explicit

**E2E tests:**
- Use Page Object Models (`tests/e2e/fixtures/pages.ts`) — no raw selectors in tests
- Tests that require external services (AI, OAuth) are skipped by default
- Each test launches a fresh Electron instance and closes it after
- Tests are serial (`workers: 1`) — Electron can only have one window at a time

## Coverage

Run `npm run test:coverage` and open `coverage/index.html` for the full report.

Target thresholds (configured in `vitest.config.ts`):
- Lines: 80%
- Functions: 80%
- Branches: 60%
