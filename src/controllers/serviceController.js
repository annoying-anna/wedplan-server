const Service = require('../models/Service');
const User = require('../models/User');

// @desc    Get all active & approved services (with search, category, location, sort)
// @route   GET /api/services
// @access  Public
const getServices = async (req, res) => {
  try {
    const { search, category, location, sort, page = 1, limit = 9 } = req.query;

    const query = {
      status: 'approved',
      isActive: true,
    };

    // Keyword search in serviceName, description, location
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { serviceName: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
      ];
    }

    // Category filter
    if (category && category !== 'All' && category !== '') {
      query.category = category;
    }

    // Location filter
    if (location && location.trim() !== '') {
      query.location = new RegExp(location.trim(), 'i');
    }

    // Sorting
    let sortOptions = { createdAt: -1 }; // default newest
    if (sort === 'price_asc' || sort === 'price-asc' || sort === 'low-to-high') {
      sortOptions = { price: 1 };
    } else if (sort === 'price_desc' || sort === 'price-desc' || sort === 'high-to-low') {
      sortOptions = { price: -1 };
    } else if (sort === 'oldest') {
      sortOptions = { createdAt: 1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const total = await Service.countDocuments(query);
    const services = await Service.find(query)
      .populate('vendorId', 'name email image businessName subscriptionPlan')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      services,
    });
  } catch (error) {
    console.error('Get Services Error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving services.' });
  }
};

// @desc    Get featured services (at least 6 approved services)
// @route   GET /api/services/featured
// @access  Public
const getFeaturedServices = async (req, res) => {
  try {
    const services = await Service.find({ status: 'approved', isActive: true })
      .populate('vendorId', 'name email image businessName subscriptionPlan')
      .sort({ createdAt: -1 })
      .limit(6);

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error retrieving featured services.' });
  }
};

// @desc    Get service categories with counts
// @route   GET /api/services/categories
// @access  Public
const getCategories = async (req, res) => {
  try {
    const categories = [
      'Photography & Videography',
      'Wedding Venues',
      'Decoration & Florist',
      'Catering Services',
      'Makeup & Styling',
      'Wedding Fashion',
    ];

    const counts = await Promise.all(
      categories.map(async (cat) => {
        const count = await Service.countDocuments({
          category: cat,
          status: 'approved',
          isActive: true,
        });
        return { name: cat, count };
      })
    );

    return res.status(200).json({
      success: true,
      categories: counts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error retrieving categories.' });
  }
};

// @desc    Get single service by ID
// @route   GET /api/services/:id
// @access  Public (Details protected on client)
const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).populate(
      'vendorId',
      'name email image businessName subscriptionPlan'
    );

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    return res.status(200).json({
      success: true,
      service,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Invalid service ID or server error.' });
  }
};

// @desc    Create wedding service (Vendor only)
// @route   POST /api/services
// @access  Private (Vendor)
const createService = async (req, res) => {
  try {
    const { serviceName, category, description, price, location, images } = req.body;

    if (!serviceName || !category || !description || price === undefined || !location) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields.',
      });
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one service image.',
      });
    }

    // Check Free Plan limitation:
    // Free vendors can publish a maximum of 3 active (approved or total) services.
    const vendor = await User.findById(req.user._id);
    const isPremium = vendor.subscriptionPlan === 'premium';

    if (!isPremium) {
      const activeServicesCount = await Service.countDocuments({
        vendorId: req.user._id,
        status: { $in: ['approved', 'pending'] },
      });

      if (activeServicesCount >= 3) {
        return res.status(403).json({
          success: false,
          limitReached: true,
          message:
            'Free Plan limit reached: You can publish a maximum of 3 services on the Free Plan. Please upgrade to Premium for unlimited service listings.',
        });
      }
    }

    const service = await Service.create({
      vendorId: req.user._id,
      serviceName: serviceName.trim(),
      category,
      description: description.trim(),
      price: Number(price),
      location: location.trim(),
      images,
      status: 'pending', // Default pending until approved by Admin
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Service submitted successfully! It is now pending Admin approval.',
      service,
    });
  } catch (error) {
    console.error('Create Service Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error creating service.' });
  }
};

// @desc    Get vendor's own services
// @route   GET /api/services/vendor/my-services
// @access  Private (Vendor)
const getVendorServices = async (req, res) => {
  try {
    const services = await Service.find({ vendorId: req.user._id }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error retrieving vendor services.' });
  }
};

// @desc    Update service (Vendor only, ownership checked)
// @route   PUT /api/services/:id
// @access  Private (Vendor)
const updateService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    // Ownership verification
    if (service.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only edit your own services.',
      });
    }

    const { serviceName, category, description, price, location, images, isActive } = req.body;

    if (serviceName) service.serviceName = serviceName.trim();
    if (category) service.category = category;
    if (description) service.description = description.trim();
    if (price !== undefined) service.price = Number(price);
    if (location) service.location = location.trim();
    if (images && Array.isArray(images) && images.length > 0) service.images = images;
    if (isActive !== undefined) service.isActive = Boolean(isActive);

    await service.save();

    return res.status(200).json({
      success: true,
      message: 'Service updated successfully.',
      service,
    });
  } catch (error) {
    console.error('Update Service Error:', error);
    return res.status(500).json({ success: false, message: 'Error updating service.' });
  }
};

// @desc    Delete service (Vendor only, ownership checked)
// @route   DELETE /api/services/:id
// @access  Private (Vendor)
const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    // Ownership verification
    if (service.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only delete your own services.',
      });
    }

    await Service.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Service deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error deleting service.' });
  }
};

// @desc    Toggle availability (Vendor only)
// @route   PATCH /api/services/:id/availability
// @access  Private (Vendor)
const toggleAvailability = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    if (service.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only modify your own services.',
      });
    }

    service.isActive = !service.isActive;
    await service.save();

    return res.status(200).json({
      success: true,
      message: `Service ${service.isActive ? 'activated' : 'deactivated'} successfully.`,
      isActive: service.isActive,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error changing service availability.' });
  }
};

// ----------------- ADMIN CONTROLLERS -----------------

// @desc    Get all services for admin management
// @route   GET /api/services/admin/all
// @access  Private (Admin)
const getAdminServices = async (req, res) => {
  try {
    const { status, category, search } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }
    if (category && category !== 'all') {
      query.category = category;
    }
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ serviceName: searchRegex }, { location: searchRegex }];
    }

    const services = await Service.find(query)
      .populate('vendorId', 'name email businessName subscriptionPlan')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error retrieving admin services.' });
  }
};

// @desc    Approve or reject service (Admin only)
// @route   PATCH /api/services/:id/status
// @access  Private (Admin)
const updateServiceStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'pending', 'approved', or 'rejected'.",
      });
    }

    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Service status updated to '${status}'.`,
      service,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error updating service status.' });
  }
};

// @desc    Delete inappropriate service (Admin only)
// @route   DELETE /api/services/admin/:id
// @access  Private (Admin)
const deleteAdminService = async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }
    return res.status(200).json({
      success: true,
      message: 'Service removed successfully by Admin.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error deleting service.' });
  }
};

module.exports = {
  getServices,
  getFeaturedServices,
  getCategories,
  getServiceById,
  createService,
  getVendorServices,
  updateService,
  deleteService,
  toggleAvailability,
  getAdminServices,
  updateServiceStatus,
  deleteAdminService,
};
