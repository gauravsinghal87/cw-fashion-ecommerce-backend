const { body } = require('express-validator');
exports.addressValidator = [ body('addressLine1').trim().notEmpty(), body('city').trim().notEmpty(), body('state').trim().notEmpty(), body('pincode').matches(/^\d{6}$/).withMessage('Invalid pincode') ];
exports.profileUpdateValidator = [ body('name').optional().trim().notEmpty(), body('phone').optional().matches(/^\d{10}$/) ];
exports.profileValidator = exports.profileUpdateValidator;