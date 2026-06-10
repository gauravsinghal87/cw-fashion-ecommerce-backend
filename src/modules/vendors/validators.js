const { body } = require('express-validator');
exports.vendorRegisterValidator = [ body('storeName').trim().notEmpty(), body('email').isEmail(), body('password').isLength({ min: 6 }) ];
exports.productValidator = [ body('title').trim().notEmpty(), body('category').notEmpty(), body('price').isNumeric() ];
exports.supportTicketValidator = [ body('subject').trim().notEmpty(), body('description').trim().notEmpty() ];