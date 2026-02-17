# Canopy

**Canopy** is a React dashboard for controlling Home Assistant (lights, climate, switches, covers, locks, sensors) plus **Google Calendar**, and a **HA API export** script that generates a Markdown reference and OpenAPI spec from your instance.

## Project structure

| Path | Purpose |
|------|---------|
| **`dashboard/`** | Canopy app (Vite). HA controls + Google Calendar. Run from root with `npm run dev` (see below). |
| **`ha-export/`** | Script to export your HA devices/entities/services to Markdown and OpenAPI YAML. Run with `npm run export` from repo root. |
| **`.env`** | Create from `.env.example` (in `dashboard/` or root). Holds `HA_BASE_URL`, `HA_TOKEN` for export; dashboard uses `dashboard/.env` for its own vars. |

## Quick start (from repo root)

```bash
npm install
npm run install:dashboard   # one-time: install dashboard deps
cp dashboard/.env.example dashboard/.env   # edit: VITE_HA_BASE_URL, VITE_HA_TOKEN, optional CALENDAR_ID
npm run dev                 # start dashboard (Vite + calendar server)
```

**Other commands from root:**

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dashboard dev server |
| `npm run build` | Build dashboard for production |
| `npm run serve` | Serve built dashboard (set HA_* and CALENDAR_ID in dashboard/.env or env) |
| `npm run preview` | Preview dashboard build |
| `npm run export` | Run HA API export (uses root `.env` for HA_BASE_URL, HA_TOKEN) |

See **`dashboard/README.md`** for full setup (Calendar, production serve).

### HA API export

```bash
# From repo root. Set HA_BASE_URL and HA_TOKEN in root .env or env:
npm run export
# Outputs: ha-export/home-assistant-api-reference.md, ha-export/home-assistant-openapi.yaml
```

Generated files are **gitignored** (instance-specific). Add `HA_BASE_URL` and `HA_TOKEN` to a root `.env` if you want the export script to load them automatically.

## Secrets

- **Do not commit** `.env`, `SERVICE_ACCOUNT.json`, or generated export files. They are listed in `.gitignore`.
- The export script and dashboard read config from env (or `.env`); no URLs or tokens are hardcoded.
