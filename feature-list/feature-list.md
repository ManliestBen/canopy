# Canopy — Feature List

A combination of **Home Assistant**–style smart home control and **Skylight**–style family calendar display for a wall-mounted panel (23.8" Full HD).

---

## Clarifications & notes

| Topic | Notes |
|-------|--------|
| **Backup / restore** | Back up and restore application configuration only (settings, user list, theme choices, etc.). `.env` and credentials are backed up separately. Use **SQLite** for persistence: one file, easy to back up, sufficient for one or a few devices. |
| **Sleep / wake** | Configurable to either **dim** the display or switch to **photo slideshow** (to reduce burn-in). Main calendar view is replaced until the user touches the screen again. Sleep and wake times can be configured after initial setup. |
| **Root-Access-Granted** | Will be fully integrated as a section/tab (React). Code from [root-access-granted](https://github.com/ManliestBen/root-access-granted) merged in; landscape layout where needed. **Integration deferred** until after TypeScript conversion and other adjustments are complete. |
| **Interaction** | Touch-only. On-screen keyboard when text input is needed (Raspberry Pi OS provides this). |

---

## Required features

### Display & layout

- [ ] UI designed for **23.8" Full HD (1920×1080)** frameless IPS panel
- [ ] **Clock and date** always visible
- [ ] Navigation via **side or top nav bar** (orientation-based: landscape vs portrait)

### Settings (nav)

- [ ] Adjust brightness (if supported by hardware)
- [ ] Adjust volume
- [x] **Dark / light mode** — UI theme selector (System / Light / Dark) with persistence; follows system preference when set to System
- [ ] **Users** — add, edit, delete; each user may pick a color for their tasks
- [ ] **Backup** — create a backup of all settings (config, user list, theme, etc.)
- [ ] **Restore** — restore from a backup
- [ ] **Themes** (each with dark/light mode):
  - [x] Color scheme to match sample images (in this directory)
  - [x] Apple liquid glass–style
  - [x] Bolder, more modern look
  - [x] **Pride theme** — rainbow gradient background, frosted glass panels, rainbow save buttons (animated), add-calendar modal inputs match add-event styling
- [ ] **Transparency effect level** — setting to adjust the strength of the glass/transparency effect (user can turn it up or down)

### Google Calendar (nav)

- [x] **View calendars** — add and manage calendars in the app (stored in SQLite); no `.env` calendar list required
- [x] **Calendar CRUD** — add calendar (title, calendar ID, color); edit and remove; 20 color options per calendar
- [x] **Event detail modal** — click any event card to open a Google Calendar–style detail modal (title, date, time, location, description, calendar name)
- [x] **Edit events** — “Edit in Google Calendar” opens the event in a new tab
- [x] **Different colors per calendar** — user-chosen color per saved calendar (20 pastels + optional custom hex)
- [x] **Views:** daily, weekly, 2-week (biweekly), monthly
- [x] Add events in-app (create new events in the dashboard)
- [x] **Clickable calendar** — daily/weekly: click empty time slot to open Add Event with date + nearest hour and 1 hr duration; biweekly/monthly: click a day to open Add Event with date pre-filled

### Weather (nav)

- [ ] Weather forecast in nav and on **main calendar view**
- [ ] OpenWeatherMap API (key provided)
- [ ] Configurable location
- [ ] Weather alerts/warnings
- [ ] Option to show upcoming week forecast next to calendar days

### Sleep, wake & slideshow

- [ ] **Sleep/wake times** — dim or switch to slideshow (see clarifications)
- [ ] **Photo slideshow** — starts after a configurable delay with no interaction, or as sleep mode
  - [ ] **Primary source:** **Cloudinary** — use Cloudinary for slideshow media (see Input & tradeoffs). Google Photos was considered but would require device registration, user linking in Google Photos app, and API limits; Cloudinary is simpler to integrate. **CLOUDINARY_URL** is already in `dashboard/.env` for when we wire this up.
  - [ ] **Configurable album/folder selection** — choose which folders or collections feed the slideshow (Cloudinary folders/tags or similar).
  - [ ] Starter set can be provided (e.g. local assets or a default Cloudinary folder until configured).

### Task list (nav)

- [ ] Per-user configuration
- [ ] Create, update, delete tasks
- [ ] Optional deadlines
- [ ] **Recurring tasks** (daily, weekly, etc.)
- [ ] Categories

### Shopping / grocery list (nav)

- [ ] Shared list(s)
- [ ] Simple list with optional assignee and “done” state

### Root-Access-Granted (nav)

- [ ] Integrated into this app; landscape layout where needed
- [ ] Required info in `.env`
- *Deferred until after TypeScript + other adjustments.*

### First-time setup / onboarding

- [ ] Add first user and set location during initial setup
- [ ] Google Calendar and sleep/wake can be configured later

### Development & CI

- [ ] **Unit tests** — add unit tests for the app (e.g. dashboard)
- [ ] **GitHub CI** — GitHub Actions workflow runs tests on push/PR; branch protection on the deployed branch requires tests to pass before merge (free for public repos; private repos get 2,000 Actions minutes/month)

---

## Stretch goals

### Calendar & agenda

- [ ] **Calendar event reminders** — configurable (e.g. 10 min, 1 hour before) with visible/audible alert
- [ ] **Agenda / “what’s next” view** — today and upcoming events (and tasks with deadlines) in list form
- [x] **Subscribed calendars** — add any calendar by ID (e.g. holidays, school); calendar titles resolved from API where possible

### Offline & robustness

- [ ] **Offline / degraded behavior** — cached calendar view, clear “offline” indicator, local-only clock/weather/tasks where possible

### Home Assistant — climate

- [ ] **Temperature control** (nav) — adjust thermostats (from `export-ha-api.js`); UI reference: `thermostat.png`, colors match theme
- [ ] Temperature/humidity from sensors; UI reference: `sensor-chart.png`

### Home Assistant — lighting

- [ ] **Lighting controls** (nav) — view/adjust all HA-linked lights
- [ ] UI reference: `lighting.png`; colors match theme and current color temperature where applicable

### Home Assistant — security

- [ ] **Security controls** (nav) — alarm, door locks, garage/door sensors, etc.

### Home Assistant — notifications & cameras

- [ ] **Notifications / alerts** — HA-driven (motion, door, alarm, smoke, etc.) with configurable sounds and prominence
- [ ] **Cameras** — live feeds (e.g. doorbell, driveway, nursery) in a side panel or overlay

### Scenes & routines

- [ ] **Scenes / routines** — e.g. “Good morning”, “Leave home”, “Good night” (thermostat, lights, and optionally what’s on the display); ties sleep/wake and HA together

### Family & sharing

- [ ] **Family messaging / announcements** — e.g. “Dinner’s ready” or sticky note on main screen; in-app or HA notifications
- [ ] **Guest / limited access** — view-only (calendar + weather; no settings or HA controls)

### Canopy service Gmail account

- [x] **Send email** — We can send email via Gmail API using the Canopy Gmail account (**mackinaw.canopy@gmail.com**) and OAuth (refresh token in `.env`). Test script: `npm run send-test-email` from dashboard. Use this as we add reminders, announcements, and other outbound features.
- [ ] **Dedicated Gmail (other uses)** — Potential uses to build on the above:
  - **Outbound:** Event or task reminders, family announcements (“Dinner’s ready”), daily agenda digest, or “what’s on the panel today” emails.
  - **Inbound:** “Email to add” flows (e.g. forward an email to create a task or quick event), or invite/guest-access links sent by email.
  - Notifications from this account so they come from a consistent “Canopy” identity.
- [ ] **Stretch: Consolidate Calendar to Canopy Gmail** — Calendar currently uses a different Gmail account and `dashboard/SERVICE_ACCOUNT.json`. Stretch goal: move Calendar over to **mackinaw.canopy@gmail.com** as well (e.g. same project, new service account for that account, or OAuth) so one identity backs Calendar and Gmail.

### Other

- [ ] **Energy / utility** — small widget or view for energy/solar (e.g. today’s production/usage) when using HA energy
- [ ] **Photo source options** — **Cloudinary** as primary for slideshow (see Input & tradeoffs). Local/NAS path or combination also on the roadmap.
- [ ] **Vacation / away mode** — pause or simplify slideshow; minimal screen or reduced HA sensitivity when “away”
- [ ] **Multi-device / naming** — device name and optional role (e.g. kitchen vs bedroom) for settings and backups
- [ ] **Responsive design** for mobile app usage

---

## Input & tradeoffs (no code action)

### Photo source: Cloudinary (Google Photos removed)

- **Decision:** Use **Cloudinary** for the slideshow instead of Google Photos. Google Photos would have required the Ambient API (device registration, user linking in the Google Photos app, 240 requests/device/day limit) or other workarounds after the Library API was restricted in 2025 — too many hoops for the goal of “users easily share albums with the calendar.”
- **Cloudinary** is the primary photo source: simpler integration, fast, responsive, and sufficient storage. Configurable folders/collections can feed the slideshow.
- **Summary:** Slideshow is backed by Cloudinary. Google Photos–related scripts and setup docs have been removed from the repo.
