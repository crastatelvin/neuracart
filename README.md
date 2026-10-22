# LocalMart

**Your neighbourhood market, delivered.**

LocalMart is a full-stack grocery delivery platform for a single neighbourhood store selling **fruits, vegetables, and meat** in Bengaluru. Four apps work together end to end:

| App | Stack | Status |
|---|---|---|
| **Customer mobile** | Expo SDK 57, React Native, NativeWind, Expo Router, Zustand | Scaffold ready; auth/home/cart next |
| **Backend API** | Node.js, Express 5, TypeScript, Prisma 5.22, PostgreSQL | Auth, catalog, addresses, seed data, and 11-table schema ready; orders next |
| **Admin panel** | Next.js, Tailwind CSS, Axios | Not started |
| **Delivery app** | Expo, React Native, NativeWind | Not started |

## Documentation

- **[`plan.md`](./plan.md)** — the complete A-to-Z product, architecture, schema, API, screen, testing, and deployment plan. This is the single source of truth.
- **[`architecture.md`](./architecture.md)** — system architecture diagram.
- **[`docs/source/design-plan.md`](./docs/source/design-plan.md)** — original design-image notes (historical; the product was called LocalCart then).

## Repository layout

This repo currently uses a **flat layout**, not a workspace monorepo:

```text
localmart/
├── src/                    # Customer Expo app (Expo Router routes in src/app/)
├── backend/                # Express + Prisma API
│   ├── prisma/             # schema, migrations, seed
│   ├── src/                # API source (being built)
│   ├── logs/               # runtime logs (gitignored)
│   └── uploads/            # local product images (gitignored)
├── admin/                  # Next.js admin (to be created)
├── delivery/               # Expo delivery app (to be created)
├── plan.md
├── architecture.md
└── docker-compose.yml      # local PostgreSQL 18
```

Path mapping to the target monorepo described in `plan.md`: `apps/customer` → repo root, `apps/api` → `backend/`, `apps/admin` → `admin/`, `apps/delivery` → `delivery/`.

## Quick start

### Prerequisites

- Node.js 20 LTS + npm
- Docker (for PostgreSQL)
- Expo Go on a phone, or an iOS/Android simulator
- A Resend API key for OTP email (optional until auth is built)

### 1. Install

```bash
npm install
cd backend && npm install && cd ..
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL 18 with database/user/password all set to `localmart`.

### 3. Configure the API

```bash
cp backend/.env.example backend/.env
# edit JWT secrets and RESEND_API_KEY
```

### 4. Migrate and seed

```bash
cd backend
npx prisma generate
npx prisma migrate dev
cd ..
```

Seeding will be added with the backend foundation (`npm run db:seed` in `backend/`).

### 5. Run

```bash
# Terminal 1 — API (http://localhost:8000)
cd backend && npm run dev

# Terminal 2 — customer app (http://localhost:8081)
npm start
```

On a physical phone, set `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8000` in the Expo environment; `localhost` points to the phone itself.

## Working agreement

- **Commit and push after every completed, verified step.** No batching days of work into one commit.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Run `npm run lint`, `npm run typecheck` (customer) and `npm run typecheck` (backend) before committing.
- Never commit `.env`, secrets, `node_modules/`, logs, or uploads.
- Update `plan.md` when a decision changes; the plan is the contract.

## Current milestone

**M2 — Catalog and addresses done.** Product CRUD with Sharp image uploads, public filtering/search, admin guards, and address ownership/default promotion are working. Next: the order transaction and delivery/admin APIs.

## License

Private project. See [`LICENSE`](./LICENSE).
