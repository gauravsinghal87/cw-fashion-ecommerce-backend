const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userRole: { type: String, enum: ['customer', 'vendor', 'admin', 'subadmin'] },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  description: String,
  changes: { type: mongoose.Schema.Types.Mixed },
  ip: String,
  userAgent: String,
  metadata: { type: mongoose.Schema.Types.Mixed },
  severity: { type: String, enum: ['info', 'warning', 'error', 'critical'], default: 'info' },
}, { timestamps: true });

auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, resource: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ severity: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
