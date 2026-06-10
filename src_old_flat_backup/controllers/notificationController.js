const Notification = require('../models/Notification');

const getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const notifications = await Notification.find({
      $or: [{ recipient: req.user._id }, { recipientRole: req.user.role }, { recipientRole: 'all' }]
    }).sort('-createdAt').skip((page - 1) * limit).limit(limit);
    const total = await Notification.countDocuments({
      $or: [{ recipient: req.user._id }, { recipientRole: req.user.role }, { recipientRole: 'all' }]
    });
    const unreadCount = await Notification.countDocuments({
      $or: [{ recipient: req.user._id }, { recipientRole: req.user.role }, { recipientRole: 'all' }],
      isRead: false
    });
    res.json({ success: true, notifications, unreadCount, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true, readAt: new Date() });
    res.json({ success: true, message: 'Marked as read' });
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { $or: [{ recipient: req.user._id }, { recipientRole: req.user.role }], isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

const sendNotification = async (req, res, next) => {
  try {
    const { recipient, recipientRole, title, message, type, data } = req.body;
    const notification = await Notification.create({
      recipient, recipientRole: recipientRole || 'all', title, message,
      type: type || 'in_app', data, sentAt: new Date(), status: 'sent',
    });
    res.status(201).json({ success: true, notification });
  } catch (error) {
    next(error);
  }
};

const getNotificationLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { type, status } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const logs = await Notification.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit);
    const total = await Notification.countDocuments(filter);
    res.json({ success: true, logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, sendNotification, getNotificationLogs };
