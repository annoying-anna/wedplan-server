# WedPlan — Backend API (Server)

Secure, role-based REST API for the **WedPlan** wedding planning platform. Built with Node.js, Express.js, MongoDB (Mongoose), JWT authentication, and Stripe Checkout. It powers the [WedPlan Next.js client](https://github.com/annoying-anna/wedplan-client).

---

## 🌐 Live Deployment & Repositories

| Deliverable | URL |
| :--- | :--- |
| **Live Backend API** | [https://wedplan-server-gilt.vercel.app](https://wedplan-server-gilt.vercel.app) |
| **Health Check** | [https://wedplan-server-gilt.vercel.app/api/health](https://wedplan-server-gilt.vercel.app/api/health) |
| **Live Frontend** | [https://client-rho-five-11.vercel.app](https://client-rho-five-11.vercel.app) |
| **Server Repository** | [github.com/annoying-anna/wedplan-server](https://github.com/annoying-anna/wedplan-server) |
| **Client Repository** | [github.com/annoying-anna/wedplan-client](https://github.com/annoying-anna/wedplan-client) |

---

## ✨ Important Features

- **JWT authentication & authorization** — `protect`, `authorize`, `verifyAdmin`, `verifyVendor`, `verifyCustomer`, and `optionalAuth` middleware.
- **Account blocking** — blocked users are rejected with `403 Forbidden` on every protected route.
- **Service catalog** — full CRUD, keyword search, category/location filters, price sorting, and an Admin approval workflow (`pending`, `approved`, `rejected`).
- **Free vs. Premium enforcement** — Free vendors may have at most **3 active services**; Premium vendors are unlimited.
- **Subscription lifecycle** — expired Premium plans are automatically downgraded to Free on the next authenticated request.
- **Booking workflow** — customers submit inquiries, vendors accept/reject, customers cancel pending requests. Duplicate active requests for the same service/date are rejected.
- **Stripe Checkout & webhooks** — server-created sessions, signature-verified webhooks, server-side session verification, and an immutable transaction ledger.
- **Role-based statistics** — dashboard aggregations for Admin, Vendor, and Customer.
- **Server-side validation** — required fields, enum validation, ownership checks, and correct `400` / `401` / `403` / `404` responses.
- **Demo checkout fallback** — when Stripe keys are absent and `ALLOW_MOCK_PAYMENTS=true`, an explicitly labelled simulated checkout keeps the assignment demo usable. Real Stripe keys always take priority.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| Runtime | Node.js |
| Framework | Express.js 5 |
| Database | MongoDB (Mongoose ODM) |
| Auth | JSON Web Tokens (JWT), bcryptjs |
| Payments | Stripe SDK + Stripe Webhooks |
| Middleware | CORS, Cookie Parser, Morgan |
| Deployment | Vercel serverless functions |

---

## 📁 Project Structure

```text
server/
├── index.js                     # Vercel serverless entry point
├── vercel.json                  # Vercel routing config
├── src/
│   ├── server.js                # Express app, CORS, routes, error handlers
│   ├── config/db.js             # Cached MongoDB connection
│   ├── middleware/auth.js       # JWT + role + blocked-user middleware
│   ├── utils/jwt.js             # Token signing/verification
│   ├── models/                  # User, Service, Booking, Transaction
│   ├── controllers/             # auth, service, booking, payment, admin, stats
│   ├── routes/                  # Express routers
│   ├── scripts/seed.js          # Demo data seeder
│   └── tests/api.test.js        # Health-check test
└── .env.example
```

---

## 🗄️ Database Collections

| Collection | Purpose | Key fields |
| :--- | :--- | :--- |
| `users` | Platform accounts | `name`, `email`, `password`, `image`, `role`, `isBlocked`, `businessName`, `subscriptionPlan`, `subscriptionExpiresAt` |
| `services` | Wedding service listings | `vendorId`, `serviceName`, `category`, `description`, `price`, `location`, `images`, `status`, `isActive` |
| `bookings` | Customer booking requests | `serviceId`, `vendorId`, `customerId`, `eventDate`, `eventLocation`, `message`, `status` |
| `transactions` | Immutable Stripe ledger | `vendorId`, `plan`, `amount`, `currency`, `stripeSessionId`, `stripeSubscriptionId`, `status` |

> When Google OAuth is used, **Better Auth** manages its own `user`, `session`, `account`, and `verification` collections through the client-side MongoDB adapter. The Express API reads the platform profile from the `users` collection.

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register a Customer or Vendor (Admin is rejected) |
| `POST` | `/api/auth/login` | Public | Email/password login, returns JWT |
| `POST` | `/api/auth/google` | Public | Sync a Google profile and return a JWT |
| `GET` | `/api/auth/me` | Private | Current profile |
| `PATCH` | `/api/auth/profile` | Private | Update name/image/business name (role and plan are ignored) |

### Services
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/services` | Public | Approved + active services; supports `search`, `category`, `location`, `sort`, `page`, `limit` |
| `GET` | `/api/services/featured` | Public | Six featured services for the homepage |
| `GET` | `/api/services/categories` | Public | Six categories with counts |
| `GET` | `/api/services/:id` | Public / optional auth | Details; pending/inactive listings are visible only to the owner or an Admin |
| `POST` | `/api/services` | Vendor | Create a service (defaults to `pending`) |
| `GET` | `/api/services/vendor/my-services` | Vendor | Own catalog |
| `PUT` | `/api/services/:id` | Vendor (owner) | Update a service |
| `DELETE` | `/api/services/:id` | Vendor (owner) | Delete a service |
| `PATCH` | `/api/services/:id/availability` | Vendor (owner) | Toggle active/inactive |
| `GET` | `/api/services/admin/all` | Admin | All services with filters |
| `PATCH` | `/api/services/:id/status` | Admin | Approve / reject / reset |
| `DELETE` | `/api/services/admin/:id` | Admin | Remove inappropriate listing |

### Bookings
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/bookings` | Customer | Submit a booking request |
| `GET` | `/api/bookings/my-bookings` | Customer | Own booking requests |
| `PATCH` | `/api/bookings/:id/cancel` | Customer (owner) | Cancel a **pending** request |
| `GET` | `/api/bookings/vendor-requests` | Vendor | Requests for the vendor's services |
| `PATCH` | `/api/bookings/:id/status` | Vendor (owner) | Accept or reject a **pending** request |

### Payments
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/payments/create-checkout-session` | Vendor | Create a Stripe Checkout session |
| `POST` | `/api/payments/webhook` | Stripe | Signature-verified, idempotent webhook |
| `POST` | `/api/payments/verify-session` | Vendor | Verify a session and activate Premium |
| `GET` | `/api/payments/transactions` | Admin | Read-only transaction ledger |

### Admin, Stats, Health
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/users` | Admin | Search/filter all users |
| `PATCH` | `/api/admin/users/:id/block` | Admin | Toggle block/unblock |
| `GET` | `/api/stats/dashboard` | Private | Role-specific dashboard metrics |
| `GET` | `/api/health` | Public | Service health check |

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` and fill in your own values. **Never commit real credentials.**

```env
PORT=5000
NODE_ENV=development

# Public frontend URL (Stripe redirects + CORS allowlist)
CLIENT_URL=http://localhost:3000

# MongoDB (local or Atlas)
MONGODB_URI=mongodb://127.0.0.1:27017/wedplan

# JWT
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d

# Stripe (test mode is fine)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Demo fallback only when Stripe is not configured
ALLOW_MOCK_PAYMENTS=true

# Optional server-side ImgBB key
IMGBB_API_KEY=your_imgbb_api_key
```

Production values (Vercel):

- `CLIENT_URL=https://client-rho-five-11.vercel.app`
- `NODE_ENV=production`
- `MONGODB_URI=<MongoDB Atlas connection string>`
- `JWT_SECRET=<long random secret>`
- Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to enable real payments.
- `ALLOW_MOCK_PAYMENTS=true` keeps the evaluator demo working until Stripe keys are added.

---

## 💻 Installation & Local Setup

### Prerequisites
- Node.js 20+
- MongoDB running locally or a MongoDB Atlas URI

### Steps
```bash
git clone https://github.com/annoying-anna/wedplan-server.git
cd wedplan-server
npm install
cp .env.example .env        # fill in your values
npm run seed                # seeds admin, vendors, customers, services, bookings, transactions
npm run dev                 # http://localhost:5000
```

### Seed data
```bash
npm run seed
```

### Run tests
```bash
npm test                    # requires the server to be running on port 5000
```

### Production
```bash
npm start
```

---

## 🔑 Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| Admin | `admin@wedplan.com` | `Password123` |
| Vendor (Premium) | `aurora@wedplan.com` | `Password123` |
| Vendor (Free) | `sophia@wedplan.com` | `Password123` |
| Vendor (Premium) | `marcus@wedplan.com` | `Password123` |
| Customer | `emily@wedplan.com` | `Password123` |
| Customer | `liam@wedplan.com` | `Password123` |

---

## 🛡️ Security Implementation

- **JWT required in production** — the server throws at startup if `JWT_SECRET` is missing in production (no hard-coded fallback).
- **Role middleware** — `verifyAdmin`, `verifyVendor`, and `verifyCustomer` run after `protect` on every protected route.
- **Blocked accounts** — `protect` loads the user from MongoDB and returns `403` when `isBlocked` is true.
- **Ownership checks** — vendors may only edit/delete their own services and decide their own bookings; customers may only cancel their own pending bookings.
- **Server-side validation** — required fields, allowed categories/statuses, price/date checks, and password complexity. Malformed MongoDB IDs return a clean `404` instead of a `500`.
- **CORS allowlist** — localhost, `*.vercel.app` previews, and the configured `CLIENT_URL`; other origins receive no CORS headers.
- **Payment verification** — with real Stripe keys, `verify-session` retrieves the Checkout Session, requires `payment_status === "paid"`, and verifies the session belongs to the requesting vendor. Webhooks are signature-verified and idempotent. The simulated checkout is only available when Stripe is absent and `ALLOW_MOCK_PAYMENTS=true`.
- **Secrets** — `.env*` files are git-ignored; only `.env.example` is committed.

---

## 💳 Stripe Payment Flow

1. Vendor clicks **Upgrade to Premium** on `/dashboard/vendor/subscription`.
2. `POST /api/payments/create-checkout-session` creates a Checkout Session with `metadata.vendorId`.
3. Stripe redirects to `/payment/success?session_id=...` (or `/payment/cancel`).
4. The success page calls `POST /api/payments/verify-session`; the server verifies the session with Stripe and activates Premium only after confirmation.
5. Stripe sends `checkout.session.completed` to `POST /api/payments/webhook`; the signature is verified and the transaction is recorded idempotently.
6. The transaction appears in the Admin **Transactions** ledger and cannot be edited manually.

### Demo mode (no Stripe keys)
If `STRIPE_SECRET_KEY` is absent and `ALLOW_MOCK_PAYMENTS=true`, the API returns an explicitly labelled `cs_test_demo_...` session and redirects to the success page. The success page shows a **Demo mode** notice. No charge is made. Adding real Stripe keys disables this path automatically.

---

## 🚀 Deployment (Vercel)

```bash
vercel --prod
```

- `vercel.json` routes all requests to `index.js`, which exports the Express app.
- Set the environment variables in **Vercel → Project → Settings → Environment Variables**.
- The MongoDB connection is cached between serverless invocations.
- Health check after deploy: `GET /api/health`.

---

## 📦 Git Commit Requirement

This repository contains **18+ meaningful commits** (the assignment requires at least 12). The client repository contains **34+ meaningful commits** (requirement: at least 20).

---

## 🔗 Related Links

- **Live API**: [wedplan-server-gilt.vercel.app](https://wedplan-server-gilt.vercel.app)
- **Live frontend**: [client-rho-five-11.vercel.app](https://client-rho-five-11.vercel.app)
- **Client repository**: [github.com/annoying-anna/wedplan-client](https://github.com/annoying-anna/wedplan-client)
