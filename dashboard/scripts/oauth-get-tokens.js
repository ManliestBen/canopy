/**
 * One-time OAuth flow to get a refresh token for the Canopy Gmail user
 * (Photos Library, Photos Ambient, Picker, Gmail, Calendar).
 *
 * Usage (interactive – script starts a server and opens the browser):
 *   1. Put your OAuth client JSON at dashboard/oauth-credentials.json
 *   2. In Google Cloud Console, set authorized redirect URI to exactly: http://localhost:3000/oauth2callback
 *   3. From dashboard/: npm install && npm run oauth-get-tokens
 *   4. Sign in, approve scopes; you’ll be redirected to localhost:3000 and the script will print the token.
 *
 * Usage (manual – you already have the code from a redirect to e.g. http://localhost/?code=...):
 *   npm run oauth-get-tokens -- "PASTE_THE_CODE_HERE"
 *   If Google sent you to http://localhost/ (no port), use:
 *   npm run oauth-get-tokens -- "PASTE_THE_CODE_HERE" --redirect-uri "http://localhost/"
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import open from 'open';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REDIRECT_PORT = 3000;
const REDIRECT_PATH = '/oauth2callback';
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}${REDIRECT_PATH}`;

const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/photosambient.mediaitems',
  'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar',
];

// Resolve credentials path: from dashboard/scripts/ -> dashboard/oauth-credentials.json
const credentialsPath = path.join(__dirname, '..', 'oauth-credentials.json');
let credentials;
try {
  credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
} catch (err) {
  console.error('Failed to load oauth-credentials.json from', credentialsPath);
  console.error('Download the OAuth client JSON from Google Cloud Console and save it there.');
  process.exit(1);
}

const client = credentials.web || credentials.installed;
if (!client || !client.client_id || !client.client_secret) {
  console.error('oauth-credentials.json must contain .web or .installed with client_id and client_secret.');
  process.exit(1);
}

// Optional: run in manual code mode (code passed as first arg; optional --redirect-uri)
const args = process.argv.slice(2);
const manualCode = args.find((a) => !a.startsWith('--'));
const redirectUriArg = args.find((a) => a.startsWith('--redirect-uri='));
const manualRedirectUri = redirectUriArg ? redirectUriArg.split('=')[1] : null;

async function exchangeCode(code, redirectUri) {
  const oauth2Client = new google.auth.OAuth2(
    client.client_id,
    client.client_secret,
    redirectUri
  );
  const { tokens } = await oauth2Client.getToken(code);
  console.log('\n--- Store this in dashboard/.env (do not commit) ---\n');
  console.log('GOOGLE_OAUTH_REFRESH_TOKEN=' + (tokens.refresh_token || ''));
  console.log('\n--- End ---\n');
  if (!tokens.refresh_token) {
    console.warn('No refresh_token in response. You may need to revoke app access and run again with prompt=consent.');
  }
}

if (manualCode) {
  const redirectUri = manualRedirectUri || 'http://localhost/';
  exchangeCode(manualCode, redirectUri)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to exchange code for tokens:', err.message);
      if (err.message?.includes('redirect_uri')) {
        console.error('Try passing the exact redirect URI Google used, e.g.: --redirect-uri "http://localhost/"');
      }
      process.exit(1);
    });
} else {

const oauth2Client = new google.auth.OAuth2(
  client.client_id,
  client.client_secret,
  client.redirect_uris?.[0] || REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

const server = createServer(async (req, res) => {
  const reqUrl = req.url || '';
  const isCallback = reqUrl.startsWith(REDIRECT_PATH) || (reqUrl.startsWith('/') && reqUrl.includes('code='));
  if (!isCallback) {
    res.writeHead(404).end('Not found');
    return;
  }
  const qs = new URL(reqUrl, `http://localhost:${REDIRECT_PORT}`).searchParams;
  const code = qs.get('code');
  const error = qs.get('error');
  if (error) {
    res.writeHead(200).end(`Authorization failed: ${error}. Check the terminal for details.`);
    server.close();
    console.error('OAuth error:', error, qs.get('error_description') || '');
    process.exit(1);
  }
  if (!code) {
    res.writeHead(200).end('No code in callback. Try again.');
    server.close();
    process.exit(1);
  }
  res.writeHead(200, { 'Content-Type': 'text/html' }).end(
    '<p>Success. You can close this tab.</p><p>Check the terminal for the refresh token.</p>'
  );
  server.close();
  try {
    await exchangeCode(code, client.redirect_uris?.[0] || REDIRECT_URI);
  } catch (err) {
    console.error('Failed to exchange code for tokens:', err.message);
    process.exit(1);
  }
});

  server.listen(REDIRECT_PORT, () => {
    console.log('Opening browser for Google sign-in. Sign in as your Canopy Gmail (e.g. mackinaw.canopy@gmail.com).\n');
    console.log('If the browser did not open, visit this URL:\n');
    console.log(authUrl);
    console.log('');
    open(authUrl).catch(() => {
      console.log('Could not open browser automatically. Copy the URL above into your browser.');
    });
  });
}
