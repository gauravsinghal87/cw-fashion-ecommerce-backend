const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { productValidator, reviewValidator } = require('../middleware/validators');
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
} = require('../controllers/productController');

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
  const { getProductReviewsPublic } = require('../controllers/reviewController');
  return getProductReviewsPublic(req, res, next);
});
router.post('/:id/reviews/:reviewId/reply', protect, authorize('vendor'), (req, res, next) => {
  req.params.reviewId = req.params.reviewId;
  const { vendorReplyReview } = require('../controllers/reviewController');
  return vendorReplyReview(req, res, next);
});
router.delete('/:id/reviews/:reviewId', protect, deleteReview);
router.put('/:id/stock', protect, authorize('vendor'), updateStock);

module.exports = router;
