// Request-information form settings. Both values are public by design: the
// endpoint is the Worker in worker/, and a Turnstile site key is meant to be
// embedded in pages. The Turnstile secret lives only in Wrangler secrets.
export const FORM = {
  action: 'https://api.mru.space/request',
  sentPath: '/contact/sent/',
  /** Set once the Turnstile widget exists. Empty: no widget is rendered. */
  turnstileSiteKey: '0x4AAAAAAFSTnXowuNbrNuJ8',
} as const;

export type Interest = 'field' | 'flight' | 'research' | 'other';

export const INTERESTS: { id: Interest; label: string }[] = [
  { id: 'field', label: 'Mru Field · Earth' },
  { id: 'flight', label: 'Mru Flight · space' },
  { id: 'research', label: 'Research or partnership' },
  { id: 'other', label: 'Something else' },
];

export const ROLES = [
  'Program or mission lead',
  'Engineering',
  'Operations',
  'Business or procurement',
  'Research',
  'Other',
] as const;

export const LIMITS = { name: 200, organisation: 200, message: 5000, email: 254 } as const;
