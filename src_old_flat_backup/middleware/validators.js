const { body } = require('express-validator');

const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().isMobilePhone('any').withMessage('Valid phone number is required'),
];

const loginValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const forgotPasswordValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
];

const resetPasswordValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit OTP is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const vendorRegisterValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().isMobilePhone('any').withMessage('Valid phone number is required'),
  body('storeName').trim().notEmpty().withMessage('Store name is required'),
  body('panNumber').optional().trim(),
  body('bankAccount').optional().trim(),
  body('ifscCode').optional().trim(),
];

const profileUpdateValidator = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().isMobilePhone('any').withMessage('Valid phone number is required'),
];

const addressValidator = [
  body('addressLine1').trim().notEmpty().withMessage('Address line 1 is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('pincode').matches(/^\d{6}$/).withMessage('Valid 6-digit pincode is required'),
  body('country').optional().trim().notEmpty(),
];

const productValidator = [
  body('title').trim().notEmpty().withMessage('Product title is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('price').optional({ values: 'null' }).isNumeric().withMessage('Price must be a number'),
  body('stock').optional({ values: 'null' }).isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('variants.*.price').optional({ values: 'null' }).isNumeric().withMessage('Each variant must have a numeric price'),
  body('variants.*.stock').optional({ values: 'null' }).isInt({ min: 0 }).withMessage('Variant stock must be a non-negative integer'),
  body().custom((_, { req }) => {
    const hasPrice = req.body.price !== undefined && req.body.price !== null && req.body.price !== '';
    const hasVariants = Array.isArray(req.body.variants) && req.body.variants.length > 0;
    const hasVariantPrice = hasVariants && req.body.variants.some(v => v.price !== undefined && v.price !== null && v.price !== '');
    if (!hasPrice && !hasVariantPrice) {
      throw new Error('Product price is required (provide top-level price or variant prices)');
    }
    return true;
  }),
];

const reviewValidator = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').trim().notEmpty().withMessage('Review comment is required'),
  body('orderId').notEmpty().withMessage('Order ID required'),
  body('orderItemId').notEmpty().withMessage('Order item ID required'),
];

const orderValidator = [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('shippingAddress').notEmpty().withMessage('Shipping address is required'),
  body('paymentMethod').notEmpty().withMessage('Payment method is required'),
];

const changePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

const couponValidator = [
  body('code').trim().notEmpty().withMessage('Coupon code is required'),
  body('endDate').isISO8601().withMessage('Valid expiry date is required'),
];

const categoryValidator = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
];

const brandValidator = [
  body('name').trim().notEmpty().withMessage('Brand name is required'),
];

const supportTicketValidator = [
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
];

module.exports = {
  registerValidator, loginValidator, forgotPasswordValidator, resetPasswordValidator,
  vendorRegisterValidator, profileUpdateValidator, addressValidator,
  productValidator, reviewValidator, orderValidator, changePasswordValidator,
  couponValidator, categoryValidator, brandValidator, supportTicketValidator,
};