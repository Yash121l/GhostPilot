# Contributing to GhostPilot

Thank you for your interest in contributing. GhostPilot is a local-first, BYOK desktop app — contributions that respect user privacy and data locality are especially welcome.

## Before you start

- Check [open issues](https://github.com/Yash121l/GhostPilot/issues) to avoid duplicate work.
- For large changes, open an issue first to discuss the approach.
- All contributions must pass the existing test suite and TypeScript checks.

## Development setup

```bash
git clone https://github.com/Yash121l/GhostPilot.git
cd GhostPilot
npm install
cp .env.example .env          # fill in your OAuth credentials
npm run dev                   # Electron + Vite hot reload
```

### Environment

- Node.js 22+
- npm 10+
- macOS, Windows, or Linux

### Useful commands

```bash
npm run typecheck       # TypeScript check (no build)
npm run lint            # ESLint
npm test                # Vitest unit + integration tests
npm run test:coverage   # Tests with coverage report
npm run build:mac       # Build macOS DMG
```

## Making changes

1. Fork the repo and create a branch: `git checkout -b fix/my-fix` or `feat/my-feature`.
2. Make your changes. Follow the existing code style (no comments unless WHY is non-obvious).
3. Add or update tests for any changed behaviour.
4. Run `npm run typecheck && npm run lint && npm test` — all must pass.
5. Commit with a clear message: `fix: short description` or `feat: short description`.
6. Open a pull request against `main`.

## Database migrations

If you change the Drizzle schema:

```bash
npm run db:generate     # generates SQL in resources/migrations/
```

Then **paste the new SQL** into the `MIGRATIONS` array in `src/main/infrastructure/db/migration-runner.ts`. Migrations are embedded as string constants — no filesystem dependency at runtime.

## Key architectural rules

- **No API keys or tokens in the DB.** Use `KeychainService` (keytar / safeStorage).
- **No server-side calls.** All AI calls use keys the user provides.
- **No telemetry without explicit opt-in.** GhostPilot is local-first.
- **Single publisher.** `publisher.worker.ts` is the only job dispatcher. Do not add a second dispatch loop.

## Pull request checklist

- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm test` passes (or failures are pre-existing native-module issues on your local Node version)
- [ ] No API keys, tokens, or credentials in code or tests
- [ ] DB schema changes include a migration entry in `migration-runner.ts`

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be respectful.
