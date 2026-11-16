# Baseline verification

Verified locally on Windows with Node 24.18.0 and a disposable PostgreSQL 17 instance.

| Check | Result |
| --- | --- |
| Clean locked install and Render build command | Passed. Compiled Express and Vite assets generated |
| Type checking and ESLint | Passed |
| npm dependency audit | Reported zero vulnerabilities for this lockfile |
| Prisma migration | Applied to an empty database. Second run reported no pending migrations |
| Unit tests | 5 passed |
| PostgreSQL integration tests | 3 passed. Covered health, readiness, React deep links, JSON API 404, registration, OTP, refresh rotation, logout, password reset, RBAC, FAQ, Telegram webhook verification and deduplication, and Google callback configuration |
| Local development | Vite served the frontend and proxied an API request to Express |
| Compiled backend entry point | Started and returned ready with the migrated database |
| Chromium over local HTTPS | Direct dashboard visit, registration, email verification, ordinary password login, secure HttpOnly refresh cookie, rotation after reload, FAQ, logout, and password reset passed. Resend requests used a local test stub |

Live validation requires an existing Render service and the intended Supabase database. The Gmail replacement has mocked HTTPS provider tests. Real Gmail delivery, Google's sign-in authorization-code exchange and successful callback, Telegram API delivery, and Gemini calls require live verification. Use the steps in [Deployment](DEPLOYMENT.md) on the actual HTTPS origin before tagging the competition baseline.

