# NeuraCart — Complete Project Plan (A → Z)

> **Project name:** **NeuraCart**  
> **Tagline:** *Your neighbourhood market, delivered.*  
> **Document version:** 1.0  
> **Date:** 22 October 2026  
> **Status:** Ready for build  
> **Source analysed:** `neuracart1_merged.md` / `neuracart1_merged.pdf` — 209-page transcript of the “Fresh Cart” full-stack grocery delivery build, 13,105 lines, plus the demo walkthrough and architecture explanation.

---

## 0. Document control

### 0.1 Purpose

This document is the single source of truth for designing, building, testing, launching, and operating **NeuraCart**. It converts the source tutorial into an implementation-ready plan, preserves every feature that was mentioned or demonstrated, closes the parts the tutorial did not finish, and defines the micro-details needed by designers, developers, testers, and ops.

### 0.2 Conventions

| Term | Meaning |
|---|---|
| **MUST** | Required for MVP launch. |
| **SHOULD** | Strongly recommended; can slip one release with written approval. |
| **MAY** | Optional / roadmap. |
| **Source** | The Fresh Cart tutorial transcript. |
| **MVP** | The first public release defined in §3. |
| **IST** | Asia/Kolkata (UTC+05:30). All customer-facing times are IST. |

### 0.3 Source fidelity statement

The source is a code-along, not a specification. It contains live debugging, inconsistent numbers, and unfinished modules. This plan:

1. Keeps every product feature that was demoed or described.
2. Keeps the source architecture (route → middleware → controller → service → repository → Prisma → PostgreSQL).
3. Standardises contradictions (e.g. free-delivery threshold) into one rule.
4. Completes modules the video only sketched (admin dashboard/products, delivery app, live tracking, online payments).
5. Fixes bugs found during the build and records them in §22 so they are not repeated.

### 0.4 How to use this document

| If you are… | Read first | Then |
|---|---|---|
| Founder / PM | §1–3, §20–24 | Approve scope, timeline, launch checklist |
| Backend developer | §7–12, §16–18 | Build schema → auth → catalog → orders → delivery |
| Customer app developer | §7, §13, §16–17 | Build auth gate → home → cart → checkout → orders |
| Admin developer | §7, §11.8, §14 | Build login → layout → orders → products → riders |
| Delivery app developer | §7, §11.7, §15 | Build login → assignments → start → complete |
| Designer | §2.3, §13.2, §14.9 | Design tokens and screen states |
| QA | §5, §7, §17, §23 | Write test cases from requirements and state machines |
| Ops / on-call | §16.3, §18.7, §23 | Runbook and launch checklist |

### 0.5 Build order (do not reorder)

1. Monorepo, env validation, Postgres, Prisma schema, migration, seed.
2. Logger, response helpers, JWT/OTP/password utils, error handler.
3. Auth module + RBAC + Resend OTP; verify with curl and a real inbox.
4. Products module + upload pipeline; seed 38 products with real photography.
5. Addresses module + ownership/default rules.
6. Orders module: pricing, transaction, stock, status machine, history.
7. Delivery module: assignments, start, complete, earnings.
8. Admin stats, riders, store settings.
9. Customer app: auth → home → cart → checkout → orders → profile.
10. Admin panel: login → layout → orders → products → riders → settings.
11. Delivery app: login → assignments → start → complete → history.
12. Emails, tracking, security hardening, E2E, load test, deploy, pilot.

Each step ends with tests and a working demo, never with “we’ll wire it later.”

---

## 1. Executive summary

**NeuraCart** is a full-stack grocery delivery platform for a **single neighbourhood store** selling **fruits, vegetables, and meat** within one city (launch city: Bengaluru). It consists of four deliverables that work end to end:

1. **NeuraCart Customer** — Expo/React Native mobile app. Customers log in with email OTP, browse and search products, filter by category, add to cart, choose an address, pay by COD (online in v1.1), place an order, and follow its status.
2. **NeuraCart Admin** — Next.js web panel. Store staff see today’s orders and revenue, confirm/cancel orders, move them through preparation, assign delivery partners, manage products and images, manage riders, and configure the store.
3. **NeuraCart Delivery** — Expo/React Native app for riders. Riders log in with email/password, see assignments, accept/start deliveries, mark them delivered, and track earnings (₹40 per completed delivery).
4. **NeuraCart API** — Node.js + Express + TypeScript + Prisma + PostgreSQL. JWT access/refresh auth, OTP email via Resend, RBAC for three roles, Multer + Sharp uploads, Zod validation, rate limiting, logging, emails, and the full order lifecycle.

**Core loop:** customer places order → admin confirms and prepares → admin assigns rider → rider starts and completes delivery → customer sees “Delivered”, COD is marked paid, rider earns ₹40, status emails are sent at each step.

**Launch definition:** a customer can complete the full loop on a real phone, an admin can operate it from a browser, and a rider can complete it from a second phone, with stock, money, statuses, and emails all consistent.

**Indicative delivery:** 6–7 weeks for one full-stack developer, 4 weeks for a team of three (backend, mobile, admin/design), including QA and deployment. Detailed schedule in §18.

---

## 2. Source analysis and naming

### 2.1 What the source actually contains

| Area | In the transcript | Plan treatment |
|---|---|---|
| Customer app | Fully coded: OTP auth, home, categories, search, featured, cart, checkout, addresses, orders, order detail, profile, edit profile, sign out | Keep and polish; add product detail, tracking, notifications |
| Backend auth | Fully coded: OTP, JWT access/refresh, rotation, family reuse detection, logout, logout-all, profile | Keep; harden OTP storage, add delivery password login |
| Backend products | Fully coded: list, featured, detail, create, update, toggle, delete, Multer/Sharp | Keep; add soft-delete rules, image pipeline |
| Backend addresses | Fully coded: CRUD, first-address default, set default transaction, ownership checks | Keep; make lat/lng optional |
| Backend orders | Coded: place order, my orders, detail, admin list, status update (stubbed), assign/tracking schemas (stubbed) | Complete status, assign, tracking, cancel, delivery endpoints |
| Admin panel | **Only login coded**; dashboard, orders, products, delivery pages demoed but not built in the transcript | Fully specified in §12 |
| Delivery app | **Demoed only**; no code in the transcript | Fully specified in §13 |
| Emails | OTP + order status mail helper (helper never called) | Wire all triggers, add templates |
| Online payment | UI option only, no gateway | Razorpay integration in v1.1, COD at launch |
| Real-time tracking | Mentioned; `OrderTracking` model and schemas exist, no UI/logic | Polling MVP, map + push in v1.1 |
| Deployment | Not covered | Full plan in §16 |

### 2.2 Fresh Cart → NeuraCart rename map

| Source | NeuraCart |
|---|---|
| Fresh Cart / freshcart | **NeuraCart / neuracart** |
| `freshcart_db` | `neuracart` (local Docker DB) |
| `freshcart_admin` DB user | `neuracart` dev / `neuracart_admin` prod |
| `driver1@freshcart.com` | `driver1@neuracart.app` |
| `admin@freshcart.com` | `admin@neuracart.app` |
| “Fresh Cart Admin” | “NeuraCart Admin” |
| “Fresh Cart — Delivery Partner Portal” | “NeuraCart Delivery” |
| App names `freshcart`, `ad-grocery` | customer: repo root `neuracart`; API: `backend/`; admin: `admin/`; delivery: `delivery/` |
| Package scope | `neuracart-api` (backend); no workspace scope yet |
| Store “Fresh Mart” | “NeuraCart Central” |
| Emails `onboarding@resend.dev` (dev) | `no-reply@neuracart.app` (prod) |

### 2.3 Brand

| Element | Decision |
|---|---|
| Name | NeuraCart |
| Tagline | Your neighbourhood market, delivered. |
| Logo | Rounded green shopping bag with a white location pin cut-out; wordmark “NeuraCart” |
| Primary | `#16A34A` (green-600) |
| Primary dark | `#15803D` |
| Primary light | `#DCFCE7` |
| Accent | `#F59E0B` (amber, promos/ratings) |
| Danger | `#EF4444` |
| Background | `#F9FAFB` |
| Surface | `#FFFFFF` |
| Text | `#111827` |
| Muted text | `#6B7280` |
| Border | `#E5E7EB` |
| Typography | System font stack (SF Pro / Roboto); no custom font at launch |
| Radius | Cards 24px (`rounded-3xl`), inputs/buttons 16px (`rounded-2xl`), pills full |
| Tone | Friendly, local, concise, no jargon; “fresh”, “neighbourhood”, “at your door” |
| Currency | INR, `₹`, `Intl.NumberFormat('en-IN')`, no decimals for display |
| Locale | `en-IN`, timezone `Asia/Kolkata` |

### 2.4 Domain and contact plan

- Web/admin: `admin.neuracart.app`
- Marketing/legal: `neuracart.app`
- API: `api.neuracart.app`
- Support: `support@neuracart.app`
- Transactional: `no-reply@neuracart.app` (Resend domain verification: SPF, DKIM, DMARC)
- Privacy: `privacy@neuracart.app`

---

## 3. Scope

### 3.1 MVP (launch)

**Customer**
- Email OTP login/logout, session restore.
- Home with greeting, search, category filters, featured carousel, product grid.
- Product detail with stock/quantity.
- Cart with add/stepper/remove/clear, bill summary, free-delivery progress.
- Address book (add, edit, delete, set default; labels Home/Work/Other).
- Checkout with saved address, COD (online hidden behind flag), order notes.
- Place order with stock validation, cart clear, confirmation.
- Orders list (latest first, pull-to-refresh), order detail with status timeline, cancel while allowed.
- Profile, edit name/phone, sign out.
- Order status emails.

**Admin**
- OTP login restricted to `ADMIN`.
- Dashboard: today’s orders, revenue, pending, active deliveries, low stock, 7-day chart, recent orders.
- Orders: filter by status/date/search, paginate, detail, confirm, preparing, assign partner, out for delivery, delivered, cancel with reason, timeline.
- Products: list/filter/search, create/edit with image upload, price/stock/unit/category/featured/active, delete/toggle.
- Delivery partners: list, add/edit, verify, availability, view workload.
- Store settings: name, address, phone, hours, delivery fee, free-delivery threshold, open/closed.
- Role-protected routes and automatic token refresh.

**Delivery**
- Email/password login (seeded accounts).
- Availability toggle.
- Assignments list (new/active), accept/reject, order detail with pickup and drop addresses, call customer, items.
- Start delivery → out for delivery; mark delivered with confirmation.
- History and earnings (₹40/delivery).
- Profile and logout.

**Platform**
- Three roles and RBAC; ownership checks.
- Product catalog, categories, stock decrement/restock.
- Order lifecycle, status history, tracking record.
- COD payment status.
- OTP + JWT security, refresh rotation, rate limits, validation.
- Upload pipeline, logging, error envelope, health check.
- Seed data and demo accounts.
- CI, staging, production deployment, backups, monitoring.

### 3.2 v1.1 (first post-launch release)

- Razorpay online payments (create order, checkout, signature verification, webhook, refunds).
- Live rider tracking map (15s polling) + ETA.
- Push notifications (Expo Notifications) for order status.
- Rider proof of delivery (photo and/or 4-digit customer OTP).
- Admin customer list and order export CSV.
- Product low-stock alerts and daily sales email.
- Saved/favourite products.
- Ratings for products and riders.
- Deep links (`neuracart://order/:id`).
- Admin httpOnly-cookie session hardening.

### 3.3 v2 (growth)

- Multi-store / store selection and per-store inventory.
- Serviceability by pincode polygon and delivery slots.
- Coupons, referrals, loyalty.
- Subscriptions (weekly vegetable box).
- Multi-language (Kannada, Hindi).
- Rider route optimisation and batched deliveries.
- Returns/refunds workflow.
- Warehouse/stock purchase orders.
- Web customer storefront.

### 3.4 Explicitly out of scope (v1)

- Alcohol/tobacco sales.
- Prescription medicine.
- International shipping.
- Multi-vendor marketplace.
- Live chat/support desk.
- Custom tax engine (prices are GST-inclusive at launch).
- Loyalty wallet.
- Dark mode (design tokens prepared, not shipped).

### 3.5 Launch assumptions

1. One store: **NeuraCart Central**, 14 MG Road, Bengaluru 560001, lat `12.9716`, lng `77.5946`.
2. Delivery radius: **10 km** from store; MVP validates pincode against an allowlist, not polygons.
3. Store hours: **08:00–22:00 IST**, seven days; orders outside hours are blocked with a clear message.
4. Prices are **GST-inclusive**; no separate tax line.
5. Delivery fee **₹40**; free above **₹500**; no platform fee (“Free”); discount fixed at ₹0 in MVP.
6. Payment: **COD default**; online option is feature-flagged off until Razorpay is live.
7. Rider payout: **₹40 per delivered order**, platform-funded even when delivery is free to the customer.
8. English-only UI at launch.
9. One default address per customer; maximum 10 addresses.
10. Order limits: max 20 units per product, max 50 total units, notes ≤ 500 chars.
11. Customer can cancel while the order is `PENDING` or `CONFIRMED`; admin can cancel until `OUT_FOR_DELIVERY` (exceptions handled by support).
12. No coupons in MVP.

---

## 4. Personas and roles

### 4.1 Personas

| Persona | Description | Primary needs | Success signal |
|---|---|---|---|
| **Asha, customer** | 32, working professional, orders fruit/vegetables weekly | Fast reorder, clear prices, reliable ETA, easy address switch | Places order in < 3 minutes; sees status without calling |
| **Ravi, store admin** | 38, manages the single store and 3 riders | One screen for today’s orders, fast confirm/assign, stock control | Clears pending queue in < 10 minutes; no oversells |
| **Arun, rider** | 24, bike rider, Android phone | Clear pickup/drop, one-tap status, visible earnings | Completes delivery without calling support |
| **Support agent** | Handles exceptions | See order timeline, payment, customer, rider | Resolves in one call |

### 4.2 Roles and permissions

| Capability | Customer | Admin | Delivery partner |
|---|---|---|---|
| Send/verify OTP | ✅ own email | ✅ own email (must be ADMIN) | ❌ |
| Password login | ❌ | ❌ | ✅ |
| Browse products | ✅ | ✅ | ✅ (read-only, via order) |
| Create/update/delete product | ❌ | ✅ | ❌ |
| Manage addresses | ✅ own | ✅ own | ❌ |
| Place order | ✅ | ✅ (assisted) | ❌ |
| Read order | ✅ own only | ✅ all | ✅ assigned only |
| Update status | ❌ (cancel only) | ✅ | ✅ start/complete assigned |
| Assign rider | ❌ | ✅ | ❌ |
| Update rider location | ❌ | ❌ | ✅ own active order |
| View dashboard/stats | ❌ | ✅ | ❌ |
| Manage riders | ❌ | ✅ | ❌ |
| View own earnings | ❌ | ❌ | ✅ |

**Enforcement:** backend middleware is authoritative (`authenticate` → `authorize(...roles)` → ownership check in service). Frontend guards are UX only.

---

## 5. Functional requirements

Priority: **P0** = launch blocker, **P1** = launch, **P2** = v1.1.

### 5.1 Customer app

| ID | Requirement | Priority |
|---|---|---|
| FR-C-01 | Log in with email + 6-digit OTP; new emails create a CUSTOMER account automatically. | P0 |
| FR-C-02 | OTP expires in 10 minutes, is single-use, max 5 verification attempts, resend after 60 seconds. | P0 |
| FR-C-03 | Persist session across app restarts using AsyncStorage + `/auth/me`. | P0 |
| FR-C-04 | Show greeting by time of day and customer name. | P1 |
| FR-C-05 | Browse products from the API, newest first, active only. | P0 |
| FR-C-06 | Filter by All / Fruits / Vegetables / Meat. | P0 |
| FR-C-07 | Search by product name/description, case-insensitive, debounced 300 ms. | P0 |
| FR-C-08 | Show featured products horizontally when no filter/search is active. | P1 |
| FR-C-09 | Add to cart, increment/decrement, remove, clear all, show badge count. | P0 |
| FR-C-10 | Cart bill: subtotal, delivery fee, platform fee “Free”, total, savings. | P0 |
| FR-C-11 | Free-delivery progress: “Add ₹X more…” / “Free Delivery Unlocked”. | P0 |
| FR-C-12 | Checkout requires a selected address and non-empty cart. | P0 |
| FR-C-13 | Address CRUD with labels, default address, first address auto-default. | P0 |
| FR-C-14 | Payment method COD (default) and Online (flag-gated). | P0 |
| FR-C-15 | Place order; validate stock/active; clear cart; show success and View Orders. | P0 |
| FR-C-16 | Orders list latest first, status pill, city, total, pull-to-refresh. | P0 |
| FR-C-17 | Order detail: timeline, address, items, bill, payment, cancel when allowed. | P0 |
| FR-C-18 | Edit profile name/phone; email read-only. | P1 |
| FR-C-19 | Sign out revokes refresh family and clears local tokens/cart. | P0 |
| FR-C-20 | Empty/loading/error states on every data screen. | P0 |
| FR-C-21 | Product detail screen with quantity and stock. | P1 |
| FR-C-22 | Track order status and rider location (polling in v1.1). | P2 |
| FR-C-23 | Push notification on status change. | P2 |
| FR-C-24 | Reorder from a past order. | P2 |

### 5.2 Admin panel

| ID | Requirement | Priority |
|---|---|---|
| FR-A-01 | OTP login; reject non-admin with “Access denied. Admins only.” | P0 |
| FR-A-02 | Token refresh interceptor; redirect to login on failure. | P0 |
| FR-A-03 | Dashboard KPIs: today’s orders, revenue, pending, active deliveries, avg order value, low stock. | P1 |
| FR-A-04 | 7-day orders/revenue chart. | P2 |
| FR-A-05 | Recent orders table and low-stock list. | P1 |
| FR-A-06 | Orders table with status/date/search filters and pagination. | P0 |
| FR-A-07 | Order detail with customer, address, items, bill, payment, timeline. | P0 |
| FR-A-08 | Actions: confirm, preparing, assign rider, out for delivery, delivered, cancel with reason. | P0 |
| FR-A-09 | Assign rider modal listing verified/available riders and current workload. | P0 |
| FR-A-10 | Products table with search/category/status filters. | P0 |
| FR-A-11 | Create/edit product: name, description, category, price, unit, stock, featured, active, image. | P0 |
| FR-A-12 | Image upload with preview, max 5 MB, JPG/PNG/WebP. | P0 |
| FR-A-13 | Toggle active/featured; delete with confirmation. | P0 |
| FR-A-14 | Delivery partners list; add/edit/verify/deactivate. | P1 |
| FR-A-15 | Store settings: details, hours, fees, free-delivery threshold, open/closed. | P1 |
| FR-A-16 | Toasts, loading skeletons, empty states, form validation. | P0 |
| FR-A-17 | Responsive layout down to 1024px; usable on tablet. | P1 |
| FR-A-18 | CSV export of orders. | P2 |

### 5.3 Delivery app

| ID | Requirement | Priority |
|---|---|---|
| FR-D-01 | Email/password login for seeded, verified, active riders. | P0 |
| FR-D-02 | Persist session; logout revokes refresh family. | P0 |
| FR-D-03 | Availability toggle (online/offline). | P1 |
| FR-D-04 | Assignments list: new, active, completed; pull-to-refresh. | P0 |
| FR-D-05 | Assignment detail: order number, items count, pickup store, drop address, customer phone, payout. | P0 |
| FR-D-06 | Accept/decline a new assignment; decline returns it to admin queue. | P1 |
| FR-D-07 | Start delivery with confirmation → `OUT_FOR_DELIVERY`. | P0 |
| FR-D-08 | Mark delivered with confirmation → `DELIVERED`, COD paid, earnings +₹40. | P0 |
| FR-D-09 | Call customer and open maps. | P1 |
| FR-D-10 | History with date, order, payout; total earnings. | P1 |
| FR-D-11 | Profile: name, vehicle, deliveries, logout. | P1 |
| FR-D-12 | Foreground location updates every 15 s while out for delivery. | P2 |
| FR-D-13 | Proof of delivery photo/OTP. | P2 |

### 5.4 Platform / backend

| ID | Requirement | Priority |
|---|---|---|
| FR-P-01 | Layered architecture; only repositories touch Prisma. | P0 |
| FR-P-02 | Consistent success/error/paginated envelopes. | P0 |
| FR-P-03 | Zod validation on every body/query. | P0 |
| FR-P-04 | JWT access 15 min + rotating refresh 7 days with family reuse detection. | P0 |
| FR-P-05 | RBAC and resource ownership checks. | P0 |
| FR-P-06 | Rate limits: global, OTP, auth, uploads, orders. | P0 |
| FR-P-07 | Product image upload and processing. | P0 |
| FR-P-08 | Order placement transaction with stock guard. | P0 |
| FR-P-09 | Status history on every transition. | P0 |
| FR-P-10 | Order status emails (placed, confirmed, out for delivery, delivered, cancelled). | P1 |
| FR-P-11 | Daily log files; no secrets/PII. | P0 |
| FR-P-12 | Health endpoint and graceful shutdown. | P0 |
| FR-P-13 | Seed script: store, admin, customer, 10 riders, 38 products with real photography, 2 orders. | P0 |
| FR-P-14 | OpenAPI/Swagger docs. | P1 |
| FR-P-15 | Admin stats and rider management endpoints. | P1 |
| FR-P-16 | Online payment + webhook (v1.1). | P2 |

---

## 6. User journeys

### 6.1 J1 — Customer places a COD order

1. App opens; `loadStoredAuth()` finds no token → `(auth)/index`.
2. Customer enters email; client validates format; `POST /auth/send-otp`.
3. Backend finds/creates CUSTOMER, invalidates old OTPs, stores a 6-digit code (10 min), sends Resend email.
4. Customer enters 6 digits; `POST /auth/verify-otp`; backend checks user active, OTP validity/attempts/expiry, marks used, issues access (15 min) + refresh (7 d) tokens; client stores both and user.
5. Home loads `GET /products?limit=20` and `/products/featured` in parallel; greeting shows name.
6. Customer filters “Fruits”, searches “mango”, taps Add; cart badge updates.
7. Cart shows items, steppers, ₹500 free-delivery progress, bill.
8. Checkout loads addresses; default selected. If none, dashed “Add delivery address” card.
9. Customer selects COD, adds a note, taps Place Order.
10. `POST /orders` → validate address ownership, products active, stock; compute subtotal/fee/total; transaction creates order + items + history + tracking and decrements stock.
11. Response 201; client clears cart, shows “Order Placed” alert with **View Orders**.
12. Orders tab refetches; new order is `PENDING`; email “Order placed” sent.
13. Customer pulls to refresh after admin confirmation; status updates.

