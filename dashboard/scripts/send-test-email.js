/**
 * Send a test email via Gmail API using OAuth2 (refresh token in .env).
 * Requires: dashboard/oauth-credentials.json and GOOGLE_OAUTH_REFRESH_TOKEN in .env.
 * Gmail API must be enabled in the Google Cloud project; OAuth consent must include gmail.send.
 *
 * Run from dashboard: npm run send-test-email
 */

import { google } from 'googleapis';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { buildRawMessage } from '../lib/email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from dashboard root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TO_EMAIL = 'benjamintmanley@gmail.com';
const SUBJECT = "Hey there!";
const BODY = "How's it going?";

function loadOAuthCredentials() {
  const credPath = path.join(__dirname, '..', 'oauth-credentials.json');
  const raw = readFileSync(credPath, 'utf8');
  const json = JSON.parse(raw);
  const client = json.installed || json.web;
  if (!client || !client.client_id || !client.client_secret) {
    throw new Error('oauth-credentials.json must contain installed or web with client_id and client_secret');
  }
  return {
    clientId: client.client_id,
    clientSecret: client.client_secret,
    redirectUri: client.redirect_uris?.[0] || 'http://localhost:3000/oauth2callback',
  };
}

async function main() {
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!refreshToken) {
    console.error('Missing GOOGLE_OAUTH_REFRESH_TOKEN in .env');
    process.exit(1);
  }

  const { clientId, clientSecret, redirectUri } = loadOAuthCredentials();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const raw = buildRawMessage(TO_EMAIL, SUBJECT, BODY);

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  console.log(`Test email sent to ${TO_EMAIL} (subject: "${SUBJECT}").`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
