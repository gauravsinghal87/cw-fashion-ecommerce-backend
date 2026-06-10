const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  accountHolderName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  bankName: { type: String, required: true },
  ifscCode: { type: String, required: true },
  accountType: { type: String, enum: ['Saving', 'Current'], default: 'Saving' },
  upiId: String,
  isVerified: { type: Boolean, default: false },
});

const vendorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  storeName: { type: String, required: true, trim: true },
  storeSlug: { type: String, required: true, unique: true, lowercase: true },
  storeDescription: String,
  storeLogo: { url: String, publicId: String },
  storeBanner: { url: String, publicId: String },
  storeRating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  panNumber: { type: String, required: true },
  aadhaarNumber: { type: String, required: true, select: false },
  bankAccount: bankAccountSchema,
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending' },
  statusReason: String,
  commissionRate: { type: Number, default: 0 },
  isFeatured: { type: Boolean, default: false },
  totalProducts: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },
  pendingWithdrawal: { type: Number, default: 0 },
  returnPolicy: { type: String, enum: ['7_days', '10_days', 'no_return'], default: '7_days' },
  warehouseAddress: {
    addressLine1: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  metaTitle: String,
  metaDescription: String,
  settings: {
    autoAcceptOrders: { type: Boolean, default: true },
    maxOrderQuantity: { type: Number, default: 10 },
    shippingCharge: { type: Number, default: 99 },
    freeShippingThreshold: { type: Number, default: 999 },
    allowCOD: { type: Boolean, default: true },
  },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

vendorSchema.index({ status: 1 });

vendorSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'vendor',
});

module.exports = mongoose.model('Vendor', vendorSchema);
