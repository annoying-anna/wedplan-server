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
const { protect, verifyVendor, verifyAdmin } = require('../middleware/auth');

// Public routes
router.get('/', getServices);
router.get('/featured', getFeaturedServices);
router.get('/categories', getCategories);

// Vendor protected routes
router.post('/', protect, verifyVendor, createService);
router.get('/vendor/my-services', protect, verifyVendor, getVendorServices);
router.put('/:id', protect, verifyVendor, updateService);
router.delete('/:id', protect, verifyVendor, deleteService);
router.patch('/:id/availability', protect, verifyVendor, toggleAvailability);

// Admin protected routes
router.get('/admin/all', protect, verifyAdmin, getAdminServices);
router.patch('/:id/status', protect, verifyAdmin, updateServiceStatus);
router.delete('/admin/:id', protect, verifyAdmin, deleteAdminService);

// Single service public (placed last so specific named routes match first)
router.get('/:id', getServiceById);

module.exports = router;
