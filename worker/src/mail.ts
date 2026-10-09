// The plain-text email to contact@mru.space, as a raw RFC 5322 message for
// the send_email binding. Header values are checked for line breaks before
// they get here; the body is base64, so any text is safe.
import { INTERESTS, type RequestFields } from './validate';

/** RFC 2047 encoded-word for non-ASCII header text. */
function header(v: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7e]*$/.test(v)) return v;
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(v)));
  return `=?UTF-8?B?${b64}?=`;
}

function base64Lines(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return (btoa(bin).match(/.{1,76}/g) ?? []).join('\r\n');
}

export function subject(f: RequestFields): string {
  return `Request information: ${INTERESTS[f.interest]} · ${f.organisation || f.name || f.email}`;
}

export function body(f: RequestFields, referer: string, now: Date): string {
  const row = (k: string, v: string) => `${k.padEnd(14)}${v || '(not given)'}`;
  return [
    'A request from the form on mru.space.',
    '',
    row('Name', f.name),
    row('Work email', f.email),
    row('Organisation', f.organisation),
    row('Role', f.role),
    row('Interested in', INTERESTS[f.interest]),
    row('About', f.topic),
    row('Page', f.page || referer),
    row('Referer', referer),
    row('Time (UTC)', now.toISOString().replace('T', ' ').slice(0, 19)),
    '',
    'Message:',
    f.message || '(no message)',
    '',
    '-- ',
    'Reply to this email to answer the requester directly.',
  ].join('\n');
}

export function rawMessage(opts: { from: string; to: string; replyTo: string; subject: string; text: string; now: Date }): string {
  const id = `<${crypto.randomUUID()}@mru.space>`;
  return [
    `From: Mru website <${opts.from}>`,
    `To: <${opts.to}>`,
    `Reply-To: <${opts.replyTo}>`,
    `Subject: ${header(opts.subject)}`,
    `Date: ${opts.now.toUTCString()}`,
    `Message-ID: ${id}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(opts.text),
    '',
  ].join('\r\n');
}
