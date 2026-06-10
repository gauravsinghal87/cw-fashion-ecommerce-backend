const mongoose = require('mongoose');

const couponRedemptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  discount: Number,
  redeemedAt: { type: Date, default: Date.now },
});

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: String,
  type: {
    type: String,
    enum: ['percentage', 'fixed', 'free_shipping', 'new_user'],
    default: 'percentage',
  },
  value: { type: Number },
  minAmount: { type: Number, default: 0 },
  maxDiscount: { type: Number },
  shippingWaived: { type: Boolean, default: false },
  usageLimit: { type: Number, default: 0 },
  usagePerUser: { type: Number, default: 0 },
  usedCount: { type: Number, default: 0 },
  totalDiscountGiven: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  applicableOn: { type: String, enum: ['all', 'category', 'brand', 'vendor', 'product'], default: 'all' },
  applicableIds: [{ type: mongoose.Schema.Types.ObjectId, refPath: 'applicableRef' }],
  applicableRef: { type: String, enum: ['Category', 'Brand', 'Vendor', 'Product'] },
  isFirstOrderOnly: { type: Boolean, default: false },
  userRedemptions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    count: { type: Number, default: 0 },
    lastUsed: Date,
  }],
  redemptions: [couponRedemptionSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

couponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
