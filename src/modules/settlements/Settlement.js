const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderItem: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemName: { type: String, required: true },
  originalPrice: { type: Number, required: true },
  couponDiscount: { type: Number, default: 0 },
  finalPrice: { type: Number, required: true },
  commissionRate: { type: Number, default: 0 },
  commissionAmount: { type: Number, default: 0 },
  vendorEarnings: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'released', 'cancelled'],
    default: 'pending'
  },
  deliveredAt: Date,
  returnWindowEnd: Date,
  releasedAt: Date,
  walletTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction' },
}, { timestamps: true });

settlementSchema.index({ vendor: 1, status: 1 });
settlementSchema.index({ order: 1 });
settlementSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Settlement', settlementSchema);
