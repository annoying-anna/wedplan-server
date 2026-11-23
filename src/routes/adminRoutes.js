const express = require('express');
const router = express.Router();
const { getAllUsers, toggleBlockUser } = require('../controllers/adminController');
const { protect, verifyAdmin } = require('../middleware/auth');

router.get('/users', protect, verifyAdmin, getAllUsers);
router.patch('/users/:id/block', protect, verifyAdmin, toggleBlockUser);

module.exports = router;
