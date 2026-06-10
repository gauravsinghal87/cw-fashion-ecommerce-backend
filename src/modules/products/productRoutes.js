const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../shared/middleware/auth');
const validate = require('../../shared/middleware/validation');
const { productValidator, reviewValidator } = require('./validators');
const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getFlashSaleProducts,
  getNewArrivals,
  getBestSellers,
  getTrendingProducts,
  getRelatedProducts,
  getProductsByVendor,
  getProductsByCategory,
  getProductsByBrand,
  addReview,
  getReviews,
  deleteReview,
  updateStock,
} = require('../products/productController');

router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/flash-sale', getFlashSaleProducts);
router.get('/new-arrivals', getNewArrivals);
router.get('/best-sellers', getBestSellers);
router.get('/trending', getTrendingProducts);
router.get('/vendor/:vendorId', getProductsByVendor);
router.get('/category/:categoryId', getProductsByCategory);
router.get('/brand/:brandId', getProductsByBrand);
router.get('/:id', getProduct);
router.get('/:id/related', getRelatedProducts);
router.get('/:id/reviews', getReviews);
router.post('/', protect, authorize('vendor'), productValidator, validate, createProduct);
router.put('/:id', protect, authorize('vendor', 'admin'), updateProduct);
router.delete('/:id', protect, authorize('vendor', 'admin'), deleteProduct);
router.post('/:id/reviews', protect, reviewValidator, validate, addReview);
router.get('/:id/reviews/stats', (req, res, next) => {
  req.params.productId = req.params.id;
  const { getProductReviewsPublic } = require('../reviews/reviewController');
  return getProductReviewsPublic(req, res, next);
});
router.post('/:id/reviews/:reviewId/reply', protect, authorize('vendor'), (req, res, next) => {
  req.params.reviewId = req.params.reviewId;
  const { vendorReplyReview } = require('../reviews/reviewController');
  return vendorReplyReview(req, res, next);
});
router.delete('/:id/reviews/:reviewId', protect, deleteReview);
router.put('/:id/stock', protect, authorize('vendor'), updateStock);

module.exports = router;
