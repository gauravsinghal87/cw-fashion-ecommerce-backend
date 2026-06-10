const SupportTicket = require('../support/SupportTicket');
const Vendor = require('../vendors/Vendor');
const Notification = require('../notifications/Notification');

// ── HELPERS ──
const notify = async ({ userId, title, message, role }) => {
  try {
    await Notification.create({ recipient: userId, recipientRole: role || 'customer', title, message, type: 'in_app', status: 'sent' });
  } catch (_) {}
};

// ── CUSTOMER / VENDOR: Create Ticket ──
const createTicket = async (req, res, next) => {
  try {
    const { category, subject, description, priority } = req.body;
    const source = req.user.role === 'vendor' ? 'vendor' : 'customer';
    let vendor;
    if (source === 'vendor') vendor = await Vendor.findOne({ user: req.user._id });
    const ticket = await SupportTicket.create({
      source, vendor: vendor?._id, user: req.user._id,
      category, subject, description, priority: priority || 'medium',
      messages: [{ sender: req.user._id, senderRole: source, message: description }],
    });
    await notify({ userId: req.user._id, title: 'Ticket Created', message: `Your ticket ${ticket.ticketNumber} was created.`, role: source });
    res.status(201).json({ success: true, ticket });
  } catch (error) { next(error); }
};

// ── CUSTOMER / VENDOR: My Tickets ──
const getMyTickets = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    if (req.user.role === 'vendor') {
      const vendor = await Vendor.findOne({ user: req.user._id });
      filter.vendor = vendor._id;
    }
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const tickets = await SupportTicket.find(filter)
      .sort('-createdAt').skip((page - 1) * limit).limit(limit).lean();
    const total = await SupportTicket.countDocuments(filter);
    const counts = await SupportTicket.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    res.json({ success: true, tickets, counts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

// ── CUSTOMER / VENDOR / ADMIN: Ticket Detail ──
const getTicketDetail = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role !== 'admin' && req.user.role !== 'subadmin') {
      filter.user = req.user._id;
    }
    const ticket = await SupportTicket.findById(filter)
      .populate('user', 'name email phone')
      .populate('vendor', 'storeName')
      .populate('assignedTo', 'name email')
      .populate('messages.sender', 'name')
      .populate('escalatedTo', 'name email');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, ticket });
  } catch (error) { next(error); }
};

// ── CUSTOMER / VENDOR / ADMIN: Reply ──
const replyTicket = async (req, res, next) => {
  try {
    const { message, attachments, isInternal } = req.body;
    const filter = { _id: req.params.id };
    if (req.user.role !== 'admin' && req.user.role !== 'subadmin') {
      filter.user = req.user._id;
    }
    const ticket = await SupportTicket.findOne(filter);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (ticket.status === 'closed') return res.status(400).json({ success: false, message: 'Ticket is closed. Reopen it to reply.' });

    let senderRole = req.user.role === 'vendor' ? 'vendor' : req.user.role === 'admin' || req.user.role === 'subadmin' ? 'admin' : 'customer';
    ticket.messages.push({
      sender: req.user._id, senderRole, message,
      attachments: attachments || [],
      isInternal: isInternal || false,
    });
    if (ticket.status === 'waiting_for_customer' && (req.user.role === 'customer' || req.user.role === 'vendor')) {
      ticket.status = 'in_progress';
    } else if (ticket.status === 'open' && (req.user.role === 'admin' || req.user.role === 'subadmin')) {
      ticket.status = 'in_progress';
    }
    await ticket.save();

    const otherParty = ticket.user._id ? ticket.user._id.toString() : ticket.user.toString();
    const notifyUser = otherParty === req.user._id.toString() ? ticket.assignedTo : ticket.user;
    const notifyRole = otherParty === req.user._id.toString() ? 'admin' : ticket.source;
    if (notifyUser) {
      await notify({ userId: notifyUser, role: notifyRole, title: 'New Reply', message: `New reply on ${ticket.ticketNumber}: ${message?.slice(0, 80)}` });
    }
    res.json({ success: true, ticket });
  } catch (error) { next(error); }
};

// ── CUSTOMER / VENDOR: Reopen Ticket ──
const reopenTicket = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.user._id });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (ticket.status !== 'closed') return res.status(400).json({ success: false, message: 'Only closed tickets can be reopened' });
    const daysSinceClose = (Date.now() - new Date(ticket.closedAt).getTime()) / 86400000;
    if (daysSinceClose > 7) return res.status(400).json({ success: false, message: 'Cannot reopen ticket after 7 days' });
    ticket.status = 'open';
    ticket.reopenedAt = new Date();
    ticket.reopenCount = (ticket.reopenCount || 0) + 1;
    ticket.closedAt = undefined;
    await ticket.save();
    res.json({ success: true, ticket });
  } catch (error) { next(error); }
};

// ── CUSTOMER / VENDOR: Add Feedback ──
const addFeedback = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.user._id, status: 'closed' });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found or not closed' });
    if (ticket.feedback?.rating) return res.status(400).json({ success: false, message: 'Feedback already submitted' });
    ticket.feedback = { rating, comment, submittedAt: new Date() };
    await ticket.save();
    res.json({ success: true, ticket });
  } catch (error) { next(error); }
};

