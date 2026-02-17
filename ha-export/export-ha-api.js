#!/usr/bin/env node
/**
 * Home Assistant API Export
 *
 * Fetches devices, entities, and services from a Home Assistant instance
 * and writes a Markdown reference and an OpenAPI 3.0 spec (YAML).
 *
 * Usage:
 *   HA_BASE_URL=... HA_TOKEN=... node export-ha-api.js [output.md]
 *   Or put HA_BASE_URL and HA_TOKEN in a .env file in the project root.
 *
 * Outputs (default): ha-export/home-assistant-api-reference.md, ha-export/home-assistant-openapi.yaml
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env") });

const BASE_URL = process.env.HA_BASE_URL?.replace(/\/+$/, "") ?? "";
const TOKEN = process.env.HA_TOKEN ?? "";

if (!BASE_URL || !TOKEN) {
  console.error("Set HA_BASE_URL and HA_TOKEN (e.g. in .env or as env vars).");
  process.exit(1);
}

const defaultOut = path.join(__dirname, "home-assistant-api-reference.md");
const defaultOpenApi = path.join(__dirname, "home-assistant-openapi.yaml");
const OUT_FILE = process.argv[2] ?? defaultOut;
const OPENAPI_FILE = process.argv[2] ? path.join(path.dirname(OUT_FILE), "home-assistant-openapi.yaml") : defaultOpenApi;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

function stripTrailingSlash(url) {
  return url.replace(/\/+$/, "");
}

const base = BASE_URL;

async function fetchJson(path) {
  const res = await fetch(`${base}${path}`, { headers });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchStates() {
  return fetchJson("/api/states");
}

async function fetchServices() {
  return fetchJson("/api/services");
}

function wsUrl() {
  return base.replace(/^http/, "ws") + "/api/websocket";
}

async function wsCommand(ws, type, id = 1) {
  return new Promise((resolve, reject) => {
    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === id && (msg.type === "result" || msg.type === "event")) {
          ws.off("message", handler);
          if (msg.type === "result" && !msg.success) reject(new Error(msg.error?.message ?? "WebSocket command failed"));
          else resolve(msg);
        }
      } catch (e) {
        ws.off("message", handler);
        reject(e);
      }
    };
    ws.on("message", handler);
    ws.send(JSON.stringify({ id, type }));
  });
}

async function fetchDeviceRegistry() {
  const { default: WebSocket } = await import("ws");
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl(), { rejectUnauthorized: false });
    let authed = false;

    ws.on("open", () => {});

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_required") {
          ws.send(JSON.stringify({ type: "auth", access_token: TOKEN }));
          return;
        }
        if (msg.type === "auth_ok") {
          authed = true;
          const devRes = await wsCommand(ws, "config/device_registry/list", 1);
          const entRes = await wsCommand(ws, "config/entity_registry/list", 2);
          ws.close();
          resolve({
            devices: devRes.result ?? [],
            entities: entRes.result ?? [],
          });
          return;
        }
        if (msg.type === "auth_invalid") {
          ws.close();
          reject(new Error("WebSocket auth failed: " + (msg.message ?? "invalid token")));
        }
      } catch (e) {
        ws.close();
        reject(e);
      }
    });

    ws.on("error", (err) => reject(err));
  });
}

function domainFromEntityId(entityId) {
  const i = entityId.indexOf(".");
  return i === -1 ? entityId : entityId.slice(0, i);
}

function servicesForDomain(servicesList, domain) {
  const entry = servicesList.find((s) => s.domain === domain);
  const services = entry?.services;
  if (Array.isArray(services)) return services;
  if (services && typeof services === "object") return Object.keys(services);
  return [];
}

/**
 * Build OpenAPI 3.0 spec from fetched data. Organized by tags: States, Services, Configuration.
 * Includes all devices, entities, and service call examples from this instance (x-entities, x-devices, request examples).
 */
