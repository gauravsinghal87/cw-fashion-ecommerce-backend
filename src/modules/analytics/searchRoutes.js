const express = require('express');
const router = express.Router();
const { searchProducts, searchSuggestions } = require('./searchController');

router.get('/', searchProducts);
router.get('/suggestions', searchSuggestions);

module.exports = router;
