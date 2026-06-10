const Product = require('../models/Product');
const Review = require('../models/Review');
const Order = require('../models/Order');
const Vendor = require('../models/Vendor');
const APIFeatures = require('../utils/apiFeatures');
const slugify = require('slugify');

const createProduct = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) {
      return res.status(400).json({ success: false, message: 'Vendor profile not found' });
    }

    const allowed = ['title', 'description', 'category', 'brand', 'images', 'variants', 'tags', 'specifications', 'isReturnable', 'returnPeriod', 'metaTitle', 'metaDescription', 'metaKeywords'];
    const productData = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) productData[f] = req.body[f]; });
    productData.vendor = vendor._id;
    productData.slug = slugify(req.body.title, { lower: true, strict: true }) + '-' + Date.now().toString(36);
    const product = await Product.create(productData);

    vendor.totalProducts += 1;
    await vendor.save();

    res.status(201).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

const getProducts = async (req, res, next) => {
  try {
    const features = new APIFeatures(Product.find({ isActive: true, status: 'approved' }), req.query)
      .filter()
      .search(['title', 'description', 'tags'])
      .sort()
      .limitFields()
      .paginate();

    const products = await features.query
      .populate('vendor', 'storeName storeSlug storeRating')
      .populate('category', 'name slug')
      .populate('brand', 'name slug')
      .select('-variants');

    const total = await Product.countDocuments({ isActive: true, status: 'approved' });
    const pagination = features.getPagination(total);

    res.json({ success: true, products, pagination });
  } catch (error) {
    next(error);
  }
};

const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { $inc: { views: 1 } },
      { new: true }
    )
      .populate('vendor', 'storeName storeSlug storeDescription storeLogo storeRating totalRatings')
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .populate('brand', 'name slug');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

const SENSITIVE_FIELDS = ['title', 'images', 'category', 'description'];

const updateProduct = async (req, res, next) => {
  try {
    let product;
    if (req.user.role === 'admin') {
      product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    } else {
      const vendor = await Vendor.findOne({ user: req.user._id });
      const existing = await Product.findOne({ _id: req.params.id, vendor: vendor._id });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const changedSensitive = SENSITIVE_FIELDS.filter(f => req.body[f] !== undefined && JSON.stringify(req.body[f]) !== JSON.stringify(existing[f]));
      const needsReapproval = changedSensitive.length > 0 && existing.status === 'approved';

      product = await Product.findOneAndUpdate(
        { _id: req.params.id, vendor: vendor._id },
        {
          ...req.body,
          ...(needsReapproval ? { status: 'pending', approvalStatus: 'pending', needsReapproval: true, reapprovalFields: changedSensitive } : {}),
        },
        { new: true, runValidators: true }
      );
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    let product;
    if (req.user.role === 'admin') {
      product = await Product.findByIdAndUpdate(req.params.id, { isActive: false, status: 'archived' }, { new: true });
    } else {
      const vendor = await Vendor.findOne({ user: req.user._id });
      product = await Product.findOneAndUpdate(
        { _id: req.params.id, vendor: vendor._id },
        { isActive: false, status: 'archived' },
        { new: true }
      );
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (req.user.role === 'vendor') {
      const vendor = await Vendor.findOne({ user: req.user._id });
      vendor.totalProducts = Math.max(0, vendor.totalProducts - 1);
      await vendor.save();
    }

    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    next(error);
  }
};

const getFeaturedProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isFeatured: true, isActive: true, status: 'approved' })
      .populate('vendor', 'storeName')
      .limit(12)
      .sort('-createdAt');
    res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
};

const getFlashSaleProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const now = new Date();
    const products = await Product.find({
      isFlashSale: true, isActive: true, status: 'approved',
      $and: [
        { $or: [{ flashSaleStart: { $exists: false } }, { flashSaleStart: null }, { flashSaleStart: { $lte: now } }] },
        { $or: [{ flashSaleEnd: { $exists: false } }, { flashSaleEnd: null }, { flashSaleEnd: { $gt: now } }] },
      ]
    }).populate('vendor', 'storeName').sort('-createdAt').skip((page - 1) * limit).limit(limit);
    const total = await Product.countDocuments({
      isFlashSale: true, isActive: true, status: 'approved',
      $and: [
        { $or: [{ flashSaleStart: { $exists: false } }, { flashSaleStart: null }, { flashSaleStart: { $lte: now } }] },
        { $or: [{ flashSaleEnd: { $exists: false } }, { flashSaleEnd: null }, { flashSaleEnd: { $gt: now } }] },
      ]
    });
    res.json({ success: true, products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const getNewArrivals = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true, status: 'approved' })
      .populate('vendor', 'storeName').limit(12).sort('-createdAt');
    res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
};

const getBestSellers = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true, status: 'approved' })
      .populate('vendor', 'storeName').limit(12).sort('-totalSold');
    res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
};

const getTrendingProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true, status: 'approved' })
      .populate('vendor', 'storeName').limit(12).sort('-trendingScore');
    res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
};

