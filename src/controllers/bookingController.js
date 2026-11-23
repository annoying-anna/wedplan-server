const Booking = require('../models/Booking');
const Service = require('../models/Service');

// @desc    Submit a new booking request (Customer only)
// @route   POST /api/bookings
// @access  Private (Customer)
const createBooking = async (req, res) => {
  try {
    const { serviceId, eventDate, eventLocation, message } = req.body;

    if (!serviceId || !eventDate || !eventLocation) {
      return res.status(400).json({
        success: false,
        message: 'Please provide service ID, event date, and event location.',
      });
    }

    // Role check: Admins cannot book customer requests
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admins cannot submit customer booking requests.',
      });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Wedding service not found.' });
    }

    // Only approved and active services can be booked
    if (service.status !== 'approved' || !service.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This service is currently unavailable for booking.',
      });
    }

    // Prevent vendors from booking their own services
    if (service.vendorId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Vendors cannot book their own wedding services.',
      });
    }

    // Prevent duplicate active booking requests for the same service and event date by the same customer
    const existingDuplicate = await Booking.findOne({
      serviceId,
      customerId: req.user._id,
      eventDate,
      status: { $in: ['Pending', 'Accepted'] },
    });

    if (existingDuplicate) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active booking request for this service on this date.',
      });
    }

    const booking = await Booking.create({
      serviceId,
      vendorId: service.vendorId,
      customerId: req.user._id,
      eventDate,
      eventLocation: eventLocation.trim(),
      message: message ? message.trim() : '',
      status: 'Pending',
    });

    return res.status(201).json({
      success: true,
      message: 'Booking request submitted successfully! The vendor will review it shortly.',
      booking,
    });
  } catch (error) {
    console.error('Create Booking Error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating booking request.' });
  }
};

// @desc    Get logged-in customer's bookings
// @route   GET /api/bookings/my-bookings
// @access  Private (Customer)
const getCustomerBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customerId: req.user._id })
      .populate('serviceId', 'serviceName category price images location')
      .populate('vendorId', 'name email businessName image')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      bookings,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error retrieving customer bookings.' });
  }
};

// @desc    Cancel a pending booking request (Customer only)
// @route   PATCH /api/bookings/:id/cancel
// @access  Private (Customer)
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Ownership check: customer can only cancel their own booking
    if (booking.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only cancel your own bookings.',
      });
    }

    // Rule: Customers cannot cancel an already accepted, rejected, or cancelled booking
    if (booking.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking. Current status is already '${booking.status}'. Only pending requests can be cancelled.`,
      });
    }

    booking.status = 'Cancelled';
    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Booking request has been cancelled successfully.',
      booking,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error cancelling booking.' });
  }
};

// @desc    Get booking requests for vendor's services
// @route   GET /api/bookings/vendor-requests
// @access  Private (Vendor)
const getVendorBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ vendorId: req.user._id })
      .populate('serviceId', 'serviceName category price images location')
      .populate('customerId', 'name email image')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      bookings,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error retrieving vendor booking requests.' });
  }
};

// @desc    Accept or reject booking request (Vendor only)
// @route   PATCH /api/bookings/:id/status
// @access  Private (Vendor)
const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['Accepted', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'Accepted' or 'Rejected'.",
      });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking request not found.' });
    }

    // Ownership check: vendor can only manage requests for their own services
    if (booking.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You cannot modify booking requests for other vendors.',
      });
    }

    // Rules:
    // Only pending requests can be accepted or rejected
    // Once accepted or rejected, a request cannot be processed again
    if (booking.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `This booking request is already '${booking.status}' and cannot be processed again.`,
      });
    }

    booking.status = status;
    await booking.save();

    return res.status(200).json({
      success: true,
      message: `Booking request successfully marked as '${status}'.`,
      booking,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error updating booking status.' });
  }
};

module.exports = {
  createBooking,
  getCustomerBookings,
  cancelBooking,
  getVendorBookings,
  updateBookingStatus,
};