### 6.2 J2 — Admin fulfils the order

1. Admin logs in with OTP; backend verifies `role === ADMIN`.
2. Dashboard shows pending count and today’s revenue.
3. Opens Orders → Pending → order detail.
4. **Confirm** → `CONFIRMED`, history entry, email.
5. **Mark Preparing** → `PREPARING`, history, email.
6. **Assign Partner** → modal lists verified riders; select Ravi (bike) → `ASSIGNED`, `deliveryPartnerId` set, history, rider assignment email/push (v1.1).
7. **Mark Out for Delivery** is normally done by rider, but admin can override → `OUT_FOR_DELIVERY`.
8. On completion (rider action) the order becomes `DELIVERED`; admin sees it in Delivered.

### 6.3 J3 — Rider completes delivery

1. Rider logs in `driver1@neuracart.app` / seeded password.
2. Assignments shows the new `ASSIGNED` order with payout ₹40.
3. Opens detail; sees pickup store, drop address, 3 items, customer phone.
4. Taps **Start Delivery** → confirm “Mark this order as out for delivery?” → `OUT_FOR_DELIVERY`; customer email sent.
5. Rides; optionally app sends location every 15 s.
6. At door, taps **Mark as Delivered** → confirm → `DELIVERED`; `deliveredAt` set; COD `paymentStatus` becomes `PAID`; rider `totalDeliveries + 1`, earnings +₹40; customer email; customer timeline turns green.
7. History shows the completed order and total earnings.

### 6.4 J4 — Cancellation

- Customer may cancel while `PENDING` or `CONFIRMED` (not once preparation starts).
- Admin may cancel while `PENDING` … `OUT_FOR_DELIVERY` with a reason; after pickup only support can.
- Transaction: set `CANCELLED`, `cancelledAt`, `cancelReason`; append history; restore stock; if online paid → `REFUNDED` + gateway refund; if COD → no refund; email customer; remove from rider active list; notify admin.

### 6.5 J5 — Online payment (v1.1)

1. Customer selects Online → `POST /payments/create-intent` returns Razorpay order id + amount.
2. App opens Razorpay checkout; on success sends `paymentId`, `orderId`, `signature`.
3. Backend verifies HMAC signature; marks `PAID`; order proceeds.
4. Webhook is the source of truth; idempotent by event id.
5. Failure → `FAILED`; customer can retry or switch to COD before accepting.
6. Cancel after payment → refund via Razorpay, `REFUNDED`.

---

## 7. State machines

### 7.1 Order status

```
PENDING ──confirm──> CONFIRMED ──prepare──> PREPARING ──assign──> ASSIGNED
   │                    │                     │                    │
   │cancel              │cancel               │cancel              │start
   ▼                    ▼                     ▼                    ▼
CANCELLED            CANCELLED             CANCELLED        OUT_FOR_DELIVERY
                                                                     │
                                                              deliver│
                                                                     ▼
                                                                 DELIVERED
```

| From | To | Actor | Guard | Side effects |
|---|---|---|---|---|
| — | `PENDING` | Customer | Cart valid, address owned, stock available | Order + items + history “Order is placed” + tracking; stock decrement; email “Order placed” |
| `PENDING` | `CONFIRMED` | Admin | — | History; email |
| `PENDING` | `CANCELLED` | Customer/Admin | — | Restock; history; email |
| `CONFIRMED` | `PREPARING` | Admin | — | History; email |
| `CONFIRMED` | `CANCELLED` | Customer/Admin | — | Restock; history; email |
| `PREPARING` | `ASSIGNED` | Admin | Rider verified, active, available | `deliveryPartnerId`; history; rider notify |
| `PREPARING` | `CANCELLED` | Admin | — | Restock; history; email |
| `ASSIGNED` | `OUT_FOR_DELIVERY` | Rider/Admin | Rider is assignee | History; email “out for delivery” |
| `ASSIGNED` | `ASSIGNED` (reassign) | Admin | Before pickup | Replace rider; history note |
| `ASSIGNED` | `CANCELLED` | Admin | — | Restock; unassign; history; email |
| `OUT_FOR_DELIVERY` | `DELIVERED` | Rider/Admin | Rider is assignee | `deliveredAt`; COD → `PAID`; rider earnings/count; history; email |
| `OUT_FOR_DELIVERY` | `CANCELLED` | Admin only | Exception | Restock; refund if paid; history; email |
| `DELIVERED` | — | — | Terminal | — |
| `CANCELLED` | — | — | Terminal | — |

**Rules**
- No skipping states except admin “force” actions, which MUST write a history note.
- Every transition writes `OrderStatusHistory` with `changedBy` (user id) and optional note.
- Emails are best-effort and MUST NOT roll back a transition.
- Rider can only act on their own assigned order.

### 7.2 Payment status

| Method | Initial | Success | Failure | Cancel |
|---|---|---|---|---|
| COD | `PENDING` | `PAID` on `DELIVERED` | — | remains `PENDING` (no money collected) |
| ONLINE | `PENDING` | `PAID` on verified payment/webhook | `FAILED` (retry allowed) | `REFUNDED` after refund succeeds |

### 7.3 Rider assignment states

`AVAILABLE` → `ASSIGNED` (order) → `ACCEPTED` (rider, optional) → `PICKED_UP` (`OUT_FOR_DELIVERY`) → `COMPLETED`.  
If the rider declines or does not accept within 10 minutes (v1.1), the order returns to the admin queue and the rider’s availability is unchanged.

### 7.4 OTP lifecycle

`CREATED` → `SENT` → (`VERIFIED` | `EXPIRED` | `ATTEMPTS_EXCEEDED` | `INVALIDATED_BY_NEW_OTP`).

---

## 8. Business rules (single source of truth)

| ID | Rule |
|---|---|
| BR-01 | One store, one currency (INR), one city at launch. |
| BR-02 | Catalog categories are exactly `FRUITS`, `VEGETABLES`, `MEAT`; UI adds an “All” pseudo-filter. |
| BR-03 | Only `isActive = true` products are visible to customers. |
| BR-04 | Product price is per `unit` (e.g. “1 kg”, “500 g”, “6 pcs”); unit is free text, max 20 chars. |
| BR-05 | Delivery fee is **₹40** when subtotal < **₹500**; **₹0** at ≥ ₹500. Boundary is inclusive (₹500 is free). |
| BR-06 | Platform fee is **₹0** and displayed as “Free”. |
| BR-07 | Discount is **₹0** in MVP; schema supports future coupons. |
| BR-08 | `total = subtotal + deliveryFee − discount`. All money stored as `Decimal(10,2)`. |
| BR-09 | Prices are GST-inclusive; no tax line at checkout. |
| BR-10 | Stock is validated and decremented atomically at order placement; cancel restores stock. |
| BR-11 | Max 20 units per product and 50 total units per order. |
| BR-12 | Order number format: `LM-YYYYMMDD-XXXX` (e.g. `LM-20261022-0007`), unique, IST date. |
| BR-13 | New orders start `PENDING` with history note “Order is placed”. |
| BR-14 | Status can only move along the state machine; every change is audited. |
| BR-15 | Customer sees only their own orders; rider sees only assigned orders; admin sees all. |
| BR-16 | Customer can cancel only while `PENDING` or `CONFIRMED`; admin until `OUT_FOR_DELIVERY`. |
| BR-17 | COD is marked `PAID` only when the order is `DELIVERED`. |
| BR-18 | Online payments require verified signature; webhooks are idempotent. |
| BR-19 | Rider payout is ₹40 per delivered order; free-delivery orders still pay the rider. |
| BR-20 | Only verified, active riders can be assigned. |
| BR-21 | A rider can have at most 3 active assignments (configurable). |
| BR-22 | First address is automatically default; exactly one default per user. |
| BR-23 | Address ownership is checked on every read/write; max 10 addresses. |
| BR-24 | OTP: 6 digits, 10-minute expiry, single-use, max 5 attempts, resend cooldown 60 s, old OTPs invalidated. |
| BR-25 | Access token 15 min; refresh token 7 days; refresh rotation; reuse revokes the whole family. |
| BR-26 | Delivery partner passwords: min 8 chars, bcrypt cost 12. |
| BR-27 | Rate limits: global 300/15 min/IP; OTP 5/15 min/email+IP; auth 20/15 min/IP; uploads 10/min/user; orders 10/h/user. |
| BR-28 | Uploads: JPG/PNG/WebP, max 5 MB, re-encoded to WebP, max 1200×1200, UUID filename. |
| BR-29 | Notes max 500 chars; names 2–80; phone E.164/10-digit India; pincode 6 digits. |
| BR-30 | Service area: 10 km / allowlisted pincodes; blocked outside hours 08:00–22:00 IST. |
| BR-31 | Emails are sent for OTP, order placed, confirmed, out for delivery, delivered, cancelled. |
| BR-32 | Deactivated users cannot log in or refresh tokens. |
| BR-33 | Deactivated products cannot be ordered even if in a cart. |
| BR-34 | Images are optional; UI shows a neutral placeholder if missing. |
| BR-35 | All timestamps stored UTC, rendered IST. |
| BR-36 | Order placement is idempotent per `Idempotency-Key` (recommended) to prevent double taps. |
| BR-37 | No hidden fees; the bill shown before placing equals the server total. |
| BR-38 | Support contact is visible on order detail and profile. |

---

## 9. Architecture

### 9.1 System context

```
┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
│  NeuraCart Customer  │      │   NeuraCart Admin    │      │  NeuraCart Delivery  │
│  Expo / React Native │      │  Next.js (browser)   │      │  Expo / React Native │
│  iOS + Android       │      │  Desktop + tablet    │      │  iOS + Android       │
└──────────┬───────────┘      └──────────┬───────────┘      └──────────┬───────────┘
           │ HTTPS REST + JSON           │ HTTPS REST + JSON           │ HTTPS REST + JSON
           └─────────────────────────────┼─────────────────────────────┘
                                         ▼
                         ┌───────────────────────────────┐
                         │        NeuraCart API          │
                         │  Node + Express + TypeScript  │
                         │  Auth · RBAC · Validation     │
                         │  Orders · Products · Riders   │
                         └───────┬───────────────┬───────┘
                                 │               │
                   ┌─────────────▼─────┐   ┌─────▼──────────────┐
                   │ PostgreSQL        │   │ External services  │
                   │ Prisma ORM        │   │ Resend (email)     │
                   │ 11 tables         │   │ S3/Cloudinary (v1) │
                   └───────────────────┘   │ Razorpay (v1.1)    │
                                           │ Sentry (monitoring)│
                                           └────────────────────┘
```

### 9.2 Backend layering

```
HTTP request
  → Helmet / CORS / compression / morgan / body parser / rate limit
  → Router
  → authenticate (JWT)
  → authorize(...roles)
  → validate(Zod schema)
  → upload (Multer) if multipart
  → Controller        (HTTP only: parse req, shape res)
  → Service           (business rules, transactions, emails)
  → Repository        (only layer allowed to call Prisma)
  → Prisma Client
  → PostgreSQL
```

**Non-negotiable rules**
- Controllers never import Prisma.
- Repositories never contain business logic.
- Services never read `req`/`res`.
- Every module has `*.repository.ts`, `*.service.ts`, `*.controller.ts`, `*.validation.ts`, `*.routes.ts`.
- All responses go through `sendSuccess`, `sendPaginated`, or `sendError`.

### 9.3 Request lifecycle example — place order

1. `POST /api/orders` with Bearer token and JSON body.
2. Global rate limiter → `authenticate` → `authorize('customer','admin')` → `validate(placeOrderSchema)`.
3. `OrdersController.placeOrder` extracts `req.user.userId` and body.
4. `OrdersService.placeOrder` loads products, validates active/stock, computes money.
5. `OrdersRepository.createWithStock` runs one Prisma transaction:
   - re-check stock with conditional updates,
   - create order + items + status history + tracking,
   - decrement stock,
   - generate the order number from today’s count.
6. Service writes an audit log and queues/sends “Order placed” email (failure tolerated).
7. Controller returns `201 { success: true, message, data: order }`.

### 9.4 Repository structure (current flat layout)

The repo intentionally stays flat for now; it is not a workspace monorepo yet. Paths in this plan map as follows: `apps/customer` → repo root, `apps/api` → `backend/`, `apps/admin` → `admin/`, `apps/delivery` → `delivery/`.

```text
neuracart/
├── src/                          # Customer Expo app
│   ├── app/                      # Expo Router routes
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx
│   │   │   └── otp.tsx
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx
│   │   │   ├── orders.tsx
│   │   │   └── profile.tsx
│   │   ├── product/[id].tsx
│   │   ├── cart.tsx
│   │   ├── checkout.tsx
│   │   ├── add-address.tsx
│   │   ├── edit-address/[id].tsx
│   │   ├── addresses.tsx
│   │   ├── edit-profile.tsx
│   │   ├── order/[id].tsx
│   │   └── tracking/[id].tsx
│   ├── components/
│   ├── constants/
│   ├── hooks/
│   ├── lib/
│   ├── store/
│   └── types/
├── backend/                      # Node + Express + Prisma
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   └── prisma.ts
│   │   ├── middleware/
│   │   │   ├── authenticate.ts
│   │   │   ├── authorize.ts
│   │   │   ├── validate.ts
│   │   │   ├── rateLimiter.ts
│   │   │   ├── upload.ts
│   │   │   ├── requestId.ts
│   │   │   └── errorHandler.ts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── products/
│   │   │   ├── addresses/
│   │   │   ├── orders/
│   │   │   ├── delivery/
│   │   │   ├── admin/
│   │   │   └── store/
│   │   ├── services/
│   │   │   ├── email.service.ts
│   │   │   └── upload.service.ts
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   ├── jwt.ts
│   │   │   ├── otp.ts
│   │   │   ├── password.ts
│   │   │   ├── response.ts
│   │   │   ├── money.ts
│   │   │   └── orderNumber.ts
│   │   ├── types/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── uploads/
│   ├── logs/
│   ├── tests/
│   ├── .env.example
│   ├── tsconfig.json
│   └── package.json
├── admin/                        # Next.js admin (to create)
├── delivery/                     # Expo delivery app (to create)
├── docs/
│   ├── source/design-plan.md
│   ├── api.md
│   ├── runbook.md
│   └── qa-matrix.md
├── .github/workflows/ci.yml
├── docker-compose.yml
├── app.json
├── package.json
├── plan.md
├── architecture.md
└── README.md
```

### 9.5 Technology stack

| Layer | Choice | Version / note |
|---|---|---|
| Runtime | Node.js | 20 LTS (source requires 18+) |
| API framework | Express | **5.3.x** (the repo is already on Express 5; async errors are handled natively) |
| Backend language | TypeScript | **5.4.5** (pinned in `backend/package.json`) |
| Customer language | TypeScript | **6.0.3** (Expo SDK 57 template) |
| ORM | Prisma | **5.22.0 pinned** (source warns Prisma 7/8 broke the build) |
| Database | PostgreSQL | 18 local (Docker Compose) / 15+ managed production |
| Validation | Zod | **4.6.x** (already installed) |
| Auth | jsonwebtoken + bcryptjs | Access 15 m, refresh 7 d, bcrypt cost 12 |
| Email | Resend SDK | OTP + order status |
| Uploads | Multer 2.4 + Sharp | 5 MB, JPG/PNG/WebP → WebP 1200 px |
| Security | Helmet, CORS, express-rate-limit | Whitelist origins |
| Logging | Custom daily file logger + morgan | `logs/YYYY-MM-DD.<level>.log` |
| API tests | Vitest + Supertest | + Testcontainers Postgres |
| Customer app | Expo **57.0.28** + React Native **0.86.3** + React **19.2.3** | Expo Router 57 |
| Styling | NativeWind **5.0.0-rc.0** | Tailwind 4 pipeline (`@tailwindcss/postcss` 4.3) |
| State | Zustand + AsyncStorage | auth, cart, delivery |
| Icons | @expo/vector-icons (Ionicons) | — |
| Admin | Next.js 15 App Router + TypeScript | React 19 |
| Admin styling | Tailwind CSS 4.3 + lucide-react | — |
| Admin HTTP | Axios | Token interceptor + refresh |
| Admin UI | sonner, recharts, date-fns | Toasts, charts, dates |
| Payments | Razorpay (v1.1) | COD at launch |
| Monitoring | Sentry + UptimeRobot | API, admin, mobile crashes |
| Mobile builds | EAS Build / Submit | App Store + Play Store |
| CI/CD | GitHub Actions | Lint, typecheck, test, build, deploy |

### 9.6 Ports and environments

| Service | Local port | Staging | Production |
|---|---|---|---|
| API | 8000 | `api.staging.neuracart.app` | `api.neuracart.app` |
| Admin | 3000 | `admin.staging.neuracart.app` | `admin.neuracart.app` |
| Customer Expo | 8081 | EAS internal channel | App Store / Play Store |
| Delivery Expo | 8082 | EAS internal channel | Play Store (internal/closed) |
| PostgreSQL | 5432 | Neon branch | Neon primary |

### 9.7 Architecture decisions (ADR summary)

| # | Decision | Why |
|---|---|---|
| ADR-01 | Single-store MVP, `Store` table ready for multi-store | Source is single-store; avoids premature marketplace complexity |
| ADR-02 | Modular monolith, not microservices | Small team, one deploy, transactional order flow |
| ADR-03 | REST + JSON, no GraphQL | Source uses REST; simpler mobile caching |
| ADR-04 | OTP for customers/admin; password for riders | Customers want no passwords; riders are pre-provisioned staff |
| ADR-05 | JWT access + rotating refresh with family reuse detection | Stateless access, revocable sessions |
| ADR-06 | Money as `Decimal(10,2)`, never floats | Correct paise/rupee arithmetic |
| ADR-07 | Order placement in a single DB transaction with conditional stock update | Prevent overselling under concurrency |
| ADR-08 | Local disk uploads in dev, S3/Cloudinary in prod | Simple dev, durable prod |
| ADR-09 | Polling for tracking in MVP, sockets/push in v1.1 | Lower complexity; source only had tracking schema |
| ADR-10 | COD first, Razorpay behind a feature flag | Ship without payment-gateway onboarding delay |
| ADR-11 | Yarn workspaces monorepo | Shared types, one CI, source already uses Yarn |
| ADR-12 | Backend is source of truth for prices, fees, totals | Never trust client-calculated money |

---

## 10. Data model

### 10.1 Entity-relationship overview

```
User 1 ──── N Address
User 1 ──── N Order (as customer)
User 1 ──── N Order (as delivery partner)
User 1 ──── N OtpCode
User 1 ──── N RefreshToken
User 1 ──── 1 DeliveryPartner

Address 1 ── N Order
Order 1 ──── N OrderItem ──── 1 Product
Order 1 ──── N OrderStatusHistory
Order 1 ──── 1 OrderTracking
Order 1 ──── 1 DeliveryPartner (optional, via deliveryPartnerId)

Store (singleton configuration row)
```

### 10.2 Prisma schema (authoritative)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  CUSTOMER
  ADMIN
  DELIVERY_PARTNER
}

enum ProductCategory {
  FRUITS
  VEGETABLES
  MEAT
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PREPARING
  ASSIGNED
  OUT_FOR_DELIVERY
  DELIVERED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

enum PaymentMethod {
  COD
  ONLINE
}

model User {
  id             String            @id @default(uuid())
  email          String            @unique
  name           String?
  phone          String?
  password       String?           // only DELIVERY_PARTNER (bcrypt, cost 12)
  role           Role              @default(CUSTOMER)
  isActive       Boolean           @default(true)
  lastLoginAt    DateTime?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  addresses      Address[]
  orders         Order[]           @relation("customerOrders")
  deliveries     Order[]           @relation("deliveryPartnerOrders")
  otpCodes       OtpCode[]
  refreshTokens  RefreshToken[]
  deliveryProfile DeliveryPartner?

  @@index([role])
  @@index([email])
  @@map("users")
}

model OtpCode {
  id         String    @id @default(uuid())
  userId     String
  codeHash   String    // SHA-256 of the 6-digit code; never store plaintext
  expiresAt  DateTime
  usedAt     DateTime?
  attempts   Int       @default(0)
  createdAt  DateTime  @default(now())

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([expiresAt])
  @@map("otp_codes")
}

model RefreshToken {
  id         String    @id @default(uuid())
  userId     String
  tokenHash  String    @unique
  family     String
  expiresAt  DateTime
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([family])
  @@map("refresh_tokens")
}

model Address {
  id         String   @id @default(uuid())
  userId     String
  label      String   @default("Home") // Home | Work | Other
  line1      String
  line2      String?
  city       String
  state      String
  pincode    String
  latitude   Float?
  longitude  Float?
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  orders     Order[]

  @@index([userId])
  @@map("addresses")
}

model Product {
  id          String          @id @default(uuid())
  name        String
  description String?
  category    ProductCategory
  price       Decimal         @db.Decimal(10, 2)
  unit        String          // "1 kg", "500 g", "6 pcs"
  stock       Int             @default(0)
  imageUrl    String?
  isActive    Boolean         @default(true)
  isFeatured  Boolean         @default(false)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  orderItems  OrderItem[]

  @@index([category, isActive])
  @@index([isFeatured])
  @@index([name])
  @@map("products")
}

model Order {
  id                String        @id @default(uuid())
  orderNumber       String        @unique
  customerId        String
  deliveryPartnerId String?
  addressId         String
  status            OrderStatus   @default(PENDING)
  paymentStatus     PaymentStatus @default(PENDING)
  paymentMethod     PaymentMethod @default(COD)
  subtotal          Decimal       @db.Decimal(10, 2)
  deliveryFee       Decimal       @db.Decimal(10, 2)
  discount          Decimal       @default(0) @db.Decimal(10, 2)
  total             Decimal       @db.Decimal(10, 2)
  notes             String?       @db.VarChar(500)
  idempotencyKey    String?       @unique
  estimatedAt       DateTime?
  deliveredAt       DateTime?
  cancelledAt       DateTime?
  cancelReason      String?       @db.VarChar(300)
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  customer          User          @relation("customerOrders", fields: [customerId], references: [id])
  deliveryPartner   User?         @relation("deliveryPartnerOrders", fields: [deliveryPartnerId], references: [id])
  address           Address       @relation(fields: [addressId], references: [id])
  items             OrderItem[]
  statusHistory     OrderStatusHistory[]
  tracking          OrderTracking?

  @@index([customerId, createdAt])
  @@index([deliveryPartnerId, status])
  @@index([status, createdAt])
  @@index([createdAt])
  @@map("orders")
}

model OrderItem {
  id        String  @id @default(uuid())
  orderId   String
  productId String
  quantity  Int
  unitPrice Decimal @db.Decimal(10, 2)
  total     Decimal @db.Decimal(10, 2)

  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [productId], references: [id])