function buildOpenAPI(data) {
  const { states, servicesList, devices, entities } = data;
  const serviceNamesByDomain = new Map();
  for (const { domain } of servicesList) {
    serviceNamesByDomain.set(domain, servicesForDomain(servicesList, domain));
  }
  const domainList = servicesList.map((s) => s.domain).sort();
  const entityIdExamples = states.slice(0, 10).map((s) => s.entity_id);

  // Entities list for GET /api/states/{entity_id} (same as in markdown)
  const xEntities = states
    .map((s) => ({
      entity_id: s.entity_id,
      domain: domainFromEntityId(s.entity_id),
      state: s.state,
      friendly_name: s.attributes?.friendly_name,
    }))
    .sort((a, b) => a.entity_id.localeCompare(b.entity_id));

  // Devices with their entity_ids (same grouping as markdown)
  const entitiesByDeviceId = new Map();
  for (const ent of entities) {
    if (ent.device_id) {
      if (!entitiesByDeviceId.has(ent.device_id)) entitiesByDeviceId.set(ent.device_id, []);
      entitiesByDeviceId.get(ent.device_id).push(ent);
    }
  }
  const xDevices = devices.map((dev) => ({
    id: dev.id,
    name: dev.name_by_user || dev.name || dev.id || "Unnamed device",
    area_id: dev.area_id || undefined,
    manufacturer: dev.manufacturer || undefined,
    model: dev.model || undefined,
    entity_ids: (entitiesByDeviceId.get(dev.id) ?? []).map((e) => e.entity_id).sort(),
  }));

  // For each (domain, service) pick an example entity_id that has that domain (for request examples)
  const entityIdsByDomain = new Map();
  for (const s of states) {
    const dom = domainFromEntityId(s.entity_id);
    if (!entityIdsByDomain.has(dom)) entityIdsByDomain.set(dom, []);
    entityIdsByDomain.get(dom).push(s.entity_id);
  }
  const serviceCallExamples = {};
  for (const { domain } of servicesList) {
    const serviceNames = servicesForDomain(servicesList, domain);
    const exampleEntityId = (entityIdsByDomain.get(domain) || [])[0];
    for (const svc of serviceNames) {
      const key = `${domain}.${svc}`;
      serviceCallExamples[key] = {
        summary: `${domain}.${svc}`,
        value: exampleEntityId ? { entity_id: exampleEntityId } : { entity_id: `${domain}.example` },
      };
    }
  }

  const spec = {
    openapi: "3.0.3",
    info: {
      title: "Home Assistant REST API",
      description: [
        "REST API for a Home Assistant instance. All endpoints require a long-lived access token.",
        "",
        `**Generated from:** ${base}`,
        `**Generated at:** ${new Date().toISOString()}`,
        "",
        "**Summary:**",
        `- Devices: ${devices.length}`,
        `- Entities (registry): ${entities.length}`,
        `- States (current): ${states.length}`,
        `- Service domains: ${servicesList.length}`,
      ].join("\n"),
      version: "1.0.0",
    },
    servers: [{ url: base, description: "Home Assistant instance" }],
    security: [{ bearerAuth: [] }],
    "x-entities": xEntities,
    "x-devices": xDevices,
    tags: [
      { name: "States", description: "Read entity and system states" },
      { name: "Services", description: "List and call services" },
      { name: "Configuration", description: "Instance configuration" },
    ],
    paths: {
      "/api/states": {
        get: {
          operationId: "listStates",
          tags: ["States"],
          summary: "List all entity states",
          description: "Returns the current state of every entity. Use this for a full snapshot of your home.",
          responses: {
            "200": {
              description: "Array of state objects for all entities",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/StateList" },
                },
              },
            },
            "401": { description: "Invalid or missing authorization" },
          },
        },
      },
      "/api/states/{entity_id}": {
        get: {
          operationId: "getState",
          tags: ["States"],
          summary: "Get one entity state",
          description: [
            "Returns the current state and attributes for a single entity.",
            "",
            "**All entity IDs for this instance** are listed in the root-level `x-entities` array (and grouped by device in `x-devices`).",
          ].join("\n"),
          parameters: [
            {
              name: "entity_id",
              in: "path",
              required: true,
              description: "Entity ID (e.g. light.living_room, sensor.temperature). See root-level x-entities for the full list.",
              schema: { type: "string", example: entityIdExamples[0] || "light.example" },
              examples: Object.fromEntries(
                entityIdExamples.slice(0, 5).map((eid) => [eid.replace(/[^a-z0-9_]/gi, "_"), { summary: eid, value: eid }])
              ),
            },
          ],
          responses: {
            "200": {
              description: "State object for the entity",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/State" },
                },
              },
            },
            "404": { description: "Entity not found" },
            "401": { description: "Invalid or missing authorization" },
          },
        },
      },
      "/api/services": {
        get: {
          operationId: "listServices",
          tags: ["Services"],
          summary: "List all service domains and services",
          description: "Returns every domain and its available service names. Use with POST /api/services/{domain}/{service} to call a service.",
          responses: {
            "200": {
              description: "List of domains with their services",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ServiceList" },
                },
              },
            },
            "401": { description: "Invalid or missing authorization" },
          },
        },
      },
      "/api/services/{domain}/{service}": {
        post: {
          operationId: "callService",
          tags: ["Services"],
          summary: "Call a service",
          description: [
            "Calls a Home Assistant service. Request body typically includes `entity_id` (string or array) plus any service-specific parameters.",
            "",
            "**Available domains (this instance):** " + domainList.join(", "),
          ].join("\n"),
          parameters: [
            {
              name: "domain",
              in: "path",
              required: true,
              description: "Service domain (e.g. light, switch, cover)",
              schema: { type: "string", enum: domainList },
            },
            {
              name: "service",
              in: "path",
              required: true,
              description: "Service name (e.g. turn_on, turn_off)",
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceCallRequest" },
                example: { entity_id: entityIdExamples.find((e) => e.startsWith("light.")) || entityIdExamples[0] },
                examples: serviceCallExamples,
              },
            },
          },
          responses: {
            "200": {
              description: "List of state changes produced by the service call",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/State" },
                  },
                },
              },
            },
            "400": { description: "Invalid request (e.g. missing entity_id)" },
            "401": { description: "Invalid or missing authorization" },
          },
        },
      },
      "/api/config": {
        get: {
          operationId: "getConfig",
          tags: ["Configuration"],
          summary: "Get instance configuration",
          description: "Returns basic configuration of the Home Assistant instance (e.g. location, time zone).",
          responses: {
            "200": {
              description: "Configuration object",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Config" },
                },
              },
            },
            "401": { description: "Invalid or missing authorization" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Long-Lived Access Token",
          description: "Create a token under Profile → Long-Lived Access Tokens",
        },
      },
      schemas: {
        State: {
          type: "object",
          description: "Entity state at a point in time",
          properties: {
            entity_id: { type: "string", example: "light.living_room" },
            state: { type: "string", description: "Current state value (e.g. on, off, 42)" },
            attributes: {
              type: "object",
              description: "Domain-specific attributes (friendly_name, unit_of_measurement, etc.)",
              additionalProperties: true,
            },
            last_changed: { type: "string", format: "date-time" },
            last_updated: { type: "string", format: "date-time" },
            context: {
              type: "object",
              properties: {
                id: { type: "string" },
                parent_id: { type: "string" },
                user_id: { type: "string" },
              },
            },
          },
        },
        StateList: {
          type: "array",
          items: { $ref: "#/components/schemas/State" },
        },
        ServiceCallRequest: {
          type: "object",
          description: "At minimum include entity_id. Other fields depend on the service.",
          properties: {
            entity_id: {
              oneOf: [
                { type: "string" },
                { type: "array", items: { type: "string" } },
              ],
              description: "Target entity or entities",
            },
          },
          additionalProperties: true,
        },
        ServiceList: {
          type: "array",
          items: {
            type: "object",
            properties: {
              domain: { type: "string" },
              services: {
                type: "object",
                additionalProperties: { type: "object" },
                description: "Map of service name to service definition",
              },
            },
          },
        },
        Config: {
          type: "object",
          description: "Instance configuration",
          properties: {
            latitude: { type: "number" },
            longitude: { type: "number" },
            elevation: { type: "number" },
            unit_system: { type: "object" },
            location_name: { type: "string" },
            time_zone: { type: "string" },
            components: { type: "array", items: { type: "string" } },
            config_dir: { type: "string" },
            allowlist_external_dirs: { type: "array", items: { type: "string" } },
            version: { type: "string" },
          },
          additionalProperties: true,
        },
      },
    },
  };
  return spec;
}

