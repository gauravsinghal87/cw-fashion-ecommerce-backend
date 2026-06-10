const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { Wallet } = require('../models/Wallet');

const getAdminDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalUsers, totalVendors, totalOrders, pendingVendors,
      monthlyRevenue, orderStatusCounts,
    ] = await Promise.all([
      User.countDocuments({ role: 'customer', isActive: true }),
      Vendor.countDocuments({ status: 'approved' }),
      Order.countDocuments(),
      Vendor.countDocuments({ status: 'pending' }),
      Order.aggregate([
        { $match: { createdAt: { $gte: thisMonth }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      dashboard: {
        totalUsers, totalVendors, totalOrders, pendingVendors,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        orderStatusCounts,
      }
    });
  } catch (error) {
    next(error);
  }
};

const getVendorDashboard = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalProducts, activeProducts, totalOrders, pendingOrders,
      thisMonthRevenue, recentOrders,
    ] = await Promise.all([
      Product.countDocuments({ vendor: vendor._id }),
      Product.countDocuments({ vendor: vendor._id, isActive: true, status: 'approved' }),
      Order.countDocuments({ 'items.vendor': vendor._id }),
      Order.countDocuments({ 'items.vendor': vendor._id, 'items.status': 'pending' }),
      Order.aggregate([
        { $unwind: '$items' },
        { $match: { 'items.vendor': vendor._id, createdAt: { $gte: thisMonth }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$items.totalPrice' } } },
      ]),
      Order.find({ 'items.vendor': vendor._id })
        .sort('-createdAt').limit(5)
        .populate('user', 'name'),
    ]);

    const wallet = await Wallet.findOne({ user: req.user._id });

    res.json({
      success: true,
      dashboard: {
        totalProducts, activeProducts, totalOrders, pendingOrders,
        totalRevenue: vendor.totalRevenue,
        totalEarnings: vendor.totalEarnings,
        totalWithdrawn: vendor.totalWithdrawn,
        pendingWithdrawal: vendor.pendingWithdrawal,
        thisMonthRevenue: thisMonthRevenue[0]?.total || 0,
        walletBalance: wallet?.balance || 0,
        recentOrders,
      }
    });
  } catch (error) {
    next(error);
  }
};

const getCustomerDashboard = async (req, res, next) => {
  try {
    const [recentOrders, wallet, wishlistCount] = await Promise.all([
      Order.find({ user: req.user._id }).sort('-createdAt').limit(5),
      Wallet.findOne({ user: req.user._id }),
      User.findById(req.user._id).select('wishlist'),
    ]);

    const pendingReturns = await require('../models/Return').countDocuments({
      user: req.user._id,
      status: { $in: ['requested', 'approved'] }
    });

    res.json({
      success: true,
      dashboard: {
        totalOrders: await Order.countDocuments({ user: req.user._id }),
        walletBalance: wallet?.balance || 0,
        wishlistCount: wishlistCount?.wishlist?.length || 0,
        pendingReturns,
        recentOrders,
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAdminDashboard, getVendorDashboard, getCustomerDashboard };
