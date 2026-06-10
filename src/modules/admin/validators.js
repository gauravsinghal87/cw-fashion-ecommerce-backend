const { body } = require('express-validator');
exports.couponValidator = [ body('code').trim().notEmpty(), body('type').isIn(['percentage','fixed','free_shipping','new_user']), body('value').isNumeric() ];
exports.categoryValidator = [ body('name').trim().notEmpty() ];
exports.brandValidator = [ body('name').trim().notEmpty() ];