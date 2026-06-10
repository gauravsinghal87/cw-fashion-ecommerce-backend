const { body } = require('express-validator');
exports.supportTicketValidator = [ body('subject').trim().notEmpty().withMessage('Subject required'), body('description').trim().notEmpty().withMessage('Description required'), body('category').optional().trim(), body('priority').optional().isIn(['low','medium','high','urgent']) ];
exports.replyValidator = [ body('message').trim().notEmpty().withMessage('Message required') ];
exports.feedbackValidator = [ body('rating').isInt({ min: 1, max: 5 }), body('comment').optional().trim() ];