  @@index([orderId])
  @@index([productId])
  @@map("order_items")
}

model OrderStatusHistory {
  id        String      @id @default(uuid())
  orderId   String
  status    OrderStatus
  note      String?     @db.VarChar(300)
  changedBy String?     // user id; nullable for system transitions
  createdAt DateTime    @default(now())

  order     Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId, createdAt])
  @@map("order_status_history")
}

model OrderTracking {
  id                String   @id @default(uuid())
  orderId           String   @unique
  latitude          Float?
  longitude         Float?
  storeLatitude     Float    @default(12.9716)
  storeLongitude    Float    @default(77.5946)
  customerLatitude  Float?
  customerLongitude Float?
  updatedAt         DateTime @updatedAt

  order             Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@map("order_tracking")
}

model DeliveryPartner {
  id              String   @id @default(uuid())
  userId          String   @unique
  vehicleType     String   @default("BIKE") // BIKE | SCOOTER | EV
  vehicleNumber   String
  isAvailable     Boolean  @default(true)
  isVerified      Boolean  @default(false)
  currentLat      Float?
  currentLng      Float?
  totalDeliveries Int      @default(0)
  earnings        Decimal  @default(0) @db.Decimal(10, 2)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([isAvailable, isVerified])
  @@map("delivery_partners")
}

model Store {
  id                 String   @id @default(uuid())
  name               String   @default("NeuraCart Central")
  address            String
  city               String   @default("Bengaluru")
  state              String   @default("Karnataka")
  pincode            String   @default("560001")
  latitude           Float    @default(12.9716)
  longitude          Float    @default(77.5946)
  phone              String
  email              String
  openTime           String   @default("08:00")
  closeTime          String   @default("22:00")
  deliveryFee        Decimal  @default(40) @db.Decimal(10, 2)
  freeDeliveryAbove  Decimal  @default(500) @db.Decimal(10, 2)
  isOpen             Boolean  @default(true)
  updatedAt          DateTime @updatedAt

  @@map("stores")
}
```

**Deliberate security hardening vs the source:** the tutorial stored OTP codes and refresh tokens in plaintext. NeuraCart stores `OtpCode.codeHash` (SHA-256 with `OTP_PEPPER`) and `RefreshToken.tokenHash` (SHA-256), so a database read cannot be replayed as a login. This is why the field names differ from the video.

**Current repo vs target schema:** the existing `backend/prisma/migrations/20261013061136_init` was created from the earlier design notes. It already has the 11 tables and the right relations, but it still uses plaintext `code`/`token`, lacks `lastLoginAt`, `earnings`, `idempotencyKey`, and store fee fields, and has a wrong `storeLongitude` default (`12.9716` instead of `77.5946`). One alignment migration will be added at the start of the auth step; until then, existing migrations are immutable history and the repo schema is authoritative for what is already deployed locally.

### 10.3 Enum and API mapping

The database uses uppercase enum values; the JSON API uses lowercase for readability. Shared mappers convert at the service boundary:

| Prisma | API JSON | UI label |
|---|---|---|
| `CUSTOMER` | `customer` | Customer |
| `ADMIN` | `admin` | Admin |
| `DELIVERY_PARTNER` | `delivery_partner` | Delivery partner |
| `FRUITS` | `fruits` | Fruits |
| `VEGETABLES` | `vegetables` | Vegetables |
| `MEAT` | `meat` | Meat |
| `PENDING` | `pending` | Order placed |
| `CONFIRMED` | `confirmed` | Confirmed |
| `PREPARING` | `preparing` | Preparing |
| `ASSIGNED` | `assigned` | Rider assigned |
| `OUT_FOR_DELIVERY` | `out_for_delivery` | Out for delivery |
| `DELIVERED` | `delivered` | Delivered |
| `CANCELLED` | `cancelled` | Cancelled |
| `COD` | `cod` | Cash on Delivery |
| `ONLINE` | `online` | Online payment |
| `PAID` / `FAILED` / `REFUNDED` | `paid` / `failed` / `refunded` | — |

**Implementation:** `packages/types` exports `ROLE`, `PRODUCT_CATEGORY`, `ORDER_STATUS`, `PAYMENT_METHOD`, `PAYMENT_STATUS` constants plus `toDbEnum` / `toApiEnum` helpers. Never hard-code enum strings in three apps.

### 10.4 Constraints, indexes, and integrity

| Concern | Implementation |
|---|---|
| One default address | Service transaction clears other defaults before setting; migration adds partial unique index `CREATE UNIQUE INDEX one_default_address_per_user ON addresses("userId") WHERE "isDefault" = true;` |
| Unique order number | `Order.orderNumber @unique`; generation retries on P2002 |
| Duplicate order on double tap | `idempotencyKey @unique`; client sends UUID per checkout attempt |
| Oversell prevention | `UPDATE products SET stock = stock - $qty WHERE id = $id AND stock >= $qty`; if affected rows = 0 → 409 `INSUFFICIENT_STOCK` |
| One tracking row per order | `OrderTracking.orderId @unique` |
| Cascade cleanup | OTPs, refresh tokens, addresses, order items, history, tracking cascade with parent |
| Historical product data | `OrderItem` snapshots `unitPrice` and `total`; renaming/deleting a product does not rewrite past bills |
| Product deletion | Soft delete (`isActive=false`) by default; hard delete only if no `OrderItem` references, otherwise 409 |
| Rider deletion | Deactivate user (`isActive=false`), never delete rows with order history |
| Money | `Decimal(10,2)` in DB; serialize as string in API to avoid float loss; clients format with `Intl.NumberFormat` |
| Timestamps | `DateTime` UTC; API returns ISO strings; UI renders IST |
| Email uniqueness | Lowercase + trim before insert; DB unique |

### 10.5 Transactional order placement

```
BEGIN
  SELECT products FOR UPDATE (or conditional UPDATE ... WHERE stock >= qty)
  validate every product active and stock sufficient
  compute subtotal, deliveryFee, discount, total
  INSERT order
  INSERT order_items (snapshots)
  INSERT order_status_history (PENDING)
  INSERT order_tracking (store coords)
  UPDATE products SET stock = stock - qty
  generate orderNumber from today’s order count (IST)
COMMIT
```

Any failure rolls back everything. The service then:
- logs `order.placed`,
- sends the “Order placed” email asynchronously (failure logged, not fatal),
- returns the order with items, address, customer, history, tracking.

### 10.6 Seed data

`prisma/seed.ts` is idempotent (`upsert` by email/name) and refuses to run in production unless `ALLOW_SEED=true`.

**Store**
- `NeuraCart Central`, 14 MG Road, Bengaluru, Karnataka 560001
- Phone `+91 80 4000 1234`, email `store@neuracart.app`
- Hours 08:00–22:00, delivery fee ₹40, free above ₹500

**Users**

| Role | Email | Password | Name |
|---|---|---|---|
| ADMIN | `admin@neuracart.app` | OTP only | Asha Rao |
| CUSTOMER | `customer@neuracart.app` | OTP only | Sujan Anand |
| DELIVERY_PARTNER | `driver1@neuracart.app` … `driver10@neuracart.app` | `NeuraCart@123` (dev seed only) | Ravi Kumar, Anand Raj, Suresh Babu, Imran Khan, Vinay Gowda, Deepak Shetty, Manoj Naik, Arjun Rao, Karthik S, Naveen Reddy |

All riders: verified, available, bike/scooter/EV, vehicle numbers `KA-01-AB-1001` … `KA-01-AB-1010`, earnings ₹0 (except demo rider may show ₹40 after seeded completed order).

**Addresses (demo customer)**
- Home (default): `12, 4th Cross, Martini Layout`, Bengaluru, Karnataka 560040
- Work: `WeWork, 10th Floor, 80 Feet Road, Koramangala`, Bengaluru, Karnataka 560095

**Products (19 total: 6 fruits, 7 vegetables, 6 meat)**

| # | Name | Category | Unit | Price ₹ | Stock | Featured |
|---|---|---|---|---|---|---|
| 1 | Bananas (Robusta) | Fruits | 1 kg | 60 | 40 | ✅ |
| 2 | Apples (Shimla) | Fruits | 1 kg | 180 | 35 | ✅ |
| 3 | Mangoes (Alphonso) | Fruits | 1 kg | 250 | 25 | ✅ |
| 4 | Oranges (Nagpur) | Fruits | 1 kg | 90 | 30 | — |
| 5 | Grapes (Green) | Fruits | 500 g | 70 | 30 | — |
| 6 | Pomegranate | Fruits | 1 kg | 160 | 20 | — |
| 7 | Tomatoes (Hybrid) | Vegetables | 1 kg | 40 | 50 | ✅ |
| 8 | Onions | Vegetables | 1 kg | 35 | 60 | — |
| 9 | Potatoes | Vegetables | 1 kg | 30 | 60 | — |
| 10 | Spinach | Vegetables | 250 g | 25 | 40 | — |
| 11 | Carrots | Vegetables | 500 g | 45 | 35 | — |
| 12 | Broccoli | Vegetables | 1 pc | 80 | 20 | — |
| 13 | Capsicum (Green) | Vegetables | 500 g | 40 | 30 | — |
| 14 | Chicken Breast | Meat | 500 g | 220 | 15 | ✅ |
| 15 | Chicken Curry Cut | Meat | 1 kg | 280 | 15 | — |
| 16 | Mutton Curry Cut | Meat | 500 g | 420 | 10 | — |
| 17 | Fish (Rohu) | Meat | 1 kg | 260 | 10 | — |
| 18 | Prawns (Medium) | Meat | 500 g | 350 | 8 | — |
| 19 | Eggs (Brown) | Meat | 6 pcs | 60 | 30 | — |

**Demo orders**
1. Delivered: 3 × Bananas, 1 × Spinach, COD, Home address, ₹205 + ₹40 = ₹245, rider Ravi, delivered yesterday.
2. Active: 2 × Mangoes, 3 × Apples, COD, Home address, ₹1,040 + ₹0 = ₹1,040, status `PREPARING`, so the demo can show the admin assigning a rider.

Product images live in `backend/prisma/seed/assets/` and are copied to `backend/uploads/seed/` on seed, so the demo works offline. Production seed uses optimized WebP.

---

## 11. API specification

### 11.1 Conventions

| Item | Rule |
|---|---|
| Base URL | `https://api.neuracart.app/api` (local `http://localhost:8000/api`) |
| Content type | `application/json`; multipart only for product image endpoints |
| Auth | `Authorization: Bearer <accessToken>` |
| IDs | UUID v4 strings |
| Dates | ISO 8601 UTC (`2026-10-22T09:15:00.000Z`) |
| Money | Decimal serialized as string (`"500.00"`) to avoid float errors; clients parse for display |
| Pagination | `page` default 1; `limit` default 20, max 50; response `pagination` object |
| Sorting | Products `createdAt desc`; orders `createdAt desc` |
| Idempotency | `Idempotency-Key` header on `POST /orders` (UUID generated per checkout attempt) |
| Request tracing | `X-Request-Id` accepted or generated; echoed in response and logs |
| Versioning | `/api` for v1; future breaking changes under `/api/v2` |

**Success envelope**
```json
{
  "success": true,
  "message": "Products fetched",
  "data": []
}
```

**Paginated envelope**
```json
{
  "success": true,
  "message": "Orders fetched",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

**Error envelope**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "items.0.quantity", "message": "Quantity must be at least 1" }
  ]
}
```

**Status codes**

| Code | Use |
|---|---|
| 200 | Read/update success |
| 201 | Order/address/product created |
| 204 | Logout with no body (optional; default 200 with message) |
| 400 | Business rule violation (bad state, empty cart, wrong password) |
| 401 | Missing/invalid/expired access token |
| 403 | Authenticated but wrong role/not owner |
| 404 | Resource not found |
| 409 | Conflict: duplicate email, insufficient stock, product in orders |
| 422 | Zod validation failure |
| 429 | Rate limited |
| 500 | Unhandled server error (message hidden in production) |

### 11.2 Endpoint summary

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/send-otp` | Public (OTP limit) | Send customer login OTP |
| POST | `/auth/verify-otp` | Public (OTP limit) | Verify customer OTP, issue tokens |
| POST | `/auth/admin/send-otp` | Public (OTP limit) | Send OTP only to an existing admin |
| POST | `/auth/admin/verify-otp` | Public (OTP limit) | Verify admin OTP, issue admin tokens |
| POST | `/auth/refresh` | Public | Rotate refresh token |
| POST | `/auth/logout` | Public + refresh body | Revoke token family |
| POST | `/auth/logout-all` | Bearer | Revoke all user sessions |
| GET | `/auth/me` | Bearer | Current user |
| PATCH | `/auth/profile` | Bearer | Update name/phone |
| POST | `/auth/delivery/login` | Public (auth limit) | Rider email/password login |
| GET | `/products` | Public | List/filter/search products |
| GET | `/products/featured` | Public | Featured active products |
| GET | `/products/:id` | Public | Product detail |
| POST | `/products` | Admin | Create product (multipart) |
| PATCH | `/products/:id` | Admin | Update product (multipart) |
| PATCH | `/products/:id/toggle` | Admin | Toggle active |
| DELETE | `/products/:id` | Admin | Soft/hard delete |
| GET | `/addresses` | Customer/Admin | List own addresses |
| POST | `/addresses` | Customer/Admin | Create address |
| GET | `/addresses/:id` | Customer/Admin | Address detail |
| PUT | `/addresses/:id` | Customer/Admin | Update address |
| DELETE | `/addresses/:id` | Customer/Admin | Delete address |
| PATCH | `/addresses/:id/default` | Customer/Admin | Set default |
| POST | `/orders` | Customer/Admin | Place order |
| GET | `/orders/my` | Customer/Admin | Own orders (paginated) |
| GET | `/orders/:id` | All roles | Order detail (ownership enforced) |
| POST | `/orders/:id/cancel` | Customer/Admin | Cancel with reason |
| GET | `/orders` | Admin | All orders, filters |
| PATCH | `/orders/:id/status` | Admin | Transition status |
| PATCH | `/orders/:id/assign` | Admin | Assign rider |
| PATCH | `/orders/:id/tracking` | Rider/Admin | Update live coordinates |
| GET | `/orders/:id/tracking` | Customer/Admin/Rider | Read tracking |
| GET | `/delivery/assignments` | Rider | My active/completed assignments |
| PATCH | `/delivery/assignments/:id/accept` | Rider | Accept assignment |
| PATCH | `/delivery/assignments/:id/reject` | Rider | Decline assignment |
| PATCH | `/delivery/assignments/:id/start` | Rider | `OUT_FOR_DELIVERY` |
| PATCH | `/delivery/assignments/:id/complete` | Rider | `DELIVERED` |
| GET | `/delivery/earnings` | Rider | Earnings summary |
| PATCH | `/delivery/availability` | Rider | Online/offline |
| GET | `/delivery/profile` | Rider | Rider profile |
| GET | `/admin/stats` | Admin | Dashboard KPIs |
| GET | `/admin/delivery-partners` | Admin | List riders |
| POST | `/admin/delivery-partners` | Admin | Create rider |
| PATCH | `/admin/delivery-partners/:id` | Admin | Update rider |
| PATCH | `/admin/delivery-partners/:id/verify` | Admin | Verify/unverify |
| GET | `/store` | Public | Store info, fees, hours |
| PATCH | `/store` | Admin | Update store settings |
| GET | `/health` | Public | Liveness/readiness |

### 11.3 Auth endpoints

#### POST `/auth/send-otp`

Request:
```json
{ "email": "customer@neuracart.app" }
```
Rules: valid email, lowercase/trim; if user exists and `isActive=false` → 403 “Your account has been deactivated.”; invalidate previous unused OTPs; generate 6 digits; hash and store; expiry 10 min; send Resend email.

Response `200`:
```json
{ "success": true, "message": "OTP sent to your email", "data": null }
```
Errors: `422` invalid email, `429` too many requests, `500` email provider failure (generic message).

#### POST `/auth/admin/send-otp`

Same body as `/auth/send-otp`, but:
- Only sends an OTP if an **existing, active ADMIN** email matches.
- Never creates a user and never reveals whether the email exists (always returns the same `200` message).
- Uses the same OTP table, expiry, attempt, and rate-limit rules.

#### POST `/auth/admin/verify-otp`

Same body as `/auth/verify-otp`, but the service passes `expectedRole = ADMIN`; if the user’s role is not `ADMIN`, return `403 Access denied. Admins only.` **before issuing any tokens.** This prevents a customer OTP session from ever becoming an admin session and avoids creating customer accounts from the admin login screen.

#### POST `/auth/verify-otp`

Request:
```json
{ "email": "customer@neuracart.app", "code": "508847" }
```
Checks in order: user exists → active → latest OTP exists → attempts < 5 → not expired → hash matches → mark used → issue tokens.

Response `200`:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "uuid",
      "email": "customer@neuracart.app",
      "name": "Sujan Anand",
      "phone": "+919876543210",
      "role": "customer"
    }
  }
}
```
Errors: `400` invalid/expired OTP; `401` too many attempts (or `429`); `403` deactivated.

#### POST `/auth/refresh`

Request `{ "refreshToken": "eyJ..." }` → `200` new pair:
```json
{ "success": true, "message": "Token refreshed", "data": { "accessToken": "...", "refreshToken": "..." } }
```
Rules: verify signature → find hash → if revoked, revoke family and 401 `REFRESH_REUSE`; if expired, 401; revoke old, issue new in same family. Never issue a new family on refresh.

#### POST `/auth/logout`

Request `{ "refreshToken": "..." }` → revoke the token’s family → `{ "message": "Logged out successfully" }`. Idempotent.

#### POST `/auth/logout-all`

Bearer required → revoke all refresh tokens for `req.user.userId`.

#### GET `/auth/me`

Returns `{ id, email, name, phone, role }` from the token/user record. Use DB lookup to catch deactivated users.

#### PATCH `/auth/profile`

Request `{ "name": "Sujan Anand", "phone": "+919876543210" }`; both optional but at least one required; name 2–80; phone 10-digit India or E.164. Email is immutable in MVP.

#### POST `/auth/delivery/login`

Request:
```json
{ "email": "driver1@neuracart.app", "password": "NeuraCart@123" }
```
Rules: user must exist, role `DELIVERY_PARTNER`, active, verified rider profile, bcrypt compare, issue tokens. Response includes `deliveryProfile` (vehicle, availability, earnings). Errors: `401` “Invalid email or password” (do not reveal which), `403` “Account is not verified or inactive.”

### 11.4 Product endpoints

#### GET `/products`

| Query | Type | Default | Notes |
|---|---|---|---|
| `page` | int | 1 | min 1 |
| `limit` | int | 20 | 1–50 |
| `category` | enum | — | `fruits`, `vegetables`, `meat` |
| `featured` | bool | — | `true` only |
| `search` | string | — | name/description contains, insensitive, max 80 |
| `sort` | enum | `newest` | `newest`, `price_asc`, `price_desc` |

Response `200` with `data: Product[]` and `pagination`. Public only returns `isActive=true`.

Product DTO:
```json
{
  "id": "uuid",
  "name": "Mangoes (Alphonso)",
  "description": "Sweet, ripe Alphonso mangoes.",
  "category": "fruits",
  "price": "250.00",
  "unit": "1 kg",
  "stock": 25,
  "imageUrl": "https://api.neuracart.app/uploads/products/mangoes.webp",
  "isFeatured": true,
  "isActive": true,
  "createdAt": "2026-10-20T10:00:00.000Z"
}
```

#### GET `/products/featured`
Returns up to 10 active featured products, newest first.

#### GET `/products/:id`
`200` product; `404` “Product not found”; inactive products return 404 to customers, but admins may pass `?includeInactive=true`.

#### POST `/products` (Admin, multipart)

Fields: `name` (2–80), `description` (optional, ≤ 1000), `category`, `price` (> 0, ≤ 100000), `unit` (1–20), `stock` (int ≥ 0), `isFeatured` (bool string), `isActive` (default true), `image` (optional file).

Rules: validate MIME + magic bytes, max 5 MB, process to WebP 1200×1200, filename `${uuid}.webp`, store under `uploads/products/`. Response `201` product.

#### PATCH `/products/:id`
Same fields optional. If a new image is uploaded, delete the old file after successful DB update.

#### PATCH `/products/:id/toggle`
Body `{ "field": "isActive" | "isFeatured" }`; flips value; returns product. Explicit field avoids accidental toggles.

#### DELETE `/products/:id`
If product has order items → soft delete (`isActive=false`) and `200 { message: "Product deactivated because it appears in past orders" }`. Otherwise hard delete and remove image. `404` if missing.

### 11.5 Address endpoints

Create:
```json
{
  "label": "Home",
  "line1": "12, 4th Cross, Martini Layout",
  "line2": "Near Water Tank",
  "city": "Bengaluru",
  "state": "Karnataka",
  "pincode": "560040",
  "latitude": 12.9551,
  "longitude": 77.5350,
  "isDefault": true
}
```
Rules: labels `Home|Work|Other`; line1 5–120; line2 ≤ 120; city/state 2–60; pincode `^[1-9][0-9]{5}$`; lat −90..90, lng −180..180, both optional; max 10 addresses; first address forced default; ownership checked; `PUT` cannot move address to another user.

`DELETE` a default address: if other addresses exist, promote the most recently created to default in the same transaction.

### 11.6 Order endpoints

#### POST `/orders`

Headers: `Authorization`, optional `Idempotency-Key`.

Request:
```json
{
  "addressId": "uuid",
  "paymentMethod": "cod",
  "items": [
    { "productId": "uuid", "quantity": 3 },
    { "productId": "uuid", "quantity": 1 }
  ],
  "notes": "Ring the bell twice"
}
```

Validation: address belongs to customer; 1–50 total units; 1–20 per product; no duplicate product IDs (merge quantities); payment method enabled; notes ≤ 500.

Server computes:
```
subtotal   = Σ(unitPrice × quantity)
deliveryFee = subtotal >= 500 ? 0 : 40
discount   = 0
total      = subtotal + deliveryFee - discount
```
Response `201`:
```json
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "id": "uuid",
    "orderNumber": "LM-20261022-0007",
    "status": "pending",
    "paymentStatus": "pending",
    "paymentMethod": "cod",
    "subtotal": "500.00",
    "deliveryFee": "0.00",
    "discount": "0.00",
    "total": "500.00",
    "estimatedAt": "2026-10-22T10:15:00.000Z",
    "address": { "...": "..." },
    "items": [
      { "quantity": 3, "unitPrice": "250.00", "total": "750.00", "product": { "name": "Mangoes (Alphonso)" } }
    ],
    "statusHistory": [{ "status": "pending", "note": "Order is placed" }],
    "tracking": { "storeLatitude": 12.9716, "storeLongitude": 77.5946 }
  }
}
```
Errors: `400` empty cart / inactive product / out of hours; `403` address not owned; `409` insufficient stock (include product name); `422` invalid body.

