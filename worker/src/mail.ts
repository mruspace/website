// The plain-text email to contact@mru.space. Field values have no line
// breaks or control characters by the time they get here (validate.ts).
import { INTERESTS, type RequestFields } from './validate';

export function subject(f: RequestFields, verified = true): string {
  const s = `Request information: ${INTERESTS[f.interest]} · ${f.organisation || f.name || f.email}`;
  return verified ? s : `[Unverified, no JS] ${s}`;
}

export function body(f: RequestFields, referer: string, now: Date): string {
  const row = (k: string, v: string) => `${k.padEnd(14)}${v || '(not given)'}`;
  return [
    'A request from the form on mru.space.',
    '',
    row('Name', f.name),
    row('Work email', f.email),
    row('Organization', f.organisation),
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

/** Send with the Resend API. Returns Resend's message id. */
export async function send(
  key: string,
  msg: { from: string; to: string; replyTo: string; subject: string; text: string },
): Promise<string> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: msg.from, to: [msg.to], reply_to: msg.replyTo, subject: msg.subject, text: msg.text }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !data.id) throw new Error(`Resend ${res.status}: ${data.message ?? 'no id'}`);
  return data.id;
}
