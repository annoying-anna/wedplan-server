const express = require('express');
const router = express.Router();
const {
  createCheckoutSession,
  handleWebhook,
  verifySession,
  getAdminTransactions,
} = require('../controllers/paymentController');
const { protect, verifyVendor, verifyAdmin } = require('../middleware/auth');

// Stripe webhook (must be registered with raw body before general body parser in server.js)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Vendor Stripe checkout routes
router.post('/create-checkout-session', protect, verifyVendor, createCheckoutSession);
router.post('/verify-session', protect, verifyVendor, verifySession);

// Admin read-only transactions
router.get('/transactions', protect, verifyAdmin, getAdminTransactions);

module.exports = router;
