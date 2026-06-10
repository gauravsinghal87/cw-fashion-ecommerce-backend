const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantSku: { type: String, required: true },
  variantLabel: { type: String, default: '' },
  availableStock: { type: Number, default: 0 },
  reservedStock: { type: Number, default: 0 },
  damagedStock: { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 10 },
}, { timestamps: true });

inventorySchema.virtual('totalStock').get(function () {
  return this.availableStock + this.reservedStock + this.damagedStock;
});

inventorySchema.virtual('sellableStock').get(function () {
  return this.availableStock - this.reservedStock;
});

inventorySchema.index({ vendor: 1, warehouse: 1 });
inventorySchema.index({ product: 1, variantSku: 1, warehouse: 1 }, { unique: true });
inventorySchema.index({ availableStock: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