function buildOutput(data) {
  const { states, servicesList, devices, entities } = data;
  const stateByEntityId = new Map(states.map((s) => [s.entity_id, s]));
  const entityRegistryList = entities;
  const deviceById = new Map(devices.map((d) => [d.id, d]));
  const entitiesByDeviceId = new Map();
  const orphanEntities = [];

  for (const ent of entityRegistryList) {
    const deviceId = ent.device_id;
    if (deviceId) {
      if (!entitiesByDeviceId.has(deviceId)) entitiesByDeviceId.set(deviceId, []);
      entitiesByDeviceId.get(deviceId).push(ent);
    } else {
      orphanEntities.push(ent);
    }
  }

  const lines = [];
  const h1 = (t) => `# ${t}`;
  const h2 = (t) => `\n## ${t}`;
  const h3 = (t) => `\n### ${t}`;
  const code = (t) => "`" + t + "`";
  const bullet = (t) => `- ${t}`;
  const tableRow = (cells) => "| " + cells.join(" | ") + " |";

  lines.push(h1("Home Assistant API Reference"));
  lines.push("");
  lines.push(`Generated from **${base}** at ${new Date().toISOString()}.`);
  lines.push("");
  lines.push("Summary:");
  lines.push(`- **Devices:** ${devices.length}`);
  lines.push(`- **Entities (registry):** ${entityRegistryList.length}`);
  lines.push(`- **States (current):** ${states.length}`);
  lines.push(`- **Service domains:** ${servicesList.length}`);
  lines.push("");

  lines.push(h2("REST API base"));
  lines.push("");
  lines.push("All requests require:");
  lines.push("- **Header:** `Authorization: Bearer YOUR_LONG_LIVED_ACCESS_TOKEN`");
  lines.push("- **Base URL:** " + code(base));
  lines.push("");

  lines.push(h2("Devices and entities"));
  lines.push("");
  lines.push("Each device can have multiple entities. Use the endpoints below to **read** state and **call services** to control.");
  lines.push("");

  const deviceIdsSeen = new Set();
  for (const dev of devices) {
    deviceIdsSeen.add(dev.id);
    const name = dev.name_by_user || dev.name || dev.id || "Unnamed device";
    const area = dev.area_id ? ` (area: \`${dev.area_id}\`)` : "";
    lines.push(h3(name + area));
    lines.push("");
    if (dev.manufacturer || dev.model) {
      lines.push(`- **Device ID:** \`${dev.id}\``);
      if (dev.manufacturer) lines.push(`- **Manufacturer:** ${dev.manufacturer}`);
      if (dev.model) lines.push(`- **Model:** ${dev.model}`);
      lines.push("");
    }

    const devEntities = entitiesByDeviceId.get(dev.id) ?? [];
    if (devEntities.length === 0) {
      lines.push("*No registered entities for this device.*");
      lines.push("");
      continue;
    }

    for (const ent of devEntities.sort((a, b) => (a.entity_id || "").localeCompare(b.entity_id || ""))) {
      const eid = ent.entity_id;
      const state = stateByEntityId.get(eid);
      const domain = domainFromEntityId(eid);
      const svcs = servicesForDomain(servicesList, domain);

      lines.push(`#### ${ent.original_name || eid}`);
      lines.push("");
      lines.push(`- **Entity ID:** ${code(eid)}`);
      lines.push(`- **Domain:** ${code(domain)}`);
      if (state) {
        lines.push(`- **Current state:** ${code(state.state)}`);
        if (state.attributes?.friendly_name) lines.push(`- **Friendly name:** ${state.attributes.friendly_name}`);
        if (state.attributes?.unit_of_measurement) lines.push(`- **Unit:** ${state.attributes.unit_of_measurement}`);
      }
      lines.push("");
      lines.push("**Read state:**");
      lines.push("```");
      lines.push(`GET ${base}/api/states/${eid}`);
      lines.push("```");
      lines.push("");
      if (svcs.length > 0) {
        lines.push("**Control (services):**");
        for (const svc of svcs) {
          lines.push(`- ${code(domain + "." + svc)}`);
          lines.push("  ```");
          lines.push(`  POST ${base}/api/services/${domain}/${svc}`);
          lines.push("  Content-Type: application/json");
          lines.push("  Body example: { \"entity_id\": \"" + eid + "\" }");
          lines.push("  ```");
        }
        lines.push("");
      }
    }
  }

  if (orphanEntities.length > 0) {
    lines.push(h3("Entities not linked to a device"));
    lines.push("");
    for (const ent of orphanEntities.sort((a, b) => (a.entity_id || "").localeCompare(b.entity_id || ""))) {
      const eid = ent.entity_id;
      const state = stateByEntityId.get(eid);
      const domain = domainFromEntityId(eid);
      const svcs = servicesForDomain(servicesList, domain);
      lines.push(`- **${eid}** (${domain}) — state: ${state ? state.state : "—"}`);
      lines.push("  - Read: `GET " + base + "/api/states/" + eid + "`");
      for (const svc of svcs) {
        lines.push("  - " + domain + "." + svc + ": `POST " + base + "/api/services/" + domain + "/" + svc + "`");
      }
    }
    lines.push("");
  }

  lines.push(h2("All entities (quick reference)"));
  lines.push("");
  lines.push(tableRow(["Entity ID", "Domain", "State", "Unit"]));
  lines.push(tableRow(["---", "---", "---", "---"]));
  for (const s of states.sort((a, b) => a.entity_id.localeCompare(b.entity_id))) {
    const unit = s.attributes?.unit_of_measurement ?? "—";
    lines.push(tableRow([code(s.entity_id), domainFromEntityId(s.entity_id), s.state, unit]));
  }
  lines.push("");

  lines.push(h2("All services by domain"));
  lines.push("");
  lines.push("Call with: `POST " + base + "/api/services/{domain}/{service}` and JSON body (e.g. `{\"entity_id\": \"...\"}`).");
  lines.push("");
  for (const { domain } of servicesList) {
    const names = servicesForDomain(servicesList, domain);
    lines.push(`- **${domain}:** ${names.map((s) => code(s)).join(", ")}`);
  }
  lines.push("");

  lines.push(h2("Common REST endpoints"));
  lines.push("");
  lines.push("| Purpose | Method | URL |");
  lines.push("| --- | --- | --- |");
  lines.push(`| All states | GET | ${code(base + "/api/states")} |`);
  lines.push(`| One entity state | GET | ${code(base + "/api/states/{entity_id}")} |`);
  lines.push(`| List services | GET | ${code(base + "/api/services")} |`);
  lines.push(`| Call service | POST | ${code(base + "/api/services/{domain}/{service}")} |`);
  lines.push(`| Config | GET | ${code(base + "/api/config")} |`);
  lines.push("");

  return lines.join("\n");
}

async function main() {
  console.log("Fetching from", base);
  const [states, servicesList, registry] = await Promise.all([
    fetchStates(),
    fetchServices(),
    fetchDeviceRegistry().catch((e) => {
      console.warn("WebSocket registry failed (using REST only):", e.message);
      return { devices: [], entities: [] };
    }),
  ]);

  const data = {
    states,
    servicesList,
    devices: registry.devices,
    entities: registry.entities,
  };

  const out = buildOutput(data);
  const fs = await import("fs");
  const yaml = (await import("yaml")).default;
  fs.writeFileSync(OUT_FILE, out, "utf8");
  console.log("Wrote", OUT_FILE);

  const openapi = buildOpenAPI(data);
  const openapiYaml = yaml.stringify(openapi, { lineWidth: 100, defaultKeyType: "PLAIN", defaultStringType: "PLAIN" });
  const openapiPath = process.argv[2] ? OUT_FILE.replace(/\.md$/, "").replace(/\.yaml$/, "") + "-openapi.yaml" : OPENAPI_FILE;
  fs.writeFileSync(openapiPath, openapiYaml, "utf8");
  console.log("Wrote", openapiPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
