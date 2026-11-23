const Stripe = require('stripe');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Initialize Stripe if valid key exists
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

// Premium plan pricing configuration
const PREMIUM_PRICE = 49.0; // $49 USD for Premium Upgrade

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

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    if (!stripe || process.env.STRIPE_SECRET_KEY.includes('MockKey')) {
      // In mock/test development environment when real Stripe key is not configured,
      // return a simulated checkout URL or direct confirmation capability
      const mockSessionId = 'cs_test_' + Math.random().toString(36).substring(2, 15);
      return res.status(200).json({
        success: true,
        sessionId: mockSessionId,
        url: `${clientUrl}/payment/success?session_id=${mockSessionId}&mock=true`,
        isMock: true,
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

  if (stripe && endpointSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    // If testing without signed webhook
    event = req.body;
  }

  // Handle checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const vendorId = session.metadata?.vendorId || session.client_reference_id;

    if (vendorId) {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year premium access

      // Update vendor subscription
      await User.findByIdAndUpdate(vendorId, {
        subscriptionPlan: 'premium',
        subscriptionExpiresAt: expiresAt,
      });

      // Save transaction
      await Transaction.create({
        vendorId,
        plan: 'premium',
        amount: session.amount_total ? session.amount_total / 100 : PREMIUM_PRICE,
        currency: session.currency || 'USD',
        stripeSessionId: session.id,
        status: 'succeeded',
      });

      console.log(`[Stripe Webhook]: Premium activated for vendor ID ${vendorId}`);
    }
  }

  return res.status(200).json({ received: true });
};

// @desc    Verify Stripe session & activate premium (safe server-verified route)
// @route   POST /api/payments/verify-session
// @access  Private (Vendor)
const verifySession = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required.' });
    }

    const vendorId = req.user._id;

    // Check if transaction already recorded
    const existingTx = await Transaction.findOne({ stripeSessionId: sessionId });
    if (existingTx) {
      return res.status(200).json({
        success: true,
        message: 'Subscription is already active.',
        transaction: existingTx,
      });
    }

    let isVerified = false;
    let amount = PREMIUM_PRICE;
    let currency = 'USD';

    if (stripe && !sessionId.startsWith('cs_test_mock')) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === 'paid') {
          isVerified = true;
          amount = session.amount_total / 100;
          currency = session.currency.toUpperCase();
        }
      } catch (stripeErr) {
        console.warn('Stripe retrieve error, falling back to mock verify if in test mode');
        if (process.env.NODE_ENV !== 'production') {
          isVerified = true;
        }
      }
    } else {
      // In test/demo environment
      isVerified = true;
    }

    if (!isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Payment has not been confirmed by Stripe.',
      });
    }

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const updatedUser = await User.findByIdAndUpdate(
      vendorId,
      {
        subscriptionPlan: 'premium',
        subscriptionExpiresAt: expiresAt,
      },
      { new: true }
    );

    const transaction = await Transaction.create({
      vendorId,
      plan: 'premium',
      amount,
      currency,
      stripeSessionId: sessionId,
      status: 'succeeded',
    });

    return res.status(200).json({
      success: true,
      message: 'Congratulations! Your account has been upgraded to Premium.',
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        subscriptionPlan: updatedUser.subscriptionPlan,
        subscriptionExpiresAt: updatedUser.subscriptionExpiresAt,
      },
      transaction,
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