const getRelatedProducts = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const products = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      isActive: true,
      status: 'approved'
    }).limit(8).populate('vendor', 'storeName');
    res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
};

const getProductsByVendor = async (req, res, next) => {
  try {
    const features = new APIFeatures(
      Product.find({ vendor: req.params.vendorId, isActive: true, status: 'approved' }),
      req.query
    ).filter().sort().paginate();

    const products = await features.query.populate('vendor', 'storeName storeSlug storeLogo storeDescription storeRating totalRatings');
    const total = await Product.countDocuments({ vendor: req.params.vendorId, isActive: true, status: 'approved' });
    const pagination = features.getPagination(total);

    res.json({ success: true, products, pagination });
  } catch (error) {
    next(error);
  }
};

const getProductsByCategory = async (req, res, next) => {
  try {
    const features = new APIFeatures(
      Product.find({ category: req.params.categoryId, isActive: true, status: 'approved' }),
      req.query
    ).filter().sort().paginate();

    const products = await features.query.populate('vendor', 'storeName');
    const total = await Product.countDocuments({ category: req.params.categoryId, isActive: true, status: 'approved' });
    const pagination = features.getPagination(total);

    res.json({ success: true, products, pagination });
  } catch (error) {
    next(error);
  }
};

const getProductsByBrand = async (req, res, next) => {
  try {
    const features = new APIFeatures(
      Product.find({ brand: req.params.brandId, isActive: true, status: 'approved' }),
      req.query
    ).filter().sort().paginate();

    const products = await features.query.populate('vendor', 'storeName');
    const total = await Product.countDocuments({ brand: req.params.brandId, isActive: true, status: 'approved' });
    const pagination = features.getPagination(total);

    res.json({ success: true, products, pagination });
  } catch (error) {
    next(error);
  }
};

const addReview = async (req, res, next) => {
  try {
    const { rating, title, comment, images, videos, orderId, orderItemId } = req.body;
    if (!orderId || !orderItemId) {
      return res.status(400).json({ success: false, message: 'Only verified purchasers can review' });
    }
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const existing = await Review.findOne({ user: req.user._id, product: product._id });
    if (existing) return res.status(400).json({ success: false, message: 'Already reviewed this product' });
    const order = await Order.findById(orderId);
    if (!order || order.user.toString() !== req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Order not found' });
    }
    const orderItem = order.items.id(orderItemId);
    if (!orderItem || orderItem.product.toString() !== product._id.toString() || orderItem.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Can only review delivered purchases' });
    }
    const review = await Review.create({
      user: req.user._id, product: product._id, order: orderId, orderItem: orderItemId,
      vendor: product.vendor, rating, title, comment, images: images || [], videos: videos || [],
      isVerifiedPurchase: true, status: 'approved',
    });
    const stats = await Review.aggregate([
      { $match: { product: product._id, status: 'approved' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    product.rating = stats[0] ? Math.round(stats[0].avg * 10) / 10 : rating;
    product.numRatings = stats[0]?.count || 1;
    product.numReviews = stats[0]?.count || 1;
    await product.save();
    const vendor = await Vendor.findById(product.vendor);
    if (vendor) {
      const products = await Product.find({ vendor: product.vendor });
      vendor.storeRating = products.length ? products.reduce((s, p) => s + p.rating, 0) / products.length : 0;
      vendor.totalRatings = products.reduce((s, p) => s + p.numRatings, 0);
      await vendor.save();
    }
    res.status(201).json({ success: true, review });
  } catch (error) { next(error); }
};

const getReviews = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).select('rating numRatings numReviews');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const reviews = await Review.find({ product: req.params.id, status: 'approved' })
      .sort('-createdAt').populate('user', 'name avatar').lean();
    res.json({ success: true, reviews, rating: product.rating, numRatings: product.numRatings });
  } catch (error) { next(error); }
};

const deleteReview = async (req, res, next) => {
  try {
    const Review = require('../models/Review');
    const review = await Review.findOne({ _id: req.params.reviewId, user: req.user._id });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    await Review.findByIdAndDelete(review._id);
    const { recalcProductRating } = require('./reviewController');
    await recalcProductRating(review.product);
    res.json({ success: true, message: 'Review deleted' });
  } catch (error) { next(error); }
};

const updateStock = async (req, res, next) => {
  try {
    const { variantId, stock } = req.body;
    const vendor = await Vendor.findOne({ user: req.user._id });
    const product = await Product.findOne({ _id: req.params.id, vendor: vendor._id });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }

    variant.stock = stock;
    await product.save();

    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct, getProducts, getProduct, updateProduct, deleteProduct,
  getFeaturedProducts, getFlashSaleProducts, getNewArrivals, getBestSellers, getTrendingProducts,
  getRelatedProducts, getProductsByVendor, getProductsByCategory, getProductsByBrand,
  addReview, getReviews, deleteReview, updateStock,
};
