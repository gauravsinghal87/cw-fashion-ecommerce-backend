const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../shared/middleware/auth');
const validate = require('../../shared/middleware/validation');
const { orderValidator } = require('./validators');
const {
  createOrder,
  getOrder,
  cancelOrder,
  getUserOrders,
  downloadInvoice,
  createRazorpayOrder,
  verifyRazorpayPayment,
  trackOrder,
} = require('../orders/orderController');

router.post('/', protect, orderValidator, validate, createOrder);
router.get('/', protect, getUserOrders);
router.get('/:id', protect, getOrder);
router.post('/create-razorpay-order', protect, createRazorpayOrder);
router.post('/verify-razorpay-payment', protect, verifyRazorpayPayment);
router.put('/:id/cancel', protect, cancelOrder);
router.get('/:id/invoice', protect, downloadInvoice);
router.get('/:id/track', protect, trackOrder);

module.exports = router;
