/**
 * Helpers for building Gmail API raw messages (base64url-encoded RFC 2822).
 * Used by scripts/send-test-email.js and testable without I/O.
 */

/**
 * Build a raw MIME message string and return it base64url-encoded for Gmail API.
 * @param {string} to - Recipient email address
 * @param {string} subject - Subject line
 * @param {string} body - Plain text body
 * @returns {string} base64url-encoded message for requestBody.raw
 */
export function buildRawMessage(to, subject, body) {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ];
  const message = lines.join('\n');
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
