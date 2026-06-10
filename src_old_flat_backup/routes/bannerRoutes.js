const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createBanner,
  getBanners,
  getBanner,
  updateBanner,
  deleteBanner,
} = require('../controllers/bannerController');

router.get('/', getBanners);
router.get('/:id', getBanner);
router.post('/', protect, authorize('admin'), createBanner);
router.put('/:id', protect, authorize('admin'), updateBanner);
router.delete('/:id', protect, authorize('admin'), deleteBanner);

module.exports = router;
