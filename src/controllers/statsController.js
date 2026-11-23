const User = require('../models/User');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');

// @desc    Get dashboard statistics based on authenticated user's role
// @route   GET /api/stats/dashboard
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user._id;

    if (role === 'admin') {
      const [
        totalUsers,
        totalVendors,
        totalCustomers,
        totalServices,
        pendingServices,
        approvedServices,
        rejectedServices,
        totalBookings,
        transactions,
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'vendor' }),
        User.countDocuments({ role: 'customer' }),
        Service.countDocuments(),
        Service.countDocuments({ status: 'pending' }),
        Service.countDocuments({ status: 'approved' }),
        Service.countDocuments({ status: 'rejected' }),
        Booking.countDocuments(),
        Transaction.find(),
      ]);

      const totalRevenue = transactions.reduce((acc, curr) => acc + (curr.amount || 0), 0);

      return res.status(200).json({
        success: true,
        stats: {
          totalUsers,
          totalVendors,
          totalCustomers,
          totalServices,
          pendingServices,
          approvedServices,
          rejectedServices,
          totalBookings,
          totalTransactions: transactions.length,
          totalRevenue,
        },
      });
    }

    if (role === 'vendor') {
      const [
        totalServices,
        activeServices,
        pendingServices,
        pendingBookings,
        acceptedBookings,
        rejectedBookings,
        vendor,
      ] = await Promise.all([
        Service.countDocuments({ vendorId: userId }),
        Service.countDocuments({ vendorId: userId, status: 'approved', isActive: true }),
        Service.countDocuments({ vendorId: userId, status: 'pending' }),
        Booking.countDocuments({ vendorId: userId, status: 'Pending' }),
        Booking.countDocuments({ vendorId: userId, status: 'Accepted' }),
        Booking.countDocuments({ vendorId: userId, status: 'Rejected' }),
        User.findById(userId),
      ]);

      return res.status(200).json({
        success: true,
        stats: {
          totalServices,
          activeServices,
          pendingServices,
          pendingBookings,
          acceptedBookings,
          rejectedBookings,
          subscriptionPlan: vendor.subscriptionPlan || 'free',
          subscriptionExpiresAt: vendor.subscriptionExpiresAt,
        },
      });
    }

    if (role === 'customer') {
      const [
        totalBookings,
        pendingBookings,
        acceptedBookings,
        rejectedBookings,
        cancelledBookings,
      ] = await Promise.all([
        Booking.countDocuments({ customerId: userId }),
        Booking.countDocuments({ customerId: userId, status: 'Pending' }),
        Booking.countDocuments({ customerId: userId, status: 'Accepted' }),
        Booking.countDocuments({ customerId: userId, status: 'Rejected' }),
        Booking.countDocuments({ customerId: userId, status: 'Cancelled' }),
      ]);

      return res.status(200).json({
        success: true,
        stats: {
          totalBookings,
          pendingBookings,
          acceptedBookings,
          rejectedBookings,
          cancelledBookings,
        },
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid role for statistics.' });
  } catch (error) {
    console.error('Stats Error:', error);
    return res.status(500).json({ success: false, message: 'Error retrieving statistics.' });
  }
};

module.exports = {
  getDashboardStats,
};