#### GET `/orders/my?page=1&limit=20`
Returns own orders with items + latest status, paginated. Sorted newest first.

#### GET `/orders/:id`
Returns full detail: customer (id/email/name/phone), address, items/product, delivery partner, status history desc, tracking. Ownership enforced by role.

#### POST `/orders/:id/cancel`
Request `{ "reason": "Ordered by mistake" }` (3–300 chars). Customer allowed only if `PENDING|CONFIRMED`; admin may cancel through `OUT_FOR_DELIVERY`. Transaction restores stock and writes history; sends email; if paid online, initiates refund.

#### GET `/orders` (Admin)
Filters: `status`, `paymentStatus`, `from`, `to`, `search` (order number/customer email/phone), `page`, `limit`. Returns list with customer, rider, item count, total.

#### PATCH `/orders/:id/status` (Admin)
```json
{ "status": "confirmed", "note": "Confirmed by store" }
```
Validates transition from current status per §7.1. `409 INVALID_TRANSITION` otherwise. Side effects as per table.

#### PATCH `/orders/:id/assign` (Admin)
```json
{ "partnerId": "user-uuid" }
```
Validates rider role, verified, active, active assignments < 3; sets `deliveryPartnerId`, status `ASSIGNED`, history; notifies rider; optional `note`.

#### PATCH `/orders/:id/tracking` (Rider/Admin)
```json
{ "latitude": 12.9611, "longitude": 77.5801 }
```
Rider must be assignee; order must be `ASSIGNED` or `OUT_FOR_DELIVERY`; updates `OrderTracking`; throttled to one write per 10 s per order (ignore duplicates). `GET` returns latest coordinates + store/customer coordinates + `updatedAt`.

### 11.7 Delivery endpoints

| Endpoint | Behaviour |
|---|---|
| `GET /delivery/assignments?status=active` | Orders where `deliveryPartnerId = me`; groups `new` (`ASSIGNED`), `active` (`OUT_FOR_DELIVERY`), `completed` (`DELIVERED`); includes items count, addresses, customer phone, payout |
| `PATCH /delivery/assignments/:id/accept` | `ASSIGNED` → `ACCEPTED` (stored as history note; status remains `ASSIGNED` until pickup); returns order |
| `PATCH /delivery/assignments/:id/reject` | Only before pickup; clears rider, returns to `PREPARING`, history “Rider declined”; admin notified |
| `PATCH /delivery/assignments/:id/start` | `ASSIGNED` → `OUT_FOR_DELIVERY`; email; `estimatedAt` set |
| `PATCH /delivery/assignments/:id/complete` | `OUT_FOR_DELIVERY` → `DELIVERED`; body `{ "proof": { "type": "photo"|"otp", "value": "..." } }` optional in MVP; COD paid; rider earnings +40; deliveredAt |
| `GET /delivery/earnings?period=today|week|month|all` | `{ total, deliveries, average, payoutPerDelivery: 40, history: [...] }` |
| `PATCH /delivery/availability` | `{ "isAvailable": true }` |
| `GET /delivery/profile` | User + vehicle + totals + rating placeholder |

**Completion transaction:** lock order, verify assignee and status, set `DELIVERED`, `deliveredAt`, `paymentStatus=PAID` if COD, increment `DeliveryPartner.totalDeliveries` and `earnings`, insert history, commit. Emails after commit.

### 11.8 Admin endpoints

#### GET `/admin/stats?range=today|7d|30d`
```json
{
  "todayOrders": 24,
  "todayRevenue": "8420.00",
  "pendingOrders": 3,
  "activeDeliveries": 2,
  "averageOrderValue": "350.83",
  "lowStockCount": 4,
  "totalCustomers": 186,
  "ordersByStatus": { "pending": 3, "confirmed": 1, "preparing": 2, "assigned": 1, "out_for_delivery": 2, "delivered": 15 },
  "revenueSeries": [{ "date": "2026-10-16", "revenue": "6200.00", "orders": 18 }],
  "lowStock": [{ "id": "uuid", "name": "Prawns (Medium)", "stock": 4 }],
  "recentOrders": []
}
```
All values computed server-side; admin only.

#### Delivery partner admin
- `GET /admin/delivery-partners?search=&available=&verified=&page=`
- `POST` `{ name, email, phone, password, vehicleType, vehicleNumber }` → creates User (role DELIVERY_PARTNER) + profile, bcrypt 12, welcome email.
- `PATCH /:id` `{ name, phone, vehicleType, vehicleNumber, isAvailable }`
- `PATCH /:id/verify` `{ isVerified: true }`; unverified riders cannot be assigned.
- `PATCH /:id/deactivate` sets user inactive and unassigns only future orders (active orders must be reassigned manually).

### 11.9 Store and health

- `GET /store` → public store details, fees, hours, `isOpen` (computed from hours + manual flag).
- `PATCH /store` (Admin) → name, address, phone, email, openTime, closeTime, deliveryFee, freeDeliveryAbove, isOpen. Validate `openTime < closeTime`, fees ≥ 0.
- `GET /health` → `{ success: true, message: "Server is running", environment, timestamp, database: "up" }`; readiness checks `SELECT 1`.

### 11.10 Error catalog

| Code | HTTP | Message (user-facing) | Trigger |
|---|---|---|---|
| `VALIDATION_FAILED` | 422 | Validation failed | Zod |
| `UNAUTHORIZED` | 401 | Please sign in again | Missing/invalid token |
| `TOKEN_EXPIRED` | 401 | Session expired | Access token expired |
| `FORBIDDEN` | 403 | You do not have access to this resource | Role/ownership |
| `USER_INACTIVE` | 403 | Your account has been deactivated | Login/refresh |
| `OTP_INVALID` | 400 | Invalid or expired OTP | Wrong/used OTP |
| `OTP_EXPIRED` | 400 | OTP has expired. Please request a new one | Expiry |
| `OTP_ATTEMPTS` | 429 | Too many failed attempts. Request a new OTP | 5 attempts |
| `OTP_RATE_LIMITED` | 429 | Too many OTP requests. Try again in 15 minutes | Rate limit |
| `REFRESH_REUSE` | 401 | Session revoked. Please sign in again | Reused revoked token |
| `ADDRESS_NOT_FOUND` | 404 | Address not found | Missing/other user |
| `PRODUCT_NOT_FOUND` | 404 | Product not found | Missing/inactive |
| `PRODUCT_UNAVAILABLE` | 400 | Product is no longer available | Inactive at checkout |
| `INSUFFICIENT_STOCK` | 409 | Only X left of Product | Stock race |
| `EMPTY_CART` | 400 | Your cart is empty | Place order |
| `INVALID_TRANSITION` | 409 | Cannot change this order to that status | State machine |
| `ADDRESS_REQUIRED` | 400 | Please select a delivery address | Checkout |
| `STORE_CLOSED` | 400 | NeuraCart is closed. Open 8 AM–10 PM | Hours |
| `OUTSIDE_SERVICE_AREA` | 400 | We do not deliver to this pincode yet | Serviceability |
| `UPLOAD_INVALID_TYPE` | 422 | Only JPG, PNG, and WebP images are allowed | MIME/magic |
| `UPLOAD_TOO_LARGE` | 413 | Image must be under 5 MB | Multer limit |
| `RATE_LIMITED` | 429 | Too many requests. Please try again later | Global |
| `INTERNAL` | 500 | Something went wrong | Unhandled |

---

## 12. Backend implementation plan

### 12.1 Environment variables

`backend/.env.example`:
```env
NODE_ENV=development
PORT=8000
DATABASE_URL=postgresql://neuracart_admin:neuracart_dev@localhost:5432/neuracart_db?schema=public

# JWT
JWT_ACCESS_SECRET=replace-with-32-byte-random-string
JWT_REFRESH_SECRET=replace-with-another-32-byte-random-string
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OTP
OTP_EXPIRES_IN_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_RESEND_SECONDS=60
OTP_PEPPER=replace-with-a-32-byte-random-string

# Resend
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM=no-reply@neuracart.app
EMAIL_FROM_NAME=NeuraCart
SUPPORT_EMAIL=support@neuracart.app

# CORS (comma-separated, no trailing slash)
CORS_ORIGINS=http://localhost:3000,http://localhost:8081,http://localhost:8082

# Uploads
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=5
PUBLIC_API_URL=http://localhost:8000

# Business
STORE_TIMEZONE=Asia/Kolkata
DELIVERY_FEE=40
FREE_DELIVERY_ABOVE=500
RIDER_PAYOUT=40
MAX_ACTIVE_ASSIGNMENTS=3
SERVICE_PINCODES=560001,560003,560034,560040,560095
ENABLE_ONLINE_PAYMENTS=false

# Payments (v1.1)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Observability
SENTRY_DSN=
LOG_LEVEL=debug
```

Rules:
- Boot fails fast if a required secret is missing or shorter than 32 chars (`config/env.ts` with Zod).
- Never expose `JWT_*`, `RESEND_API_KEY`, `RAZORPAY_KEY_SECRET` to mobile/admin clients.
- `EXPO_PUBLIC_API_URL` and `NEXT_PUBLIC_API_URL` are the only public vars.
- Production `CORS_ORIGINS` contains only the real admin/domain origins.
- In development only, when `RESEND_API_KEY` is empty, OTP responses include `data.devOtp` and no email is sent. This field is never returned in production; it exists so the first login can be tested without an email provider.

### 12.2 Config and utilities

**`config/prisma.ts`**
- Singleton Prisma client using `globalThis` in dev to survive hot reload.
- `log: ['query','error']` in dev, `['error']` in prod.
- Export named and default; graceful `$disconnect()` on SIGTERM.

**`utils/logger.ts`**
- Levels `debug|info|warn|error`.
- Console colors: info green 32, warn yellow 33, error red 31; debug silent in production.
- Daily file `logs/YYYY-MM-DD.<level>.log`, directory created recursively.
- Format: `[ISO timestamp] [LEVEL] message {json meta}`.
- Redact `authorization`, `password`, `code`, `token`, `refreshToken`, `apiKey`.
- Include `requestId`, `userId`, `role`, `path`, `method`, `durationMs` where relevant.
- Never log OTPs or full emails (mask `s****n@example.com`).

**`utils/jwt.ts`**
```ts
type AccessPayload = { userId: string; email: string; role: Role };
type RefreshPayload = { userId: string; family: string; tokenId: string };
```
- `signAccessToken(payload)` → `JWT_ACCESS_EXPIRES_IN`.
- `signRefreshToken(userId, family)` → `tokenId = uuid()`, returns `{ token, tokenId, family, expiresAt }`.
- `verifyAccessToken` / `verifyRefreshToken` throw typed errors.
- Refresh token is a JWT; only its SHA-256 hash is stored.

**`utils/otp.ts`**
- `generateOtp()` → `crypto.randomInt(100000, 1000000)` six digits.
- `hashOtp(code, userId)` → SHA-256(`${userId}:${code}:${OTP_PEPPER}`); compare with `timingSafeEqual`.
- `getOtpExpiry()` from env; `isExpired(date)`.

**`utils/response.ts`**
```ts
sendSuccess(res, data, message = 'Success', statusCode = 200)
sendPaginated(res, data, pagination, message = 'Success')
sendError(res, message, statusCode = 400, errors?)
getPaginationParams(page, limit) -> { page, limit, skip }
getPaginationMeta(page, limit, total) -> PaginationMeta
```
One argument order only; all controllers use it consistently (the source mixed orders and caused bugs).

**`utils/money.ts`**
- `toDecimal(value)` using Prisma.Decimal; `toMoneyString(decimal)`; `formatINR(number)`.
- Never use `parseFloat` for arithmetic; only for display after server calculation.

**`utils/orderNumber.ts`**
- `nextOrderNumber(tx)` → `LM-${YYYYMMDD in IST}-${String(seq).padStart(4,'0')}`.
- Counts today’s orders (IST) inside the placement transaction, adds 1, and formats the number; on unique collision retry up to 3 times. At high volume, replace with a dedicated Postgres sequence or Redis `INCR`.

### 12.3 Middleware order

```ts
app.use(requestId);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: allowlist, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE'], allowedHeaders: ['Content-Type','Authorization','Idempotency-Key','X-Request-Id'] }));
app.use(globalRateLimiter);
app.use(compression());
app.use(morgan(...));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadDir, { maxAge: '7d', immutable: true }));
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/store', storeRoutes);
app.get('/health', health);
app.use(notFound);
app.use(errorHandler);
```

**Rate limiters**
| Limiter | Window | Max | Key |
|---|---|---|---|
| global | 15 min | 300 | IP |
| otp | 15 min | 5 | `body.email` + IP |
| auth | 15 min | 20 | IP |
| upload | 1 min | 10 | `userId` or IP |
| placeOrder | 1 h | 10 | `userId` |

Use `standardHeaders: true`, `legacyHeaders: false`; return the standard error envelope; log limit hits.

**Auth middleware**
- Parse `Authorization`; missing → 401 “No token provided”; malformed → 401 “Invalid token format”.
- Verify; load user from DB (`id`, `email`, `role`, `isActive`) to catch deactivation; attach `req.user`.
- `authorize(...roles)` → 403 with generic message; log role/path.

**Validation middleware**
- `schema.safeParse(req.body)` (and `req.query` for list endpoints with a separate schema).
- On failure: 422 with `errors: [{ field, message }]`.
- On success: replace body/query with parsed (and coerced) values.
- Never trust `req.query` types; coerce `page`, `limit`, booleans.

**Error handler**
- Prisma `P2002` → 409 with field; `P2025` → 404; `P2003` FK → 400.
- JWT `TokenExpiredError` → 401 `TOKEN_EXPIRED`; `JsonWebTokenError` → 401.
- Multer `LIMIT_FILE_SIZE` → 413; custom upload error → 422.
- Zod → 422.
- Default → 500; hide message in production; always log stack + request context.
- Never leak SQL, stack traces, or secrets to clients.

### 12.4 Module implementation details

#### Auth module
Repository methods:
- `findUserByEmail(email)`, `findUserById(id)`, `createCustomer(email)`, `updateProfile(id, {name, phone})`
- `invalidateActiveOtps(userId)`, `createOtp({userId, codeHash, expiresAt})`, `findLatestActiveOtp(userId)`, `incrementOtpAttempts(id)`, `markOtpUsed(id)`
- `createRefreshToken({userId, tokenHash, family, expiresAt})`, `findRefreshTokenByHash(hash)`, `revokeRefreshToken(id)`, `revokeFamily(family)`, `revokeAllForUser(userId)`
- `findDeliveryUserByEmail(email)` with profile

Service:
- `sendOtp(email)`: find/create customer; reject inactive; invalidate old; hash; store; send email; return generic message.
- `sendAdminOtp(email)`: existing-admin-only variant; always returns the same generic message and never creates a user.
- `verifyOtp(email, code, expectedRole?)`: checks; mark used; if `expectedRole` is set and the user’s role differs, throw 403 before issuing tokens; issue pair with new family; update `lastLoginAt`; return tokens + safe user.
- `verifyAdminOtp(email, code)`: `verifyOtp(email, code, 'ADMIN')`.
- `refresh(token)`: verify; hash lookup; if revoked → revoke family + log security event; check expiry; rotate; return pair.
- `logout(token)`, `logoutAll(userId)`.
- `deliveryLogin(email, password)`: rider checks; bcrypt compare; issue pair.
- `updateProfile(userId, data)`.

Controller: thin; always returns safe user (never `password`).

#### Product module
- Repository `findAll(filter)` builds `where` with `category`, `isActive`, `isFeatured`, `OR: [{name contains}, {description contains}]`, `skip/take`, `orderBy`; uses `$transaction([findMany, count])`.
- Service computes pagination and maps enums. The DB stores relative paths (`/uploads/products/<uuid>.webp`); the serializer returns an absolute URL (`PUBLIC_API_URL + imageUrl`) in every product DTO so all three clients render images identically.
- Create/update validate category/price/stock; image handled by upload service; old image deleted best-effort.
- Delete: referenced → soft delete; else hard delete + file cleanup.
- Toggle explicit field.

#### Address module
- First address default; max 10; set-default transaction (`updateMany false` → `update true`).
- Ownership check on every `get/update/delete/setDefault`.
- Delete default → promote newest other address.
- `pincode` spelling consistent everywhere (DB, API, UI). The source mixed `pinCode`/`pincode`, causing validation failures.

#### Order module
- `placeOrder` as §10.5; merge duplicate product IDs before validating; snapshot prices; calculate server-side; set `estimatedAt = now + 60 min`; set `tracking` store coords and customer coords from address (if present).
- `getMyOrders`, `getById` with role/ownership.
- `adminList` filters and pagination.
- `updateStatus` validates transition table; writes history; sends email; on `DELIVERED` also COD paid; on `CANCELLED` restock/refund.
- `assignPartner` checks rider; max active; writes history; sends rider notification (email in MVP, push v1.1).
- `cancelOrder` transaction: status, reason, restock, history, refund if paid.
- `updateTracking` throttled; validates coords; only assignee.

#### Delivery module
- `getAssignments(userId, group)`; include order, address, customer phone, items count.
- `accept/reject/start/complete` with ownership and state guards.
- `complete` transaction as §11.7; `earnings = +RIDER_PAYOUT`; idempotent (if already delivered, return 200 current state).
- `earnings` computes from delivered orders in period and `DeliveryPartner.earnings` (ledger consistency check).
- `availability` updates profile; `profile` returns safe data.

#### Admin module
- `stats(range)` aggregates via Prisma `groupBy`/raw SQL; uses IST day boundaries.
- `deliveryPartners` CRUD; create user+profile in transaction; welcome email with temporary password (dev) or invite link (prod).
- Never return password hashes.

#### Store module
- `getStore()` returns singleton (create default if missing).
- `updateStore()` validates hours/fees; only admin.

#### Email service
Resend client; templates as functions returning HTML + text:
1. **OTP** — subject “Your NeuraCart login code”; code in large type; “expires in 10 minutes”; “If you didn’t request this, ignore this email.”
2. **Order placed** — order number, items, total, address, ETA.
3. **Confirmed** — “Your order is confirmed and being packed.”
4. **Out for delivery** — rider name, “arriving in 30–60 minutes.”
5. **Delivered** — “Delivered. Enjoy!” + support link.
6. **Cancelled** — reason, refund note if applicable.
7. **Rider assignment** — pickup, drop, payout, order number.
8. **Rider welcome** — credentials/invite.
All sends are wrapped in try/catch, logged, and never block the DB transaction. Use `Promise.allSettled` for multi-recipient sends. Include plain-text fallback. Unsubscribe not required for transactional mail, but include support contact.

#### Upload service
- Multer memory or disk storage; prefer memory + Sharp for validation.
- Check MIME and magic bytes; reject SVG (XSS).
- `sharp(buffer).rotate().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(...)`.
- UUID filename; store relative path `/uploads/products/<uuid>.webp`; serve with long cache headers.
- Delete old file on replace/delete (best-effort).
- Production: switch adapter to S3/Cloudinary; keep the same `uploadService.saveProductImage()` interface.

#### Background jobs (node-cron or a queue)
| Job | Schedule | Action |
|---|---|---|
| Auto-cancel stale online payments | every 5 min | `PENDING` + ONLINE + older than 15 min → cancel, restock |
| Unaccepted assignment timeout | every 5 min | `ASSIGNED` > 10 min without accept → return to admin queue (v1.1) |
| Low-stock digest | 08:00 IST | Email admin products with stock ≤ 5 |
| Daily sales summary | 22:30 IST | Orders, revenue, top products, cancellations |
| Refresh-token cleanup | daily 03:00 | Delete expired/revoked tokens older than 30 days |
| OTP cleanup | daily 03:10 | Delete OTPs older than 24 h |
| Tracking retention | daily 03:20 | Keep tracking only for 30 days after delivery |

For MVP, cron is acceptable; move to BullMQ/Redis when volume grows.

### 12.5 API documentation and contracts

- Generate OpenAPI 3.1 from Zod schemas (`zod-to-openapi`) and serve Swagger UI at `/docs` in non-production.
- `packages/types` exports request/response DTOs used by all clients.
- Contract tests assert the mobile/admin clients and API agree on enums and envelopes.
- Every endpoint has: summary, auth role, request schema, success schema, error codes, example.

---

## 13. Customer mobile app plan

### 13.1 Navigation map

> In this repo all customer routes live under `src/app/` (Expo Router root). The tree below omits the `src/` prefix for readability.

```
app/index.tsx                  Splash / auth gate
├── (auth)/index.tsx           Email entry
├── (auth)/otp.tsx             OTP verification
└── (tabs)/                    Authenticated shell
    ├── index.tsx              Home
    ├── orders.tsx             My Orders
    └── profile.tsx            Profile
        ├── addresses.tsx      Address book
        ├── add-address.tsx    Add address
        ├── edit-address/[id]  Edit address
        └── edit-profile.tsx   Edit profile

Stack screens (outside tabs, header hidden):
├── product/[id].tsx           Product detail
├── cart.tsx                   Cart
├── checkout.tsx               Checkout
├── order/[id].tsx             Order detail
└── tracking/[id].tsx          Live tracking (v1.1)
```

- Expo Router file-based routes; root `Stack` with `(auth)`, `(tabs)`, and stack screens.
- Auth gate: while `isLoading`, show branded splash; if authenticated redirect to `/(tabs)`; else `/(auth)`.
- Deep links: `neuracart://product/:id`, `neuracart://order/:id`, `https://neuracart.app/order/:id` (v1.1).
- Tab bar: active `#16A34A`, inactive `#9CA3AF`, white background, top border `#F3F4F6`, height 70 + safe inset; Ionicons filled/outline pairs (`home`, `receipt`, `person`).
- Hide tab bar on cart/checkout/order detail? Keep it visible except checkout to reduce accidental exits; cart and order detail keep tabs (source hides headers only).

### 13.2 Design system

**Layout**
- Screen background `#F9FAFB`; cards white with `rounded-3xl`, 1px `#F3F4F6` border, subtle shadow (`shadow-sm`).
- Horizontal gutter 20px (`px-5`); card padding 16–20px; section gap 20–24px.
- Headers: white or green; top padding uses `useSafeAreaInsets().top + 12`, never hard-coded `pt-16` (source used fixed padding and broke on some devices).
- Fixed bottom CTAs: white bar, top border, `paddingBottom: insets.bottom + 16`.

**Type scale**

| Role | Size / weight |
|---|---|
| Screen title | 24 / 700 |
| Section title | 18 / 700 |
| Card title | 14–16 / 700 |
| Body | 14 / 400 |
| Meta | 12 / 400–500 |
| Button | 16 / 600 |
| Price | 16–18 / 700, green |
| Badge | 11–12 / 600 |

