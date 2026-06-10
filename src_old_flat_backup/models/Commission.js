const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['global', 'category', 'vendor', 'product', 'return_settings', 'shipping'], default: 'global' },
  rate: { type: Number, required: true, min: 0, max: 100 },
  charge: { type: Number },
  freeThreshold: { type: Number },
  isShippingEnabled: { type: Boolean, default: true },
  isFreeShippingEnabled: { type: Boolean, default: true },
  applicableId: { type: mongoose.Schema.Types.ObjectId },
  priority: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  effectiveFrom: Date,
  effectiveTo: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

commissionSchema.index({ type: 1, isActive: 1 });
commissionSchema.index({ applicableId: 1 });

module.exports = mongoose.model('Commission', commissionSchema);
