const Review = require('../reviews/Review');
const Product = require('../products/Product');
const Order = require('../orders/Order');
const Vendor = require('../vendors/Vendor');

const recalcProductRating = async (productId) => {
  const result = await Review.aggregate([
    { $match: { product: productId, status: 'approved' } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const avg = result[0]?.avgRating || 0;
  const count = result[0]?.count || 0;
  await Product.findByIdAndUpdate(productId, { rating: Math.round(avg * 10) / 10, numRatings: count, numReviews: count });
  const vendor = await Product.findById(productId).select('vendor');
  if (vendor) {
    const products = await Product.find({ vendor: vendor.vendor });
    const totalRating = products.reduce((s, p) => s + p.rating, 0);
    await Vendor.findByIdAndUpdate(vendor.vendor, {
      storeRating: products.length ? Math.round((totalRating / products.length) * 10) / 10 : 0,
      totalRatings: products.reduce((s, p) => s + p.numRatings, 0),
    });
  }
};

const createReview = async (req, res, next) => {
  try {
    const { productId, orderId, orderItemId, rating, title, comment, images, videos, isAnonymous } = req.body;
    if (!orderId || !orderItemId) {
      return res.status(400).json({ success: false, message: 'Only verified purchasers can review' });
    }
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const existing = await Review.findOne({ user: req.user._id, product: productId });
    if (existing) return res.status(400).json({ success: false, message: 'You already reviewed this product' });
    const order = await Order.findById(orderId);
    if (!order || order.user.toString() !== req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Order not found' });
    }
    const item = order.items.id(orderItemId);
    if (!item || item.product.toString() !== productId || item.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Can only review delivered purchases' });
    }
    const review = await Review.create({
      user: req.user._id, product: productId, order: orderId, orderItem: orderItemId,
      vendor: product.vendor, rating, title, comment, images: images || [], videos: videos || [],
      isVerifiedPurchase: true, isAnonymous: !!isAnonymous, status: 'approved',
    });
    await recalcProductRating(productId);
    res.status(201).json({ success: true, review });
  } catch (error) { next(error); }
};

const getProductReviews = async (req, res, next) => {
  try {
    const { sort, rating, hasMedia, verified } = req.query;
    const filter = { product: req.params.productId, status: 'approved' };
    if (rating) filter.rating = parseInt(rating);
    if (hasMedia === 'true') filter.$or = [{ images: { $exists: true, $ne: [] } }, { videos: { $exists: true, $ne: [] } }];
    if (verified === 'true') filter.isVerifiedPurchase = true;
    let sortObj = { createdAt: -1 };
    if (sort === 'highest') sortObj = { rating: -1, createdAt: -1 };
    else if (sort === 'lowest') sortObj = { rating: 1, createdAt: -1 };
    else if (sort === 'helpful') sortObj = { helpfulCount: -1, createdAt: -1 };
    const reviews = await Review.find(filter).sort(sortObj).populate('user', 'name avatar').lean();
    const stats = await Review.aggregate([
      { $match: { product: req.params.productId, status: 'approved' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats.forEach(s => { ratingDistribution[s._id] = s.count; });
    const total = Object.values(ratingDistribution).reduce((a, b) => a + b, 0);
    const product = await Product.findById(req.params.productId).select('rating numRatings numReviews');
    res.json({
      success: true, reviews,
      stats: { ...ratingDistribution, total, averageRating: product?.rating || 0, numRatings: product?.numRatings || 0 },
    });
  } catch (error) { next(error); }
};

const updateReview = async (req, res, next) => {
  try {
    const review = await Review.findOne({ _id: req.params.reviewId, user: req.user._id });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    const daysSinceCreation = (Date.now() - new Date(review.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation > 30) return res.status(400).json({ success: false, message: 'Can only edit review within 30 days' });
    const { rating, title, comment, images, videos, isAnonymous } = req.body;
    if (rating) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;
    if (images) review.images = images;
    if (videos) review.videos = videos;
    if (isAnonymous !== undefined) review.isAnonymous = isAnonymous;
    review.editedAt = new Date();
    await review.save();
    await recalcProductRating(review.product);
    res.json({ success: true, review });
  } catch (error) { next(error); }
};

const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findOne({ _id: req.params.reviewId, user: req.user._id });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    await Review.findByIdAndDelete(review._id);
    await recalcProductRating(review.product);
    res.json({ success: true, message: 'Review deleted' });
  } catch (error) { next(error); }
};

const markHelpful = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    const idx = review.helpfulUsers.indexOf(req.user._id);
    if (idx > -1) {
      review.helpfulUsers.splice(idx, 1);
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      review.helpfulUsers.push(req.user._id);
      review.helpfulCount += 1;
    }
    await review.save();
    res.json({ success: true, helpfulCount: review.helpfulCount, isHelpful: idx === -1 });
  } catch (error) { next(error); }
};

const reportReview = async (req, res, next) => {
  try {
    const { reason, details } = req.body;
    if (!['spam', 'fake', 'abusive', 'offensive', 'other'].includes(reason)) {
      return res.status(400).json({ success: false, message: 'Invalid report reason' });
    }
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    if (review.report.isReported) return res.status(400).json({ success: false, message: 'Already reported' });
    review.report = {
      isReported: true, reason, details, reportedBy: req.user._id, reportedAt: new Date(), status: 'pending',
    };
    await review.save();
    res.json({ success: true, message: 'Report submitted' });
  } catch (error) { next(error); }
};

const getMyReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = { user: req.user._id };
    if (req.query.orderId) filter.order = req.query.orderId;
    const reviews = await Review.find(filter)
      .sort('-createdAt').skip((page - 1) * limit).limit(limit)
      .populate('product', 'title slug images').lean();
    const total = await Review.countDocuments(filter);
    res.json({ success: true, reviews, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const getReviewDetail = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId)
      .populate('user', 'name avatar')
      .populate('product', 'title slug images').lean();
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    res.json({ success: true, review });
  } catch (error) { next(error); }
};

const vendorGetReviews = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = { vendor: vendor._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.rating) filter.rating = parseInt(req.query.rating);
    if (req.query.product) filter.product = req.query.product;
    const reviews = await Review.find(filter)
      .sort('-createdAt').skip((page - 1) * limit).limit(limit)
      .populate('user', 'name avatar').populate('product', 'title slug images').lean();
    const total = await Review.countDocuments(filter);
    const analytics = await Review.aggregate([
      { $match: { vendor: vendor._id } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, totalReviews: { $sum: 1 }, fiveStar: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } }, fourStar: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } }, threeStar: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } }, twoStar: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } }, oneStar: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } } } },
    ]);
    res.json({ success: true, reviews, analytics: analytics[0] || {}, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const vendorReplyReview = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const review = await Review.findOne({ _id: req.params.reviewId, vendor: vendor._id });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Reply text is required' });
    review.vendorReply = { text: text.trim(), repliedAt: new Date() };
    await review.save();
    res.json({ success: true, review });
  } catch (error) { next(error); }
};

