const express = require('express');
const router = express.Router();
const { protect, authorize, checkPermission } = require('../middleware/auth');
const {
  getAllTickets, getTicketDetail, replyTicket, assignTicket,
  updateTicketStatus, escalateTicket, addInternalNote,
  getTicketStats, getSupportAgents
} = require('../controllers/supportController');

const a = [protect, authorize('admin', 'subadmin')];

router.get('/stats', ...a, checkPermission('support', 'view'), getTicketStats);
router.get('/agents', ...a, checkPermission('support', 'view'), getSupportAgents);
router.get('/tickets', ...a, checkPermission('support', 'view'), getAllTickets);
router.get('/tickets/:id', ...a, checkPermission('support', 'view'), getTicketDetail);
router.post('/tickets/:id/reply', ...a, checkPermission('support', 'reply'), replyTicket);
router.put('/tickets/:id/assign', ...a, checkPermission('support', 'assign'), assignTicket);
router.put('/tickets/:id/status', ...a, checkPermission('support', 'manage'), updateTicketStatus);
router.post('/tickets/:id/escalate', ...a, checkPermission('support', 'manage'), escalateTicket);
router.post('/tickets/:id/notes', ...a, checkPermission('support', 'reply'), addInternalNote);

module.exports = router;
