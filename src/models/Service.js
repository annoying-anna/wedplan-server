const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceName: {
      type: String,
      required: [true, 'Please provide service name'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Please specify category'],
      enum: [
        'Photography & Videography',
        'Wedding Venues',
        'Decoration & Florist',
        'Catering Services',
        'Makeup & Styling',
        'Wedding Fashion',
      ],
    },
    description: {
      type: String,
      required: [true, 'Please provide description'],
    },
    price: {
      type: Number,
      required: [true, 'Please provide price'],
      min: 0,
    },
    location: {
      type: String,
      required: [true, 'Please provide location'],
      trim: true,
    },
    images: {
      type: [String],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'Please provide at least one service image',
      },
      default: [],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for search & filtering
serviceSchema.index({ serviceName: 'text', description: 'text', location: 'text' });
serviceSchema.index({ category: 1, status: 1, price: 1 });

module.exports = mongoose.model('Service', serviceSchema);