**Components**
- `Button` (primary green, secondary outline, ghost, danger; loading spinner; disabled 50% opacity).
- `Input` (label, required asterisk, icon, error text, 56px height, `rounded-2xl`, `bg-gray-50`, focus ring green).
- `Card`, `SectionHeader`, `EmptyState`, `ErrorState`, `Skeleton`, `Badge`, `QuantityStepper`, `ProductCard`, `AddressCard`, `OrderCard`, `StatusTimeline`, `BottomBar`, `Sheet/Modal`, `Toast`.
- Icons: Ionicons 14–24px; never use emoji as icons.
- Touch targets ≥ 44×44; `hitSlop` for small icons.
- Motion: 150–220 ms ease; cart badge scale pulse on add; no gratuitous animation.
- Haptics: light impact on add-to-cart and order placed (optional).

**Status colors**

| Status | Text/bg |
|---|---|
| Pending | amber-700 / amber-50 |
| Confirmed | blue-700 / blue-50 |
| Preparing | purple-700 / purple-50 |
| Assigned | indigo-700 / indigo-50 |
| Out for delivery | orange-700 / orange-50 |
| Delivered | green-700 / green-50 |
| Cancelled | red-700 / red-50 |

**Formatting**
- Money: `₹${new Intl.NumberFormat('en-IN').format(amount)}` (no decimals).
- Dates: “22 Oct 2026, 4:30 PM” via `Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })`.
- Relative: “Just now”, “12 min ago”, “Yesterday”.
- Phone: `+91 98765 43210` display; `tel:` link.

### 13.3 State management

**`authStore`** (Zustand + AsyncStorage)
```ts
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sendOtp(email: string): Promise<void>;
  verifyOtp(email: string, code: string): Promise<void>;
  loadStoredAuth(): Promise<void>;
  refreshSession(): Promise<boolean>;
  updateProfile(data: { name?: string; phone?: string }): Promise<void>;
  signOut(): Promise<void>;
}
```
- Keys: `neuracart.accessToken`, `neuracart.refreshToken`, `neuracart.user`.
- On boot: read tokens → `GET /auth/me` → set user; on 401 try refresh once → else clear.
- On sign out: call `POST /auth/logout` with refresh token (best effort), clear tokens, reset cart, navigate to `(auth)`.

**`cartStore`** (Zustand, persisted)
```ts
interface CartState {
  items: CartItem[];                  // { product, quantity }
  addItem(product: Product): void;
  increment(productId: string): void;
  decrement(productId: string): void; // at 1 -> remove
  removeItem(productId: string): void;
  clearCart(): void;
  getSubtotal(): number;
  getDeliveryFee(): number;           // 0 if subtotal >= 500 else 40
  getTotal(): number;
  getItemCount(): number;
  getItemQuantity(productId: string): number;
}
```
- Persist to AsyncStorage under `neuracart.cart.<userId>`; hydrate after login; clear on sign out.
- Reconcile with server: on checkout, server recalculates; if price changed, show a modal “Prices updated” before placing (v1.1).
- Constants `FREE_DELIVERY_ABOVE = 500`, `DELIVERY_FEE = 40` come from `/store`, fallback constants only for offline display.

**`deliveryStore`** (delivery app): availability, assignments, earnings, accept/start/complete actions.

### 13.4 API client and token refresh

`src/lib/api.ts`:
- `BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'`.
- `apiRequest<T>(path, options)`:
  - Adds JSON content type and Bearer token.
  - Parses `{ success, message, data, pagination }`.
  - Throws typed `ApiError { status, code, message, errors }` when `!response.ok`.
  - On `401 TOKEN_EXPIRED`: enqueue requests, call `POST /auth/refresh` once, store new pair, replay queue; if refresh fails, clear session and redirect to login.
  - 15 s timeout via `AbortController`.
  - Network error → “You’re offline. Check your connection.”
  - Never retry non-idempotent POSTs automatically except with the same `Idempotency-Key`.
- Image helper: `resolveImageUrl(path)` → absolute if starts with `http`, else `${BASE_URL}${path}`.
- Log requests only in `__DEV__`, redact tokens.

### 13.5 Screen-by-screen specification

#### S1 — Splash / auth gate (`app/index.tsx`)
- Full-screen white, centered NeuraCart logo, subtle green gradient background (`#F0FDF4` → white), activity indicator.
- Runs `loadStoredAuth()`; minimum display 400 ms to avoid flash.
- Routes: authenticated → `/(tabs)`; otherwise `/(auth)`.
- Error: if `/me` fails due to network, show “Retry” and “Sign in” buttons rather than silently logging out.

#### S2 — Email entry (`(auth)/index.tsx`)
**Layout**
- Green hero (`#16A34A`) with safe-area top, 32px bottom padding: white rounded logo tile 80×80, “NeuraCart” 36/700 white, subtitle “Fresh groceries from your neighbourhood, at your door.”
- Category chips: Fruits, Vegetables, Meat (white/20 background, white text, 12px).
- White form sheet with 24px top radius, overlapping hero by 12px: “Get started” 24/700; “Enter your email to receive a one-time password.”
- Email field with mail icon, placeholder `you@example.com`, `keyboardType=email-address`, `autoCapitalize=none`, `autoCorrect=false`, `autoComplete=email`, `returnKeyType=next`.
- Primary button “Send OTP” + arrow icon; loading spinner and disabled state.
- Trust row: “Fast delivery · Farm fresh · Secure”.
- Legal line: “By continuing you agree to our Terms and Privacy Policy.”

**Validation**
- Empty → inline “Email is required” + alert optional.
- Regex `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` → “Enter a valid email address.”
- Trim + lowercase before sending.
- On success: `router.push({ pathname: '/(auth)/otp', params: { email } })`.
- On 429: “Too many attempts. Try again in 15 minutes.”
- On provider failure: “We couldn’t send the code. Please try again.”

#### S3 — OTP (`(auth)/otp.tsx`)
- Header: back arrow “Change email”; green icon; “Check your email” 24/700; “We sent a 6-digit code to” + email in green semibold.
- Six individual boxes 48×56, `rounded-2xl`, centered 20/700; filled → green border + light green bg; auto-advance; backspace moves back; paste support distributes digits.
- Countdown: “Resend code in 0:59”; enabled after 60 s as green text button. Resend calls `sendOtp`, resets timer, clears boxes, focuses first.
- Primary “Verify OTP”; disabled until 6 digits; spinner while verifying.
- Errors inline: “Invalid code. 4 attempts left.” / “Code expired. Request a new one.”
- Success: replace to `/(tabs)`; haptic success; cart hydrated.
- Security: no OTP in logs/analytics; clear boxes on error; keyboard number-pad; `textContentType=oneTimeCode` (iOS autofill).

#### S4 — Home (`(tabs)/index.tsx`)
**Data**
- On mount and when category/search changes: `GET /products?limit=20&category=&search=` and, when no filter, `GET /products/featured`.
- Debounce search 300 ms; cancel in-flight requests with AbortController.
- Pull-to-refresh both lists; `RefreshControl` tint green.
- Infinite scroll: fetch next page when 300px from bottom; footer spinner; “You’re all caught up.”

**Header**
- Green background, safe-area top + 12.
- “Good morning/afternoon/evening” 12/500 white/80; customer first name 20/700 white (fallback “there” when `name` is null, with a one-time “Complete your profile” nudge).
- Cart button 44×44 white/20 circle with cart icon and badge (`itemCount`, max “9+”).
- Search bar white, 48px, rounded 16, search icon, placeholder “Search fruits, vegetables, meat…”, clear button when non-empty.
- Promo banner (design only at launch): “Free delivery over ₹500” with leaf icon; dismissible per session.

**Categories**
- Horizontal scroll: All, Fruits, Vegetables, Meat; icon + label; active green-600 white text; inactive white gray text with border.
- Selected category persists during session.

**Featured**
- Visible only when `featured.length > 0` and category = all and search empty.
- Header “Featured” + “See all” (navigates to a filtered list or no-op at launch).
- Horizontal cards 160×220: image 120px, featured badge, name, unit, price, Add/stepper.

**All products**
- Heading changes to category label.
- 2-column grid (`FlatList numColumns=2`, gap 12) with `ProductCard`.
- Card: image 140px, featured badge top-left, category badge top-right (subtle), name 2 lines, unit, price, stock hint (“Only 4 left” when ≤ 5), Add button or stepper.
- Add button: green, plus icon, 32px height; stepper: green-50 pill, minus/number/plus; entire card tappable → product detail; buttons `stopPropagation`.
- Out of stock: grayscale image, “Out of stock” badge, disabled Add.
- Empty: illustration + “No products found” + “Try a different search or category” + Clear filters.
- Loading: 6 skeleton cards.
- Error: “Couldn’t load products” + Retry.

**Floating cart bar**
- Appears when `itemCount > 0`, above tab bar with 12px margin: green rounded 24 bar, cart icon + “{n} items · ₹{total}”, “View cart” arrow.
- Animated slide-up; hides on scroll down (optional).

#### S5 — Product detail (`product/[id].tsx`) (P1)
- Large image with back button overlay; featured badge; image aspect 1:1.
- Name 22/700; category chip; rating placeholder (v1.1); price 24/700 green; unit; stock status (“In stock”, “Only 4 left”, “Out of stock”).
- Description with “Read more” if > 4 lines.
- Quantity stepper and “Add to cart” sticky bottom bar with total.
- “Delivery in 30–60 min” and “Free delivery over ₹500” info rows.
- Related products (same category, 4 items) optional.
- If product inactive at load → 404 screen with “This product is no longer available” + Back to home.

#### S6 — Cart (`cart.tsx`)
- Header: back, “My cart”, item count, “Clear all” (confirmation alert).
- Item cards: 96×96 image, name, unit, unit price, stepper, line total, remove (swipe or trash icon with confirm).
- Bill summary card: Subtotal (n items), Delivery fee (Free/₹40), Platform fee (Free), divider, Total; savings card if free delivery.
- Free-delivery progress card when below threshold: progress bar `subtotal/500`, “Add ₹X more for free delivery”; when above: green check “Free delivery unlocked” + “You saved ₹40”.
- Sticky checkout bar: “Proceed to checkout” + total; disabled if empty.
- Empty state: illustration, “Your cart is empty”, “Add fresh products to get started”, “Browse products” → home.
- Price changes: if server price differs at checkout, warn before placing (v1.1).
- Cart persists across app restarts for the logged-in user; cleared on sign out.

#### S7 — Checkout (`checkout.tsx`)
**Sections**
1. Header: back, “Checkout”, “{n} items · ₹{total}”.
2. “Your order” horizontal item strip: 64×64 image, name, ×qty, line total; tap to cart.
3. Delivery address: heading + “Add new”; list of address cards (default first); selected card green border + check; label, line1, line2, city/state/pincode, “Default” badge; edit/delete icons.
   - No address: dashed card “Add delivery address / Tap to add your location”.
   - Selected address persisted for the session; default preselected on load.
4. Payment method: COD (cash icon, “Pay when your order arrives”, default) and Online (card icon, “UPI, cards, netbanking”, disabled with “Coming soon” when flag off).
5. Delivery estimate card: “Estimated delivery / 30–60 minutes after confirmation”.
6. Notes: optional text area, 500 chars, “Instructions for the store/rider”.
7. Bill summary: subtotal, delivery, platform fee, total.
8. Sticky “Place order” bar with total; spinner + disabled while placing.

**Guards**
- No address → alert “Please select a delivery address.”
- Empty cart → alert “Your cart is empty.” + navigate home.
- Store closed / outside service area → server error displayed inline; keep cart.
- Double tap: disable immediately + `Idempotency-Key` UUID.

**Success**
- Alert “Order placed” / “Your order has been placed successfully.” with **View orders** → `router.replace('/(tabs)/orders')`; clear cart; no back navigation to checkout.
- Failure: keep cart and address; show server message; retry allowed.

#### S8 — Add / Edit address (`add-address.tsx`, `edit-address/[id].tsx`)
- Header back + “Add address” / “Edit address”.
- Label segmented chips: Home (home icon), Work (briefcase), Other (location). Selected green.
- Fields: Address line 1* (placeholder “House number, building and street”), Address line 2 (optional, “Landmark, area”), City*, State*, PIN code* (number pad, 6 digits).
- Optional “Use my current location” (v1.1) fills lat/lng and suggests address via geocoding.
- Validation inline on blur + on submit; scroll to first error.
- Save button sticky; spinner; success toast/alert then `router.back()`.
- Edit mode prefilled; delete option at bottom with confirmation (or only in address book).
- Max 10 addresses: disable “Add” with explanation.

#### S9 — Address book (`addresses.tsx`) (P1)
- List cards: label, full address, default badge, Edit / Set default / Delete actions.
- Deleting default promotes the next address; explain in confirmation.
- Empty state + “Add address”.
- Pull-to-refresh.

#### S10 — Orders (`(tabs)/orders.tsx`)
- Header “My orders” + “Track your fresh deliveries”.
- Cards: order number, date/time, status pill with icon, item thumbnails (up to 3 + “+n”), item count, delivery city, total, “View details” chevron.
- Status pill colors per §13.2; cancelled shows reason preview.
- Pull-to-refresh; infinite pagination; empty state “No orders yet / Your order history will appear here” + “Start shopping”.
- Error state with retry.
- Reorder button (v1.1) adds all available items to cart, warns about unavailable ones.

#### S11 — Order detail (`order/[id].tsx`)
- Header back + order number + copy button.
- Status card: current status label, “Estimated delivery 30–60 min after confirmation”, progress bar.
- Timeline: Pending → Confirmed → Preparing → Assigned → Out for delivery → Delivered; completed steps green with check, current step ring, future gray; connector lines; timestamps where available; cancelled replaces timeline with red card + reason.
- Rider card when assigned: name, vehicle, “Call rider” (masked number via backend proxy or `tel:`), “Track” (v1.1).
- Delivery address card.
- Items card: image, name, unit price × qty, line total.
- Bill summary: subtotal, delivery, discount, total; payment method and status.
- Actions: “Cancel order” (only allowed statuses; confirmation + reason sheet); “Need help?” → support email/phone; “Reorder” (v1.1).
- Pull-to-refresh; polling every 30 s while screen focused and order active (v1.1).

#### S12 — Tracking (`tracking/[id].tsx`) (v1.1)
- Map with store pin, rider pin (live), customer pin; route polyline (optional).
- ETA card, rider card with call/chat, status timeline collapsed.
- Poll `GET /orders/:id/tracking` every 15 s while `OUT_FOR_DELIVERY`; stop when backgrounded/delivered.
- Fallback if location stale > 2 min: “Location updating…”.

#### S13 — Profile (`(tabs)/profile.tsx`)
- Header green: avatar circle with initials, name, email, phone; “Edit profile” button.
- Stats row: total orders, delivered, active (computed from orders or `/auth/me` + counts).
- Menu list (icon, label, chevron):
  - My orders → Orders tab
  - Saved addresses → Address book
  - Edit profile
  - Notifications (toggle, v1.1)
  - Help & support (email/phone)
  - Terms & privacy
  - About (version, build)
  - Sign out (red, confirmation)
- Sign out: revoke, clear, navigate to auth; no back.

#### S14 — Edit profile (`edit-profile.tsx`)
- Avatar initials, email read-only, name (2–80), phone (10-digit/ E.164), Save changes; success toast; updates auth store and home greeting.
- Validation inline; server error shown.

### 13.6 Copy deck (key strings)

| Context | Copy |
|---|---|
| Auth hero | “Fresh groceries from your neighbourhood, at your door.” |
| Email CTA | “Send OTP” |
| OTP title | “Check your email” |
| OTP resend | “Didn’t receive the code? Resend” |
| Home greeting | “Good morning/afternoon/evening, {name}” |
| Search | “Search fruits, vegetables, meat…” |
| Free delivery | “Add ₹{x} more for free delivery” |
| Unlocked | “Free delivery unlocked” / “You saved ₹40 on delivery” |
| Empty cart | “Your cart is empty” / “Add fresh products to get started” |
| Checkout CTA | “Place order” |
| Order success | “Your order has been placed successfully.” |
| Orders empty | “No orders yet” / “Your order history will appear here” |
| Cancel | “Cancel order” / “Tell us why you’re cancelling” |
| Sign out | “Sign out” / “You’ll need to verify your email again.” |

### 13.7 Accessibility, performance, and quality

- Every icon-only button has `accessibilityLabel`; images have `accessibilityLabel`/`alt`.
- Dynamic type supported up to 1.3×; avoid fixed-height text containers.
- Contrast ≥ 4.5:1 for body text; green-600 on white passes for large text, use green-700 for small text if needed.
- `FlatList` for product/order lists (not `ScrollView` + map) with `keyExtractor`, `getItemLayout` where possible, `removeClippedSubviews`.
- `expo-image` with blurhash/placeholder, caching, `contentFit="cover"`.
- Memoize `ProductCard`; avoid inline functions in list items; use `useCallback`.
- Debounce search; abort requests; cache home data for 60 s.
- Skeleton loaders instead of full-screen spinners after first load.
- Offline: show cached cart/profile; disable checkout with “You’re offline”.
- Test on iPhone SE (small), iPhone 16, Pixel 7, and a low-end Android (2 GB RAM).
- No console logs in production; Sentry captures unhandled errors with breadcrumbs (no PII).

---

## 14. Admin panel plan

### 14.1 Route map and layout

```
app/page.tsx                  Redirect: authenticated -> /dashboard, else /login
app/login/page.tsx            OTP login (email -> OTP)
app/(dashboard)/layout.tsx    Sidebar + topbar + auth guard
app/(dashboard)/dashboard     KPIs, charts, recent orders, low stock
app/(dashboard)/orders        Orders table + filters
app/(dashboard)/orders/[id]   Order detail + actions
app/(dashboard)/products      Products table
app/(dashboard)/products/new  Create product
app/(dashboard)/products/[id] Edit product
app/(dashboard)/delivery      Delivery partners
app/(dashboard)/settings      Store settings
```

**Sidebar** (240px, white, border-right):
- Logo + “NeuraCart Admin”.
- Nav: Dashboard, Orders (badge with pending count), Products, Delivery partners, Settings.
- Bottom: store open/closed toggle, admin avatar/menu (email, Sign out).
- Active item: green-50 background, green-700 text, left 3px green bar.
- Collapse to icons under 1280px; drawer under 1024px.

**Topbar** (64px, white, border-bottom):
- Page title + breadcrumb.
- Global search (orders/products) with `⌘K` (v1.1).
- “View store” link, notification bell (v1.1), avatar.

**Auth guard**: client-side check `getStoredToken()` + role; redirect to `/login`; backend enforces too. Show skeleton while checking to avoid flash.

### 14.2 Login (`/login`)

- Centered card 440px on `bg-gray-50`; logo, “NeuraCart Admin”, “Sign in to manage your store.”
- Step 1: email field, “Continue with email”; disabled until valid email; loading spinner.
- Step 2: “Check your mail”, “We sent a 6-digit code to {email}”, OTP input (6 digits, single input with spacing or 6 boxes), “Verify & sign in”, “Resend OTP” (60 s), “Change email”.
- Errors: inline red text; 403 non-admin → “Access denied. Admins only.”; 429 → rate-limit message.
- Uses `/auth/admin/send-otp` and `/auth/admin/verify-otp`, so unknown emails never create accounts and non-admin roles never receive tokens.
- On success: store access/refresh/user in localStorage (MVP), `router.replace('/dashboard')`.
- Session expiry: axios interceptor refreshes; on failure clear and redirect with toast “Session expired. Please sign in.”
- Security hardening v1.1: move refresh token to httpOnly, secure, sameSite cookie; add CSRF token.

### 14.3 Dashboard (`/dashboard`)

**KPI cards** (4 across desktop, 2 tablet):
1. Today’s orders — count + % vs yesterday.
2. Today’s revenue — ₹ + % vs yesterday.
3. Pending confirmation — count, amber accent, link to filtered orders.
4. Active deliveries — count, blue accent.

**Secondary row**:
- Average order value (₹).
- Delivered today.
- Cancelled today.
- Low-stock items (count, red if > 0).

**Metric definitions (must match the API)**
- Today’s orders: orders with `createdAt` inside today’s IST day, all statuses.
- Today’s revenue: sum of `total` for orders placed today IST and not `CANCELLED`; refunds are excluded in v1.1.
- Pending confirmation: `status = PENDING`.
- Active deliveries: `status IN (ASSIGNED, OUT_FOR_DELIVERY)`.
- Average order value: today’s revenue ÷ non-cancelled orders placed today.
- Delivered today: `deliveredAt` inside today IST.
- Cancelled today: `cancelledAt` inside today IST.
- Low stock: active products with `stock <= 5`.

**Charts**
- 7-day revenue bar/line chart (recharts), toggle Revenue/Orders.
- Orders by status donut or horizontal bars.
- Date range selector: Today, 7 days, 30 days.

**Lists**
- Recent orders table (8 rows): order #, customer, items, total, status, time, “View”.
- Low stock list: product, stock, “Restock” link to edit.
- “Store is open/closed” status with toggle (admin).

**States**: skeleton cards; error banner with retry; empty “No orders yet today.”

### 14.4 Orders (`/orders`)

**Filters bar**
- Search input (order number, customer name/email/phone).
- Status tabs/pills: All, Pending, Confirmed, Preparing, Assigned, Out for delivery, Delivered, Cancelled, with counts.
- Date range (Today, Yesterday, 7 days, 30 days, custom).
- Payment filter (COD/Online), “Clear filters”.
- Export CSV (v1.1).

**Table columns**
- Order # + placed time.
- Customer (name, phone).
- Items (count + first 2 names).
- Total (₹).
- Payment (method + status badge).
- Status badge.
- Rider (name or “Unassigned”).
- Actions: View; quick Confirm/Cancel where allowed.

**Behaviour**
- Server-side pagination (20/page), sort newest first.
- Row click → detail; keyboard accessible.
- Sticky header; horizontal scroll on tablet.
- Empty state per filter: “No pending orders. You’re all caught up.”
- Auto-refresh every 60 s (optional toggle) or manual refresh button.

### 14.5 Order detail (`/orders/[id]`)

**Header**: order number, placed date/time, status badge, “Print invoice” (v1.1), back.

**Layout**: 2 columns (main 2/3, sidebar 1/3); stacks on tablet.

**Main**
- Status timeline (vertical) with timestamps and actor.
- Items table: image, product, unit price, qty, line total; subtotal/delivery/discount/total.
- Notes from customer.
- Cancellation card if cancelled (reason, time, by whom).

