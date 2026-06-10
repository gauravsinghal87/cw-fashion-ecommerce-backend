const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../shared/middleware/auth');
const {
  createBrand,
  getBrands,
  getBrand,
  getBrandBySlug,
  updateBrand,
  deleteBrand,
} = require('../brands/brandController');

router.get('/', getBrands);
router.get('/slug/:slug', getBrandBySlug);
router.get('/:id', getBrand);
router.post('/', protect, authorize('admin'), createBrand);
router.put('/:id', protect, authorize('admin'), updateBrand);
router.delete('/:id', protect, authorize('admin'), deleteBrand);

module.exports = router;
