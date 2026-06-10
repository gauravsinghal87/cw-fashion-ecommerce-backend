const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { body } = require('express-validator');
const {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  markHelpful,
  reportReview,
  getMyReviews,
  getReviewDetail,
  vendorGetReviews,
  vendorReplyReview,
  vendorReportReview,
  adminGetReviews,
  adminApproveReview,
  adminRejectReview,
  adminHideReview,
  adminRestoreReview,
  adminResolveReport,
  adminBanReviewer,
  getProductReviewsPublic,
  getReviewMedia,
} = require('../controllers/reviewController');

const reviewValidator = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('productId').notEmpty().withMessage('Product ID required'),
  body('orderId').notEmpty().withMessage('Order ID required'),
  body('orderItemId').notEmpty().withMessage('Order item ID required'),
];

const reportValidator = [
  body('reason').isIn(['spam', 'fake', 'abusive', 'offensive', 'other']).withMessage('Invalid reason'),
];

router.get('/product/:productId/stats', getProductReviewsPublic);
router.get('/product/:productId/media', getReviewMedia);
router.get('/product/:productId', getProductReviews);
router.post('/', protect, reviewValidator, validate, createReview);
router.get('/my', protect, getMyReviews);
router.get('/:reviewId', getReviewDetail);
router.put('/:reviewId', protect, updateReview);
router.delete('/:reviewId', protect, deleteReview);
router.post('/:reviewId/helpful', protect, markHelpful);
router.post('/:reviewId/report', protect, reportValidator, validate, reportReview);

router.get('/vendor/all', protect, authorize('vendor'), vendorGetReviews);
router.post('/vendor/:reviewId/reply', protect, authorize('vendor'), vendorReplyReview);
router.post('/vendor/:reviewId/report', protect, authorize('vendor'), reportValidator, validate, vendorReportReview);

router.get('/admin/all', protect, authorize('admin'), adminGetReviews);
router.put('/admin/:reviewId/approve', protect, authorize('admin'), adminApproveReview);
router.put('/admin/:reviewId/reject', protect, authorize('admin'), adminRejectReview);
router.put('/admin/:reviewId/hide', protect, authorize('admin'), adminHideReview);
router.put('/admin/:reviewId/restore', protect, authorize('admin'), adminRestoreReview);
router.put('/admin/:reviewId/resolve-report', protect, authorize('admin'), adminResolveReport);
router.put('/admin/:reviewId/ban-reviewer', protect, authorize('admin'), adminBanReviewer);

module.exports = router;
