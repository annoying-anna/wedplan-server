const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventDate: {
      type: String,
      required: [true, 'Please provide event date'],
    },
    eventLocation: {
      type: String,
      required: [true, 'Please provide event location'],
      trim: true,
    },
    message: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Accepted', 'Rejected', 'Cancelled'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to help query bookings quickly
bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ vendorId: 1, status: 1 });
bookingSchema.index({ serviceId: 1, eventDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
