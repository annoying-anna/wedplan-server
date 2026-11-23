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

// Customer routes
router.post('/', protect, verifyCustomer, createBooking);
router.get('/my-bookings', protect, verifyCustomer, getCustomerBookings);
router.patch('/:id/cancel', protect, verifyCustomer, cancelBooking);

// Vendor routes
router.get('/vendor-requests', protect, verifyVendor, getVendorBookings);
router.patch('/:id/status', protect, verifyVendor, updateBookingStatus);

module.exports = router;
