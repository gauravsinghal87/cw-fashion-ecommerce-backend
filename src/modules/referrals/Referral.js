const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referred: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referralCode: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'cancelled', 'rejected'], default: 'pending' },
  rewardReferrer: { type: Number, default: 100 },
  rewardReferred: { type: Number, default: 50 },
  referrerRewarded: { type: Boolean, default: false },
  referredRewarded: { type: Boolean, default: false },
  referrerRewardPaidAt: Date,
  referredRewardPaidAt: Date,
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  orderAmount: Number,
  deviceId: String,
  ipAddress: String,
  isFraud: { type: Boolean, default: false },
  fraudReason: String,
  fraudDetectedAt: Date,
  completedAt: Date,
}, { timestamps: true });

referralSchema.index({ referrer: 1 });
referralSchema.index({ referred: 1 });
referralSchema.index({ referralCode: 1 });
referralSchema.index({ status: 1 });

module.exports = mongoose.model('Referral', referralSchema);
