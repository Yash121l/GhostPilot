# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | Yes       |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email **yash.l23csai@nst.rishihood.edu.in** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You will receive a response within 48 hours. If the issue is confirmed, a patch will be released as quickly as possible.

## Security design

GhostPilot is built with a local-first, zero-trust model:

- **No cloud backend.** All data stays on your machine in `~/Library/Application Support/ghostpilot/` (macOS).
- **API keys stored in OS keychain.** GhostPilot uses `keytar` to store AI provider keys and OAuth tokens in the system credential store (macOS Keychain, Windows Credential Manager, libsecret on Linux). Keys are never written to SQLite.
- **OAuth via system browser.** OAuth tokens are exchanged in your browser and passed to the app via a `ghostpilot://` deep link — they never touch a server we control.
- **No telemetry without opt-in.** GhostPilot does not collect usage data by default.
- **Electron security hardening.** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. All IPC channels are typed and validated.

## Known limitations

- **Unsigned macOS builds** require a one-time `sudo codesign --force --deep --sign - /Applications/GhostPilot.app` after install. A proper Apple Developer ID signature is planned.
- **Windows builds** show a SmartScreen warning on first run (unrecognized publisher). Click "More info → Run anyway."
