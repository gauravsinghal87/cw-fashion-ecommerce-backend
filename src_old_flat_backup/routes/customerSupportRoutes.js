const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createTicket, getMyTickets, getTicketDetail, replyTicket, reopenTicket, addFeedback } = require('../controllers/supportController');

router.post('/tickets', protect, createTicket);
router.get('/tickets', protect, getMyTickets);
router.get('/tickets/:id', protect, getTicketDetail);
router.post('/tickets/:id/reply', protect, replyTicket);
router.post('/tickets/:id/reopen', protect, reopenTicket);
router.post('/tickets/:id/feedback', protect, addFeedback);

module.exports = router;
