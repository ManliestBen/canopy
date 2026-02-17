# Canopy

A React dashboard that talks to your Home Assistant instance via the REST API. One page, tabbed by category: **Lighting**, **Climate**, **Switches & Fans**, **Covers**, **Locks & Security**, **Sensors**, and **Calendar** (Google Calendar via service account).

## Setup

1. **Install and run in development** (Vite proxies `/api` to HA and injects the token; calendar server runs alongside):

   ```bash
   cd dashboard
   cp .env.example .env
   # Edit .env: set VITE_HA_BASE_URL and VITE_HA_TOKEN (same values as in the project's export script if you use that HA instance)
   npm install
   npm run dev
   ```

   Open http://localhost:5173. The app will load states from HA and you can control lights, climate, switches, fans, covers, locks, view sensors, and see Google Calendar events.

   **Calendar:** Place `SERVICE_ACCOUNT.json` (Google Cloud service account key) in the `dashboard/` folder. Share your Google Calendar with the service account email (e.g. `your-service-account@your-project.iam.gserviceaccount.com`) with “See all event details”. Optionally set `CALENDAR_ID` in `.env` to one or more calendar IDs, comma-separated (e.g. `you@gmail.com` or `you@gmail.com,work@group.calendar.google.com`); otherwise the first calendar the service account can access is used.

2. **Production** (token stays on the server):

   ```bash
   npm run build
   HA_BASE_URL=https://your-ha:8123 HA_TOKEN=your_token npm run serve
   ```

   Serves the built app and proxies `/api` to Home Assistant with the token. Calendar is served by the same server (uses `SERVICE_ACCOUNT.json` and optional `CALENDAR_ID`).

## Tabs

- **Lighting** — Toggle and brightness for each light.
- **Climate** — Thermostats: current/target temp, HVAC mode, and +/- to set temperature.
- **Switches & Fans** — On/off for switches and fans; fan speed slider when supported.
- **Covers** — Open / Close / Stop for blinds, garage doors, etc.
- **Locks & Security** — Lock/unlock and alarm arm/disarm/arm home/arm away.
- **Sensors** — Read-only list of sensor and binary_sensor states.
- **Calendar** — Upcoming Google Calendar events (next 14 days). Uses the service account in `SERVICE_ACCOUNT.json`; share your calendar with the service account email to allow access. Supports multiple calendars via comma-separated `CALENDAR_ID` in `.env`.

Data is refetched every 30 seconds; use **Refresh** in the header to update immediately after a change.

## API

The app uses the same endpoints as the project’s export/OpenAPI spec:

- `GET /api/states` — all entity states
- `POST /api/services/{domain}/{service}` — call a service (e.g. `light.turn_on`, `climate.set_temperature`)

In dev, the Vite proxy sends these to `VITE_HA_BASE_URL` with `Authorization: Bearer VITE_HA_TOKEN`. In production, `server.js` does the same with `HA_BASE_URL` and `HA_TOKEN`.
