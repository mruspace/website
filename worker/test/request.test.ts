import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';

// The runtime's EmailMessage does not give the raw message back; a plain
// class lets the tests read what would be sent.
vi.mock('cloudflare:email', () => ({
  EmailMessage: class {
    constructor(
      public from: string,
      public to: string,
      public raw: string,
    ) {}
  },
}));

const ORIGIN = 'https://mru.space';
const sent: { from: string; to: string; raw: string }[] = [];
let allow = true;
let turnstileOk = true;

function testEnv(): Env {
  return {
    ...env,
    TURNSTILE_SECRET: 'test-secret',
    MAIL: {
      send: vi.fn(async (m: { from: string; to: string; raw: ReadableStream | string }) => {
        const raw = typeof m.raw === 'string' ? m.raw : await new Response(m.raw).text();
        sent.push({ from: m.from, to: m.to, raw });
      }),
    } as unknown as SendEmail,
    RATE_LIMIT: { limit: vi.fn(async () => ({ success: allow })) } as unknown as RateLimit,
  };
}

function form(over: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams({
    name: 'Ada Ops',
    email: 'ada@example.org',
    organisation: 'Ocean Lab',
    role: 'Operations',
    interest: 'field',
    message: 'Three loggers on a buoy.\nOne visit a year.',
    topic: 'Ocean buoys and moorings',
    page: 'https://mru.space/use-cases/ocean-buoys/',
    website: '',
    'cf-turnstile-response': 'token',
    ...over,
  });
}

function post(body: URLSearchParams, opts: { json?: boolean; origin?: string | null } = {}): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'CF-Connecting-IP': '203.0.113.7',
    Referer: 'https://mru.space/use-cases/ocean-buoys/',
  };
  if (opts.origin !== null) headers.Origin = opts.origin ?? ORIGIN;
  if (opts.json !== false) headers.Accept = 'application/json';
  return new Request('https://api.mru.space/request', { method: 'POST', headers, body });
}

/** The decoded text body of the last email. */
function lastText(): string {
  const raw = sent.at(-1)!.raw;
  const b64 = raw.split('\r\n\r\n')[1]!.replace(/\r\n/g, '');
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}
const lastHeaders = () => sent.at(-1)!.raw.split('\r\n\r\n')[0]!;

beforeEach(() => {
  sent.length = 0;
  allow = true;
  turnstileOk = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).startsWith('https://challenges.cloudflare.com/'))
        return Response.json({ success: turnstileOk });
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('valid requests', () => {
  it('sends one email and answers JSON to fetch()', async () => {
    const res = await worker.fetch(post(form()), testEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('contact@mru.space');
    const h = lastHeaders();
    expect(h).toContain('Reply-To: <ada@example.org>');
    // "Request information: Mru Field · Earth · Ocean Lab", RFC 2047-encoded (non-ASCII).
    const subj = h.match(/^Subject: =\?UTF-8\?B\?(.+)\?=$/m)![1]!;
    expect(new TextDecoder().decode(Uint8Array.from(atob(subj), (c) => c.charCodeAt(0)))).toBe(
      'Request information: Mru Field · Earth · Ocean Lab',
    );
    const text = lastText();
    for (const s of ['Ada Ops', 'ada@example.org', 'Ocean Lab', 'Operations', 'Ocean buoys and moorings', 'One visit a year.', 'Time (UTC)'])
      expect(text).toContain(s);
    expect(text).toContain('https://mru.space/use-cases/ocean-buoys/');
  });

  it('redirects a plain form post (no JS) to the sent page', async () => {
    const res = await worker.fetch(post(form(), { json: false }), testEnv());
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('https://mru.space/contact/sent/');
    expect(sent).toHaveLength(1);
  });

  it('falls back to the name, then the email, in the subject', async () => {
    await worker.fetch(post(form({ organisation: '', interest: 'research' })), testEnv());
    expect(lastHeaders()).toMatch(/^Subject: /m);
    expect(lastText()).toContain('Research or partnership');
  });
});

describe('spam', () => {
  it('drops a filled honeypot without sending, and looks like success', async () => {
    const res = await worker.fetch(post(form({ website: 'http://spam.example' })), testEnv());
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it('rejects a failed Turnstile check', async () => {
    turnstileOk = false;
    const res = await worker.fetch(post(form()), testEnv());
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/spam check/);
    expect(sent).toHaveLength(0);
  });

  it('rejects a missing Turnstile token', async () => {
    const res = await worker.fetch(post(form({ 'cf-turnstile-response': '' })), testEnv());
    expect(res.status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it('rate-limits by IP', async () => {
    allow = false;
    const res = await worker.fetch(post(form()), testEnv());
    expect(res.status).toBe(429);
    expect(sent).toHaveLength(0);
  });

  it('accepts posts only from mru.space', async () => {
    expect((await worker.fetch(post(form(), { origin: 'https://evil.example' }), testEnv())).status).toBe(403);
    expect((await worker.fetch(post(form(), { origin: null }), testEnv())).status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  it('keeps line breaks out of the headers', async () => {
    await worker.fetch(post(form({ organisation: 'Lab\r\nBcc: victim@example.org' })), testEnv());
    expect(lastHeaders()).not.toMatch(/^Bcc:/m);
    expect(lastHeaders().split('\r\n').every((l) => !l.includes('\n'))).toBe(true);
  });
});

describe('invalid input', () => {
  it('requires a work email, with a message tied to the field', async () => {
    const res = await worker.fetch(post(form({ email: '' })), testEnv());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ field: 'email', error: 'Enter your work email, so we can reply.' });
  });

  it('rejects a malformed email', async () => {
    const res = await worker.fetch(post(form({ email: 'ada@example' })), testEnv());
    expect(((await res.json()) as { field: string }).field).toBe('email');
  });

  it('enforces the field lengths', async () => {
    for (const [field, n] of [['name', 201], ['organisation', 201], ['message', 5001]] as const) {
      const res = await worker.fetch(post(form({ [field]: 'x'.repeat(n) })), testEnv());
      expect(res.status).toBe(400);
      expect(((await res.json()) as { field: string }).field).toBe(field);
    }
    expect(sent).toHaveLength(0);
  });

  it('rejects unknown roles and interests', async () => {
    expect((await worker.fetch(post(form({ role: 'Hacker' })), testEnv())).status).toBe(400);
    expect((await worker.fetch(post(form({ interest: 'prices' })), testEnv())).status).toBe(400);
  });

  it('shows a plain HTML message for a failed plain form post', async () => {
    const res = await worker.fetch(post(form({ email: '' }), { json: false }), testEnv());
    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(await res.text()).toContain('Enter your work email, so we can reply.');
  });
});

describe('routing', () => {
  it('answers the CORS preflight for mru.space only', async () => {
    const pre = (origin: string) =>
      worker.fetch(new Request('https://api.mru.space/request', { method: 'OPTIONS', headers: { Origin: origin } }), testEnv());
    const ok = await pre(ORIGIN);
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect((await pre('https://evil.example')).status).toBe(403);
  });

  it('allows only POST /request', async () => {
    expect((await worker.fetch(new Request('https://api.mru.space/request'), testEnv())).status).toBe(405);
    expect((await worker.fetch(new Request('https://api.mru.space/other', { method: 'POST' }), testEnv())).status).toBe(404);
  });
});
