# API

Open `/api/docs/` for Swagger and `/api/openapi.json` for the generated request contract. Endpoints below use the `/api/v1` prefix. Mutating browser calls send JSON with the configured Origin. Send an empty object for refresh, logout, link creation, or disconnection. Protected calls use `Authorization: Bearer <accessToken>`.

| Endpoint | Behavior |
| --- | --- |
| GET /auth/features | Usable Google, email, login OTP, and Telegram flags |
| POST /auth/register | Accept name, email and password and request verification |
| POST /auth/verify-email | Confirm email and code |
| POST /auth/resend-verification | Request another code with a generic response |
| POST /auth/login | Return an access token and refresh cookie or `otpRequired` |
| POST /auth/login/verify | Verify email, password and optional login code |
| POST /auth/refresh | Rotate the cookie and return an access token |
| POST /auth/logout | Revoke the cookie session and clear the cookie |
| GET /auth/me | Current user and grants |
| POST /auth/forgot-password | Request a reset code with a generic response |
| POST /auth/reset-password | Submit email, valid code, and new password in one operation |
| GET /auth/google | Redirect to Google when available |
| GET /auth/google/callback | Verify the callback and redirect to dashboard or sign-in |
| GET /users/me | Current profile |
| PATCH /users/me | Update name and email opt-in |
| GET /users | Latest 50 users with `users.read` |
| POST /integrations/telegram/link | Create a private bot connection URL |
| DELETE /integrations/telegram/link | Disconnect the current user |
| POST /integrations/telegram/webhook | Handle a Telegram update with the webhook secret |
| POST /chatbot/message | Authenticated support question, up to 500 characters |

`/health` reports process liveness. `/ready` checks the database and baseline role migration. Both also have `/api`-prefixed aliases. API errors contain `error.code`, `error.message`, and `error.requestId`. Concurrent refresh can return `409 ROTATION_CONFLICT`. The browser refreshes once and retries the original protected request when it receives a 401.

