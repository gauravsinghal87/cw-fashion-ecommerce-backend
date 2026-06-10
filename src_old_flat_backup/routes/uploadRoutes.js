const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');
const { uploadFiles, deleteFile } = require('../controllers/uploadController');

router.post('/', protect, uploadMultiple('files', 10), uploadFiles);
router.delete('/:publicId', protect, deleteFile);

module.exports = router;
