const express = require('express');
const router = express.Router();
const { getAllUsers, toggleBlockUser } = require('../controllers/adminController');
const { protect, verifyAdmin } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');

router.get('/users', protect, verifyAdmin, getAllUsers);
router.patch('/users/:id/block', protect, verifyAdmin, validateObjectId(), toggleBlockUser);

module.exports = router;
