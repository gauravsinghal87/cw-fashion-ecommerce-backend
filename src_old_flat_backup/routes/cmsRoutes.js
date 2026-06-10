const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getCMSPage,
  getAllCMSPages,
  updateCMSPage,
  createCMSPage,
} = require('../controllers/cmsController');

router.get('/', getAllCMSPages);
router.get('/:page', getCMSPage);
router.put('/:page', protect, authorize('admin'), updateCMSPage);
router.post('/', protect, authorize('admin'), createCMSPage);

module.exports = router;