**Sidebar**
- Customer card: name, email, phone, total orders (v1.1), “Call”.
- Delivery address card with map link.
- Payment card: method, status, transaction id (online).
- Rider card: name, vehicle, phone, assigned time; “Reassign”.
- Action panel (contextual):
  - PENDING: Confirm order (primary), Cancel (danger).
  - CONFIRMED: Mark preparing, Cancel.
  - PREPARING: Assign partner (primary), Cancel.
  - ASSIGNED: Reassign, Mark out for delivery (admin override), Cancel.
  - OUT_FOR_DELIVERY: Mark delivered (admin override), Cancel (exception, confirm).
  - DELIVERED/CANCELLED: no actions; “Download invoice”.
- Confirmation modals for every state change; cancel requires reason (3–300 chars).
- Assign modal: search verified riders; rows show name, vehicle, active count, availability; disabled if ≥3 active; “Assign partner”.
- Optimistic UI not used for status; wait for server, then refresh; toast success/error.

### 14.6 Products (`/products`)

**Header**: “Products”, count, “Add product” button.

**Filters**: search, category, status (Active/Inactive), featured toggle, low stock (≤5), sort (newest, price, stock).

**Table**: image thumb, name + unit, category, price, stock (red ≤5), featured star, active toggle, updated, actions (Edit, Delete).

**Create/Edit form** (dedicated page, 2-column):
- Left: name*, description, category* select, price* (₹, 2 decimals), unit* (e.g. “1 kg”), stock* (int), featured checkbox, active checkbox.
- Right: image dropzone (drag/drop or click), preview 1:1, “Remove”, requirements text “JPG, PNG, WebP · max 5 MB · recommended 1200×1200”.
- Validation inline; save disabled while uploading; optimistic image preview; on success toast + redirect to list.
- Delete: confirmation “This product will be removed from the catalog. Past orders are unaffected.” If referenced, API soft-deletes and UI explains.
- Toggle active/featured calls dedicated endpoint; row updates without full reload.
- Bulk actions (v1.1): activate/deactivate, feature/unfeature.

### 14.7 Delivery partners (`/delivery`)

- Header “Delivery partners”, “Add partner”.
- KPI strip: total, verified, available now, active assignments.
- Table: name, email, phone, vehicle + number, verified badge, availability dot, active orders, total deliveries, earnings, actions (Edit, Verify, Deactivate).
- Add/Edit drawer or page: name*, email*, phone*, temporary password* (create only, min 8), vehicle type (Bike/Scooter/EV), vehicle number*, verified toggle.
- Verify action with confirmation; unverified riders excluded from assignment.
- Deactivate: blocked if active orders; prompt to reassign first.
- Partner detail (v1.1): assignment history, earnings, ratings.

### 14.8 Settings (`/settings`)

- Store profile: name, address, city, state, pincode, phone, email, lat/lng.
- Hours: open/close time pickers; “Temporarily closed” toggle.
- Delivery: delivery fee, free-delivery threshold, rider payout (read-only display), max active assignments, service pincodes (chips input).
- Notifications: order emails on/off, low-stock threshold.
- Danger zone: pause store (stops new orders, keeps existing).
- Save bar sticky; validation; audit log of changes (v1.1).

### 14.9 Admin components and conventions

- `DataTable` with sorting, pagination, empty/loading/error, sticky header.
- `StatusBadge` shared with customer colors.
- `ConfirmDialog`, `ReasonDialog`, `Drawer`, `Toast` (sonner), `SkeletonTable`, `FormField`, `ImageUploader`.
- All money via `formatINR`; all dates via `formatDateIST`.
- All mutations show pending state, success toast, and refresh server data.
- Errors map API `message`; field errors map to inputs.
- No `any`; DTOs from `packages/types`.
- Accessibility: labels, focus rings, keyboard navigation, `aria-live` for toasts.
- Responsive breakpoints: 1024, 1280, 1536; sidebar drawer below 1024.
- Dark mode not in MVP; tokens ready.

### 14.10 Admin API client

```ts
const API = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL, timeout: 15000 });
API.interceptors.request.use(config => {
  const token = localStorage.getItem('neuracart.admin.access');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
API.interceptors.response.use(
  r => r,
  async error => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('neuracart.admin.refresh');
      if (!refresh) throw error;
      const { data } = await axios.post(`${BASE}/auth/refresh`, { refreshToken: refresh });
      localStorage.setItem('neuracart.admin.access', data.data.accessToken);
      localStorage.setItem('neuracart.admin.refresh', data.data.refreshToken);
      return API(original);
    }
    throw error;
  }
);
```
- Single-flight refresh (queue concurrent 401s).
- On refresh failure: clear storage, redirect `/login`.
- `lib/auth.ts`: `sendAdminOtp`, `verifyAdminOtp` (calls the admin-only endpoints and still rejects any non-admin response), `getStoredUser`, `isAuthenticated`, `logoutAdmin`.
- Store keys namespaced `neuracart.admin.*`.

---

## 15. Delivery partner app plan

### 15.1 Navigation

> In the delivery app, routes live under `delivery/src/app/` when that app is created. The tree below omits the `src/` prefix.

```
app/index.tsx                Splash / auth gate
app/login.tsx                Email + password
app/(tabs)/                  Authenticated shell
├── assignments.tsx          Active + new assignments
├── history.tsx              Completed deliveries + earnings
└── profile.tsx              Rider profile + logout
app/order/[id].tsx           Assignment detail
```

Tabs: Assignments (bicycle icon), History (receipt), Profile (person). Active tint `#16A34A`.

### 15.2 Login

- Green hero with NeuraCart Delivery logo and “Delivery Partner Portal”.
- Email field (`keyboardType=email-address`), password field with eye toggle, “Sign in” button.
- “Forgot password? Contact the store” (no self-service reset in MVP).
- Errors: “Invalid email or password.” (generic), “Your account is not verified. Contact the store.”, “Account deactivated.”
- On success: store tokens + rider profile; navigate to Assignments.
- Demo credential: `driver1@neuracart.app` / `NeuraCart@123` (seed only; never in production builds).

### 15.3 Assignments (`assignments.tsx`)

**Header**
- Green header: “Hello, {firstName}”, “{n} active assignments”, availability switch “Online / Offline”.
- Pull-to-refresh.

**Sections**
1. **New assignments** (`ASSIGNED`, not accepted): card with order #, “{n} items”, customer area, distance, payout ₹40, “Accept” (primary) / “Decline” (ghost). Accept → `PATCH /accept`; decline → confirmation + `PATCH /reject`.
2. **Active** (`OUT_FOR_DELIVERY`): card with order #, customer name/area, status pill, “Complete delivery” button.
3. **Ready to start** (`ASSIGNED`, accepted): “Start delivery” button.
4. **Completed today**: compact rows with time and ₹40.

**Empty state**: “No assignments right now. Stay online and we’ll notify you.” Illustration + refresh.
**Offline state**: banner “You’re offline. Go online to receive assignments.”

### 15.4 Assignment detail (`order/[id].tsx`)

- Header: back, order #, status badge.
- Payout card: “You earn ₹40 for this delivery”.
- Pickup card: “Pickup from NeuraCart Central”, store address, “Open maps”, “Call store”.
- Drop card: customer name, full address, landmark, “Open maps”, “Call customer” (phone from API), delivery notes.
- Items checklist: name × qty; checkbox per item for rider confidence (local only).
- Timeline/status.
- Sticky action:
  - `ASSIGNED` → “Start delivery” (confirm: “Mark this order as out for delivery?”).
  - `OUT_FOR_DELIVERY` → “Mark as delivered” (confirm: “Confirm the order has been handed to the customer?”).
  - `DELIVERED` → “Delivered” state, payout shown.
- After start: show “On the way” and optionally start foreground location updates.
- After complete: success screen with payout, “Back to assignments”.
- Guard: if order reassigned/cancelled, show “This assignment is no longer active” and refresh.

### 15.5 History (`history.tsx`)

- Earnings summary card: Today, This week, This month, All time; deliveries count; average per delivery.
- List grouped by date: order #, completed time, customer area, ₹40.
- Empty state: “No completed deliveries yet.”
- Pull-to-refresh; pagination.

### 15.6 Profile (`profile.tsx`)

- Avatar initials, name, email, phone.
- Vehicle card: type + number.
- Stats: total deliveries, earnings, member since.
- Availability toggle.
- App version, “Help & support” (call store), “Sign out” (red, confirmation).
- No self-service profile editing in MVP; store admin manages rider data.

### 15.7 Delivery state and API

```ts
interface DeliveryState {
  profile: DeliveryProfile | null;
  assignments: Assignment[];
  earnings: EarningsSummary | null;
  isAvailable: boolean;
  isLoading: boolean;
  fetchAssignments(): Promise<void>;
  accept(id: string): Promise<void>;
  reject(id: string): Promise<void>;
  start(id: string): Promise<void>;
  complete(id: string): Promise<void>;
  setAvailability(value: boolean): Promise<void>;
  loadEarnings(period): Promise<void>;
}
```
- Tokens stored under `neuracart.delivery.*`; separate from customer app.
- API client same refresh-queue behavior as customer app.
- On 401 refresh failure → login.
- Poll assignments every 30 s while foreground and online (v1.1); push notification for new assignment.
- Foreground location: `expo-location.watchPositionAsync({ accuracy: Balanced, timeInterval: 15000, distanceInterval: 30 })`; send only when `OUT_FOR_DELIVERY`; stop on complete/background. Never track when offline.
- Battery: pause updates if battery < 15% and show notice (v1.1).

### 15.8 Delivery UX rules

- One primary action per screen; never ambiguous.
- Destructive/irreversible actions require confirmation with the order number.
- Call/maps use native intents; handle no-telephony devices (tablets) gracefully.
- Show payout before accepting; no hidden deductions.
- If network fails during complete: queue the action with an idempotency key and retry; show “Pending sync” until confirmed. Never show “Delivered” before server 200.
- Mask customer phone until assignment accepted (privacy).
- Support contact visible at all times.

---

## 16. Cross-cutting concerns

### 16.1 Security checklist

| Area | Control |
|---|---|
| Transport | HTTPS only; HSTS in production; secure WebSocket (v1.1) |
| Headers | Helmet: CSP, X-Frame-Options, nosniff, referrer policy; CORP cross-origin for uploads |
| CORS | Explicit allowlist per environment; credentials only where needed |
| Auth | Short access token; rotating refresh; hashed refresh tokens; family reuse detection |
| Passwords | bcrypt cost 12; min 8; no password reuse check in MVP; never log |
| OTP | Hashed at rest; 6 digits; 10 min; 5 attempts; 60 s resend; rate limit per email+IP |
| RBAC | `authorize` on every protected route; ownership checks in services |
| Input | Zod on body/query/params; max lengths; enum allowlists |
| SQL | Prisma parameterised queries only; no raw string interpolation |
| Uploads | MIME + magic bytes; no SVG; max 5 MB; re-encode with Sharp; UUID names; serve from separate path |
| XSS | React escaping; sanitize rich text (none in MVP); CSP; no `dangerouslySetInnerHTML` except email templates |
| CSRF | Bearer tokens for mobile; admin localStorage MVP; httpOnly cookie + CSRF token in v1.1 |
| Rate limits | Global, OTP, auth, upload, order |
| Enumeration | Generic “Invalid email or password”; OTP send always generic; avoid user-exists leaks |
| Secrets | Env/secret manager; never in git; rotate on leak; separate per environment |
| Logging | Redact tokens/passwords/OTP; mask emails; no request bodies with secrets |
| Dependencies | `npm audit`/Dependabot; pin Prisma; review transitive CVEs |
| Admin | Role check server-side; no admin endpoints exposed to mobile; session timeout |
| Payments | Verify Razorpay signature; webhook secret; idempotency; never trust client amount |
| Mobile | No secrets in app bundle; secure storage for tokens (Keychain/Keystore via `expo-secure-store` recommended over AsyncStorage) |
| Privacy | Collect only necessary data; delete/anonymise on request; retention policy |
| Backups | Encrypted; restore tested quarterly |
| Pen test | Before launch: auth, IDOR, upload, payment, rate limit |

**Token storage decision:** source uses AsyncStorage. For production, use `expo-secure-store` for refresh tokens (and access token if size permits) or encrypt at rest; keep AsyncStorage only for non-sensitive profile/cart. Document the deviation.

### 16.2 Validation rules (shared)

| Field | Rule |
|---|---|
| Email | RFC-lite regex, max 254, lowercase, trim |
| OTP | `/^\d{6}$/` |
| Name | 2–80, trimmed, letters/spaces/`.'-` |
| Phone | `^[6-9]\d{9}$` (India) or E.164 `^\+[1-9]\d{7,14}$` |
| Password | 8–72, at least one letter and one number |
| Address line1 | 5–120 |
| Address line2 | 0–120 |
| City/State | 2–60 |
| Pincode | `^[1-9][0-9]{5}$` |
| Latitude | −90..90 |
| Longitude | −180..180 |
| Product name | 2–80 |
| Description | 0–1000 |
| Price | 0.01–100000, 2 decimals |
| Unit | 1–20 |
| Stock | int 0–100000 |
| Quantity | int 1–20 per product; total ≤ 50 |
| Order notes | 0–500 |
| Cancel reason | 3–300 |
| Search | 0–80 |
| Pagination | page ≥ 1; 1 ≤ limit ≤ 50 |
| File | JPG/PNG/WebP; ≤ 5 MB; dimensions ≥ 200×200 recommended |

### 16.3 Logging and observability

**Logs**
- Structured JSON in production (`timestamp`, `level`, `message`, `requestId`, `userId`, `role`, `route`, `status`, `durationMs`, `meta`).
- Human-readable colored console in dev.
- Daily rotating files; retention 30 days; ship to Better Stack/Datadog in production (optional).
- Security events: OTP limit hit, refresh reuse, forbidden access, upload rejection, payment signature failure.

**Metrics**
- Request rate, p95 latency, 5xx rate per route.
- Order placement success/failure, stock conflicts.
- OTP send/verify success, email provider failures.
- Active riders, unassigned orders age, delivery time p50/p95.
- DB connections, slow queries (> 200 ms).

**Alerts**
- 5xx > 1% for 5 min.
- p95 > 1 s for 10 min.
- Unassigned `PREPARING` orders > 15 min.
- Email failure rate > 5%.
- DB CPU > 80% / storage > 80%.
- Health check down 2 min.

**Tracing**
- `X-Request-Id` propagated API → logs → Sentry.
- Sentry for API exceptions, admin errors, mobile crashes; release tags; no PII.

### 16.4 Performance budgets

| Surface | Budget |
|---|---|
| API p95 (reads) | < 300 ms |
| API p95 (place order) | < 800 ms |
| Home first meaningful content | < 2 s on 4G |
| Product image | ≤ 150 KB WebP, lazy loaded |
| Admin dashboard | < 2 s, skeleton immediately |
| Order list | 20/page, < 500 ms |
| Mobile JS bundle | < 4 MB initial (Hermes) |
| DB query | < 100 ms typical; index all filters |

**Techniques**
- DB indexes per §10.4; `select` only needed fields; avoid N+1 with `include`.
- `$transaction` for list+count.
- Cache `/store` and `/products/featured` for 60 s (in-memory or CDN).
- Compress responses; ETag for images.
- Paginate everything; no unbounded lists.
- Admin uses server-side pagination/filtering, not client-side arrays.
- Images: Sharp WebP, responsive sizes, CDN in production.

### 16.5 Accessibility (WCAG 2.1 AA target)

- Contrast 4.5:1 body, 3:1 large text/icons.
- All interactive elements ≥ 44×44 and labeled.
- Forms: visible labels, error text tied to input, focus order logical.
- No color-only status: icon + text + color.
- Screen reader: `accessibilityRole`, `accessibilityState`, `accessibilityHint`; test VoiceOver/TalkBack.
- Admin: keyboard navigable, visible focus, semantic tables, `aria-live` for async updates.
- Reduced motion respected for animations.
- Text zoom 200% without truncation of critical content.

### 16.6 Privacy and legal

- Collect: email, name, phone, addresses, order history, rider location (only during delivery).
- Purpose: fulfil orders, support, fraud prevention, legal compliance.
- Retention: orders 3 years (tax), OTP 24 h, refresh tokens 30 days after expiry, tracking 30 days, logs 30 days.
- User rights: access, correction, deletion (anonymise where tax retention applies), contact `privacy@neuracart.app`.
- Consent: terms/privacy at signup; marketing opt-in separate (none in MVP).
- Rider location: disclosed in rider app; only while on delivery; not sold.
- Payment data: never stored; Razorpay handles card data (PCI DSS).
- Grocery/meat licensing: FSSAI registration displayed on store/legal page; meat sourcing compliance; invoices include GSTIN.
- Legal pages: Terms, Privacy, Refund/Cancellation, Shipping/Delivery, Contact.
- App store: privacy nutrition labels, data safety form, account deletion path.

### 16.7 Notifications

| Event | Channel MVP | Channel v1.1 |
|---|---|---|
| OTP | Email | Email |
| Order placed | Email | Email + push |
| Confirmed | Email | Email + push |
| Out for delivery | Email | Email + push |
| Delivered | Email | Email + push |
| Cancelled | Email | Email + push |
| Rider assignment | Email (MVP) | Push |
| Low stock | Admin email | Admin email |
| Daily summary | Admin email | Admin email |

- Push tokens stored per user/device; Expo Notifications; deep link to order.
- Email templates responsive, tested in Gmail/Outlook/Apple Mail; plain-text fallback.
- Bounce/complaint handling via Resend webhooks (v1.1).

### 16.8 Error and empty-state philosophy

Every screen must define four states: **loading** (skeleton), **empty** (illustration + one action), **error** (message + retry), **success** (content). Never show a blank screen. Never show raw server errors. Use actionable language:
- “Couldn’t load your orders. Check your connection and try again.”
- “This product is no longer available. Browse similar items.”
- “Your session expired. Please sign in again.”

---

## 17. Testing and QA

### 17.1 Test pyramid

| Level | Scope | Tools | Target |
|---|---|---|---|
| Unit | Pricing, fees, status machine, OTP, JWT, validators, mappers | Vitest | 90% on business rules |
| Integration | API + real Postgres, auth, orders, stock, RBAC | Vitest + Supertest + Testcontainers | All endpoints |
| Contract | Response shapes/enums used by apps | Zod schemas + shared types | 100% endpoints |
| Component | Mobile components, forms, stores | Jest + RN Testing Library | Critical components |
| E2E | Full role journeys | Maestro (mobile), Playwright (admin) | 6 golden paths |
| Manual | Devices, accessibility, exploratory | Checklist | Every release |
| Load | Order placement, catalog reads | k6 | 100 concurrent users, p95 < 1 s |
| Security | AuthZ, IDOR, upload, rate limits | Manual + OWASP ZAP | No high findings |

### 17.2 Must-pass test cases

**Auth**
- T-A01 send OTP for new email creates CUSTOMER.
- T-A02 send OTP for inactive user → 403.
- T-A03 OTP expires after 10 min.
- T-A04 6th wrong attempt → locked until new OTP.
- T-A05 verify marks OTP used; replay fails.
- T-A06 access token expires in 15 min; refresh rotates pair.
- T-A07 reuse of revoked refresh revokes family; all sessions fail.
- T-A08 logout revokes family; logout-all revokes all.
- T-A09 customer cannot call admin endpoint (403).
- T-A10 rider login rejects customer credentials and unverified riders.

**Products**
- T-P01 list only active products; pagination metadata correct.
- T-P02 category/filter/search combinations.
- T-P03 featured returns only featured+active.
- T-P04 admin create with image; file re-encoded WebP; >5 MB rejected; SVG rejected.
- T-P05 non-admin create/update/delete → 403.
- T-P06 delete referenced product soft-deletes; unreferenced hard-deletes.
- T-P07 price/stock validation boundaries.

**Addresses**
- T-D01 first address becomes default.
- T-D02 second default clears first atomically.
- T-D03 cannot read/update/delete another user’s address (403).
- T-D04 delete default promotes newest other.
- T-D05 pincode validation and max 10 addresses.

**Orders**
- T-O01 place order computes subtotal/fee/total correctly at ₹499.99, ₹500, ₹500.01.
- T-O02 empty cart rejected.
- T-O03 inactive product rejected.
- T-O04 stock race: two concurrent orders for last unit → one 201, one 409.
- T-O05 multi-item order persists all items (regression from source bug).
- T-O06 stock decremented atomically; cancel restores.
- T-O07 duplicate `Idempotency-Key` returns the same order.
- T-O08 customer cannot read another customer’s order.
- T-O09 rider cannot read unassigned order.
- T-O10 admin sees all with filters/pagination.
- T-O11 invalid status transition → 409.
- T-O12 assign unverified rider → 400; 4th active assignment → 409.
- T-O13 rider start/complete only own order.
- T-O14 complete sets COD paid, deliveredAt, rider earnings +40 exactly once.
- T-O15 cancel paid online triggers refund and REFUNDED.
- T-O16 status emails triggered (mock Resend) and failures don’t roll back.

**Admin**
- T-AD01 non-admin OTP login rejected.
- T-AD02 dashboard stats match seeded data and IST day boundary.
- T-AD03 order table filters/counts.
- T-AD04 product form validation and image preview.
- T-AD05 rider create/verify/deactivate flows.

**Mobile**
- T-M01 auth gate restores session / redirects.
- T-M02 cart badge and totals update on add/increment/decrement/remove.
- T-M03 free-delivery progress at 499/500.
- T-M04 checkout without address blocked.
- T-M05 place order clears cart and navigates to Orders.
- T-M06 pull-to-refresh updates status.
- T-M07 sign out clears tokens/cart.
- T-M08 edit profile updates greeting.

**Delivery**
- T-DL01 login and session restore.
- T-DL02 accept/decline updates admin queue.
- T-DL03 start transitions to OUT_FOR_DELIVERY.
- T-DL04 complete transitions to DELIVERED and updates earnings.
- T-DL05 complete twice is idempotent (no double payout).
- T-DL06 offline complete queues and syncs (v1.1).

### 17.3 Golden E2E paths

1. **Customer COD order**: OTP login → search → add 2 items → cart → checkout → add address → place → see Pending.
2. **Admin fulfilment**: login → confirm → preparing → assign rider → see Assigned.
3. **Rider delivery**: login → accept → start → complete → earnings ₹40.
4. **Customer sees delivered**: refresh orders → detail timeline all green; email received.
5. **Cancel**: customer cancels before preparing → stock restored → admin sees Cancelled.
6. **Product management**: admin creates product with image → appears in customer home after refresh → customer orders it.

### 17.4 QA matrix