// ── ADMIN / SUBADMIN: List All Tickets ──
const getAllTickets = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.source) filter.source = req.query.source;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    if (req.query.search) {
      filter.$or = [
        { ticketNumber: new RegExp(req.query.search, 'i') },
        { subject: new RegExp(req.query.search, 'i') },
      ];
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const tickets = await SupportTicket.find(filter)
      .sort('-createdAt').skip((page - 1) * limit).limit(limit)
      .populate('user', 'name email')
      .populate('vendor', 'storeName')
      .populate('assignedTo', 'name')
      .lean();
    const total = await SupportTicket.countDocuments(filter);
    res.json({ success: true, tickets, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

// ── ADMIN / SUBADMIN: Assign Ticket ──
const assignTicket = async (req, res, next) => {
  try {
    const { assignedTo } = req.body;
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { assignedTo, status: 'assigned', assignedAt: new Date() },
      { new: true }
    ).populate('user', 'name email').populate('vendor', 'storeName').populate('assignedTo', 'name email');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    await notify({ userId: ticket.user, role: ticket.source, title: 'Ticket Assigned', message: `Your ticket ${ticket.ticketNumber} has been assigned.` });
    if (assignedTo) await notify({ userId: assignedTo, title: 'New Assignment', message: `Ticket ${ticket.ticketNumber} assigned to you.`, role: 'admin' });
    res.json({ success: true, ticket });
  } catch (error) { next(error); }
};

// ── ADMIN / SUBADMIN: Update Status ──
const updateTicketStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === 'resolved') update.resolvedAt = new Date();
    if (status === 'closed') update.closedAt = new Date();
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    await notify({ userId: ticket.user, role: ticket.source, title: 'Status Updated', message: `Ticket ${ticket.ticketNumber} status: ${status}` });
    res.json({ success: true, ticket });
  } catch (error) { next(error); }
};

// ── ADMIN / SUBADMIN: Escalate ──
const escalateTicket = async (req, res, next) => {
  try {
    const { escalatedTo, reason } = req.body;
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { escalatedTo, escalatedAt: new Date(), escalationReason: reason || 'Escalated by support' },
      { new: true }
    ).populate('escalatedTo', 'name email');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    await notify({ userId: ticket.user, role: ticket.source, title: 'Ticket Escalated', message: `Your ticket ${ticket.ticketNumber} has been escalated.` });
    if (escalatedTo) await notify({ userId: escalatedTo, title: 'Escalated Ticket', message: `Ticket ${ticket.ticketNumber} escalated to you.`, role: 'admin' });
    res.json({ success: true, ticket });
  } catch (error) { next(error); }
};

// ── ADMIN / SUBADMIN: Add Internal Note ──
const addInternalNote = async (req, res, next) => {
  try {
    const { body } = req.body;
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { $push: { internalNotes: { body, createdBy: req.user._id, createdAt: new Date() } } },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, ticket });
  } catch (error) { next(error); }
};

// ── ADMIN: Dashboard Stats ──
const getTicketStats = async (req, res, next) => {
  try {
    const [statusCounts, sourceCounts, avgResolution] = await Promise.all([
      SupportTicket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      SupportTicket.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]),
      SupportTicket.aggregate([
        { $match: { status: 'closed', closedAt: { $ne: null }, createdAt: { $ne: null } } },
        { $project: { diff: { $subtract: ['$closedAt', '$createdAt'] } } },
        { $group: { _id: null, avgMs: { $avg: '$diff' } } },
      ]),
    ]);
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyTickets = await SupportTicket.countDocuments({ createdAt: { $gte: thisMonth } });
    const avgHours = avgResolution[0] ? Math.round(avgResolution[0].avgMs / 3600000) : 0;
    const total = await SupportTicket.countDocuments();
    const open = await SupportTicket.countDocuments({ status: { $in: ['open', 'assigned', 'in_progress', 'waiting_for_customer'] } });
    const resolved = await SupportTicket.countDocuments({ status: 'resolved' });
    const closed = await SupportTicket.countDocuments({ status: 'closed' });
    const avgRating = await SupportTicket.aggregate([
      { $match: { 'feedback.rating': { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$feedback.rating' } } },
    ]);
    res.json({
      success: true, stats: {
        total, open, resolved, closed,
        monthlyTickets, avgResolutionHours: avgHours,
        satisfaction: avgRating[0] ? Math.round(avgRating[0].avg * 10) / 10 : 0,
        statusCounts: statusCounts.reduce((a, c) => ({ ...a, [c._id]: c.count }), {}),
        sourceCounts: sourceCounts.reduce((a, c) => ({ ...a, [c._id]: c.count }), {}),
      }
    });
  } catch (error) { next(error); }
};

// ── ADMIN: List agents (users with subadmin / admin role) ──
const getSupportAgents = async (req, res, next) => {
  try {
    const User = require('../users/User');
    const agents = await User.find({ role: { $in: ['admin', 'subadmin'] }, isActive: true }).select('name email role');
    res.json({ success: true, agents });
  } catch (error) { next(error); }
};

module.exports = {
  createTicket, getMyTickets, getTicketDetail, replyTicket, reopenTicket, addFeedback,
  getAllTickets, assignTicket, updateTicketStatus, escalateTicket, addInternalNote,
  getTicketStats, getSupportAgents,
};
