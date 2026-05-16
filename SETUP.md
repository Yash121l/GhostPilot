# GhostPilot — Setup & Testing Guide

Complete guide to get GhostPilot running and test posting to LinkedIn, X (Twitter), and Instagram.

---

## 1. Prerequisites

- Node.js 20+
- npm 10+
- macOS 13+ (Keychain integration is native; Windows/Linux work but keychain behaviour differs)

---

## 2. Install & run

```bash
npm install
npm run dev
```

`postinstall` rebuilds native modules (`better-sqlite3`, `keytar`) for Electron automatically.  
`npm run dev` starts Electron with hot-reload. The app window opens automatically.

---

## 3. Environment variables

```bash
cp .env.example .env
```

Fill in credentials for whichever platforms you want to test (see sections below):

```env
VITE_APP_NAME="GhostPilot"

# LinkedIn
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# X (Twitter)
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_CONSUMER_KEY=       # optional — only needed for media uploads
TWITTER_CONSUMER_SECRET=    # optional — only needed for media uploads

# Instagram / Meta
META_APP_ID=
META_APP_SECRET=
```

> All credentials are read at runtime by the main process. Restart `npm run dev` after editing `.env`.

---

## 4. How the OAuth callback works

The redirect URI for all three platforms is:

```
https://ghostpilot.yashlunawat.com/oauth/callback
```

**Flow:**

1. You click Connect in the app → browser opens the platform's OAuth page
2. You authorize → platform redirects to `https://ghostpilot.yashlunawat.com/oauth/callback?code=...&state=...`
3. That page immediately fires `ghostpilot://oauth/callback?code=...&state=...` (a deep link)
4. Electron catches the deep link via `app.on('open-url')`, exchanges the code for tokens, stores them in the macOS Keychain
5. The browser tab shows "✓ Connected — you can close this tab"

**Register this exact URI in every platform app:**

```
https://ghostpilot.yashlunawat.com/oauth/callback
```

---

## 5. LinkedIn setup

### Create the app

1. Go to [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps) → **Create app**
2. Fill in App name, LinkedIn Page, logo (any image)
3. **Auth tab → OAuth 2.0 settings → Authorized redirect URLs:**
   - Add `https://ghostpilot.yashlunawat.com/oauth/callback`
4. **Products tab** — request both:
   - **Sign In with LinkedIn using OpenID Connect** → gives `openid`, `profile`
   - **Share on LinkedIn** → gives `w_member_social`
5. Copy **Client ID** and **Client Secret** → paste into `.env`

### Required scopes

| Scope             | What it does      |
| ----------------- | ----------------- |
| `openid`          | Identify the user |
| `profile`         | Get display name  |
| `w_member_social` | Create posts      |

### Connect in the app

1. `npm run dev`
2. Sidebar → **Connect** → **Connect** next to LinkedIn
3. Browser opens LinkedIn OAuth → authorize
4. Browser redirects to localhost → tab shows "✓ Connected"
5. Sidebar shows LinkedIn with a green dot

### Test a post

1. Sidebar → **Composer**
2. Write a draft, make sure **LinkedIn** chip is selected
3. Click **Generate Variants** (requires an AI key — see Section 8)
4. Review the LinkedIn variant on the right
5. Click **Schedule** → set time 1–2 min in the future → **Confirm**
6. Check **Calendar** — post appears
7. At the scheduled time the publisher worker dispatches it

---

## 6. X (Twitter) setup

### Create the app

