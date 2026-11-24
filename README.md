# WedPlan Backend Server API

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-5-lightgrey?style=for-the-badge&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Webhooks-635BFF?style=for-the-badge&logo=stripe)](https://stripe.com/)

A secure, role-based REST API built with Node.js, Express.js, and MongoDB for the **WedPlan** wedding planning platform.

---

## 🌐 Live API & Repository Links
- **Live Backend API**: [https://wedplan-server-gilt.vercel.app](https://wedplan-server-gilt.vercel.app)
- **Live Frontend**: [https://client-rho-five-11.vercel.app](https://client-rho-five-11.vercel.app)
- **Server GitHub Repository**: [https://github.com/annoying-anna/wedplan-server](https://github.com/annoying-anna/wedplan-server)
- **Client GitHub Repository**: [https://github.com/annoying-anna/wedplan-client](https://github.com/annoying-anna/wedplan-client)

---

## ✨ Important Features
- **JWT Authentication & Authorization**: Secure token generation and verification middleware (`protect`, `verifyAdmin`, `verifyVendor`, `verifyCustomer`) returning proper `401` and `403` status codes.
- **Account Blocking Security**: Blocked users (`isBlocked: true`) are immediately barred from all protected platform features.
- **Wedding Services Management**: Full CRUD operations with category filtering, keyword search, location filter, price sorting (`price_asc`, `price_desc`), and Admin approval workflow (`pending`, `approved`, `rejected`).
- **Free vs. Premium Tier Enforcement**: Free vendors are capped at 3 active services; Premium vendors enjoy unlimited services.
- **Wedding Bookings Workflow**: Customer booking submissions, duplicate date prevention, role validation (preventing vendors from booking own services and admins from customer bookings), customer cancellation for pending requests, and vendor accept/reject processing.
- **Stripe Checkout & Webhook Integration**: Secure server-side Stripe Checkout session generation, signature-verified webhooks for instant upgrade to Premium, and immutable read-only admin transactions.
- **Analytics & Statistics**: Role-tailored dashboard metric aggregations (`/api/stats/dashboard`).

---

## 📡 API Endpoints Overview

| Module | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **Health** | `GET /api/health` | Public | Server health status |
| **Auth** | `POST /api/auth/register` | Public | Register customer or vendor (blocks admin role) |
| **Auth** | `POST /api/auth/login` | Public | Credential login returning JWT |
| **Auth** | `POST /api/auth/google` | Public | Google OAuth user sync returning JWT |
| **Auth** | `GET /api/auth/me` | Private | Get authenticated user profile |
| **Auth** | `PUT /api/auth/profile` | Private | Update user name, image, or businessName |
| **Services** | `GET /api/services` | Public | Search, filter, and sort approved services |
| **Services** | `GET /api/services/featured` | Public | Fetch 6+ featured approved services |
| **Services** | `GET /api/services/categories` | Public | Category counts for all 6 wedding disciplines |
| **Services** | `GET /api/services/:id` | Public | Single service details |
| **Services** | `POST /api/services` | Vendor | Create service (enforces 3-service Free limit) |
| **Services** | `PUT /api/services/:id` | Vendor | Update own service |
| **Services** | `PATCH /api/services/:id/availability` | Vendor | Toggle active/inactive availability |
| **Services** | `DELETE /api/services/:id` | Vendor | Delete own service |
| **Bookings** | `POST /api/bookings` | Customer | Submit booking (prevents duplicates & self-booking) |
| **Bookings** | `GET /api/bookings/my-bookings` | Customer | List customer's bookings |
| **Bookings** | `PATCH /api/bookings/:id/cancel` | Customer | Cancel pending booking |
| **Bookings** | `GET /api/bookings/vendor-requests` | Vendor | List bookings for vendor's services |
| **Bookings** | `PATCH /api/bookings/:id/status` | Vendor | Accept or Reject pending booking |
| **Payments** | `POST /api/payments/create-checkout-session` | Vendor | Create Stripe Checkout session |
| **Payments** | `POST /api/payments/webhook` | Stripe | Signature-verified Stripe webhook |
| **Payments** | `POST /api/payments/verify-session` | Vendor | Verify checkout session & activate Premium |
| **Payments** | `GET /api/payments/transactions` | Admin | Read-only platform transactions ledger |
| **Admin** | `GET /api/admin/users` | Admin | Search & filter all registered users |
| **Admin** | `PATCH /api/admin/users/:id/block` | Admin | Block or unblock a user |
| **Admin** | `GET /api/services/admin/all` | Admin | View all submitted services for moderation |
| **Admin** | `PATCH /api/services/:id/status` | Admin | Approve, Reject, or set Pending status |
| **Admin** | `DELETE /api/services/admin/:id` | Admin | Delete inappropriate service |
| **Stats** | `GET /api/stats/dashboard` | Private | Role-specific dashboard analytics |

---

## 🛠️ Technology Stack
- **Runtime**: Node.js (v20+)
- **Framework**: Express.js 5
- **Database**: MongoDB with Mongoose ODM
- **Security & Auth**: JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `cors`, `cookie-parser`
- **Logging**: `morgan`
- **Payment Processing**: Stripe SDK & Stripe Webhooks

---

## 🔐 Environment Variables
Create a `.env` file in the root of the `server` directory (never commit `.env` to Git):
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/wedplan
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d
STRIPE_SECRET_KEY=sk_test_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
IMGBB_API_KEY=your_imgbb_key
ALLOW_MOCK_PAYMENTS=true
```

---

## 💻 How to Run Locally
1. Clone the repository & install dependencies:
   ```bash
   git clone https://github.com/annoying-anna/wedplan-server.git
   cd wedplan-server
   npm install
   ```
2. Seed the database with demo accounts, services, bookings, and transactions:
   ```bash
   npm run seed
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Run automated API verification tests:
   ```bash
   npm test
   ```
