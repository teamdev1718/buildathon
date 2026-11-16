# Deployment

## Supabase PostgreSQL

Use the connection information under **Connect** in your Supabase project. Keep development and deployment databases separate. Use the **Session pooler** URI on port **5432** for `DATABASE_URL` and, on an IPv4-only host, for `DIRECT_URL` as well. The direct URI is suitable for `DIRECT_URL` when the host can reach its IP family. Use TLS on hosted connections (for example, `sslmode=require` with your provider's connection options). Percent-encode reserved characters in the database password. Prisma v7 CLI reads `DIRECT_URL` from `backend/prisma.config.ts` and the application uses `DATABASE_URL` through the PostgreSQL driver adapter. [Supabase Prisma guide](https://supabase.com/docs/guides/database/prisma) · [Prisma v7 connection configuration](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections)

Keep `app_private` outside the exposed Data API schemas. Prisma stores its migration history in that schema. The migration owner needs rights to create the schema and run DDL. You can use a separate application DB role for runtime by granting it USAGE on `app_private`, SELECT/INSERT/UPDATE/DELETE on its application tables, and suitable default privileges for future application tables. Keep migrations on the owner URI and avoid granting access to `anon` and `authenticated`. Express authorization is independent of the Data API.

## Render Web Service

Connect the single GitHub repository to an existing or explicitly approved Render Web Service. Apply `render.yaml` or configure the equivalent fields manually.

| Setting | Value |
| --- | --- |
| Root directory | Repository root, leave Render's root directory field blank |
| Runtime | Node 24 via `.node-version` |
| Build command | `npm run build:deploy` |
| Start command | `npm run start:deploy` |
| Health check | `/ready` |
| Plan | Free for the competition demo if appropriate |

The build runs `npm ci --include=dev`, builds both workspaces, and writes React assets to `frontend/dist`. The start command uses Prisma `migrate deploy`, then launches compiled Express on `0.0.0.0:$PORT`. Prisma tracks applied migrations and takes an advisory lock. Keep migrations compatible with an older running release until the new instance is healthy. If migration fails, inspect the migration and logs before retrying. Use Prisma migration resolution for failed migrations when appropriate. Free web services spin down after idle periods, so allow for cold starts in the browser and Telegram webhook delivery. Render's paid pre-deploy command is optional if you later move plans. [Render deployment commands](https://render.com/docs/deploys) · [Render free service limitations](https://render.com/docs/free)

Set these environment variables in Render:

| Variable | Setting |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_ORIGIN` | Exact public HTTPS origin, such as `https://your-service.onrender.com` |
| `TRUST_PROXY_HOPS` | `1` for the direct Render proxy configuration. Reassess when a different proxy chain is added |
| `DATABASE_URL`, `DIRECT_URL` | Supabase session/runtime and migration URIs above |
| `JWT_SECRET`, `OTP_SECRET` | Separate random secrets of at least 32 characters |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | `gmail`, sender mailbox address, and Gmail OAuth credentials |
| `ENABLE_LOGIN_OTP` | `false` by default. Set `true` for an email code after password login |
| `ENABLE_GOOGLE_AUTH`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | See Google section |
| `ENABLE_TELEGRAM`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | See Telegram section |
| `CHATBOT_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL` | FAQ is the default. See Gemini section |

Render injects `PORT`. The frontend needs no deployed environment variables. A push runs GitHub Actions and may trigger a Render deployment separately. Configure Render **After CI Checks Pass** if you want CI to gate automatic deployment.

## Gmail API email delivery

Use a Gmail mailbox you control as the sender. The app can remain on its Render subdomain. The mailbox owner grants the backend send access once. Recipients need no Google authorization to receive emails.

1. Enable **Gmail API** in the Google Cloud project for your sender. Set up Google Auth Platform and create a **Web application** OAuth client for sending. Add `https://developers.google.com/oauthplayground` to this client's **Authorized redirect URIs**.
2. Open [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/). In the settings gear, select **Use your own OAuth credentials** and enter the Gmail sender client's ID and secret. Use **Access type → Offline**.
3. Enter the custom scope `https://www.googleapis.com/auth/gmail.send`, click **Authorize APIs**, and sign in as the sender mailbox. Exchange the authorization code for tokens and copy the **refresh token**. If the OAuth app is in External Testing, add the sender to **Audience → Test users**. Refresh tokens for this scope expire after seven days in External Testing. Set up the appropriate publishing and verification status for ongoing deployment. [Google OAuth token expiration](https://developers.google.com/identity/protocols/oauth2#expiration)
4. In Render, set `EMAIL_PROVIDER=gmail`, `EMAIL_FROM` to the exact mailbox address, and add `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN`. Remove the obsolete `RESEND_API_KEY` if present, save, and redeploy. A deployment still configured with the old email provider setting starts with email disabled until switched to Gmail.
5. Register with an inbox you can check and complete email verification and password reset. Check the Gmail sender and recipient inboxes during live testing.

Gmail accepts MIME messages over HTTPS. The service avoids automatic replay of a failed send because Gmail may have already accepted the message. Ask for a fresh code after a delivery failure. Missing provider configuration returns a 503 for email-dependent requests. [Gmail send endpoint](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send)

## Google OAuth

Use the Gmail **Web application** OAuth client or create a separate Web application client for sign-in. On the client you use, register exactly `https://your-service.onrender.com/api/v1/auth/google/callback` under **Authorized redirect URIs**. If you are using the Gmail client, add it alongside the Playground redirect. For Vite development add `http://localhost:5173/api/v1/auth/google/callback`.

Set `ENABLE_GOOGLE_AUTH=true` and set `GOOGLE_CALLBACK_URL` to the exact callback. Leave both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` blank to reuse the Gmail OAuth client. Set both to use a dedicated sign-in client. The sign-in flow requests only `openid`, `email`, and `profile`, and keeps the Gmail refresh token in the email provider. Google sign-in uses PKCE, state, nonce, and a verified email claim. When a password account already uses the address, sign in with its existing method. The starter creates new Google accounts and reuses them by Google subject. [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)

## Telegram

Create the bot in BotFather. Set the token and username without the @ prefix. Use a random URL-safe `TELEGRAM_WEBHOOK_SECRET` of at least 16 characters. After the service is reachable, call the Bot API's `setWebhook` with `url` equal to `https://your-service.onrender.com/api/v1/integrations/telegram/webhook`, `secret_token` equal to the configured secret, and `allowed_updates` set to `["message"]`. Check `getWebhookInfo` and try the profile connection flow and bot commands. Keep the bot token private when invoking these methods. [Telegram Bot API](https://core.telegram.org/bots/api#setwebhook)

## Gemini

To enable Gemini, set `CHATBOT_PROVIDER=gemini`, `GEMINI_API_KEY`, and the bare supported model ID in `GEMINI_MODEL`. Confirm the model is available for your account, region, and quota before enabling it. A service-level timeout, output cap, and request limit apply. Missing or failed Gemini calls fall back to the built-in FAQ. [Gemini generateContent API](https://aistudio.google.com/api-reference/generate-content)

## Live verification

1. Check `/health`, `/ready`, and `/api/openapi.json`. Confirm an unknown `/api/v1` URL returns JSON 404.
2. Open a private browser window on the Render origin. Visit `/login` directly, register a test account, and verify its email.
3. Sign in. Confirm the browser stores a Secure, HttpOnly, host-only `__Host-refresh` cookie. Open `/dashboard` directly and reload. Confirm the refresh request rotates the cookie.
4. Sign out and confirm a direct dashboard visit goes to sign-in. Reset the password and verify previously signed-in sessions are revoked.
5. Exercise Google sign-in and callback from the production URL. Check real email delivery, Telegram opt-in and delivery, and Gemini only for configured providers.
6. Confirm the USER role is denied by `GET /api/v1/users`. Verify ADMIN access with an authorized test account.

To grant the first ADMIN role, register and verify the intended account. A database operator can then run the following in the Supabase SQL editor after replacing the example with the exact normalized email. Verify the returned row belongs to the intended user.

```sql
INSERT INTO "app_private"."UserRole" ("userId", "roleName")
SELECT "id", 'ADMIN' FROM "app_private"."User"
WHERE "email" = 'admin@example.com' AND "verifiedAt" IS NOT NULL
ON CONFLICT DO NOTHING
RETURNING "userId", "roleName";
```

