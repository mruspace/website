// Secrets, set with `wrangler secret put`. They are not in wrangler.jsonc.
interface Env {
  TURNSTILE_SECRET?: string;
  RESEND_API_KEY?: string;
}
