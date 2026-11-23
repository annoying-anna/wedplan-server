const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plan: {
      type: String,
      required: true,
      default: 'premium',
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    stripeSessionId: {
      type: String,
      default: '',
    },
    stripeSubscriptionId: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['succeeded', 'pending', 'failed'],
      default: 'succeeded',
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ vendorId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
