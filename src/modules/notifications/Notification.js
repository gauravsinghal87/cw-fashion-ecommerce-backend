const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recipientRole: { type: String, enum: ['customer', 'vendor', 'admin', 'subadmin', 'all'] },
  type: { type: String, enum: ['email', 'push', 'sms', 'in_app'], default: 'in_app' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  isRead: { type: Boolean, default: false },
  readAt: Date,
  sentAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  error: String,
  metadata: {
    emailId: String,
    pushToken: String,
    smsId: String,
  },
  sentLogs: [{
    type: String,
    sentAt: Date,
    status: String,
    response: String,
  }],
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipientRole: 1 });
notificationSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
