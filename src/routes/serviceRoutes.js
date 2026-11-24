const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/serviceController');
const { protect, optionalAuth, verifyVendor, verifyAdmin } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');

// Public routes
router.get('/', getServices);
router.get('/featured', getFeaturedServices);
router.get('/categories', getCategories);

// Vendor protected routes
router.post('/', protect, verifyVendor, createService);
router.get('/vendor/my-services', protect, verifyVendor, getVendorServices);
router.put('/:id', protect, verifyVendor, validateObjectId(), updateService);
router.delete('/:id', protect, verifyVendor, validateObjectId(), deleteService);
router.patch('/:id/availability', protect, verifyVendor, validateObjectId(), toggleAvailability);

// Admin protected routes
router.get('/admin/all', protect, verifyAdmin, getAdminServices);
router.patch('/:id/status', protect, verifyAdmin, validateObjectId(), updateServiceStatus);
router.delete('/admin/:id', protect, verifyAdmin, validateObjectId(), deleteAdminService);

// Single service (optional auth lets the owner/admin preview pending listings)
router.get('/:id', validateObjectId(), optionalAuth, getServiceById);

module.exports = router;
