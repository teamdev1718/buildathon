# Buildathon starter instructions

Use Node 24 and the root npm workspaces. Keep Express on the same production origin as Vite's bundle. Keep API requests relative and register new API routes before the SPA fallback.

- Build feature slices under `backend/src/modules` and `frontend/src/features`. Use the existing route helper with strict Zod request validation and a short OpenAPI summary. Keep HTTP handlers thin and business logic in services. Import each route module in `backend/src/app.ts`.
- Update `backend/prisma/schema.prisma` and use `npm exec -w backend -- prisma migrate dev --name <name>` with a disposable development database. Review and commit the SQL and lockfile. Use `npm run db:migrate` on deployed databases. Keep application tables private and coordinate backward-compatible schema changes during deploys.
- Add React Router screens in `frontend/src/pages` and wire them in `frontend/src/main.tsx`. Use the shared API client, auth context, and form controls.
- Apply `requireAuth` on protected routes and `requirePermission` or `requireRole` where privileges are needed. Check resource ownership in the service. Use the existing refresh cookie and JWT flow. Treat credentials and OTPs as secrets and keep them out of logs.
- Call `notificationService.send` with a stable key per logical notification. Respect email and Telegram opt-in. Handle provider status in calling code. Extend `faq.ts` for domain support and keep any Gemini instructions free of private data.
- Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Use `npm run test:integration` against a migrated disposable loopback PostgreSQL database ending in `_test`. Add tests for new flows and authorization boundaries.
- Render builds via `npm run build:deploy` and starts via `npm run start:deploy`. Follow `docs/DEPLOYMENT.md` for configuration and the browser smoke test.

