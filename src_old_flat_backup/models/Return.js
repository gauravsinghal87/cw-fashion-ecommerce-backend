const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderItem: { type: mongoose.Schema.Types.ObjectId, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  reason: { type: String, required: true },
  details: String,
  images: [{ url: String, publicId: String }],
  quantity: { type: Number, required: true },
  refundAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['return_requested', 'return_approved', 'return_rejected', 'pickup_scheduled', 'picked_up', 'return_received', 'qc_passed', 'qc_failed', 'refund_processed', 'dispute_open', 'dispute_resolved'],
    default: 'return_requested'
  },
  rejectionReason: String,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  itemReceivedAt: Date,
  refundProcessedAt: Date,
  refundTransactionId: String,
  pickupAddress: {
    fullName: String,
    phone: String,
    addressLine1: String,
    city: String,
    state: String,
    pincode: String,
  },
  pickupScheduled: Date,
  pickupCompleted: Date,
  trackingNumber: String,
  notes: String,
  evidence: [{ type: String }],
  qcNotes: String,
  qcPerformedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  qcPassedAt: Date,
  qcFailedAt: Date,
  damagedInventory: { type: Boolean, default: false },
  dispute: {
    reason: String,
    details: String,
    openedAt: Date,
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolution: String,
  },
}, { timestamps: true });

returnSchema.index({ order: 1 });
returnSchema.index({ user: 1 });
returnSchema.index({ vendor: 1 });
returnSchema.index({ status: 1 });

module.exports = mongoose.model('Return', returnSchema);
