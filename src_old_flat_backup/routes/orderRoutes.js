const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { orderValidator } = require('../middleware/validators');
const {
  createOrder,
  getOrders,
  getOrder,
  cancelOrder,
  getUserOrders,
  downloadInvoice,
  createRazorpayOrder,
  verifyRazorpayPayment,
  trackOrder,
} = require('../controllers/orderController');

router.post('/', protect, orderValidator, validate, createOrder);
router.get('/', protect, getUserOrders);
router.get('/:id', protect, getOrder);
router.post('/create-razorpay-order', protect, createRazorpayOrder);
router.post('/verify-razorpay-payment', protect, verifyRazorpayPayment);
router.put('/:id/cancel', protect, cancelOrder);
router.get('/:id/invoice', protect, downloadInvoice);
router.get('/:id/track', protect, trackOrder);

module.exports = router;
