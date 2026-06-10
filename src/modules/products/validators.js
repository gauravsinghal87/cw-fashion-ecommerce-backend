const { body } = require('express-validator');
exports.productValidator = [ body('title').trim().notEmpty(), body('category').notEmpty(), body('price').isNumeric(), body('stock').isInt({ min: 0 }) ];
exports.reviewValidator = [ body('rating').isInt({ min: 1, max: 5 }), body('comment').optional().trim() ];