const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../shared/middleware/auth');
const {
  createCoupon,
  getCoupons,
  getCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  getAvailableCoupons,
} = require('../coupons/couponController');

router.get('/', getCoupons);
router.get('/available', getAvailableCoupons);
router.get('/:id', getCoupon);
router.post('/validate', validateCoupon);
router.post('/', protect, authorize('admin'), createCoupon);
router.put('/:id', protect, authorize('admin'), updateCoupon);
router.delete('/:id', protect, authorize('admin'), deleteCoupon);

module.exports = router;
