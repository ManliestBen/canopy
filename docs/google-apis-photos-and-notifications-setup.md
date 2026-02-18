# Google APIs setup: Photos & notifications (Gmail)

This guide walks through configuring **Google Photos Library API** (for the photo slideshow) and **Gmail API** (for sending notifications, reminders, or announcements from the Canopy Gmail account). You can use the **same Google Cloud project** you already use for Calendar.

**Auth model:**

| Feature | Auth | Why |
|--------|------|-----|
| **Calendar** | Service account (`SERVICE_ACCOUNT.json`) | Currently a separate Gmail/account; you share calendars with that service account email. Stretch goal: move to **mackinaw.canopy@gmail.com** (see feature list). |
| **Photos** | OAuth 2.0 (user = Canopy Gmail) | Photos API does not support service accounts. You sign in once as the Canopy Gmail user (**mackinaw.canopy@gmail.com**); family shares albums with that account. |
| **Gmail (send)** | OAuth 2.0 (user = Canopy Gmail) | Gmail API cannot send mail via service account; you authorize the app to send as the Canopy Gmail user. |

---

## Prerequisites

- A **Google Cloud project** (the one you use for Calendar, or create a new one).
- A **Gmail account for Canopy** (**mackinaw.canopy@gmail.com**) that will own the OAuth tokens for Photos and Gmail. (Calendar stays on its current service account for now.)
- For **Photos**: Family members share Google Photos albums with this Canopy Gmail account so the app can display them in the slideshow.

---

## Part 1: One-time Google Cloud setup

### 1.1 Open your project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Select the **project** you use for Canopy Calendar (or create a new project and note its name).

### 1.2 Enable the APIs

