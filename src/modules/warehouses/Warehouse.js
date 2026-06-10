const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  name: { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: String,
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: 'India' },
  contactName: String,
  contactPhone: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

warehouseSchema.index({ vendor: 1 });

module.exports = mongoose.model('Warehouse', warehouseSchema);
