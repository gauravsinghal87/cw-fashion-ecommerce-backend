const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true },
  balanceBefore: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  category: {
    type: String,
    enum: ['referral_earnings', 'refund', 'cashback', 'purchase', 'withdrawal', 'bonus', 'adjustment', 'commission'],
    required: true
  },
  description: String,
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceModel: { type: String, enum: ['Order', 'Referral', 'Withdrawal', 'Return', 'User'] },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  remark: String,
}, { timestamps: true });

const walletSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, default: 0 },
  totalCredited: { type: Number, default: 0 },
  totalDebited: { type: Number, default: 0 },
  totalReferralEarnings: { type: Number, default: 0 },
  totalCashback: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  withdrawalMinimum: { type: Number, default: 500 },
  lastTransactionAt: Date,
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

walletTransactionSchema.index({ wallet: 1, createdAt: -1 });
walletTransactionSchema.index({ user: 1, createdAt: -1 });
walletTransactionSchema.index({ category: 1 });

walletSchema.virtual('transactions', {
  ref: 'WalletTransaction',
  localField: '_id',
  foreignField: 'wallet',
  options: { sort: { createdAt: -1 } }
});

module.exports = {
  Wallet: mongoose.model('Wallet', walletSchema),
  WalletTransaction: mongoose.model('WalletTransaction', walletTransactionSchema),
};
