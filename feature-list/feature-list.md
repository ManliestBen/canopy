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
  - [ ] Color scheme to match sample images (in this directory)
  - [ ] Apple liquid glass–style
  - [ ] Bolder, more modern look

### Google Calendar (nav)

- [x] **View calendars** — add and manage calendars in the app (stored in SQLite); no `.env` calendar list required
- [x] **Calendar CRUD** — add calendar (title, calendar ID, color); edit and remove; 20 color options per calendar
- [x] **Event detail modal** — click any event card to open a Google Calendar–style detail modal (title, date, time, location, description, calendar name)
- [x] **Edit events** — “Edit in Google Calendar” opens the event in a new tab
- [x] **Different colors per calendar** — user-chosen color per saved calendar (20 pastels)
- [x] **Views:** daily, weekly, 2-week (biweekly), monthly
- [ ] Add events in-app (create new events in the dashboard)

### Weather (nav)

- [ ] Weather forecast in nav and on **main calendar view**
- [ ] OpenWeatherMap API (key provided)
- [ ] Configurable location
- [ ] Weather alerts/warnings
- [ ] Option to show upcoming week forecast next to calendar days

### Sleep, wake & slideshow

- [ ] **Sleep/wake times** — dim or switch to slideshow (see clarifications)
- [ ] **Photo slideshow** — starts after a configurable delay with no interaction, or as sleep mode
  - [ ] Photo source TBD; starter set will be provided

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

### Other

- [ ] **Energy / utility** — small widget or view for energy/solar (e.g. today’s production/usage) when using HA energy
- [ ] **Photo source options** — e.g. Google Photos, local/NAS path, or both; explicitly on the roadmap
- [ ] **Vacation / away mode** — pause or simplify slideshow; minimal screen or reduced HA sensitivity when “away”
- [ ] **Multi-device / naming** — device name and optional role (e.g. kitchen vs bedroom) for settings and backups
- [ ] **Responsive design** for mobile app usage