| Dimension | Values |
|---|---|
| Devices | iPhone SE (small), iPhone 16, Pixel 7, low-end Android 2 GB, iPad |
| OS | iOS 17/18, Android 12/14/15 |
| Network | Wi-Fi, 4G, throttled 3G, offline, airplane mode |
| Locale | en-IN; currency INR; 12/24h |
| Text size | default, 130%, 200% |
| Roles | customer, admin, rider, unauthenticated |
| Order states | all 7 |
| Payment | COD; online flag off/on (v1.1) |
| Edge | empty catalog, out-of-stock, store closed, expired session, duplicate tap, app backgrounded |

### 17.5 Definition of done per feature

- Acceptance criteria met.
- Unit + integration tests added and passing.
- Works on iOS and Android (mobile) or Chrome/Safari/Edge (admin).
- Loading/empty/error states implemented.
- Accessibility labels and contrast checked.
- Analytics events fired.
- API documented.
- No new lint/type errors.
- Product/design review signed off.
- Feature flag documented (if any).

---

## 18. DevOps and deployment

### 18.1 Local development setup

**Prerequisites**
- Node.js 20 LTS + Yarn 1.22
- Docker Desktop (Postgres) or local PostgreSQL 15
- Expo Go on a physical phone; Xcode (iOS simulator) / Android Studio (emulator)
- Git
- Resend account + API key (or use a test inbox)
- Razorpay test keys (v1.1)

**Steps**
```bash
# 1. Clone and install
git clone https://github.com/crastatelvin/neuracart.git
cd neuracart
npm install
cd backend && npm install && cd ..

# 2. Database
docker compose up -d
cp backend/.env.example backend/.env
# edit DATABASE_URL, JWT secrets, RESEND_API_KEY

# 3. Schema + seed
cd backend
npx prisma generate
npx prisma migrate dev
npm run db:seed
cd ..

# 4. Run everything (flat repo: one command per app)
cd backend && npm run dev     # http://localhost:8000
# in another terminal, from repo root:
npm start                     # Expo customer, port 8081

# admin/ and delivery/ are added later; their commands will be:
# cd admin && npm run dev     # http://localhost:3000
# cd delivery && npm start    # Expo, port 8082
```

**Physical device note:** `localhost` on a phone points to the phone. Set `EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000` (e.g. `http://192.168.1.20:8000`) and add that origin to `CORS_ORIGINS`. The source hit this repeatedly.

**Docker Compose (Postgres only)**
```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: neuracart_admin
      POSTGRES_PASSWORD: neuracart_dev
      POSTGRES_DB: neuracart_db
    ports: ["5432:5432"]
    volumes: ["neuracart_pg:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U neuracart_admin -d neuracart_db"]
      interval: 5s
      timeout: 5s
      retries: 10
volumes:
  neuracart_pg:
```

**Database bootstrap (without Docker)**
```sql
CREATE USER neuracart_admin WITH PASSWORD 'neuracart_dev';
CREATE DATABASE neuracart_db OWNER neuracart_admin;
GRANT ALL PRIVILEGES ON DATABASE neuracart_db TO neuracart_admin;
ALTER USER neuracart_admin CREATEDB;
```

### 18.2 Environment matrix

| Variable | Dev | Staging | Prod |
|---|---|---|---|
| `NODE_ENV` | development | production | production |
| `DATABASE_URL` | localhost | Neon branch | Neon primary + pooler |
| `JWT_ACCESS_SECRET` | dev random | secret manager | secret manager |
| `CORS_ORIGINS` | localhost ports | staging domains | prod domains |
| `ENABLE_ONLINE_PAYMENTS` | false | true (test keys) | true (live keys) |
| `EMAIL_FROM` | onboarding@resend.dev | no-reply@staging.neuracart.app | no-reply@neuracart.app |
| `UPLOAD_DIR` | ./uploads | S3 bucket | S3 bucket + CDN |
| `LOG_LEVEL` | debug | info | info |
| `SENTRY_DSN` | empty | staging project | prod project |

### 18.3 CI pipeline (GitHub Actions)

```yaml
name: CI
on:
  pull_request:
  push: { branches: [main] }
jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18
        env: { POSTGRES_USER: test, POSTGRES_PASSWORD: test, POSTGRES_DB: test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test --if-present
      - run: npm ci --prefix backend
      - run: npm run typecheck --prefix backend
      - run: npx prisma migrate deploy --schema backend/prisma/schema.prisma
        env: { DATABASE_URL: postgresql://test:test@localhost:5432/test }
      - run: npm run build --prefix backend
  # e2e is enabled once admin/ and delivery/ exist and Playwright/Maestro suites are added.
```

**Branching**
- `main` protected; PR required; 1 review; CI green.
- `feat/*`, `fix/*`, `chore/*`; conventional commits.
- Preview deploy for admin on every PR (Vercel).
- API staging deploy on merge to `main`; production deploy on tag `v*`.

### 18.4 Deployment targets

| Component | Platform | Notes |
|---|---|---|
| API | Render / Railway / Fly.io | Docker image; 2 instances; health check `/health`; autoscaling 2–4 |
| PostgreSQL | Neon (or Supabase) | Managed backups, PITR, connection pooling; separate staging branch |
| Admin | Vercel | Next.js App Router; env `NEXT_PUBLIC_API_URL`; preview + prod |
| Customer app | EAS Build + App Store/Play Store | Production channel; OTA updates via EAS Update for JS-only fixes |
| Delivery app | EAS Build + Play Store closed testing | Can stay internal at launch |
| Images | S3 + CloudFront (or Cloudinary) | Signed uploads from API; public read; cache 1 year |
| Email | Resend | Verified domain; dedicated subdomain |
| Payments | Razorpay | Test → live; webhook endpoint `/api/payments/webhook` |
| Monitoring | Sentry + Better Stack/UptimeRobot | Alerts to Slack/email |
| Secrets | Render/Vercel env + 1Password | Rotate quarterly |

**API Dockerfile (multi-stage outline)**
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM deps AS build
COPY backend/ .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 8000
CMD ["node", "dist/server.js"]
```

### 18.5 Database migrations and releases

- Never edit applied migrations; create a new migration.
- `prisma migrate dev` locally; `prisma migrate deploy` in CI/staging/prod.
- Destructive changes require a two-step deploy (add column → backfill → switch → drop later).
- Seed is not run automatically in production; initial catalog loaded once via a controlled script.
- Take a DB snapshot before production migrations.
- Rollback: redeploy previous image; for schema, use forward-fix unless a tested down migration exists.
- Feature flags (`ENABLE_ONLINE_PAYMENTS`, `ENABLE_LIVE_TRACKING`) allow dark launches.

### 18.6 Backups, retention, and disaster recovery

| Item | Policy |
|---|---|
| Postgres backups | Daily automated + PITR 7 days (Neon) |
| Retention | 30 days monthly snapshots |
| Restore test | Quarterly to staging; document RTO/RPO |
| RTO | < 2 hours |
| RPO | < 15 minutes |
| Uploads | S3 versioning + lifecycle; 30-day delete for replaced files |
| Logs | 30 days |
| Secrets | Backed up in password manager; break-glass access |

### 18.7 Runbook (common incidents)

| Symptom | First checks | Action |
|---|---|---|
| API 5xx spike | Sentry, `/health`, DB connections, recent deploy | Roll back deploy; scale DB; check slow queries |
| OTP emails not delivered | Resend dashboard, domain DNS, API key, rate limit | Fix DNS/key; resend; inform support |
| Orders stuck Pending | Admin queue, cron, DB status distribution | Confirm/assign manually; check transition errors |
| Stock wrong | Recent orders, transaction logs, concurrent placements | Reconcile via audit; adjust stock; fix race |
| Rider cannot complete | Assignment owner, status, network | Admin override; verify order state |
| Payment paid but order Pending | Razorpay webhook logs, signature, idempotency | Replay webhook; manual reconcile |
| Admin locked out | OTP email, role, isActive | Seed/reset admin; check logs |
| DB storage high | Table sizes, logs, tracking rows | Archive/cleanup; scale storage |
| App crash on launch | Sentry release, OTA rollback | Roll back EAS Update; ship fix |

### 18.8 Cost estimate (monthly, launch scale)

| Item | Estimate |
|---|---|
| Neon Postgres | $19–39 |
| Render API (2 small instances) | $14–50 |
| Vercel admin | $0–20 |
| Resend | $0–20 (3k emails) |
| S3/CloudFront | $5–15 |
| Sentry | $0–26 |
| Domain/SSL | ~$2 |
| EAS | $0–99 (depending on plan) |
| **Total** | **~$40–270/month** |

---

## 19. Analytics and success metrics

### 19.1 Event taxonomy

| Event | Properties | Surface |
|---|---|---|
| `auth_otp_requested` | `{ role }` | customer/admin |
| `auth_otp_verified` | `{ role, isNewUser }` | customer/admin |
| `home_viewed` | `{ category, search }` | customer |
| `product_viewed` | `{ productId, category, price }` | customer |
| `add_to_cart` | `{ productId, quantity, price, source }` | customer |
| `remove_from_cart` | `{ productId, quantity }` | customer |
| `checkout_started` | `{ itemCount, subtotal }` | customer |
| `order_placed` | `{ orderId, total, paymentMethod, itemCount }` | customer |
| `order_cancelled` | `{ orderId, reason, byRole }` | all |
| `order_status_changed` | `{ orderId, from, to, byRole }` | API |
| `delivery_assigned` | `{ orderId, riderId, activeCount }` | admin |
| `delivery_started` | `{ orderId, riderId }` | delivery |
| `delivery_completed` | `{ orderId, riderId, durationMin, payout }` | delivery |
| `product_created` / `product_updated` | `{ productId, category }` | admin |
| `search_performed` | `{ query, resultCount }` | customer |
| `error_shown` | `{ screen, code }` | all |

Rules: no PII in analytics; `userId` hashed or internal; no OTP/email/phone; consent-aware.

### 19.2 KPIs

| KPI | Target (month 1) | Definition |
|---|---|---|
| Order conversion | ≥ 25% of checkout starts | orders / checkout starts |
| Login success | ≥ 95% | verified / requested |
| Order fulfilment rate | ≥ 98% | delivered / placed |
| Median delivery time | ≤ 45 min | deliveredAt − confirmedAt |
| Cancellation rate | ≤ 3% | cancelled / placed |
| Repeat rate (30d) | ≥ 30% | customers with 2+ orders |
| Average order value | ₹450–600 | revenue / orders |
| Stockout rate | ≤ 5% | order failures due to stock |
| API error rate | < 0.5% | 5xx / requests |
| Crash-free sessions | ≥ 99.5% | mobile |
| Rider acceptance | ≥ 90% | accepted / assigned |
| On-time delivery | ≥ 90% | within ETA |

---

## 20. Timeline, milestones, and team

### 20.1 Solo developer plan (7 weeks)

| Week | Focus | Deliverables | Exit criteria |
|---|---|---|---|
| **0** (2 days) | Setup | Monorepo, Postgres, CI skeleton, branding, env | Apps run locally; health check green |
| **1** | Backend foundation + auth | Prisma schema, migrations, seed, logger, JWT, OTP, Resend, auth endpoints, RBAC | OTP login works; refresh rotation tested |
| **2** | Catalog + addresses + orders backend | Products CRUD/upload, addresses, order transaction, status machine, admin list, delivery endpoints | Integration tests pass; stock race test passes |
| **3** | Customer app core | Auth screens, home, search/categories, product detail, cart | Add-to-cart and totals work on device |
| **4** | Customer checkout + orders + profile | Checkout, addresses, order list/detail, profile, sign out | Full COD order placed on device |
| **5** | Admin panel | Login, layout, dashboard, orders list/detail/actions, products CRUD, riders, settings | Admin completes full lifecycle |
| **6** | Delivery app + integration | Login, assignments, start/complete, earnings, profile; emails; cross-app sync | Rider completes delivery; customer sees Delivered |
| **7** | QA, security, launch | E2E, load, accessibility, Sentry, deploy, store builds, runbook | Launch checklist 100%; pilot order succeeds |

### 20.2 Team of three (4 weeks)

| Week | Backend dev | Mobile dev | Admin/design dev |
|---|---|---|---|
| 1 | Schema + auth + products | Customer auth/home/cart | Admin login/layout/dashboard |
| 2 | Addresses + orders + delivery | Checkout/orders/profile | Orders list/detail/actions |
| 3 | Admin stats/riders/store + emails | Delivery app | Products CRUD/upload/settings |
| 4 | Hardening + tests + deploy | Device QA + builds | Playwright + QA + deploy |

Plus part-time QA/ops in week 4.

### 20.3 RACI

| Workstream | Accountable | Responsible | Consulted | Informed |
|---|---|---|---|---|
| Product/scope | Founder | PM/lead | Store ops | Team |
| Backend | Lead dev | Backend dev | Mobile/admin | Founder |
| Customer app | Lead dev | Mobile dev | Design | Founder |
| Admin | Lead dev | Frontend dev | Store ops | Founder |
| Delivery app | Lead dev | Mobile dev | Rider ops | Founder |
| Design | Design lead | Designer | PM | Team |
| QA | QA lead | QA | Devs | Founder |
| Launch | Founder | Lead dev | Legal/ops | Team |

### 20.4 Milestones

| Milestone | Date (relative) | Criteria |
|---|---|---|
| M0 — Foundations | Day 2 | Repo, DB, CI, health check |
| M1 — Auth done | Day 7 | OTP + JWT + RBAC tested |
| M2 — Backend complete | Day 14 | All P0 endpoints + tests |
| M3 — Customer MVP | Day 21 | Full order on device |
| M4 — Admin MVP | Day 28 | Full fulfilment in admin |
| M5 — Delivery MVP | Day 32 | Rider completes delivery |
| M6 — Feature complete | Day 38 | Emails, tracking, polish |
| M7 — Launch ready | Day 45 | QA/security/deploy checklist |
| M8 — Public launch | Day 49 | Pilot orders, monitoring green |

---

## 21. Risks and mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Scope creep (payments, tracking, multi-store) | High | High | Freeze MVP scope; feature flags; roadmap in §3 |
| R-02 | OTP email deliverability | Medium | High | Verify domain (SPF/DKIM/DMARC); monitor Resend; fallback “contact support”; test Gmail/Outlook |
| R-03 | Overselling under concurrency | Medium | High | Conditional stock update in transaction; load test; alerts |
| R-04 | Order stuck / invalid transition | Medium | Medium | State machine + tests; admin override with audit; alerts for stale Pending/Preparing |
| R-05 | Rider supply insufficient | Medium | High | Seed/recruit 10 riders; max 3 active; unassigned alert; pickup fallback |
| R-06 | Payment gateway delay | High | Medium | COD launch; online flag off; Razorpay v1.1 |
| R-07 | Live tracking battery/accuracy | Medium | Medium | Foreground polling; balanced accuracy; stop when inactive; v1.1 |
| R-08 | Admin account takeover | Low | High | OTP + RBAC + rate limits; short sessions; Sentry; httpOnly v1.1 |
| R-09 | Image upload abuse | Medium | Medium | MIME+magic validation, size limit, re-encode, rate limit, storage quotas |
| R-10 | Prisma/Expo upgrade breakage | Medium | Medium | Pin Prisma 5.22, Expo SDK 57; upgrade deliberately with regression tests |
| R-11 | Device networking (localhost) | High | Low | LAN IP env; CORS allowlist; documented in setup |
| R-12 | Timezone/date bugs (IST vs UTC) | Medium | Medium | Store UTC; compute IST day boundaries server-side; tests |
| R-13 | Money rounding errors | Medium | High | Decimal DB, server-side totals, integer paise in tests |
| R-14 | Email status helper never called | High | Medium | Wire triggers in status service + tests (source bug) |
| R-15 | Mobile store rejection | Low | High | Privacy labels, account deletion, review notes, no external payment links |
| R-16 | FSSAI/GST compliance | Medium | High | Register FSSAI, display license, GST invoices, legal review |
| R-17 | Single store operational failure | Low | High | Manual “store closed” toggle; support number; refund policy |
| R-18 | Data loss | Low | High | Managed backups, PITR, restore drills |
| R-19 | Refund disputes | Medium | Medium | Clear cancellation policy; audit trail; Razorpay refunds |
| R-20 | Notification spam | Medium | Low | Transactional only; throttling; user preferences v1.1 |

---

## 22. Source bug log — do not repeat

The tutorial hit these issues live. Each is a checklist item for NeuraCart.

| # | Source issue | NeuraCart prevention |
|---|---|---|
| B-01 | Free-delivery threshold spoken as ₹230, coded as ₹500 | Single constant from `/store`; UI and server read the same value; boundary test at ₹500 |
| B-02 | `sendSuccess` argument order differed between modules | One typed helper signature; lint rule/contract test |
| B-03 | `sendStatusMail` defined but never called | Status service calls `emailService.onStatusChange`; integration test asserts send |
| B-04 | Address schema omitted `pincode` | Shared Zod schema + contract tests; one spelling (`pincode`) across DB/API/UI |
| B-05 | Address lat/lng required but form did not collect them | Make fields optional; only require if “use my location” |
| B-06 | JWT access expiry raised to 7 days to fix a demo error | Keep access 15 min; fix refresh interceptor and clock skew instead |
| B-07 | `authorize("custmer")` typo caused 403 | Shared role constants; type-safe `authorize`; tests per role |
| B-08 | Multi-item order persisted only one item | Unit test with 3 distinct items; inspect `items.create` mapping |
| B-09 | Expo default `app/index.tsx` hijacked the initial route | Explicit auth gate at `app/index.tsx`; no duplicate route |
| B-10 | Prisma 7/8 breaking changes | Pin `prisma@5.22.0` and `@prisma/client@5.22.0`; upgrade ticket |
| B-11 | `localhost` API unreachable from phone | LAN IP env + CORS docs; runtime banner in dev if API unreachable |
| B-12 | Resend `MAIL_FROM` invalid (`mail`) | Env validation at boot; send test email in CI staging smoke |
| B-13 | `onboarding@resend.dev` only delivers to account owner | Verify `neuracart.app` domain before launch |
| B-14 | Missing default exports (`service`, `controller`, `router`) | Module template + lint/test import smoke |
| B-15 | `getPaginationMeta` missing export | Shared response util with tests |
| B-16 | Order detail catch called `router.back()` and hid errors | Show error state with retry; log; never swallow |
| B-17 | `pinCode` vs `pincode` mismatch | One field name; generated types |
| B-18 | Order enum casing mismatch (`pending` vs `PENDING`) | Shared mappers + contract tests |
| B-19 | Decimal serialized inconsistently | Serializer returns money strings; clients format |
| B-20 | Rider/customer tokens mixed in one store | Separate storage namespaces per app |
| B-21 | No idempotency on Place Order | `Idempotency-Key` + unique constraint |
| B-22 | Stock decrement outside transaction | Single transaction + conditional update |
| B-23 | Status changes had no audit | `OrderStatusHistory` on every transition |
| B-24 | Admin panel only reached login in the transcript | This plan fully specifies admin pages and APIs |
| B-25 | Delivery app not coded | This plan fully specifies it; build in week 6 |

---

## 23. Launch checklist

### Product
- [ ] All P0 requirements from §5 implemented and accepted.
- [ ] Customer can complete COD order end to end on iOS and Android.
- [ ] Admin can confirm → prepare → assign → out for delivery → delivered.
- [ ] Rider can accept → start → complete; earnings correct.
- [ ] Cancellation restores stock and shows reason.
- [ ] Emails arrive for OTP, placed, confirmed, out for delivery, delivered, cancelled.
- [ ] Empty/loading/error states on every screen.
- [ ] Copy proofread; no “Fresh Cart” strings left.
- [ ] App icons, splash, store screenshots, descriptions ready.

### Data
- [ ] Production schema migrated; no drift (`prisma migrate status`).
- [ ] Store row configured with real address, hours, fees.
- [ ] Admin account created; test customer/rider accounts removed or secured.
- [ ] 19+ products with real images, prices, stock.
- [ ] 10 riders verified; at least 3 available at launch.
- [ ] Backup taken; restore tested.

### Security
- [ ] Secrets rotated and stored in secret manager.
- [ ] CORS locked to production domains.
- [ ] Rate limits verified in staging.
- [ ] RBAC matrix tested (customer/admin/rider).
- [ ] IDOR tests pass (addresses, orders, tracking).
- [ ] Upload validation tested (SVG, 6 MB, fake MIME).
- [ ] OTP brute-force test passes.
- [ ] Refresh reuse revokes family.
- [ ] Dependency audit clean (no high/critical).
- [ ] HTTPS/HSTS; security headers verified.
- [ ] Pen-test checklist signed off.

### Infrastructure
- [ ] API deployed with 2 instances; health checks green.
- [ ] DB connection pooling; backups/PITR on.
- [ ] Admin deployed; preview/prod envs.
- [ ] S3/CloudFront configured; image URLs work.
- [ ] Resend domain verified; test emails pass.
- [ ] Sentry wired for API/admin/mobile; alerts to on-call.
- [ ] Uptime monitor on `/health` and admin login.
- [ ] Logs shipping and retention configured.
- [ ] Load test: 100 concurrent users, p95 < 1 s, no stock errors.

### Mobile
- [ ] EAS production build installed on real devices.
- [ ] Deep links tested.
- [ ] Permissions (location v1.1) explained.
- [ ] Crash-free test session.
- [ ] App Store/Play Store listing, privacy labels, data safety.
- [ ] Account deletion path documented (store requirement).
- [ ] OTA update channel configured.

### Operations
- [ ] Support phone/email monitored.
- [ ] Runbook shared with on-call.
- [ ] Refund/cancellation policy published.
- [ ] FSSAI/GST details on site/invoices.
- [ ] Rider onboarding/training doc.
- [ ] Admin training session.
- [ ] Launch-day war room and rollback plan.
- [ ] Pilot: 10 orders with real users before public announcement.

### Legal
- [ ] Terms, Privacy, Refund, Delivery policies live.
- [ ] Cookie/consent (admin analytics) if applicable.
- [ ] Vendor DPAs (Resend, Neon, Render, Sentry).
- [ ] Trademark/domain check for “NeuraCart”.
- [ ] Insurance/liability for delivery ops (consult local advisor).

---

## 24. Future roadmap

> **Status (Oct 2026):** v1.0 shipped — customer app, backend, admin panel, and rider app are built and verified. The v2.0/v2.1 items below have been **approved and expanded** into the concrete §26 v2 roadmap: all tiers were green-lit for implementation with free-tier resources only.

| Release | Theme | Highlights |
|---|---|---|
| **v1.0** | Launch | COD, single store, 3 apps, emails, admin ops |
| **v1.1** | Trust & speed | Razorpay, live tracking, push, proof of delivery, reorder, favourites, CSV export |
| **v1.2** | Operations | Low-stock automation, daily reports, rider ratings, support inbox, coupons |
| **v2.0** | Growth | Multi-store, serviceability polygons, slots, subscriptions, referrals, Kannada/Hindi |
| **v2.1** | Scale | Route optimisation, batching, warehouse integration, web storefront, loyalty |
| **v3.0** | Platform | Multi-vendor marketplace, partner APIs, ads, analytics product |

**Sequencing principle:** deepen the single-store experience before adding stores. Every new surface must reuse the same order state machine and API contracts.

---

## 25. Appendices

### 25.1 Appendix A — Command cheat sheet

```bash
# Install
npm install
cd backend && npm install && cd ..

