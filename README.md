# WedPlan Backend Server API

A secure, role-based REST API built with Node.js, Express.js, and MongoDB for the WedPlan wedding planning platform.

## Important Features
- **JWT Authentication & Authorization**: Secure token generation and verification middleware (`verifyToken`, `verifyAdmin`, `verifyVendor`, `verifyCustomer`).
- **Account Blocking Security**: Blocked users are immediately barred from all protected platform features.
- **Wedding Services Management**: Full CRUD operations with category filtering, keyword search, price sorting (low-to-high, high-to-low), and Admin approval workflow (`pending`, `approved`, `rejected`).
- **Free vs. Premium Tier Enforcement**: Free vendors are capped at 3 active services; Premium vendors enjoy unlimited services.
- **Wedding Bookings Workflow**: Customer booking submissions, duplicate date prevention, role validation (preventing vendors from booking own services and admins from customer bookings), customer cancellation for pending requests, and vendor accept/reject processing.
- **Stripe Checkout & Webhook Integration**: Secure server-side Stripe Checkout session generation, signature-verified webhooks for instant upgrade to Premium, and immutable read-only admin transactions.
- **Analytics & Statistics**: Role-tailored dashboard metric aggregations.

## Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Security & Auth**: JSON Web Tokens (JWT), Bcrypt.js, CORS, Cookie-Parser
- **Payment Processing**: Stripe SDK & Stripe Webhooks

## Environment Variables
Create a `.env` file in the root of the server directory:
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
```

## How to Run Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Seed the database with demo accounts and rich wedding services:
   ```bash
   npm run seed
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Run automated tests:
   ```bash
   npm test
   ```

## Demo Credentials
- **Admin**: `admin@wedplan.com` / `Password123`
- **Vendor (Premium)**: `aurora@wedplan.com` / `Password123`
- **Vendor (Free)**: `sophia@wedplan.com` / `Password123`
- **Customer**: `emily@wedplan.com` / `Password123`

## GitHub Repositories
- **Server**: [https://github.com/annoying-anna/wedplan-server](https://github.com/annoying-anna/wedplan-server)
- **Client**: [https://github.com/annoying-anna/wedplan-client](https://github.com/annoying-anna/wedplan-client)