const vendorReportReview = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const review = await Review.findOne({ _id: req.params.reviewId, vendor: vendor._id });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    const { reason, details } = req.body;
    if (!['spam', 'fake', 'abusive', 'offensive', 'other'].includes(reason)) {
      return res.status(400).json({ success: false, message: 'Invalid reason' });
    }
    if (review.report.isReported) return res.status(400).json({ success: false, message: 'Already reported' });
    review.report = { isReported: true, reason, details, reportedBy: req.user._id, reportedAt: new Date(), status: 'pending' };
    await review.save();
    res.json({ success: true, message: 'Report submitted' });
  } catch (error) { next(error); }
};

const adminGetReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.reported === 'true') filter['report.isReported'] = true;
    if (req.query.reportedStatus) filter['report.status'] = req.query.reportedStatus;
    if (req.query.product) filter.product = req.query.product;
    if (req.query.user) filter.user = req.query.user;
    const reviews = await Review.find(filter)
      .sort('-createdAt').skip((page - 1) * limit).limit(limit)
      .populate('user', 'name email avatar')
      .populate('product', 'title slug')
      .populate('vendor', 'storeName')
      .lean();
    const total = await Review.countDocuments(filter);
    const pendingCount = await Review.countDocuments({ status: 'pending' });
    const reportedCount = await Review.countDocuments({ 'report.isReported': true, 'report.status': 'pending' });
    res.json({ success: true, reviews, pendingCount, reportedCount, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const adminApproveReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    review.status = 'approved';
    await review.save();
    await recalcProductRating(review.product);
    res.json({ success: true, review });
  } catch (error) { next(error); }
};

const adminRejectReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    review.status = 'rejected';
    review.rejectionReason = req.body.reason || 'Does not meet guidelines';
    await review.save();
    res.json({ success: true, review });
  } catch (error) { next(error); }
};

const adminHideReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    review.status = 'hidden';
    review.hiddenReason = req.body.reason || 'Hidden by admin';
    await review.save();
    await recalcProductRating(review.product);
    res.json({ success: true, review });
  } catch (error) { next(error); }
};

const adminRestoreReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    review.status = 'approved';
    review.hiddenReason = undefined;
    await review.save();
    await recalcProductRating(review.product);
    res.json({ success: true, review });
  } catch (error) { next(error); }
};

const adminResolveReport = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    review.report.status = req.body.action === 'dismiss' ? 'dismissed' : 'resolved';
    review.report.resolvedBy = req.user._id;
    review.report.resolvedAt = new Date();
    if (req.body.action === 'hide') {
      review.status = 'hidden';
      review.hiddenReason = review.report.reason;
    }
    await review.save();
    if (req.body.action === 'hide') await recalcProductRating(review.product);
    res.json({ success: true, review });
  } catch (error) { next(error); }
};

const adminBanReviewer = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    const User = require('../users/User');
    const user = await User.findById(review.user);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot ban admin' });
    if (user.isBanned) {
      user.isBanned = false;
    } else {
      user.isBanned = true;
      await Review.updateMany({ user: review.user }, { status: 'hidden', hiddenReason: 'User banned' });
    }
    await user.save();
    res.json({ success: true, message: user.isBanned ? 'User banned' : 'User unbanned' });
  } catch (error) { next(error); }
};

const getProductReviewsPublic = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId)
      .select('rating numRatings numReviews').lean();
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const stats = await Review.aggregate([
      { $match: { product: req.params.productId, status: 'approved' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats.forEach(s => { ratingDistribution[s._id] = s.count; });
    const total = Object.values(ratingDistribution).reduce((a, b) => a + b, 0);
    res.json({
      success: true,
      stats: { ...ratingDistribution, total, averageRating: product.rating, numRatings: product.numRatings },
    });
  } catch (error) { next(error); }
};

const getReviewMedia = async (req, res, next) => {
  try {
    const reviews = await Review.find({
      product: req.params.productId,
      status: 'approved',
      $or: [{ images: { $exists: true, $ne: [] } }, { videos: { $exists: true, $ne: [] } }],
    }).select('images videos rating user').populate('user', 'name').lean();
    const allImages = [];
    const allVideos = [];
    reviews.forEach(r => {
      (r.images || []).forEach(img => allImages.push({ url: img, reviewId: r._id, user: r.user }));
      (r.videos || []).forEach(vid => allVideos.push({ url: vid, reviewId: r._id, user: r.user }));
    });
    res.json({ success: true, images: allImages, videos: allVideos });
  } catch (error) { next(error); }
};

module.exports = {
  recalcProductRating,
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  markHelpful,
  reportReview,
  getMyReviews,
  getReviewDetail,
  vendorGetReviews,
  vendorReplyReview,
  vendorReportReview,
  adminGetReviews,
  adminApproveReview,
  adminRejectReview,
  adminHideReview,
  adminRestoreReview,
  adminResolveReport,
  adminBanReviewer,
  getProductReviewsPublic,
  getReviewMedia,
};
