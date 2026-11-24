const Stripe = require('stripe');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Initialize Stripe only when a real secret key is configured.
// Placeholder keys such as "sk_test_51MockKey..." must never be treated as live Stripe.
const rawStripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
const hasRealStripeKey =
  /^sk_(test|live)_/.test(rawStripeKey) && !/mock/i.test(rawStripeKey);

const stripe = hasRealStripeKey
  ? new Stripe(rawStripeKey, { apiVersion: '2023-10-16' })
  : null;

// Premium plan pricing configuration
const PREMIUM_PRICE = 49.0; // $49 USD for Premium Upgrade

/**
 * Demo checkout is only allowed when Stripe is NOT configured AND the
 * deployment explicitly opts in (or is running outside production).
 * This keeps the assignment demo usable while ensuring that a real Stripe
 * deployment can never be upgraded through the simulated checkout path.
 */
const demoPaymentsEnabled = () => {
  if (stripe) return false;
  return (
    process.env.ALLOW_MOCK_PAYMENTS === 'true' ||
    process.env.NODE_ENV !== 'production'
  );
};

const isAllowedClientOrigin = (origin) => {
  if (!origin) return false;
  const normalized = origin.replace(/\/$/, '');
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalized)) return true;
  const configured = (process.env.CLIENT_URL || '').replace(/\/$/, '');
  return Boolean(configured) && normalized === configured;
};

/**
 * Resolve the public client URL for Stripe success/cancel redirects.
 * The browser Origin is preferred when CLIENT_URL is missing or still points
 * at localhost on a production deployment (a common Vercel misconfiguration).
 */
const getClientUrl = (req) => {
  const configured = (process.env.CLIENT_URL || '').trim().replace(/\/$/, '');
  const origin = (req.headers.origin || '').trim().replace(/\/$/, '');

  if (isAllowedClientOrigin(origin)) {
    const configuredIsLocal = /localhost|127\.0\.0\.1/i.test(configured);
    if (!configured || (process.env.NODE_ENV === 'production' && configuredIsLocal)) {
      return origin;
    }
  }

  if (configured) return configured;
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return 'http://localhost:3000';
};

const activatePremium = async (vendorId, { amount, currency, stripeSessionId, stripeSubscriptionId }) => {
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year premium access

  const updatedUser = await User.findByIdAndUpdate(
    vendorId,
    {
      subscriptionPlan: 'premium',
      subscriptionExpiresAt: expiresAt,
    },
    { new: true }
  );

  if (!updatedUser) return null;

  const transaction = await Transaction.create({
    vendorId,
    plan: 'premium',
    amount,
    currency,
    stripeSessionId,
    stripeSubscriptionId: stripeSubscriptionId || '',
    status: 'succeeded',
  });

  return { updatedUser, transaction };
};

