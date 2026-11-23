const User = require('../models/User');

// @desc    Get all users with search and role filter (Admin only)
// @route   GET /api/admin/users
// @access  Private (Admin)
const getAllUsers = async (req, res) => {
  try {
    const { search, role } = req.query;
    const query = {};

    if (role && role !== 'all') {
      query.role = role;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { email: searchRegex }, { businessName: searchRegex }];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error retrieving users.' });
  }
};

// @desc    Toggle block/unblock status for a user (Admin only)
// @route   PATCH /api/admin/users/:id/block
// @access  Private (Admin)
const toggleBlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Prevent admin from blocking themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot block your own admin account.',
      });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `User ${user.name} is now ${user.isBlocked ? 'blocked' : 'unblocked'}.`,
      isBlocked: user.isBlocked,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error updating user block status.' });
  }
};

module.exports = {
  getAllUsers,
  toggleBlockUser,
};
