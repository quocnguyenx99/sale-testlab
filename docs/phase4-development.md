# TestLab V3 database and authentication development

Phase 4 uses MySQL 8 and Prisma. Personas and runtime product data remain filesystem-backed and are not imported into MySQL.

## 1. Start MySQL

Copy `.env.example` to an ignored `.env`, then provide local values for `DATABASE_URL` and the `TESTLAB_MYSQL_*` variables used by `docker-compose.testlab.yml`.

```powershell
docker compose -f docker-compose.testlab.yml up -d
```

Do not commit `.env` or database credentials.

## 2. Apply migrations

```powershell
npm run db:generate
npm run db:migrate
```

`db:migrate` uses committed migrations and does not modify runtime data files.

## 3. Bootstrap the development user

Set these process environment variables without writing them to source:

- `DEV_BOOTSTRAP_EMAIL`
- `DEV_BOOTSTRAP_PASSWORD` (minimum 10 characters)
- `DEV_BOOTSTRAP_DISPLAY_NAME`

Then run:

```powershell
npm run db:bootstrap
```

This is `DEV_BOOTSTRAP_ONLY`. The command hashes the supplied password with bcrypt before writing it. It never stores the plaintext password.

## 4. Start the application

```powershell
npm run playground
npm --prefix apps/sales-web run dev
```

The browser receives only an opaque `HttpOnly`, `SameSite=Lax` cookie. The raw token is not stored in browser storage or in MySQL; MySQL stores its SHA-256 hash.

## 5. Database integration tests

Use a dedicated disposable database configured through `DATABASE_URL`:

```powershell
npm run test:v3-db
```

The integration suite clears its target database tables. Never point this command at a shared or production database.
