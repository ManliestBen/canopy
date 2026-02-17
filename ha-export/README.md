# Home Assistant API Export

Fetches devices, entities, and services from your Home Assistant instance and writes:

- **home-assistant-api-reference.md** – Markdown reference
- **home-assistant-openapi.yaml** – OpenAPI 3.0 spec

## Usage

From the **repo root**:

```bash
HA_BASE_URL=https://your-instance.duckdns.org:8123 HA_TOKEN=your_long_lived_token npm run export
```

Or add `HA_BASE_URL` and `HA_TOKEN` to a **`.env`** file in the repo root; the script loads it automatically.

Optional: pass an output path for the Markdown file (OpenAPI is written next to it):

```bash
npm run export /tmp/my-ha-reference.md
```

## Output

Files are written to **`ha-export/`** by default. They are gitignored because they contain your instance’s entity list and base URL.
