const express = require('express');
const router = express.Router();
const { protect } = require('../../shared/middleware/auth');
const { uploadMultiple } = require('../../shared/middleware/upload');
const { uploadFiles, deleteFile } = require('./uploadController');

router.post('/', protect, uploadMultiple('files', 10), uploadFiles);
router.delete('/:publicId', protect, deleteFile);

module.exports = router;
