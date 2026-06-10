const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  variantSku: { type: String },
  type: {
    type: String,
    enum: ['stock_in', 'stock_out', 'transfer_in', 'transfer_out', 'reserve', 'unreserve', 'damaged', 'repaired', 'order', 'order_cancel', 'return'],
    required: true,
  },
  quantity: { type: Number, required: true },
  availableBefore: { type: Number, default: 0 },
  availableAfter: { type: Number, default: 0 },
  reservedBefore: { type: Number, default: 0 },
  reservedAfter: { type: Number, default: 0 },
  damagedBefore: { type: Number, default: 0 },
  damagedAfter: { type: Number, default: 0 },
  note: { type: String },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceModel: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

transactionSchema.index({ vendor: 1, createdAt: -1 });
transactionSchema.index({ warehouse: 1 });
transactionSchema.index({ variantSku: 1 });
transactionSchema.index({ referenceId: 1 });

module.exports = mongoose.model('InventoryTransaction', transactionSchema);
