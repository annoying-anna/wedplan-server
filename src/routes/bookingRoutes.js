const express = require('express');
const router = express.Router();
const {
  createBooking,
  getCustomerBookings,
  cancelBooking,
  getVendorBookings,
  updateBookingStatus,
} = require('../controllers/bookingController');
const { protect, verifyCustomer, verifyVendor } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');

// Customer routes
router.post('/', protect, verifyCustomer, createBooking);
router.get('/my-bookings', protect, verifyCustomer, getCustomerBookings);
router.patch('/:id/cancel', protect, verifyCustomer, validateObjectId(), cancelBooking);

// Vendor routes
router.get('/vendor-requests', protect, verifyVendor, getVendorBookings);
router.patch('/:id/status', protect, verifyVendor, validateObjectId(), updateBookingStatus);

module.exports = router;
