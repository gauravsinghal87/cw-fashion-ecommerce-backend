const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 1 },
  fee: { type: Number, default: 0 },
  netAmount: { type: Number, required: true },
  accountDetails: {
    accountHolderName: String,
    accountNumber: String,
    bankName: String,
    ifscCode: String,
    upiId: String,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  adminNote: String,
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: Date,
  completedAt: Date,
  rejectedAt: Date,
  rejectionReason: String,
  paymentMethod: { type: String, default: 'bank_transfer' },
  walletTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction' },
}, { timestamps: true });

withdrawalSchema.index({ vendor: 1, status: 1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
