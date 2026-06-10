const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true },
  source: { type: String, enum: ['customer', 'vendor'], required: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: {
    type: String,
    enum: [
      'order_issue', 'refund_issue', 'return_issue', 'payment_failed',
      'coupon_not_working', 'account_problem', 'referral_issue', 'product_issue',
      'product_approval', 'settlement_issue', 'withdrawal_issue', 'inventory_issue',
      'store_issue', 'commission_issue', 'technical_problem', 'other'
    ],
    required: true
  },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: {
    type: String,
    enum: ['open', 'assigned', 'in_progress', 'waiting_for_customer', 'resolved', 'closed'],
    default: 'open'
  },
  messages: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderRole: { type: String, enum: ['customer', 'vendor', 'admin', 'subadmin'] },
    message: String,
    attachments: [{ url: String, publicId: String, originalName: String, mimeType: String }],
    isInternal: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  }],
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedAt: Date,
  escalatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  escalatedAt: Date,
  escalationReason: String,
  internalNotes: [{ body: String, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, createdAt: { type: Date, default: Date.now } }],
  resolvedAt: Date,
  closedAt: Date,
  reopenedAt: Date,
  reopenCount: { type: Number, default: 0 },
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    submittedAt: Date,
  },
}, { timestamps: true });

supportTicketSchema.index({ user: 1, status: 1 });
supportTicketSchema.index({ vendor: 1, status: 1 });
supportTicketSchema.index({ assignedTo: 1, status: 1 });
supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ source: 1, status: 1 });

supportTicketSchema.pre('save', async function (next) {
  if (this.isNew && !this.ticketNumber) {
    const year = new Date().getFullYear();
    const last = await mongoose.model('SupportTicket').findOne({ ticketNumber: new RegExp(`^SUP-${year}-`) }).sort({ ticketNumber: -1 });
    let seq = 1;
    if (last) {
      const parts = last.ticketNumber.split('-');
      seq = parseInt(parts[2]) + 1;
    }
    this.ticketNumber = `SUP-${year}-${String(seq).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