// @desc    Create Stripe Checkout Session for Vendor Premium Subscription
// @route   POST /api/payments/create-checkout-session
// @access  Private (Vendor)
const createCheckoutSession = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const vendor = await User.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    if (vendor.subscriptionPlan === 'premium') {
      return res.status(400).json({
        success: false,
        message: 'You already have an active Premium Subscription!',
      });
    }

    const clientUrl = getClientUrl(req);

    if (!stripe) {
      if (!demoPaymentsEnabled()) {
        return res.status(503).json({
          success: false,
          message:
            'Stripe is not configured on this deployment. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to enable real payments.',
        });
      }

      // Explicitly marked demo checkout. Real Stripe keys always take priority.
      const mockSessionId = 'cs_test_demo_' + Math.random().toString(36).substring(2, 15);
      return res.status(200).json({
        success: true,
        sessionId: mockSessionId,
        url: `${clientUrl}/payment/success?session_id=${mockSessionId}&mock=true`,
        isMock: true,
        message:
          'Demo checkout enabled because Stripe keys are not configured. No real charge is made.',
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: vendor.email,
      client_reference_id: vendor._id.toString(),
      metadata: {
        vendorId: vendor._id.toString(),
        plan: 'premium',
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'WedPlan Vendor Premium Subscription',
              description: 'Unlimited wedding service listings, Premium badge, and priority visibility',
              images: [
                'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80',
              ],
            },
            unit_amount: Math.round(PREMIUM_PRICE * 100), // in cents
          },
          quantity: 1,
        },
      ],
      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/payment/cancel`,
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url,
      isMock: false,
    });
  } catch (error) {
    console.error('Stripe Session Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error creating checkout session.',
    });
  }
};

// @desc    Handle Stripe Webhooks
// @route   POST /api/payments/webhook
// @access  Public (Webhook verification via signature)
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  if (stripe && endpointSecret) {
    if (!sig) {
      return res.status(400).send('Webhook Error: Missing stripe-signature header.');
    }
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Never accept unsigned webhook payloads in production.
    return res.status(400).send('Webhook Error: Stripe webhook is not configured.');
  } else {
    // Local development/testing convenience only.
    event = req.body;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const vendorId = session.metadata?.vendorId || session.client_reference_id;

      if (vendorId) {
        // Idempotency: a webhook may be retried by Stripe multiple times.
        const existing = await Transaction.findOne({ stripeSessionId: session.id });
        if (!existing) {
          await activatePremium(vendorId, {
            amount: session.amount_total ? session.amount_total / 100 : PREMIUM_PRICE,
            currency: (session.currency || 'usd').toUpperCase(),
            stripeSessionId: session.id,
            stripeSubscriptionId: session.subscription || '',
          });
          console.log(`[Stripe Webhook]: Premium activated for vendor ID ${vendorId}`);
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handling error:', error);
    return res.status(500).json({ received: false, message: 'Webhook processing failed.' });
  }
};

// @desc    Verify Stripe session & activate premium (server-verified route)
// @route   POST /api/payments/verify-session
// @access  Private (Vendor)
const verifySession = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required.' });
    }

    const vendorId = req.user._id.toString();

    // Idempotency + ownership check
    const existingTx = await Transaction.findOne({ stripeSessionId: sessionId });
    if (existingTx) {
      if (existingTx.vendorId.toString() !== vendorId) {
        return res.status(403).json({
          success: false,
          message: 'This payment session belongs to another vendor.',
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Subscription is already active.',
        transaction: existingTx,
      });
    }

    let amount = PREMIUM_PRICE;
    let currency = 'USD';
    let stripeSubscriptionId = '';

    if (stripe) {
      let session;
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId);
      } catch (stripeErr) {
        console.error('Stripe session retrieval failed:', stripeErr.message);
        return res.status(400).json({
          success: false,
          message: 'Payment session could not be verified with Stripe.',
        });
      }

      const sessionVendorId = session.metadata?.vendorId || session.client_reference_id;
      if (sessionVendorId !== vendorId) {
        return res.status(403).json({
          success: false,
          message: 'This payment session does not belong to your vendor account.',
        });
      }

      if (session.payment_status !== 'paid') {
        return res.status(400).json({
          success: false,
          message: 'Payment has not been confirmed by Stripe.',
        });
      }

      amount = (session.amount_total || 0) / 100;
      currency = (session.currency || 'usd').toUpperCase();
      stripeSubscriptionId = session.subscription || '';
    } else if (demoPaymentsEnabled() && sessionId.startsWith('cs_test_demo_')) {
      // Simulated checkout is only valid when explicitly enabled and Stripe is absent.
      console.warn('[Demo Payment]: Simulated premium activation for vendor', vendorId);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Payment has not been confirmed by Stripe.',
      });
    }

    const activated = await activatePremium(vendorId, {
      amount,
      currency,
      stripeSessionId: sessionId,
      stripeSubscriptionId,
    });

    if (!activated) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Congratulations! Your account has been upgraded to Premium.',
      user: {
        _id: activated.updatedUser._id,
        name: activated.updatedUser.name,
        email: activated.updatedUser.email,
        role: activated.updatedUser.role,
        subscriptionPlan: activated.updatedUser.subscriptionPlan,
        subscriptionExpiresAt: activated.updatedUser.subscriptionExpiresAt,
      },
      transaction: activated.transaction,
    });
  } catch (error) {
    console.error('Verify Session Error:', error);
    return res.status(500).json({ success: false, message: 'Error verifying payment session.' });
  }
};

// @desc    Get all platform transactions (Admin only - read-only)
// @route   GET /api/payments/transactions
// @access  Private (Admin)
const getAdminTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('vendorId', 'name email businessName image')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      transactions,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error retrieving transactions.' });
  }
};

module.exports = {
  createCheckoutSession,
  handleWebhook,
  verifySession,
  getAdminTransactions,
};
