import { describe, it, expect } from 'vitest';
import { buildRawMessage } from '../lib/email.js';

describe('buildRawMessage', () => {
  it('returns base64url-encoded string (no + / or trailing =)', () => {
    const raw = buildRawMessage('a@b.com', 'Sub', 'Body');
    expect(raw).not.toContain('+');
    expect(raw).not.toContain('/');
    expect(raw).not.toMatch(/=+$/);
    expect(typeof raw).toBe('string');
    expect(raw.length).toBeGreaterThan(0);
  });

  it('decodes to RFC 2822 with To, Subject, Content-Type and body', () => {
    const raw = buildRawMessage('ben@example.com', 'Hey there!', "How's it going?");
    const decoded = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    expect(decoded).toContain('To: ben@example.com');
    expect(decoded).toContain('Subject: Hey there!');
    expect(decoded).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(decoded).toContain("How's it going?");
  });

  it('handles empty body', () => {
    const raw = buildRawMessage('x@y.z', 'No body', '');
    const decoded = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    expect(decoded).toContain('To: x@y.z');
    expect(decoded).toContain('Subject: No body');
    expect(decoded.endsWith('\n\n')).toBe(true);
  });

  it('handles multiline body', () => {
    const body = 'Line 1\nLine 2';
    const raw = buildRawMessage('a@b.c', 'Sub', body);
    const decoded = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    expect(decoded).toContain('Line 1\nLine 2');
  });
});
