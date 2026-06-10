const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variant: { type: mongoose.Schema.Types.ObjectId },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  name: { type: String, required: true },
  image: String,
  sku: String,
  color: String,
  size: String,
  mrp: { type: Number, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  totalPrice: { type: Number, required: true },
  couponDiscount: { type: Number, default: 0 },
  finalPrice: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },
  commissionRate: { type: Number, default: 0 },
  vendorEarnings: { type: Number, default: 0 },
  paymentSettled: { type: Boolean, default: false },
  settlementDate: Date,
  status: {
    type: String,
    enum: ['pending', 'accepted', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'return_requested', 'return_approved', 'return_rejected', 'return_received', 'refunded', 'settled'],
    default: 'pending'
  },
  statusHistory: [{
    status: String,
    date: { type: Date, default: Date.now },
    note: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  isReturnable: { type: Boolean, default: true },
  returnRequest: {
    isRequested: { type: Boolean, default: false },
    reason: String,
    status: { type: String, enum: ['pending', 'return_requested', 'return_approved', 'return_rejected', 'pickup_scheduled', 'picked_up', 'return_received', 'qc_passed', 'qc_failed', 'refunded'] },
    requestedAt: Date,
    approvedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
    refundAmount: Number,
    refundProcessedAt: Date,
  },
  tracking: {
    carrier: String,
    trackingNumber: String,
    trackingUrl: String,
    estimatedDelivery: Date,
    deliveredAt: Date,
    shippedAt: Date,
  },
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderNumber: { type: String, required: true, unique: true },
  items: [orderItemSchema],
  shippingAddress: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: String,
    landmark: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' },
  },
  billingAddress: {
    fullName: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
  },
  payment: {
    method: { type: String, enum: ['cod', 'wallet', 'razorpay'], required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'], default: 'pending' },
    transactionId: String,
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    paidAt: Date,
    refundAmount: { type: Number, default: 0 },
    refundTransactionId: String,
  },
  coupon: {
    code: String,
    discount: { type: Number, default: 0 },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
  },
  subtotal: { type: Number, required: true },
  shippingCharge: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'return_requested', 'return_approved', 'return_rejected', 'return_received', 'refunded', 'settled'],
    default: 'pending'
  },
  notes: String,
  invoiceUrl: String,
  invoiceNumber: String,
  estimatedDelivery: Date,
  deliveredAt: Date,
  cancellation: {
    isRequested: { type: Boolean, default: false },
    reason: String,
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  paymentSettled: { type: Boolean, default: false },
  settlementDate: Date,
  settledAt: Date,
  returnWindowEnd: Date,
  refund: {
    amount: Number,
    processedAt: Date,
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
  },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'items.vendor': 1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