# Database
docker compose up -d
cd backend
npx prisma generate
npx prisma migrate dev --name <name>
npx prisma migrate deploy
npm run db:seed
npx prisma studio
cd ..

# API
cd backend
npm run dev
npm run build
npm start
npm test
cd ..

# Customer (repo root)
npm start
npx expo start --clear
npx expo run:ios
npx expo run:android

# Delivery (once created)
cd delivery && npm start

# Admin (once created)
cd admin && npm run dev
cd admin && npm run build

# Quality
npm run lint
npm run typecheck
npm test --if-present
npm run test:e2e

# EAS
eas build --profile production --platform all
eas submit --platform ios
eas submit --platform android
eas update --branch production --message "fix: ..."
```

### 25.2 Appendix B — Source feature traceability

| Source feature | NeuraCart section |
|---|---|
| Three roles: customer/admin/delivery | §4 |
| Single store, fruits/vegetables/meat | §1, §3.5, §8 |
| Customer tabs Home/Orders/Profile | §13.1 |
| Greeting by time of day | §13.5 S4 |
| Category filters | §13.5 S4 |
| Featured products | §13.5 S4, §11.4 |
| Search | §13.5 S4 |
| Add to cart / steppers / badge | §13.3, §13.5 S4/S6 |
| Bill summary, platform fee “Free” | §8 BR-05/06, §13.5 S6 |
| Free delivery threshold | §8 BR-05 (₹500), §22 B-01 |
| COD/online selection | §11.6, §13.5 S7, §3.2 |
| Address labels, default, delete | §11.5, §13.5 S8/S9 |
| Place order / clear cart / View Orders | §6.1, §13.5 S7 |
| Orders list, pull-to-refresh | §13.5 S10 |
| Order detail timeline, items, bill | §13.5 S11 |
| Profile edit, sign out | §13.5 S13/S14 |
| OTP email login | §11.3, §13.5 S2/S3 |
| Admin login OTP, admin-only | §14.2 |
| Admin today’s orders, revenue | §14.3 |
| Admin confirm/cancel/preparing | §7.1, §14.5 |
| Assign delivery partner | §7.1, §14.5 |
| Out for delivery/delivered | §7.1, §14.5, §15 |
| Product CRUD + image upload | §11.4, §14.6 |
| Admin stats | §11.8, §14.3 |
| Rider email/password login | §11.3, §15.2 |
| Rider assignments/earnings ₹40 | §11.7, §15.3–15.5 |
| Status emails | §12.4 email service |
| JWT access 15m/refresh 7d, rotation | §8 BR-25, §11.3 |
| bcrypt cost 12 | §8 BR-26 |
| Rate limits | §8 BR-27, §12.3 |
| Helmet/CORS/Zod security | §16.1 |
| Multer + Sharp images | §12.4 upload |
| Prisma + PostgreSQL schema | §10 |
| Layered architecture | §9.2 |
| Seed products/riders | §10.6 |
| Pull-to-refresh cross-app status | §6.1, §13.5 S10 |
| Real-time tracking | §3.2, §13.5 S12, §15.7 |
| Online payment | §3.2, §6.5 |
| Delivery app logout/profile | §15.6 |

### 25.3 Appendix C — Open decisions

| # | Decision | Recommendation | Owner | Needed by |
|---|---|---|---|---|
| D-01 | Online payment provider | Razorpay (India, UPI/cards) | Founder | v1.1 |
| D-02 | Token storage | `expo-secure-store` for refresh; AsyncStorage for non-sensitive | Mobile lead | Before build |
| D-03 | Image hosting | S3 + CloudFront in prod | Backend lead | Staging |
| D-04 | Live tracking transport | 15 s polling MVP; WebSocket v2 | Mobile lead | v1.1 |
| D-05 | Rider acceptance model | Admin assigns; rider accepts; 10 min timeout | Ops | Build |
| D-06 | Customer cancellation cutoff | Only while PENDING/CONFIRMED | Ops | Build |
| D-07 | Rider payout | ₹40/order, platform-funded | Founder | Build |
| D-08 | Serviceability | Pincode allowlist at launch; polygons v2 | Ops | Build |
| D-09 | Tax/invoice | GST-inclusive prices; invoice with GSTIN | Accountant | Launch |
| D-10 | Multi-store timing | After 100 orders/week and stable ops | Founder | v2 |
| D-11 | Admin session storage | localStorage MVP; httpOnly cookie v1.1 | Security | v1.1 |
| D-12 | Push notifications | Expo Notifications | Mobile lead | v1.1 |

### 25.4 Appendix D — Glossary

| Term | Meaning |
|---|---|
| **COD** | Cash on delivery |
| **OTP** | One-time password (6 digits, email) |
| **Access token** | Short-lived JWT (15 min) |
| **Refresh token** | Long-lived JWT (7 days) stored hashed, rotated |
| **Family** | Group of refresh tokens from one login; reused token revokes all |
| **RBAC** | Role-based access control |
| **Idempotency key** | Client UUID ensuring a repeated request creates one order |
| **Soft delete** | Mark inactive instead of removing a row |
| **PITR** | Point-in-time recovery |
| **EAS** | Expo Application Services (build/submit/update) |
| **RTO/RPO** | Recovery time/point objective |
| **AOV** | Average order value |
| **ETA** | Estimated time of arrival |
| **IST** | India Standard Time (UTC+05:30) |

### 25.5 Appendix E — Final acceptance statement

NeuraCart v1.0 is accepted when:

1. A new customer can install the app, verify email, add groceries, save an address, place a COD order, and see it progress to **Delivered**.
2. A store admin can log in, see the order, confirm it, prepare it, assign a verified rider, and see the final status.
3. A rider can log in, accept the assignment, start delivery, complete it, and see **₹40** added to earnings.
4. Stock decreases on order and restores on cancellation; totals always equal the server calculation; the free-delivery boundary at ₹500 is correct.
5. Emails arrive for every milestone; no OTP or token appears in logs.
6. All P0 tests pass; no high/critical security findings; monitoring and backups are live; the runbook is published.
7. Every customer-facing string says **NeuraCart**, not Fresh Cart.

---

*End of plan — NeuraCart v1.0.*

---
---

# 26. v2 Roadmap — approved advanced & AI features (Oct 2026)

> **Decision log:** After a competitive research pass (Instacart, GoPuff, Swiggy, Blinkit, Zepto, BigBasket, practical RAG guides), the owner approved **all six proposed tiers** for implementation: AI-on-our-data, LLM flagship, heavyweight foundations, growth, rider/logistics, and polish/voice. **Free resources only**: Gemini API free tier, open-meteo, Expo push, Razorpay *test-mode* keys, WhatsApp Cloud API env-gated (no cost incurred without a real account). Everything must remain fully functional **without** any external key via deterministic fallbacks — the same pattern as dev OTP.

## 26.1 Provider matrix (feature → provider → fallback)

| Capability | Provider (free tier) | Model/config | Fallback when key/config absent |
|---|---|---|---|
| Chat assistant, catalog drafting, note summarisation, NL admin ops, review sentiment | Google Gemini API | `gemini-3.8-flash` (backend env `GEMINI_MODEL`, configurable) | Rules-based canned assistant / skipped draft |
| Semantic search + embeddings | Gemini embeddings (`text-embedding-004`, env `GEMINI_EMBEDDING_MODEL`) | Vectors cached on product rows | keyword (ILIKE) search |
| Vision search + vision catalog ingest | Gemini multimodal (same chat model, image part) | — | error `AI_UNAVAILABLE` |
| Demand forecasting, reorder, personalised home, CF “frequently together” | Own heuristics on order history (weighted weekday recency model) | SQL/JS only | — (always on) |
| Weather/surge mode | open-meteo (keyless) | Bengaluru coords | “normal” mode |
| Push notifications | Expo push service (free, keyless) | expo-notifications token registry | in-app + email only |
| Payments | Razorpay **test mode** keys (env-gated) + **UPI intent deep-link** (`upi://pay?pa=…&tr=<orderNumber>`) which costs nothing | `RAZORPAY_KEY_ID/SECRET` | UPI intent + UTR confirmation flow (works today, admin verifies) |
| WhatsApp updates | Meta WhatsApp Cloud API (env-gated: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`) | utility templates | logged + email only |
| Route/dispatch heuristics, ETA, batching | Own geo math (haversine + OSRM-free straight-line) | in-process | — (always on) |

**Quota discipline:** one in-process token-bucket per Gemini call class (chat 3 rpm, embed 10 rpm, vision 3 rpm), exponential backoff on 429, and a 24h circuit breaker that pins the feature to fallback after repeated failures.

## 26.2 Phase plan (each phase = verified, committed, pushed)

- **P0 — Platform hooks.** ✅ Gemini client w/ rate limiting + fallbacks; in-process event bus + SSE endpoint (`/api/updates`); env plumbing; `plan.md` §26 (this document).
- **P1 — Data delta.** ✅ Prisma migration for every new model/field (§26.3); idempotent seed extension (recipes, help articles, slots, wallet, loyalty defaults).
- **P2 — AI-on-our-data (no LLM).** ✅ Recommendation service: reorder nudges, buy-again, frequently-together (co-purchase CF); personalised home feed; dietary prefs; product reviews (photo-less v1) + moderation; green score.
- **P3 — LLM suite.** ✅ Semantic search (hybrid); “Ask NeuraCart” chat with cart-tool JSON protocol; vision search; recipe→cart; AI substitutions; admin NL-ops console; AI catalog draft; note summarisation; help-article support chat.
- **P4 — Money & scheduling.** ✅ Wallet ledger + checkout redemption; loyalty points/tiers + referral program; near-expiry flash deals; delivery slots with capacity; store-pickup mode; subscriptions (weekly cadence, runs into pending orders); UPI intent flow + Razorpay test-mode integration.
- **P5 — Logistics.** ✅ Rider live GPS (expo-location → tracking endpoint → rider/customer UI); smart dispatch suggestions; 2-order batching; proof-of-delivery (photo + 4-digit OTP); weather surge mode.
- **P6 — Engagement & polish.** ✅ Expo push notifications; ✅ WhatsApp module (env-gated); ✅ risk flags (rapid cancellations); EN/KN/HI string catalogue + language toggle and voice search remain deferred.
- **P7 — Verification & docs.** ✅ Backend logic test suite (`npm test`), README/plan updates; Playwright screenshot evidence remains deferred (the suites from v1 cover the core flows).

## 26.3 Data-model delta

New enums: `WalletTxnType {REFUND, CASHBACK, REFERRAL, GIFT, REDEEM}`, `LoyaltyTier {GREEN, SILVER, PRIME}`, `SlotDay {today, tomorrow}`, `SubscriptionStatus {ACTIVE, PAUSED, CANCELLED}`, `WeatherMode {NORMAL, RAIN, HEAVY}`, `SupportKind {SHOPPING, SUPPORT}`, `BatchStatus…` (implicit).

New models (all `@@map` snake_case, uuid ids, Decimal(10,2) money):
- `UserPrefs` (1:1 user): `dietTags String[]`, `householdSize Int?`, `language String @default("en")`, `pushEnabled`, `greenBags Boolean @default(true)`.
- `Wallet` (1:1 user, `balance Decimal`), `WalletTransaction (userId, type, amount, orderId?, note, createdAt)`.
- `LoyaltyAccount` (1:1 user: `points`, `lifetimeSpend`, `tier`); `ReferralCode` (user-unique code, `referredCount`, `creditsEarned`), used at signup by code.
- `ProductReview (orderId, productId, userId, rating 1..5, comment?, isVerified (purchase), createdAt)` unique(orderId, productId) + `ProductReviewReply?` via admin `response`.
- `Recipe (slug, title, description?, servings, category?, imageUrl?, steps String[], isPublished)` + `RecipeItem (recipeId, productId, quantity)`.
- `HelpArticle (slug, title, body, topics String[], isPublished)`.
- `ChatSession (userId, kind, title?, createdAt)` + `ChatMessage (sessionId, role {user, assistant}, content, cartProposal jsonb?, model?, createdAt)`.
- `DeliverySlot (date DateTime, windowLabel “08–10 AM”, startTime, endTime, capacity, booked, isActive)` + `Order.slotId?`.
- `Subscription (userId, addressId, notes?, cadenceDays Int (7/14), dayOfWeek, items jsonb [{productId, quantity}], status, nextRunAt, lastRunAt?)` — runs generate PENDING orders at 05:00 IST via admin-toggled cron-or-on-request runner.
- `FlashDeal (productId, discountPct Int, startsAt, endsAt, stockLimit?, isActive)` — near-expiry/markdown tool.
- `RiderBatch (status, createdAt)` + `Order.batchId?` (≤2 orders/batch, same or co-route pincode).
- `ProofOfDelivery (orderId unique, otpHash, otpSentAt, attempts, photoUrl?, verifiedAt?, method {OTP, PHOTO_otp, PIN})`.
- `RiskFlag (userId, kind {COD_REFUSAL, RAPID_CANCEL, BOUNCE}, score, note?, createdAt)` + rolling counters on Order (`cancelledAt` already exists).
- `PushToken (userId, token unique, platform {ios, android, web}, isActive, createdAt)`.
- `Store` additions: `weatherMode WeatherMode @default(NORMAL)`, `weatherNote?`, `surgeFee Decimal @default(0)`, `slotCapacityPerHour Int`, `pickupEnabled Boolean @default(false)`, `upiVpa?`, `whatsappAdminPhone?`; `Store coupons?` — no, coupons deferred.
- `Product` additions: `tags String[]` (vegan/veggie/nonveg/exotic…), `dietLabel`, `bestBeforeAt DateTime?`, `embedding Float[] (Json)`, `embeddingModel?`, `embeddingAt?`, `searchText String?` (cached lexical blob), `expiryDiscountPct Int @default(0)` when near-expiry.
- `Order` additions: `slotId?`, `pickupAt DateTime?` (store pickup), `walletApplied Decimal @default(0)`, `loyaltyPointsEarned Int @default(0)`, `loyaltyPointsUsed Int @default(0)`, `referralCode?`, `paymentRef?` (Razorpay order/payment id), `mode` = shipping mode? covered by pickupAt; `batchId?`; `fulfilment {DELIVERY, PICKUP}` enum field default DELIVERY.
- `DeliveryPartner` additions: `lastSeenAt DateTime?`, `batchesDone Int @default(0)`.

## 26.4 API surface delta

Customer (`/api`): `GET /recs/home` (sections), `GET /recs/reorder`, `GET /products/:id/reviews`, `POST /reviews`, `PATCH /me/prefs`, `GET /recipes` + `POST /recipes/:id/cart`, `POST /ai/chat` (+ `POST /ai/chat/:sessionId/replay`), `POST /ai/search`, `POST /ai/vision-search`, `GET /ai/substitutes?productId=`, `GET /slots?date=`, `POST /wallet`, `GET /wallet/transactions`, `GET /loyalty`, `POST /referrals/apply` (signup) — signup schema gains optional `referralCode`; `GET /flash-deals`; `POST /subscriptions` CRUD at `/subscriptions/:id` (+pause/resume); `GET /updates` (SSE); `POST /push-token`; `POST /support/chat` (help-article RAG); `POST /orders/:id/unlock-otp`? (POD is rider-side; customer sees verify screen).
Checkout input gains: `slotId?`, `fulfilment`, `walletApply? bool`, `loyaltyApply?`, `referral at signup only`, `upiVpa` informs payment intent; `paymentMethod` gains `upi`.
Rider: `PATCH /delivery/location` (online throttle 15s), `GET /delivery/batch` (current batch view), `POST /delivery/assignments/:id/proof` (photo multipart + `otp`), `GET /delivery/weather` (mode banner).
Admin: `GET /admin/forecast?days=7`, `GET /admin/stock-alerts`, `POST /admin/ai/ask`, `POST /admin/ai/catalog-draft` (multipart image), `POST /admin/ai/summarize` (notes), `GET/POST/PATCH /admin/reviews`, `GET/POST /admin/recipes`, `GET/POST /admin/flash-deals`, `POST /admin/slots/bulk` (auto-create next 14 days × windows), `POST /admin/rider-batches` (create from 2 ready orders), `GET/POST /admin/store/weather` (open-meteo proxy + manual override), `GET /admin/risk`, `PATCH /admin/orders/:id/verify-upi`.

## 26.5 Screen delta

**Customer:** Home adds reorder chips row, “Buy again” rail, recipe rail, flash-deals banner, weather banner; new **Assistant** screen (chat + cart proposals + voice mic); Search becomes hybrid + voice + camera button; Product page gains reviews + “goes well with”; Checkout revamp (slot picker, pickup toggle, wallet/loyalty toggles, UPI/Razorpay/COD selector, green-bag opt); Orders list/detail gains live tracking map (real GPS dot + ETA), substitution approvals, POD OTP entry slot; Profile gains Wallet, Loyalty/referrals card, Subscriptions manager, Language, Dietary prefs, Help chat; Review composer appears post-delivery.
**Admin:** Dashboard gains Forecast panel + weather widget; new pages: Reviews, Recipes, Flash deals, Slots, Subscriptions (admin pause), Risk flags, Batching (pair ready orders), NL-ops console (“Ask the data”); Products form gains tags/diet/expiry + “AI draft from image” button; Order detail gains UPI verify button, weather/surge context, AI substitution workflow.
**Rider:** Assignments adds weather banner + batch cards (2-stop list); Order detail gains turn-by-turn leg list, “send POD OTP”, photo capture + verify screen; GPS auto-updates while on active delivery.

## 26.6 New environment variables (all optional at boot)

`GEMINI_API_KEY` (unlocks AI suite; without it everything runs on fallbacks), `GEMINI_MODEL=gemini-3.8-flash`, `GEMINI_EMBEDDING_MODEL=text-embedding-004`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `UPI_VPA=neuracart@upi`, `UPI_PAYEE_NAME=NeuraCart`, `WEATHER_LAT=12.9716`, `WEATHER_LON=77.5946`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `SLOT_WINDOW_DEFAULTS=08-10,10-12,16-18,18-20`, `LOYALTY_EARN_RATE=0.02` (pts/₹), `REFERRAL_REWARD=50`, `FLASH_DEAL_MAX_PCT=40`. Frontends inherit existing env patterns (no changes needed except optional `EXPO_PUBLIC_*` mirrors if ever needed).

## 26.7 Risks & mitigations

- **Gemini 429s / quota →** token bucket + backoff + circuit breaker + always-on fallbacks; free-tier chat calls stay short-context (product summaries only, never raw PII).
- **UPI intent can’t auto-verify →** honest model: order is `PENDING_PAID_CONFIRMATION`? No — keep architecture: UPI intent pays outside; customer hits “I’ve paid”, enters the last 4 of UTR; admin gets a verify queue entry. Razorpay, when keys are present, automates it. Both paths documented in UI copy.
- **WhatsApp costs →** env-gated; dev mode logs the payload like dev OTP; never initialized without both config values.
- **Background GPS on web export →** foreground-only; riders are guided to the native app for continuous tracking; manual “share my location” fallback.
- **Embedding drift →** recomputed nightly (admin button) and on every product create/edit.
- **Scope explosion →** phase discipline: nothing merges without its phase-DoD in §26.2 and a Playwright pass.

## 26.8 Phase gates (definition of done)

Every phase ships with: `backend: npm run typecheck + build`, customer/admin/delivery `tsc --noEmit` + lint in their own directories, migration applied to the local DB, seed idempotent re-runnable, at least one Playwright-driven proof of the new flow, screenshots in `/tmp/opencode/shots/`, a conventional commit **and push**.

### 26.9 v2 acceptance highlights

1. A customer types “dinner for two under ₹400, no meat” into Assistant and receives an in-app cart they can add in one tap.
2. Home shows “Reorder — you’re likely running low”, and reorder chips add a known basket in two taps.
3. Checkout offers slots vs delivery-now vs store pickup; wallet balance and loyalty points apply to the total; UPI Intent and COD both complete orders end-to-end.
4. Riders stream GPS; customers watch a live dot + ETA; delivery verification is an OTP; rain days show surge banner and adjusted ETA.
5. Admin asks “which customers stopped ordering meat?” in plain text and gets data-derived answers; forecast and stock alerts drive an actual restock decision; a product photo becomes a draft catalog card in one click.
6. Every AI feature still works, with degraded quality, when the API key is absent.

---

*End of plan — NeuraCart v2 scope.*


---

## 27. v2.1 — showcase pass (November 2026)

### 27.1 Identity
- Product, packages, scheme, emails, storage keys, database, and seed data are **NeuraCart**.
- Seed people use international names (manager `Daniel Okafor`, customer `Amelia Novak`, riders `Marcus Lindqvist`, `Diego Fernández`, `Yuki Tanaka`, …). Demo emails stay `@neuracart.app`.
- New order numbers use the `NC-` prefix; historical `LM-` rows were migrated in place.

### 27.2 Theming (whole project)
- Admin: CSS variables + `[data-theme='dark']` overrides, pre-paint script, persistent top-bar toggle.
- Customer and rider apps: one palette proxy in `constants/design.ts` (`lightColors` / `darkColors` / `activeScheme`) plus `themedStyles(factory)`. Module-level `StyleSheet.create` keeps working; each sheet is built lazily per scheme.
- Mode is `light | dark | system`, persisted in `AsyncStorage` under `neuracart.theme`, with a three-chip control in each profile screen.
- Status bar, tab bar, cards, inputs, badges, and illustrations all resolve through the palette.

### 27.3 Google sign-in
- `GET /auth/google/status` reports configuration; `GET /auth/google` starts the consent flow; `GET /auth/google/callback` exchanges the code, links or creates a customer, and redirects with one-time tokens.
- OAuth state lives in an in-process TTL map (10 min) — acceptable for one API instance; move to Redis when scaling out.
- Without `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, the button is disabled with an inline hint and the API returns `503 GOOGLE_NOT_CONFIGURED`.

### 27.4 i18n scope (explicit)
- Translated today: tab bar, home, profile, help. Kannada and Hindi catalogues have key parity with English.
- All other screens fall back to English. `npm run test:i18n` fails on key drift.

### 27.5 AI showcase
- README positions NeuraCart as an AI-native product: one loop (signal → context → guardrails → model/fallback → action), with a table of every AI feature and its deterministic fallback.
- Animated SVG assets live in `docs/assets/`; screenshots in `docs/evidence/`.

*End of plan — NeuraCart v2.1.*
