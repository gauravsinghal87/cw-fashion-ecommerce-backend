const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../shared/middleware/auth');
const {
  getAdminDashboard,
  getVendorDashboard,
  getCustomerDashboard,
} = require('../analytics/dashboardController');

router.get('/admin', protect, authorize('admin'), getAdminDashboard);
router.get('/vendor', protect, authorize('vendor'), getVendorDashboard);
router.get('/customer', protect, getCustomerDashboard);

module.exports = router;
