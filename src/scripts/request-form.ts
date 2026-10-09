// Progressive enhancement for the request-information form. Without this
// script the form still posts, and the Worker redirects to /contact/sent/.
import { LIMITS } from '../config/form';

interface Turnstile {
  render: (el: Element, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
    __mruTurnstileReady?: () => void;
  }
}

// Turnstile loads only when a form comes near the screen, and runs in
// "interaction-only" mode: most visitors never see it. The token lands in a
// hidden cf-turnstile-response field inside the form.
let turnstileLoad: Promise<Turnstile> | null = null;
function loadTurnstile(): Promise<Turnstile> {
  turnstileLoad ??= new Promise((resolve, reject) => {
    window.__mruTurnstileReady = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('no turnstile')));
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__mruTurnstileReady';
    s.async = true;
    s.onerror = () => reject(new Error('turnstile failed to load'));
    document.head.append(s);
  });
  return turnstileLoad;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CONTACT = 'contact@mru.space';

type FieldName = 'name' | 'email' | 'organisation' | 'message';

function validate(data: FormData): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  const get = (k: string) => String(data.get(k) ?? '').trim();
  const email = get('email');
  if (!email) errors.email = 'Enter your work email, so we can reply.';
  else if (!EMAIL.test(email) || email.length > LIMITS.email)
    errors.email = 'This email address looks incomplete. Check it and try again.';
  if (get('name').length > LIMITS.name) errors.name = `Keep the name to ${LIMITS.name} characters or fewer.`;
  if (get('organisation').length > LIMITS.organisation)
    errors.organisation = `Keep the organisation to ${LIMITS.organisation} characters or fewer.`;
  if (get('message').length > LIMITS.message)
    errors.message = `Keep the message to ${LIMITS.message.toLocaleString('en')} characters or fewer.`;
  return errors;
}

function showErrors(form: HTMLFormElement, errors: Partial<Record<FieldName, string>>): boolean {
  let first: HTMLElement | null = null;
  for (const name of ['name', 'email', 'organisation', 'message'] as FieldName[]) {
    const input = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
    const slot = form.querySelector<HTMLElement>(`#req-err-${name}`);
    if (!input || !slot) continue;
    const msg = errors[name];
    slot.textContent = msg ?? '';
    slot.hidden = !msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg && !first) first = input;
  }
  first?.focus();
  return first !== null;
}

function setStatus(form: HTMLFormElement, msg: string | null) {
  const box = form.querySelector<HTMLElement>('[data-req-error]');
  if (!box) return;
  box.textContent = msg ?? '';
  box.hidden = !msg;
}

export function initRequestForms(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-req]')) {
    const form = root.querySelector<HTMLFormElement>('[data-req-form]');
    const sent = root.querySelector<HTMLElement>('[data-req-sent]');
    const again = root.querySelector<HTMLButtonElement>('[data-req-again]');
    if (!form || !sent) continue;
    form.noValidate = true;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');

    const box = form.querySelector<HTMLElement>('[data-turnstile]');
    let widget: string | undefined;
    let token: Promise<string> | null = null;
    let settle: ((t: string) => void) | null = null;
    const arm = () => {
      token = new Promise((r) => (settle = r));
    };
    arm();
    const start = () => {
      if (!box || widget !== undefined) return;
      widget = '';
      loadTurnstile()
        .then((ts) => {
          widget = ts.render(box, {
            sitekey: box.dataset.turnstile,
            appearance: 'interaction-only',
            theme: 'auto',
            size: 'flexible',
            callback: (t: string) => settle?.(t),
          });
        })
        .catch(() => settle?.(''));
    };
    if (box) {
      const io = new IntersectionObserver((e) => {
        if (e.some((x) => x.isIntersecting)) {
          io.disconnect();
          start();
        }
      }, { rootMargin: '600px' });
      io.observe(form);
      form.addEventListener('focusin', start, { once: true });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus(form, null);
      const data = new FormData(form);
      if (showErrors(form, validate(data))) return;
      if (submit) submit.disabled = true;
      if (box) {
        start();
        // Wait for the spam check, at most 15 s.
        const t = await Promise.race([token!, new Promise<string>((r) => setTimeout(() => r(''), 15000))]);
        if (!t) {
          setStatus(form, `The spam check did not load. Reload the page and try again, or write to ${CONTACT}.`);
          if (submit) submit.disabled = false;
          return;
        }
        data.set('cf-turnstile-response', t);
      }
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          body: new URLSearchParams(data as unknown as Record<string, string>),
          headers: { Accept: 'application/json' },
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string; field?: FieldName };
        if (res.ok) {
          form.hidden = true;
          sent.hidden = false;
          sent.focus();
        } else if (body.field && body.error) {
          showErrors(form, { [body.field]: body.error });
        } else if (res.status === 429) {
          setStatus(form, `Too many requests from this network. Try again in a few minutes, or write to ${CONTACT}.`);
        } else {
          setStatus(form, body.error ?? `The request did not send. Try again, or write to ${CONTACT}.`);
        }
      } catch {
        setStatus(form, `The request did not send. Check your connection and try again, or write to ${CONTACT}.`);
      } finally {
        if (submit) submit.disabled = false;
        // A token is good for one use: get a fresh one for "Send another".
        if (widget) {
          arm();
          window.turnstile?.reset(widget);
        }
      }
    });

    again?.addEventListener('click', () => {
      form.reset();
      showErrors(form, {});
      sent.hidden = true;
      form.hidden = false;
      (form.elements.namedItem('name') as HTMLInputElement | null)?.focus();
    });
  }
}
