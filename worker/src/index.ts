// api.mru.space/request: the request-information form. POST only.
// - JSON reply for fetch() (Accept: application/json), 303 to the "sent"
//   page for a plain form post, plain 4xx messages otherwise.
// - Checks: origin, rate limit, honeypot, Turnstile, fields.
// - Sends one plain-text email to contact@mru.space through Resend, with
//   Reply-To set to the requester.
// - Turnstile needs JavaScript. A plain form post (JS off) without a token is
//   still accepted, behind the honeypot, origin check and rate limit, and its
//   subject is marked "[Unverified, no JS]". A fetch() without a token fails.
import { parse, type FieldError } from './validate';
import { body, send, subject } from './mail';

const MAX_BODY = 32 * 1024;

function wantsJson(req: Request): boolean {
  return (req.headers.get('Accept') ?? '').includes('application/json');
}

function cors(env: Env, origin: string | null): Record<string, string> {
  return origin === env.ALLOWED_ORIGIN
    ? { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN, Vary: 'Origin' }
    : { Vary: 'Origin' };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A small, readable error page for a plain form post (no JS on the site). */
function errorPage(env: Env, status: number, message: string): Response {
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Request not sent · Mru Aerospace</title><meta name="robots" content="noindex">
<style>body{margin:0;background:#fafaf8;color:#16161a;font:19px/1.66 Charter,"Source Serif 4",Georgia,serif}
main{max-width:640px;margin:0 auto;padding:96px 24px}h1{font:500 39px/1.1 Futura,Jost,"Century Gothic",sans-serif;margin:0 0 24px}
p{margin:0 0 16px}a{color:#3a4a5a}@media (prefers-color-scheme:dark){body{background:#121214;color:#ecece8}a{color:#9fb4cb}}</style>
<main><h1>Request not sent</h1><p>${esc(message)}</p>
<p><a href="${env.FORM_URL}">Go back to the form</a>, or write to <a href="mailto:${env.MAIL_TO}">${env.MAIL_TO}</a>.</p></main></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function fail(req: Request, env: Env, status: number, e: FieldError | { error: string; field?: undefined }): Response {
  if (wantsJson(req))
    return Response.json(e, { status, headers: { ...cors(env, req.headers.get('Origin')), 'Cache-Control': 'no-store' } });
  return errorPage(env, status, e.error);
}

function ok(req: Request, env: Env): Response {
  if (wantsJson(req))
    return Response.json({ ok: true }, { headers: { ...cors(env, req.headers.get('Origin')), 'Cache-Control': 'no-store' } });
  return new Response(null, { status: 303, headers: { Location: env.SENT_URL } });
}

export async function verifyTurnstile(secret: string, token: string, ip: string | null): Promise<boolean> {
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  if (ip) form.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin');

    if (url.pathname !== '/request') return new Response('Not found', { status: 404 });
    if (req.method === 'OPTIONS') {
      if (origin !== env.ALLOWED_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          ...cors(env, origin),
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    if (req.method !== 'POST')
      return new Response('Use POST.', { status: 405, headers: { Allow: 'POST, OPTIONS' } });

    // Browsers send Origin with every form post and fetch. Only the site may post.
    if (origin !== env.ALLOWED_ORIGIN)
      return fail(req, env, 403, { error: 'Requests are accepted only from the form on mru.space.' });

    const ip = req.headers.get('CF-Connecting-IP');
    const { success: allowed } = await env.RATE_LIMIT.limit({ key: ip ?? 'unknown' });
    if (!allowed)
      return fail(req, env, 429, {
        error: `Too many requests from this network. Try again in a few minutes, or write to ${env.MAIL_TO}.`,
      });

    const type = req.headers.get('Content-Type') ?? '';
    if (!/^(application\/x-www-form-urlencoded|multipart\/form-data)/.test(type))
      return fail(req, env, 415, { error: 'Send the form as a form post.' });
    if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BODY)
      return fail(req, env, 413, { error: 'The request is too large. Shorten the message and try again.' });

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail(req, env, 400, { error: 'The form could not be read. Try again.' });
    }

    // Honeypot: people never see this field. Answer as if it worked, send nothing.
    if (String(form.get('website') ?? '').trim() !== '') return ok(req, env);

    if (!env.TURNSTILE_SECRET || !env.RESEND_API_KEY)
      return fail(req, env, 503, { error: `The form is not available right now. Write to ${env.MAIL_TO}.` });
    const token = String(form.get('cf-turnstile-response') ?? '');
    const plainPost = !wantsJson(req);
    let verified = false;
    if (token) {
      verified = await verifyTurnstile(env.TURNSTILE_SECRET, token, ip);
      if (!verified) return fail(req, env, 400, { error: 'The spam check did not pass. Reload the page and try again.' });
    } else if (!plainPost) {
      return fail(req, env, 400, { error: 'The spam check did not pass. Reload the page and try again.' });
    }

    const fields = parse(form);
    if ('error' in fields) return fail(req, env, 400, fields);

    const now = new Date();
    const referer = req.headers.get('Referer') ?? '';
    try {
      await send(env.RESEND_API_KEY, {
        from: env.MAIL_FROM,
        to: env.MAIL_TO,
        replyTo: fields.email,
        subject: subject(fields, verified),
        text: body(fields, referer, now),
      });
    } catch (e) {
      console.error('send failed', e);
      return fail(req, env, 502, { error: `The request did not send. Try again, or write to ${env.MAIL_TO}.` });
    }
    return ok(req, env);
  },
} satisfies ExportedHandler<Env>;
