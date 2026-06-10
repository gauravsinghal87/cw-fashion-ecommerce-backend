const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../shared/middleware/auth');
const { getFooterSettings, updateFooterSettings } = require('./footerController');

router.get('/', getFooterSettings);
router.put('/', protect, authorize('admin'), updateFooterSettings);

module.exports = router;
