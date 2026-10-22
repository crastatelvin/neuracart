# LocalCart — Grocery Delivery App (source design notes)

> **Historical source extraction.** These notes were transcribed from the original 11 planning images, which called the product **LocalCart**. The project is now **LocalMart**. This file is preserved for traceability; the authoritative specification is [`../../plan.md`](../../plan.md).

**Original source notes.** Extracted from the 11 planning images, transcribed as-is.

4 apps working together end to end: Backend API, Customer mobile app, Admin panel, Delivery partner app.

---

## 1. Tech Stack

### Backend

- Node.js + Express + TypeScript
- Prisma ORM + PostgreSQL
- JWT (access + refresh tokens)
- Resend (email OTP)
- Multer + Sharp (image uploads)
- Zod (validation)
- bcrypt (password hashing)
- Helmet + CORS + express-rate-limit (security)

### Customer App

- Expo SDK 57 + React Native + TypeScript
- NativeWind (Tailwind CSS for RN)
- Expo Router (file-based navigation)
- Zustand (state management)
- AsyncStorage (token persistence)

### Admin Panel

- Next.js 14 + TypeScript
- Tailwind CSS
- Axios (with token interceptor + auto-refresh)
- Lucide React (icons)

### Delivery Partner App

- Expo + React Native + TypeScript
- NativeWind
- Zustand
- Expo Router

---

## 2. Backend Architecture — Layered Pattern

```
HTTP Request
  → Route
    → Middleware (auth, validate, rate limit)
      → Controller
        → Service (business logic)
          → Repository (DB calls only)
            → Prisma
              → PostgreSQL
```

Each layer has one job. Controllers never touch the DB. Repositories never have business logic.

---

## 3. Database Models

- **User** — customers, admins, delivery partners (single table, role-based)
- **OtpCode** — 6-digit OTP with expiry, attempts, used tracking
- **RefreshToken** — JWT refresh tokens with family rotation
- **Address** — delivery addresses with lat/lng
- **Product** — fruits/vegetables/meat with image, stock, category
- **Order** — full order with status lifecycle
- **OrderItem** — products inside an order
- **OrderStatusHistory** — every status change logged
- **OrderTracking** — live GPS coordinates for delivery
- **DeliveryPartner** — vehicle info, availability, verified status
- **Store** — single store with coordinates

---

## 4. Authentication

### Customers + Admin → Email OTP

```
send-otp   → generate 6-digit code → email code via Resend
verify-otp → validate + issue access token (15m) + refresh token (7d)
```

### Delivery Partners → Email + Password

```
delivery-login → bcrypt.compare → issue tokens
```

### Security: Refresh Token Rotation

- Every refresh issues a new token pair
- Old token immediately revoked
- If revoked token reused → entire family revoked → force re-login

---

## 5. Order Status Lifecycle

```
PENDING → CONFIRMED → PREPARING → ASSIGNED → OUT_FOR_DELIVERY → DELIVERED
                                                                    → CANCELLED
```

- **PENDING** — customer places order
- **CONFIRMED** — admin confirms
- **PREPARING** — store packs
- **ASSIGNED** — admin assigns delivery partner
- **OUT_FOR_DELIVERY** — driver starts delivery
- **DELIVERED** — driver marks complete

---

## 6. API Modules

| Module | Endpoints |
|---|---|
| **Auth** | `send-otp`, `verify-otp`, `delivery-login`, `refresh`, `logout`, `me`, `profile` |
| **Products** | public: `list`, `featured`, `get-by-id` \| admin: `create`, `update`, `delete`, `toggle`, image upload |
| **Orders** | customer: `place`, `my-orders` \| admin: `all-orders`, `update-status`, `assign-partner` \| delivery: `my-deliveries`, `update-tracking` |
| **Address** | `list`, `add`, `update`, `delete`, `set-default` |
| **Delivery** | `register`, `profile`, `availability toggle`, `location update`, `verify` (admin) |

---

## 7. Security Layer

- Helmet.js — 11 security HTTP headers
- CORS — whitelist only
- Rate limiting — global (100/15min), OTP (5/15min), auth (20/15min), uploads (10/min)
- Role guards — CUSTOMER / ADMIN / DELIVERY_PARTNER
- Zod validation — every request body validated before controller
- JWT expiry — 15 minute access tokens
- bcrypt cost factor 12 for passwords
- File type validation — JPEG/PNG/WEBP only

---

## 8. Customer App Screens

```
(auth)
  index.tsx          → email input + send OTP
  login.tsx          → 6-box OTP entry

(tabs)
  index.tsx          → home (products, search, categories, animated cart bar)
  orders.tsx         → order history
  profile.tsx        → profile + sign out

product/[id].tsx     → product detail + add to cart
cart.tsx             → cart with bill summary + progress bar
checkout.tsx         → address + payment + place order
order/[id].tsx       → order detail + status tracker
addresses.tsx        → manage addresses
add-address.tsx      → add new address
edit-profile.tsx     → update name + phone
```

---

## 9. Admin Panel Pages

```
/login                  → OTP login
/dashboard              → stats (orders, revenue, products)
/dashboard/orders       → all orders + filter + confirm + cancel
/dashboard/orders/[id]  → order detail + assign delivery partner
/dashboard/products     → CRUD + image upload + toggle active
/dashboard/delivery     → partners list + verify
```

---

## 10. Delivery App Screens

```
(auth)/index.tsx    → email + password login
(tabs)/index.tsx    → active + completed orders with stats
(tabs)/profile.tsx  → availability toggle + sign out
order/[id].tsx      → customer info + navigate + call + start/complete delivery
```

---

## 11. Pricing Logic

```
subtotal    = sum(price × quantity)
deliveryFee = subtotal ≥ ₹500 ? FREE : ₹40
total       = subtotal + deliveryFee
```

---

## 12. Project Folder Structure

```
grocery-app/              ← Customer mobile app
  src/
    app/
    lib/api.ts
    store/auth-store.ts
    store/cart-store.ts
    types/index.ts

backend/                  ← Node.js API
  src/
    config/prisma.ts
    middleware/
    modules/auth/ products/ orders/ address/ delivery/
    utils/logger.ts jwt.ts otp.ts response.ts
    app.ts
  prisma/schema.prisma seed.ts seed-drivers.ts

admingrocery/             ← Admin Panel (Next.js)
grocery-delivery/         ← Delivery Partner App (Expo)
```

---

## 13. Notes

- **Cart is device-side.** No `CartItem` model exists in the plan; cart lives in Zustand
  (`store/cart-store.ts`) and the order is created from that payload.
- **4 separate top-level folders**, not an npm-workspaces monorepo. Folder names above are
  transcribed verbatim from the plan (`grocery-app`, `backend`, `admingrocery`,
  `grocery-delivery`) — the project itself is named LocalCart.
- **Unclear from the plan:** which statuses `CANCELLED` is reachable from. The lifecycle block
  draws it as a branch off the end of the chain. Admin can cancel an order; the transition
  table needs an explicit allow-list before it is written.
- **Unclear from the plan:** Postgres runs locally or in Docker.