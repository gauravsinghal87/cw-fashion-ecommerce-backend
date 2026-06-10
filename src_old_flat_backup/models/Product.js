const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  sku: { type: String, required: true },
  color: String,
  size: String,
  price: { type: Number, required: true },
  mrp: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
  reservedStock: { type: Number, default: 0 },
  availableStock: { type: Number, default: 0 },
  weight: Number,
  images: [{ url: String, publicId: String, isPrimary: Boolean }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, lowercase: true },
  description: { type: String, required: true },
  isReturnable: { type: Boolean, default: true },
  returnWindow: { type: Number, default: 7 },
  productType: { type: String, enum: ['simple', 'variant'], default: 'simple' },
  variants: [variantSchema],
  defaultVariant: { type: mongoose.Schema.Types.ObjectId },
  images: [{ url: String, publicId: String, isPrimary: Boolean }],
  videos: [{ url: String, publicId: String, type: { type: String, enum: ['upload', 'youtube', 'vimeo'] } }],
  tags: [String],
  attributes: [{
    name: String,
    value: String,
  }],
  minPrice: { type: Number },
  maxPrice: { type: Number },
  mrp: { type: Number },
  weight: { type: Number },
  totalStock: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'draft', 'archived'], default: 'draft' },
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  isFlashSale: { type: Boolean, default: false },
  flashSalePrice: Number,
  flashSaleStart: Date,
  flashSaleEnd: Date,
  isNewArrival: { type: Boolean, default: false },
  isBestSeller: { type: Boolean, default: false },
  isTrending: { type: Boolean, default: false },
  returnPolicy: { type: String, enum: ['7_days', '10_days', 'no_return', 'vendor_default'], default: 'vendor_default' },
  rating: { type: Number, default: 0 },
  numRatings: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  totalSold: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  wishlistCount: { type: Number, default: 0 },
  cartCount: { type: Number, default: 0 },
  trendingScore: { type: Number, default: 0 },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectionReason: String,
  hideReason: String,
  hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hiddenAt: Date,
  needsReapproval: { type: Boolean, default: false },
  reviews: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    rating: { type: Number, min: 1, max: 5 },
    title: String,
    comment: String,
    images: [String],
    videos: [String],
    createdAt: { type: Date, default: Date.now },
  }],
  reapprovalFields: [String],
  metaTitle: String,
  metaDescription: String,
  ogImage: { url: String, publicId: String },
  seoSlug: String,
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

productSchema.index({ vendor: 1, status: 1 });
productSchema.index({ slug: 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ 'variants.sku': 1 });
productSchema.index({ minPrice: 1, maxPrice: 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ isFlashSale: 1, flashSaleEnd: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ totalSold: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ tags: 1 });
productSchema.index({ title: 'text', description: 'text', tags: 'text' });

productSchema.pre('save', function (next) {
  if (this.variants && this.variants.length > 0) {
    const active = this.variants.filter(v => v.isActive);
    const prices = active.map(v => v.price);
    const mrps = active.map(v => v.mrp);
    this.minPrice = prices.length ? Math.min(...prices) : 0;
    this.maxPrice = prices.length ? Math.max(...prices) : 0;
    this.mrp = mrps.length ? Math.max(...mrps) : 0;
    this.totalStock = active.reduce((sum, v) => sum + (v.availableStock || v.stock || 0), 0);
  } else {
    this.minPrice = this.minPrice || 0;
    this.maxPrice = this.maxPrice || 0;
    this.totalStock = this.totalStock || 0;
    this.mrp = this.mrp || 0;
  }
  this.trendingScore = (this.views || 0) * 1 + (this.wishlistCount || 0) * 2 + (this.cartCount || 0) * 3 + (this.totalSold || 0) * 5 + (this.numReviews || 0) * 10 + (this.rating || 0) * 20;
  next();
});

module.exports = mongoose.model('Product', productSchema);
