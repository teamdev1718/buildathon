# Buildathon Starter

React and Express share one Render Web Service and one production URL. Express owns authentication and serves the Vite build. Prisma connects to Supabase PostgreSQL.

## Local setup

Use Node 24 and npm. Commands below work in Git Bash from the repository root.

```bash
npm ci
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
node -e 'console.log(require("node:crypto").randomBytes(48).toString("base64url"))'
```

Run the secret command separately for `JWT_SECRET`, `OTP_SECRET`, and the optional `MOCK_INBOX_KEY`. Set `DATABASE_URL` and `DIRECT_URL` for a development database before running these commands.

```bash
npm run db:migrate
npm run db:generate -w backend
npm run dev
```

Open http://localhost:5173. Vite proxies relative `/api` requests to port 4000. With `EMAIL_PROVIDER=mock` and a configured mock inbox key, read messages from a trusted terminal on your own computer. Replace the example recipient with the address you registered.

```bash
read -rs -p "Mock inbox key: " inbox_key
echo
curl --get http://localhost:4000/api/dev/inbox \
  --data-urlencode 'email=you@example.com' -H "X-Mock-Inbox-Key: $inbox_key"
unset inbox_key
```

The mock inbox keeps the latest 100 messages in process memory. Use a private terminal because this command prints development codes. The route is only registered in development mode.

To grant yourself ADMIN locally, register and verify your account, set `DEV_SEED_ADMIN_EMAIL`, then run `npm run db:seed`.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For integration tests, create a disposable loopback PostgreSQL database with a name ending in `_test`. Use its URL for all three variables below. Local PostgreSQL can be installed directly. GitHub Actions runs the tests against a disposable PostgreSQL service.

```bash
export TEST_DATABASE_URL='postgresql://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/buildathon_test'
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npm run db:migrate
npm run test:integration
```

To exercise the compiled single-service build locally, set `APP_ORIGIN=http://localhost:4000` and use `npm start`, then open port 4000. This uses development cookie settings. The production browser check uses HTTPS and the production settings in the deployment guide.

## Project layout

```text
frontend/src/         React screens, context, API client, chat widget
backend/src/          Express API, auth, RBAC, provider modules, SPA hosting
backend/prisma/       Private PostgreSQL schema, migrations, development seed
backend/test/         Unit and PostgreSQL integration tests
docs/                 API, deployment, competition runbook, team templates
.github/workflows/    CI
render.yaml          Single-service Render Blueprint
```

- [Deployment and provider configuration](docs/DEPLOYMENT.md)
- [Baseline verification](docs/VERIFICATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API contract](docs/API.md)
- [Four-hour runbook](docs/BUILDATHON_RUNBOOK.md)
- [Research template](docs/RESEARCH_TEMPLATE.md)
- [UI/UX template](docs/UIUX_TEMPLATE.md)
- [QA template](docs/QA_TEMPLATE.md)
- [Agent instructions](AGENTS.md)

## Preserve the baseline

Review and commit the working tree in your existing GitHub repo once the smoke checks pass. Tag the verified commit and push the tag. Continue competition work on your normal branch in the same repository.

```bash
git tag -a starter-baseline -m "Verified buildathon starter foundation"
git push origin starter-baseline
```

