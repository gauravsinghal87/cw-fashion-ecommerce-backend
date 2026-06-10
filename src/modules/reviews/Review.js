const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  orderItem: { type: mongoose.Schema.Types.ObjectId },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, trim: true, maxlength: 200 },
  comment: { type: String, trim: true, maxlength: 5000 },
  images: [{ type: String }],
  videos: [{ type: String }],
  isVerifiedPurchase: { type: Boolean, default: false },
  helpfulCount: { type: Number, default: 0 },
  helpfulUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'hidden'], default: 'pending' },
  rejectionReason: String,
  hiddenReason: String,
  vendorReply: {
    text: { type: String, trim: true, maxlength: 2000 },
    repliedAt: Date,
  },
  report: {
    isReported: { type: Boolean, default: false },
    reason: { type: String, enum: ['spam', 'fake', 'abusive', 'offensive', 'other'] },
    details: String,
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportedAt: Date,
    status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  editedAt: Date,
  isAnonymous: { type: Boolean, default: false },
}, { timestamps: true });

reviewSchema.index({ product: 1, status: 1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ vendor: 1 });
reviewSchema.index({ status: 1, createdAt: -1 });
reviewSchema.index({ 'report.isReported': 1, 'report.status': 1 });

module.exports = mongoose.model('Review', reviewSchema);
