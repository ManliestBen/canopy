/**
 * SQLite database for dashboard data (e.g. saved calendars).
 * DB file: data/canopy.db (created automatically).
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'canopy.db');

let db = null;

function getDb() {
  if (db) return db;
  fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_calendars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      calendar_id TEXT NOT NULL UNIQUE,
      color_index INTEGER NOT NULL DEFAULT 0 CHECK(color_index >= 0 AND color_index <= 19)
    );
  `);
  return db;
}

/**
 * @returns {Array<{ id: number, title: string, calendar_id: string, color_index: number }>}
 */
export function getSavedCalendars() {
  const stmt = getDb().prepare('SELECT id, title, calendar_id AS calendarId, color_index AS colorIndex FROM saved_calendars ORDER BY id');
  return stmt.all();
}

/**
 * @param {{ title: string, calendarId: string, colorIndex: number }} row
 * @returns {{ id: number, title: string, calendarId: string, colorIndex: number }}
 */
export function addSavedCalendar(row) {
  const stmt = getDb().prepare('INSERT INTO saved_calendars (title, calendar_id, color_index) VALUES (?, ?, ?)');
  const result = stmt.run(row.title, row.calendarId, Math.max(0, Math.min(19, row.colorIndex ?? 0)));
  return { id: result.lastInsertRowid, title: row.title, calendarId: row.calendarId, colorIndex: row.colorIndex ?? 0 };
}

/**
 * @param {number} id
 * @param {{ title?: string, calendarId?: string, colorIndex?: number }} updates
 */
export function updateSavedCalendar(id, updates) {
  const row = getDb().prepare('SELECT id, title, calendar_id, color_index FROM saved_calendars WHERE id = ?').get(id);
  if (!row) return null;
  const title = updates.title !== undefined ? updates.title : row.title;
  const calendar_id = updates.calendarId !== undefined ? updates.calendarId : row.calendar_id;
  let color_index = row.color_index;
  if (updates.colorIndex !== undefined) color_index = Math.max(0, Math.min(19, updates.colorIndex));
  getDb().prepare('UPDATE saved_calendars SET title = ?, calendar_id = ?, color_index = ? WHERE id = ?').run(title, calendar_id, color_index, id);
  return { id, title, calendarId: calendar_id, colorIndex: color_index };
}

/**
 * @param {number} id
 */
export function deleteSavedCalendar(id) {
  const result = getDb().prepare('DELETE FROM saved_calendars WHERE id = ?').run(id);
  return result.changes > 0;
}
