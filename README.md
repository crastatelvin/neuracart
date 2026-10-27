# LocalMart

**Your neighbourhood market, delivered.**

LocalMart is a full-stack grocery delivery platform for a single neighbourhood store selling **fruits, vegetables, and meat** in Bengaluru. Four apps work together end to end:

| App | Stack | Status |
|---|---|---|
| **Customer mobile** | Expo SDK 57, React Native, Expo Router, Zustand, SecureStore / AsyncStorage | ✅ Built & verified — OTP login, catalog, cart, checkout with COD, order tracking, address book |
| **Backend API** | Node.js, Express 5, TypeScript, Prisma 5.22, PostgreSQL 18 | ✅ Built & verified — auth, catalog, addresses, orders, delivery, admin, store, health |
| **Admin panel** | Next.js 15 (App Router), plain CSS design system, OTP login | ✅ Built & verified — dashboard, order lifecycle, catalog management, rider management, store settings |
| **Delivery app** | Expo SDK 57, React Native, Expo Router, Zustand | ✅ Built & verified — password login, assignment board, accept/decline/start/complete, earnings history, rider profile |

## Documentation

- **[`plan.md`](./plan.md)** — the complete A-to-Z product, architecture, schema, API, screen, testing, and deployment plan. This is the single source of truth.
- **[`architecture.md`](./architecture.md)** — system architecture diagram.
- **[`docs/source/design-plan.md`](./docs/source/design-plan.md)** — original design-image notes (historical; the product was called LocalCart then).

## Repository layout

```text
localmart/
├── src/                    # Customer Expo app (Expo Router routes in src/app/)
├── backend/                # Express + Prisma API
│   ├── prisma/             # schema, migrations, seed
│   ├── src/                # API source
│   ├── logs/               # runtime logs (gitignored)
│   └── uploads/            # local product images (gitignored)
├── admin/                  # Next.js admin panel
├── delivery/               # Expo delivery partner app
├── plan.md
├── architecture.md
└── docker-compose.yml      # local PostgreSQL 18
```

Each mobile/desktop app is a standalone npm project; run `npm install` inside the folder you are working on.

## Quick start

### Prerequisites

- Node.js 20 LTS + npm
- Docker (for PostgreSQL), _or_ a local PostgreSQL you point `DATABASE_URL` at
- Expo Go on a phone, or an iOS/Android simulator
- A Resend API key (optional — without it the API returns codes as `devOtp` and `devCode` for development)

### 1. Install

```bash
npm install                                 # customer app
cd backend && npm install && cd ..          # API
cd admin && npm install && cd ..            # admin panel
cd delivery && npm install && cd ..         # delivery app
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL 18 with database/user/password all set to `localmart`.

### 3. Configure the API

```bash
cp backend/.env.example backend/.env
# edit JWT secrets, OTP pepper, CORS_ORIGINS, RESEND_API_KEY
```

### 4. Migrate and seed

```bash
cd backend
npx prisma migrate deploy   # or: npx prisma migrate dev
npm run db:seed             # demo store, products, admin, customer, riders
cd ..
```

### 5. Run

```bash
# Terminal 1 — API (http://localhost:8000)
cd backend && npm run dev

# Terminal 2 — customer app (http://localhost:8081)
npm start

# Terminal 3 — admin panel (http://localhost:3000)
cd admin && npm run dev

# Terminal 4 — delivery app (http://localhost:8082)
cd delivery && npm start
```

On a physical phone, set `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8000` in the Expo environment; `localhost` points to the phone itself.

### Seeded demo accounts

| Role | Email | Credential |
|---|---|---|
| Admin | `admin@localmart.app` | email OTP (dev code returned by the API) |
| Customer | `customer@localmart.app` | email OTP (dev code returned by the API) |
| Riders | `driver1@localmart.app` … `driver10@localmart.app` | `LocalMart@123` |

## Key product rules

- Free delivery above **₹500**, otherwise **₹40**; prices are INR, GST-inclusive, IST day boundaries.
- **COD at launch** — online payments are intentionally rejected with `ONLINE_PAYMENTS_UNAVAILABLE` until Razorpay lands in v1.1.
- Order lifecycle: `pending → confirmed → preparing → assigned → out_for_delivery → delivered` (admin can cancel through `out_for_delivery`; customers through `confirmed`).
- Riders earn **₹40 per delivered order**; assignments must be accepted before starting; declining returns the order to the store and emails the admin.
- Access tokens live **15 minutes**, refresh tokens **7 days** with rotation and reuse detection; OTPs and refresh tokens are stored hashed.
- Service is restricted to the store's pincode allowlist; store hours 08:00–22:00 IST with an admin open/closed override.

## Working agreement

- **Commit and push after every completed, verified step.** No batching days of work into one commit.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Run `npm run lint` + `npx tsc --noEmit` in the app you touched (`backend`: `npm run typecheck`) before committing.
- Never commit `.env`, secrets, `node_modules/`, logs, or uploads.
- Update `plan.md` when a decision changes; the plan is the contract.

## Verification

```bash
# backend
cd backend && npm run typecheck && npm run build

# customer / delivery
npx tsc --noEmit && npx expo lint

# admin
cd admin && npm run typecheck && npm run build
```

All four apps were verified end to end with Playwright-driven browser sessions (customer: browse → cart → checkout → order detail; admin: OTP login → confirm/prepare/assign → product create; delivery: login → accept → start → complete → earnings).

## License

Private project. See [`LICENSE`](./LICENSE).
