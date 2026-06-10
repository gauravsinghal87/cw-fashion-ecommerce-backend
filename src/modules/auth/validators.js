const { body } = require('express-validator');
exports.registerValidator = [ body('name').trim().notEmpty().withMessage('Name is required'), body('email').isEmail().withMessage('Valid email required'), body('password').isLength({ min: 6 }).withMessage('Password min 6 chars') ];
exports.loginValidator = [ body('email').isEmail().withMessage('Valid email required'), body('password').notEmpty().withMessage('Password required') ];
exports.forgotPasswordValidator = [ body('email').isEmail().withMessage('Valid email required') ];
exports.resetPasswordValidator = [ body('otp').notEmpty().withMessage('OTP required'), body('password').isLength({ min: 6 }).withMessage('Password min 6 chars') ];
exports.changePasswordValidator = [ body('currentPassword').notEmpty().withMessage('Current password required'), body('newPassword').isLength({ min: 6 }).withMessage('New password min 6 chars') ];
exports.socialLoginValidator = [ body('idToken').notEmpty() ];