1. In the left menu go to **APIs & Services** → **Library**.
2. Search for and enable:
   - **Google Photos Library API** — for listing and reading albums/photos for the slideshow.
   - **Google Photos Ambient API** — for ambient/slideshow devices ([reference](https://developers.google.com/photos/ambient/reference/rest)); used by `mediaItems.list` for user-configured media sources.
   - **Google Photos Picker API** — for letting users pick photos from their library (e.g. in a web or app flow).
   - **Gmail API** — for sending emails (reminders, announcements) from the Canopy account.
   - **Google Calendar API** — for Calendar (already enabled if you use Calendar today; needed for OAuth when you consolidate to mackinaw.canopy@gmail.com).

Enabling these up front avoids re-running the OAuth consent flow when you add features later.

### 1.3 OAuth consent screen

Photos and Gmail use **OAuth 2.0** (user login), so you need a consent screen. You’ll authorize the app once as the Canopy Gmail user.

1. Go to **APIs & Services** → **OAuth consent screen**.
2. Choose **External** (for a personal Gmail like `canopy@gmail.com`) or **Internal** (only if the Canopy account is in a Google Workspace org).
3. Click **Create** (or edit if it already exists).
4. Fill in:
   - **App name:** e.g. `Canopy`
   - **User support email:** your email
   - **Developer contact:** your email
5. Click **Save and Continue**.
6. **Scopes:**
   - Click **Add or Remove Scopes**.
   - Add the following so you don’t have to re-consent later when you add features:

   | Scope | Purpose |
   |-------|---------|
   | `https://www.googleapis.com/auth/photoslibrary.readonly` | Photos Library API: read albums and media (slideshow). |
   | `https://www.googleapis.com/auth/photosambient.mediaitems` | [Photos Ambient API](https://developers.google.com/photos/ambient/reference/rest): list ambient media items for a device ([mediaItems.list](https://developers.google.com/photos/ambient/reference/rest/v1/mediaItems/list)). |
   | `https://www.googleapis.com/auth/photospicker.mediaitems.readonly` | Photos Picker API: create sessions and list media items for picker flows. |
   | `https://www.googleapis.com/auth/gmail.send` | Gmail API: send email as the signed-in user (notifications). |
   | `https://www.googleapis.com/auth/calendar.readonly` | Calendar API: read events (for when you consolidate Calendar to OAuth / mackinaw.canopy@gmail.com). |
   | `https://www.googleapis.com/auth/calendar` | Calendar API: create/edit/delete events (same consolidation case). |

   - Remove any you truly don’t need, then Save.
7. **Test users** (if app is in “Testing”):
   - Add **mackinaw.canopy@gmail.com** so that account can sign in during testing.
8. **Save and Continue** through the summary.

### 1.4 Create OAuth 2.0 credentials

1. Go to **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth client ID**.
3. **Application type:**  
   - **Desktop app** — if the app runs on your machine (e.g. dev or a Pi) and you can open a browser once to sign in.  
   - **Web application** — if the app has a web server and you’ll use a redirect URL (e.g. `http://localhost:3000/oauth2callback`).
4. Name it (e.g. `Canopy Photos & Gmail`).
5. If you chose **Web application**, add an **Authorized redirect URI** (e.g. `http://localhost:5173/oauth2callback` for local dev).
6. Click **Create**.
7. Download the JSON: click the download icon next to the new OAuth client. Save it somewhere safe (e.g. `dashboard/oauth-credentials.json`).  
   - **Do not commit this file.** The repo’s `.gitignore` already ignores `*-credentials.json`.

You should see a **Client ID** and **Client secret** in the JSON. The app will use these plus a **refresh token** (obtained in Part 2) to get access tokens for Photos and Gmail.

---

## Part 2: First-time sign-in (refresh token for Canopy Gmail)

The app needs a **refresh token** for the Canopy Gmail user so it can call Photos and Gmail without opening a browser every time. You do this once per environment (dev machine, production server).

### 2.1 Run a one-time auth flow

You need a small script or your app to:

1. Open a browser to Google’s OAuth URL with your client ID and scopes.
2. Have the **Canopy Gmail user** sign in and approve the requested scopes (Photos, Ambient, Picker, Gmail, and Calendar if you added them).
3. Receive the authorization code (via redirect or copy from the browser).
4. Exchange the code for **access_token** and **refresh_token**.
5. Store the **refresh_token** securely (env var or a file that is not committed).

**Scopes to request** (match what you added in the consent screen):

- `https://www.googleapis.com/auth/photoslibrary.readonly`
- `https://www.googleapis.com/auth/photosambient.mediaitems`
- `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar`

**Ready-made script:**

A one-time script is in the repo. Use it like this:

1. Download your OAuth client JSON from Google Cloud Console and save it as **`dashboard/oauth-credentials.json`**.
2. In the OAuth client settings, add **`http://localhost:3000/oauth2callback`** as an authorized redirect URI (Web application type).
3. From the **dashboard** directory:

   ```bash
   cd dashboard
   npm install
   npm run oauth-get-tokens
   ```

4. A browser opens; sign in as **mackinaw.canopy@gmail.com** (or your Canopy Gmail) and approve the scopes.
5. The terminal prints `GOOGLE_OAUTH_REFRESH_TOKEN=...`. Copy that line into **`dashboard/.env`**.

**Important:** The OAuth client’s redirect URI in Google Cloud Console must be **exactly** `http://localhost:3000/oauth2callback` (port 3000, path `/oauth2callback`). If it’s set to `http://localhost/` (no port), Google will redirect there and the script’s server won’t receive the code — you’ll see “localhost refused to connect” because nothing is listening on port 80. Fix the redirect URI in the console and run the script again, or use the manual option below.

**If you already got redirected to `http://localhost/?code=...`** (and the page failed to load), you can still get a refresh token without redoing the flow. From **dashboard/** run (paste your code in place of `CODE`):

```bash
npm run oauth-get-tokens -- "CODE" --redirect-uri "http://localhost/"
```

Use the exact redirect URI Google used (e.g. `http://localhost/` with or without trailing slash). The script will exchange the code for tokens and print `GOOGLE_OAUTH_REFRESH_TOKEN=...`.

The script is **`dashboard/scripts/oauth-get-tokens.js`**. It uses the dashboard’s existing `googleapis` and the `open` package (already in `package.json`) to open the browser.

### 2.2 Store the refresh token

- **Development:** Put the refresh token in `.env` (do not commit):

  ```env
  GOOGLE_OAUTH_REFRESH_TOKEN=your_refresh_token_here
  ```

- **Production:** Use the same env var or your secrets manager. Never commit the refresh token.

---

## Part 3: App configuration

### 3.1 OAuth credentials file

- Keep the downloaded OAuth client JSON as e.g. `dashboard/oauth-credentials.json`.
- Ensure it’s in `.gitignore`:

  ```
  oauth-credentials.json
  .env
  SERVICE_ACCOUNT.json
  ```

### 3.2 Environment variables

In `dashboard/.env` (or production env):

```env
# Existing
VITE_HA_BASE_URL=...
VITE_HA_TOKEN=...

# Photos & Gmail (OAuth)
GOOGLE_OAUTH_REFRESH_TOKEN=...   # from Part 2
# Optional: path to oauth client JSON if not default
# GOOGLE_OAUTH_CREDENTIALS_PATH=dashboard/oauth-credentials.json
```

Your app code will:

1. Load the OAuth client ID and secret from `oauth-credentials.json`.
2. Use `GOOGLE_OAUTH_REFRESH_TOKEN` to get an access token when calling Photos or Gmail APIs.
3. Use that access token for Photos Library, Photos Ambient, Photos Picker, Gmail send, and (when implemented) Calendar.

### 3.3 Photos: sharing albums with the Canopy account

- Have family members **share** their Google Photos albums with the **Canopy Gmail address** (the one you used to get the refresh token).
- In the app, when you call the Photos Library API as that user, you’ll see:
  - Albums owned by that account.
  - Albums shared with that account (shared albums appear in the list).
- Use the existing APIs (e.g. `albums.list`, `mediaItems.search`) to drive the slideshow from those albums.

### 3.4 Gmail: sending notifications

- With the same refresh token and `gmail.send` scope, your app can call the Gmail API `messages.send` to send email as the Canopy Gmail user.
- Use this for: event reminders, “Dinner’s ready”–style announcements, or daily digest emails, so notifications come from a consistent Canopy identity.

---

## Part 4: Security checklist

- [ ] **OAuth client JSON** (`oauth-credentials.json`) is in `.gitignore` and never committed.
- [ ] **Refresh token** is only in `.env` or a secrets store, never in code or Git.
- [ ] **Service account key** (`SERVICE_ACCOUNT.json`) remains only for Calendar and is not committed.
- [ ] If the refresh token is ever exposed, revoke it in [Google Account → Security → Third-party access](https://myaccount.google.com/permissions) and run the Part 2 flow again to get a new one.

---

## Summary

| Item | Where / How |
|------|-------------|
| Google Cloud project | Same as Calendar (or new project). |
| APIs enabled | Photos Library API, Gmail API (Calendar already enabled). |
| OAuth consent screen | External (or Internal for Workspace); scopes: `photoslibrary.readonly`, `photosambient.mediaitems`, `photospicker.mediaitems.readonly`, `gmail.send`, `calendar.readonly`, `calendar`. |
| OAuth client | Create OAuth client ID (Desktop or Web), download JSON → `oauth-credentials.json`. |
| Refresh token | One-time browser sign-in as Canopy Gmail → store in `GOOGLE_OAUTH_REFRESH_TOKEN`. |
| Photos | Family shares albums with Canopy Gmail; app uses OAuth to list/read via Photos Library API. |
| Gmail | App uses same OAuth (refresh token) to send mail via Gmail API as Canopy Gmail. |

After this, your app can use the Photos Library API for the slideshow and the Gmail API for notifications without storing the Canopy Gmail password; only the refresh token and OAuth client credentials are needed on the server.
