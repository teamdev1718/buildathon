# Architecture

Vite is the local development entry point. Express is the production entry point and serves the compiled React bundle after the API and API 404 routes. React Router owns browser views. The browser sends relative requests to `/api/v1` and uses no database credentials.

Route declarations validate JSON with Zod and register the request schemas in OpenAPI. Express handlers call module services. Prisma owns runtime data access and migrations. The `app_private` PostgreSQL schema contains application tables and remains outside the Supabase Data API.

Access JWTs live in React process memory and expire after ten minutes. An opaque, hashed refresh credential rotates on every refresh and expires after 14 days. Authenticated requests check the live session and permissions. A stale previous token has a five-second concurrent-rotation grace window before observed replay revokes the session. Sign-out revokes that session. Password reset consumes its OTP and revokes all sessions in the same database transaction. Email OTP codes expire after ten minutes, allow five attempts, and are HMAC-protected. Replaceable codes have a one-minute resend cooldown.

Production cookies are secure, host-only, HttpOnly, and SameSite=Lax. Mutating API requests require JSON and the exact configured origin. Telegram uses its webhook secret in place of the browser origin check. The disallowed origin has no credentialed CORS policy. Google checks browser-bound state, PKCE and nonce.

Notifications reserve a unique database key before calling the provider. Records distinguish mock, provider acceptance, failure, and pending status. An interrupted send may leave pending status and requires review before a deliberate retry. Telegram webhook updates are claimed transactionally before replying. This provides at-most-once dispatch across webhook and notification retries. Extend with an outbox if you need durable delivery and reconciliation.

Recovery and resend requests acknowledge before looking up the account or waiting for the email provider. Delivery is retriable via the code request flow if the process stops before sending.

FAQ entries are local code. The optional Gemini path sends only the bounded question and the public FAQ instructions. It has no application tools or database access. Model text is rendered as plain text. In-process rate limits suit a single demo instance. Use a shared store if deploying multiple instances, and review provider quotas and data retention before expanding traffic.