1. Go to [developer.twitter.com/en/portal/dashboard](https://developer.twitter.com/en/portal/dashboard)
2. Create a new project + app (or use an existing one)
3. **App settings → User authentication settings:**
   - Enable **OAuth 2.0**
   - App type: **Native App**
   - Callback URI: `https://ghostpilot.yashlunawat.com/oauth/callback`
   - Website URL: anything (e.g. `https://ghostpilot.yashlunawat.com`)
4. Copy **Client ID** and **Client Secret** → paste into `.env` as `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET`

> **Media uploads** (images/video) require OAuth 1.0a credentials. If you only need text tweets, skip `TWITTER_CONSUMER_KEY` / `TWITTER_CONSUMER_SECRET`.

### Required scopes (set in the portal)

| Scope            | What it does            |
| ---------------- | ----------------------- |
| `tweet.read`     | Read tweets             |
| `tweet.write`    | Post tweets and threads |
| `users.read`     | Get display name        |
| `offline.access` | Get a refresh token     |

### Connect in the app

1. Sidebar → **Connect** → **Connect** next to X
2. Browser opens X OAuth (PKCE flow) → authorize
3. Browser redirects to localhost → tab shows "✓ Connected"
4. Sidebar shows X with a green dot

### Rate limits

X Basic tier: **100 tweets per user per 24 hours**. The app tracks this in-memory and will error before attempting to exceed it.

---

## 7. Instagram setup

Instagram requires a **Meta Business app** with an **Instagram Business or Creator account** linked to a **Facebook Page**.

### Prerequisites

- An Instagram account switched to **Professional** (Business or Creator)
- A **Facebook Page** linked to that Instagram account
- A Meta Developer account

### Create the app

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Create App**
2. Choose **Business** type
3. Add these products to the app:
   - **Facebook Login** (for OAuth)
   - **Instagram Graph API**
4. **Facebook Login → Settings → Valid OAuth Redirect URIs:**
   - Add `https://ghostpilot.yashlunawat.com/oauth/callback`
5. Copy **App ID** and **App Secret** → paste into `.env` as `META_APP_ID` / `META_APP_SECRET`

### Required permissions

| Permission                  | What it does         |
| --------------------------- | -------------------- |
| `instagram_basic`           | Read profile info    |
| `instagram_content_publish` | Create posts         |
| `instagram_manage_comments` | Read comments        |
| `pages_show_list`           | List Facebook Pages  |
| `pages_manage_metadata`     | Access Page metadata |

> While in **Development mode**, the app only works for users added as testers/developers in the Meta app dashboard. To use it with any account, submit for App Review.

### Connect in the app

1. Sidebar → **Connect** → **Connect** next to Instagram
2. Browser opens Facebook OAuth → authorize (this grants access to both Facebook Page and linked Instagram)
3. Browser redirects to localhost → tab shows "✓ Connected"
4. Sidebar shows Instagram with a green dot

### How publishing works

GhostPilot uses the **Instagram Graph API** (not the Basic Display API):

1. Creates a media container with your caption + optional image URL
2. Polls until the container status is `FINISHED` (up to 30s)
3. Calls `media_publish` to make it live

**Rate limit:** 50 API-triggered posts per 24-hour window per Instagram account.

---

## 8. Add an AI provider key

GhostPilot needs an AI key to generate platform variants.

1. Sidebar → **Settings**
2. Click **Add Key**
3. Choose provider, paste key, click **Save**

Keys are stored in the macOS Keychain — never in the database or `.env`.

| Provider   | Key format   | Notes                            |
| ---------- | ------------ | -------------------------------- |
| OpenAI     | `sk-...`     | Uses `gpt-4o-mini` by default    |
| Anthropic  | `sk-ant-...` | Uses `claude-haiku` by default   |
| Groq       | `gsk_...`    | Fast inference, cheap            |
| OpenRouter | `sk-or-...`  | Access to many models            |
| Ollama     | _(no key)_   | Auto-detected if running locally |

---

## 9. Create a Persona

Personas give the AI your voice and content focus.

1. Sidebar → **Personas** → **+**
2. Fill in:
   - **Name** — e.g. "Yash — Founder"
   - **Bio** — 1–2 sentences about who you are
   - **Content pillars** — comma-separated topics (e.g. `AI, startups, dev tools`)
   - **Style hints** — how you write (e.g. `casual, short sentences, no jargon, specific numbers`)
3. Click **Create Persona**

---

## 10. Create and schedule a post (full flow)

1. Sidebar → **Composer**
2. Select platforms using the chips at the top (LinkedIn / X / Instagram)
3. Write your draft in the left panel
4. Click **Generate Variants** — AI produces a native variant for each selected platform
5. Review each variant using the tabs on the right
6. Click **Schedule** → select platform → pick date/time → **Confirm**
7. Sidebar → **Calendar** — post appears on the selected day
8. At the scheduled time, the background publisher worker dispatches it

> To test immediately: schedule 1–2 minutes in the future.

---

## 11. Database

Auto-created on first run:

```
~/Library/Application Support/ghostpilot/ghostpilot.db
```

Migrations run automatically at startup. To reset everything:

```bash
rm ~/Library/Application\ Support/ghostpilot/ghostpilot.db
```

Restart the app — schema is recreated from scratch.

---

## 12. Logs

```
~/Library/Logs/ghostpilot/
```

```bash
tail -f ~/Library/Logs/ghostpilot/main.log
```

---

## 13. Tests

```bash
npm test              # run once
npm run test:coverage # with coverage report
```

---

## 14. Troubleshooting

### "No connector registered for platform: linkedin / twitter / instagram"

The env var for that platform is missing. Add it to `.env` and restart `npm run dev`.

### OAuth callback not received / browser just hangs

- The app must be running when the platform redirects back
- The flow times out after 10 minutes — if you took too long, click Connect again
- Make sure the redirect URI in the platform app is exactly `https://ghostpilot.yashlunawat.com/oauth/callback`
- If the callback page opens but the app doesn't launch, make sure GhostPilot is running and click "Open GhostPilot" on the callback page

### "LinkedIn token exchange failed: 401"

- Double-check `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`
- Make sure **Share on LinkedIn** product is approved (can take a few minutes after requesting)

### "X token exchange failed"

- Make sure **OAuth 2.0** is enabled in the X app settings (not just OAuth 1.0a)
- App type must be **Native App** (not Web App) for the PKCE flow to work

### "Instagram token exchange failed" / "No linked Facebook Pages found"

- The Instagram account must be a **Professional** account (Business or Creator)
- It must be linked to a **Facebook Page** in Instagram settings → Account → Linked accounts
- Your Meta developer account must be added as a tester if the app is in Development mode

### Keychain prompt on macOS

Click **Always Allow** the first time. If you keep getting prompted, open Keychain Access and find the `ghostpilot:*` entries — set them to Always Allow for the app.

### "AI: Not configured" in status bar

Add a provider key in Settings (Section 8). If using Ollama, make sure it's running (`ollama serve`).

### Posts not publishing at scheduled time

The publisher worker checks every minute. Common causes:

- Token expired — reconnect the platform in the Connect page
- Rate limit hit — LinkedIn: 500 calls/day, X: 100 tweets/day, Instagram: 50 posts/day
- Check logs: `tail -f ~/Library/Logs/ghostpilot/main.log`
