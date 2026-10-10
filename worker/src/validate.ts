// Field checks for the request form. Limits match the site's form.

export const LIMITS = { name: 200, organisation: 200, message: 5000, email: 254, topic: 200 } as const;

export const INTERESTS = {
  field: 'Mru Field · Earth',
  flight: 'Mru Flight · space',
  research: 'Research or partnership',
  other: 'Something else',
} as const;
export type Interest = keyof typeof INTERESTS;

export const ROLES = [
  'Program or mission lead',
  'Engineering',
  'Operations',
  'Business or procurement',
  'Research',
  'Other',
] as const;

/** Old role labels from pages a browser may still have cached, mapped to the current label. */
const LEGACY_ROLES: Record<string, string> = { 'Programme or mission lead': 'Program or mission lead' };

export interface RequestFields {
  name: string;
  email: string;
  organisation: string;
  role: string;
  interest: Interest;
  message: string;
  topic: string;
  page: string;
}

export type FieldName = 'name' | 'email' | 'organisation' | 'message' | 'role' | 'interest' | 'topic';
export interface FieldError {
  field: FieldName;
  error: string;
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

/** Collapse whitespace and remove control characters (keeps newlines in the message). */
const line = (v: string) =>
  v
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const text = (v: string) =>
  v
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();

const legacyRole = (r: string) => LEGACY_ROLES[r] ?? r;

export function parse(form: FormData): RequestFields | FieldError {
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' ? v : '';
  };
  const f: RequestFields = {
    name: line(get('name')),
    email: line(get('email')),
    organisation: line(get('organisation')),
    role: legacyRole(line(get('role'))),
    interest: line(get('interest')) as Interest,
    message: text(get('message')),
    topic: line(get('topic')),
    page: line(get('page')),
  };
  if (!f.email) return { field: 'email', error: 'Enter your work email, so we can reply.' };
  if (f.email.length > LIMITS.email || !EMAIL.test(f.email))
    return { field: 'email', error: 'This email address looks incomplete. Check it and try again.' };
  if (f.name.length > LIMITS.name)
    return { field: 'name', error: `Keep the name to ${LIMITS.name} characters or fewer.` };
  if (f.organisation.length > LIMITS.organisation)
    return { field: 'organisation', error: `Keep the organization to ${LIMITS.organisation} characters or fewer.` };
  if (f.message.length > LIMITS.message)
    return {
      field: 'message',
      error: `Keep the message to ${LIMITS.message.toLocaleString('en')} characters or fewer.`,
    };
  if (f.topic.length > LIMITS.topic) return { field: 'topic', error: 'The topic is too long.' };
  if (f.role && !(ROLES as readonly string[]).includes(f.role))
    return { field: 'role', error: 'Choose a role from the list.' };
  if (!f.interest) f.interest = 'other';
  if (!(f.interest in INTERESTS)) return { field: 'interest', error: 'Choose what you are interested in.' };
  return f;
}
