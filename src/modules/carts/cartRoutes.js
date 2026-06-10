const express = require('express');
const router = express.Router();
const { protect } = require('../../shared/middleware/auth');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
  removeCoupon,
} = require('../carts/cartController');

router.get('/', protect, getCart);
router.post('/add', protect, addToCart);
router.put('/:itemId', protect, updateCartItem);
router.delete('/:itemId', protect, removeFromCart);
router.delete('/', protect, clearCart);
router.post('/apply-coupon', protect, applyCoupon);
router.delete('/coupon/:couponCode', protect, removeCoupon);

module.exports = router;
