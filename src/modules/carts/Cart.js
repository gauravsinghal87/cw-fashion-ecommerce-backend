const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variant: { type: mongoose.Schema.Types.ObjectId },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  name: String,
  image: String,
  price: { type: Number, required: true },
  mrp: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1, max: 10 },
  totalPrice: { type: Number, required: true },
  couponDiscount: { type: Number, default: 0 },
  finalPrice: { type: Number, default: 0 },
  color: String,
  size: String,
  sku: String,
}, { timestamps: true });

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [cartItemSchema],
  coupon: {
    code: String,
    discount: Number,
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
    shippingWaived: { type: Boolean, default: false },
  },
}, { timestamps: true });

cartSchema.set('toJSON', { transform: (doc, ret) => { if (ret.coupon && !ret.coupon.code) ret.coupon = undefined; return ret; } });
cartSchema.set('toObject', { transform: (doc, ret) => { if (ret.coupon && !ret.coupon.code) ret.coupon = undefined; return ret; } });

module.exports = mongoose.model('Cart', cartSchema);
