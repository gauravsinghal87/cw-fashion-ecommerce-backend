const Coupon = require('../coupons/Coupon');
const Order = require('../orders/Order');

const createCoupon = async (req, res, next) => {
  try {
    const { type, value, startDate, endDate } = req.body;
    if (type !== 'free_shipping' && !value) {
      return res.status(400).json({ success: false, message: 'Discount value required' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Start and end dates required' });
    }
    const coupon = await Coupon.create({ ...req.body, code: req.body.code.toUpperCase(), createdBy: req.user._id });
    res.status(201).json({ success: true, coupon });
  } catch (error) {
    next(error);
  }
};

const getCoupons = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    const coupons = await Coupon.find(filter).sort('-createdAt');
    res.json({ success: true, coupons });
  } catch (error) {
    next(error);
  }
};

const getCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true, coupon });
  } catch (error) {
    next(error);
  }
};

const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, coupon });
  } catch (error) {
    next(error);
  }
};

const deleteCoupon = async (req, res, next) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (error) {
    next(error);
  }
};

const validateCoupon = async (req, res, next) => {
  try {
    const { code, subtotal, items, userId } = req.body;
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) return res.status(400).json({ success: false, message: 'Invalid coupon code' });
    if (new Date() < coupon.startDate || new Date() > coupon.endDate) {
      return res.status(400).json({ success: false, message: 'Coupon has expired' });
    }
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
    }

    if (coupon.usagePerUser > 0 && userId) {
      const userRedemption = coupon.userRedemptions.find(r => r.user.toString() === userId.toString());
      if (userRedemption && userRedemption.count >= coupon.usagePerUser) {
        return res.status(400).json({ success: false, message: 'You have already used this coupon the maximum number of times' });
      }
    }

    if (coupon.isFirstOrderOnly && userId) {
      const existingOrders = await Order.countDocuments({ user: userId });
      if (existingOrders > 0) {
        return res.status(400).json({ success: false, message: 'This coupon is for first order only' });
      }
    }

    if (coupon.minAmount > 0 && subtotal < coupon.minAmount) {
      return res.status(400).json({ success: false, message: `Minimum order amount ₹${coupon.minAmount} required` });
    }

    if (coupon.applicableOn !== 'all' && coupon.applicableIds.length > 0 && items) {
      const valid = items.some(item => {
        if (coupon.applicableOn === 'category') return coupon.applicableIds.some(id => id.toString() === (item.category || '').toString());
        if (coupon.applicableOn === 'brand') return coupon.applicableIds.some(id => id.toString() === (item.brand || '').toString());
        if (coupon.applicableOn === 'vendor') return coupon.applicableIds.some(id => id.toString() === (item.vendor || '').toString());
        if (coupon.applicableOn === 'product') return coupon.applicableIds.some(id => id.toString() === (item.productId || '').toString());
        return false;
      });
      if (!valid) return res.status(400).json({ success: false, message: 'Coupon not applicable to selected items' });
    }

    const discount = calculateDiscount(coupon, subtotal);

    res.json({ success: true, coupon, discount, message: `Coupon applied! You save ₹${discount}` });
  } catch (error) {
    next(error);
  }
};

const calculateDiscount = (coupon, subtotal) => {
  if (coupon.type === 'free_shipping') return 0;
  if (coupon.type === 'fixed') return Math.min(coupon.value || 0, subtotal);
  const pct = subtotal * ((coupon.value || 0) / 100);
  return coupon.maxDiscount ? Math.min(pct, coupon.maxDiscount) : pct;
};

const getAvailableCoupons = async (req, res, next) => {
  try {
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).sort('-value').select('code description type value minAmount maxDiscount shippingWaived applicableOn applicableIds isFirstOrderOnly startDate endDate usageLimit usedCount').lean();
    res.json({ success: true, coupons });
  } catch (error) {
    next(error);
  }
};

const getCouponAnalytics = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort('-createdAt').select('code type value usedCount totalDiscountGiven usageLimit isActive startDate endDate');

    const totalUsage = coupons.reduce((s, c) => s + (c.usedCount || 0), 0);
    const totalDiscount = coupons.reduce((s, c) => s + (c.totalDiscountGiven || 0), 0);
    const activeCount = coupons.filter(c => c.isActive).length;

    res.json({
      success: true,
      analytics: { totalUsage, totalDiscount, activeCount, coupons },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createCoupon, getCoupons, getCoupon, updateCoupon, deleteCoupon, validateCoupon, getAvailableCoupons, getCouponAnalytics };
