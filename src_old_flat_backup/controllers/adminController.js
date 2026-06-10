const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Brand = require('../models/Brand');
const Coupon = require('../models/Coupon');
const Banner = require('../models/Banner');
const Return = require('../models/Return');
const Withdrawal = require('../models/Withdrawal');
const Referral = require('../models/Referral');
const Notification = require('../models/Notification');
const CMS = require('../models/CMS');
const Commission = require('../models/Commission');
const AuditLog = require('../models/AuditLog');
const { Wallet, WalletTransaction } = require('../models/Wallet');
const Settlement = require('../models/Settlement');
const { createSettlementForItem } = require('./settlementController');
const Role = require('../models/Role');
const Inventory = require('../models/Inventory');
const { sendVendorApprovalEmail } = require('../utils/emailService');
const slugify = require('slugify');

const getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalUsers, totalVendors, totalOrders, totalRevenue,
      pendingVendors, pendingWithdrawals, pendingReturns,
      monthlyRevenue, commissionEarned, topProducts, topVendors
    ] = await Promise.all([
      User.countDocuments({ role: 'customer', isActive: true }),
      Vendor.countDocuments({ status: 'approved' }),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { status: { $nin: ['cancelled'] } } },
        { $unwind: '$items' },
        { $match: { 'items.status': { $nin: ['cancelled', 'refunded'] } } },
        { $group: { _id: null, total: { $sum: '$items.totalPrice' } } },
      ]),
      Vendor.countDocuments({ status: 'pending' }),
      Withdrawal.countDocuments({ status: 'pending' }),
      Return.countDocuments({ status: 'return_requested' }),
      Order.aggregate([
        { $match: { createdAt: { $gte: thisMonth }, status: { $nin: ['cancelled'] } } },
        { $unwind: '$items' },
        { $match: { 'items.status': { $nin: ['cancelled', 'refunded'] } } },
        { $group: { _id: null, total: { $sum: '$items.totalPrice' } } },
      ]),
      Order.aggregate([
        { $match: { status: { $nin: ['cancelled', 'refunded'] } } },
        { $unwind: '$items' },
        { $match: { 'items.status': { $nin: ['cancelled', 'refunded'] } } },
        { $group: { _id: null, total: { $sum: '$items.commission' } } },
      ]),
      Product.find({ isActive: true }).sort('-totalSold').limit(10).select('title slug totalSold minPrice images'),
      Vendor.find({ status: 'approved' }).sort('-totalRevenue').limit(10).select('storeName storeLogo totalRevenue totalOrders'),
    ]);

    res.json({
      success: true,
      dashboard: {
        totalUsers, totalVendors, totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        pendingVendors, pendingWithdrawals, pendingReturns,
        commissionEarned: commissionEarned[0]?.total || 0,
        topProducts, topVendors,
      }
    });
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { search, role, isActive } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit).select('-sessions');
    const total = await User.countDocuments(filter);
    res.json({ success: true, users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const getVendors = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { status, search } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { storeName: { $regex: search, $options: 'i' } },
      ];
    }

    const vendors = await Vendor.find(filter).populate('user', 'name email phone').sort('-createdAt').skip((page - 1) * limit).limit(limit);
    const total = await Vendor.countDocuments(filter);
    res.json({ success: true, vendors, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const approveVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.vendorId, { status: 'approved' }, { new: true }).populate('user', 'email name');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    await sendVendorApprovalEmail(vendor.user.email, vendor.storeName, 'approved');
    res.json({ success: true, vendor });
  } catch (error) {
    next(error);
  }
};

const rejectVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.vendorId, { status: 'rejected', statusReason: req.body.reason }, { new: true }).populate('user', 'email name');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    await sendVendorApprovalEmail(vendor.user.email, vendor.storeName, 'rejected');
    res.json({ success: true, vendor });
  } catch (error) {
    next(error);
  }
};

const getProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { status, vendor, approvalStatus, showHidden } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (vendor) filter.vendor = vendor;
    if (approvalStatus) filter.approvalStatus = approvalStatus;
    if (showHidden === 'true') filter.isActive = false;

    const products = await Product.find(filter)
      .populate('vendor', 'storeName')
      .populate('category', 'name')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Product.countDocuments(filter);
    res.json({ success: true, products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const approveProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.productId, {
      approvalStatus: 'approved', status: 'approved', approvedBy: req.user._id, approvedAt: new Date(),
    }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

const rejectProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.productId, {
      approvalStatus: 'rejected', status: 'rejected', rejectionReason: req.body.reason,
    }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { status, search } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (search) filter.orderNumber = { $regex: search, $options: 'i' };

    const orders = await Order.find(filter)
      .populate('user', 'name email phone')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Order.countDocuments(filter);
    res.json({ success: true, orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    order.status = 'cancelled';
    order.cancellation = { isRequested: true, reason: req.body.reason || 'Cancelled by admin', cancelledAt: new Date(), cancelledBy: req.user._id };

    for (const item of order.items) {
      item.status = 'cancelled';
      item.statusHistory.push({ status: 'cancelled', date: new Date(), note: req.body.reason || 'Cancelled by admin', updatedBy: req.user._id });
      try {
        const product = await Product.findById(item.product);
        if (product) {
          if (item.variant) {
            const variant = product.variants.id(item.variant);
            if (variant) variant.stock += item.quantity;
          }
          product.totalSold = Math.max(0, product.totalSold - item.quantity);
          await product.save();
        }
        const sku = item.sku || product?.variants?.[0]?.sku;
        if (sku) {
          const inventories = await Inventory.find({ product: item.product, variantSku: sku, reservedStock: { $gt: 0 } });
          for (const inv of inventories) {
            const release = Math.min(inv.reservedStock, item.quantity);
            if (release <= 0) continue;
            inv.reservedStock -= release;
            inv.availableStock += release;
            await inv.save();
          }
        }
        const vendor = await Vendor.findById(item.vendor);
        if (vendor) {
          vendor.totalOrders = Math.max(0, vendor.totalOrders - 1);
          vendor.totalRevenue = Math.max(0, vendor.totalRevenue - item.totalPrice);
          vendor.totalEarnings = Math.max(0, vendor.totalEarnings - (item.vendorEarnings || 0));
          await vendor.save();
        }
      } catch (e) {
        console.error('Error restoring item on admin cancel:', e.message);
      }
    }

    await order.save();
    res.json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

const getReturns = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const returns = await Return.find(filter)
      .populate('user', 'name email')
      .populate('vendor', 'storeName')
      .populate('product', 'title')
      .populate('order', 'orderNumber items.name items.tracking items._id items.status items.image')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Return.countDocuments(filter);
    res.json({ success: true, returns, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const getWithdrawals = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const withdrawals = await Withdrawal.find(filter)
      .populate({ path: 'vendor', select: 'storeName bankAccount' })
      .populate({ path: 'user', select: 'name email phone' })
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Withdrawal.countDocuments(filter);
    res.json({ success: true, withdrawals, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const slug = slugify(req.body.name, { lower: true, strict: true });
    const category = await Category.create({ ...req.body, slug });
    res.status(201).json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().populate('subCategories').sort('displayOrder');
    res.json({ success: true, categories });
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.name) data.slug = slugify(data.name, { lower: true, strict: true });
    const category = await Category.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, { isActive: false });
    await SubCategory.updateMany({ category: req.params.id }, { isActive: false });
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
};

const createBrand = async (req, res, next) => {
  try {
    const slug = slugify(req.body.name, { lower: true, strict: true });
    const brand = await Brand.create({ ...req.body, slug });
    res.status(201).json({ success: true, brand });
  } catch (error) {
    next(error);
  }
};

const getBrands = async (req, res, next) => {
  try {
    const brands = await Brand.find().sort('displayOrder');
    res.json({ success: true, brands });
  } catch (error) {
    next(error);
  }
};

const updateBrand = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.name) data.slug = slugify(data.name, { lower: true, strict: true });
    const brand = await Brand.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json({ success: true, brand });
  } catch (error) {
    next(error);
  }
};

const deleteBrand = async (req, res, next) => {
  try {
    await Brand.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Brand deleted' });
  } catch (error) {
    next(error);
  }
};

const getRevenueReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const revenue = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $nin: ['cancelled', 'refunded'] } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$items.totalPrice' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const totals = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $nin: ['cancelled', 'refunded'] } } },
      { $group: { _id: null, totalRevenue: { $sum: '$items.totalPrice' }, totalOrders: { $sum: 1 }, avgOrderValue: { $avg: '$items.totalPrice' } } },
    ]);

    res.json({
      success: true,
      report: {
        daily: revenue,
        totals: totals[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 },
        startDate: start,
        endDate: end,
      }
    });
  } catch (error) {
    next(error);
  }
};

const getVendorReport = async (req, res, next) => {
  try {
    const vendors = await Vendor.aggregate([
      { $match: { status: 'approved' } },
      { $lookup: { from: 'products', localField: '_id', foreignField: 'vendor', as: 'products' } },
      { $project: { storeName: 1, totalRevenue: 1, totalOrders: 1, totalEarnings: 1, totalWithdrawn: 1, productCount: { $size: '$products' }, createdAt: 1 } },
      { $sort: { totalRevenue: -1 } },
    ]);
    res.json({ success: true, report: vendors });
  } catch (error) {
    next(error);
  }
};

const getProductReport = async (req, res, next) => {
  try {
    const products = await Product.aggregate([
      { $match: { isActive: true } },
      { $lookup: { from: 'vendors', localField: 'vendor', foreignField: '_id', as: 'vendor' } },
      { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
      { $project: { title: 1, totalSold: 1, minPrice: 1, maxPrice: 1, totalStock: 1, rating: 1, 'vendor.storeName': 1, createdAt: 1 } },
      { $sort: { totalSold: -1 } },
      { $limit: 100 },
    ]);
    res.json({ success: true, report: products });
  } catch (error) {
    next(error);
  }
};

const getReferralReport = async (req, res, next) => {
  try {
    const referrals = await Referral.aggregate([
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
      { $limit: 90 },
    ]);

    const totals = await Referral.aggregate([
      { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, totalPayout: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, { $add: ['$rewardReferrer', '$rewardReferred'] }, 0] } } } },
    ]);

    res.json({ success: true, report: { daily: referrals, totals: totals[0] || { total: 0, completed: 0, totalPayout: 0 } } });
  } catch (error) {
    next(error);
  }
};

const getCommissionSettings = async (req, res, next) => {
  try {
    const commissions = await Commission.find().sort({ type: 1, priority: 1 });
    res.json({ success: true, commissions });
  } catch (error) {
    next(error);
  }
};

const updateCommissionSettings = async (req, res, next) => {
  try {
    const { rate, type, name } = req.body;
    const commission = await Commission.findOneAndUpdate(
      { type: type || 'global' },
      { rate, name: name || `${type || 'Global'} Commission`, isActive: true },
      { upsert: true, new: true }
    );
    res.json({ success: true, commission });
  } catch (error) {
    next(error);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const { action, resource, userId } = req.query;

    const filter = {};
    if (action) filter.action = action;
    if (resource) filter.resource = resource;
    if (userId) filter.user = userId;

    const logs = await AuditLog.find(filter).populate('user', 'name email role').sort('-createdAt').skip((page - 1) * limit).limit(limit);
    const total = await AuditLog.countDocuments(filter);
    res.json({ success: true, logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const createSubAdmin = async (req, res, next) => {
  try {
    const { name, email, password, roleId } = req.body;
    if (!roleId) {
      return res.status(400).json({ success: false, message: 'Role is required' });
    }
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    const user = await User.create({ name, email, password, role: 'subadmin', roleId, isEmailVerified: true });
    user.generateReferralCode();
    await user.save();
    const populated = await User.findById(user._id).populate('roleId', 'name permissions');
    res.status(201).json({ success: true, user: populated });
  } catch (error) {
    next(error);
  }
};

const getSubAdmins = async (req, res, next) => {
  try {
    const subAdmins = await User.find({ role: 'subadmin' }).select('name email avatar isActive roleId createdAt').populate('roleId', 'name permissions');
    res.json({ success: true, subAdmins });
  } catch (error) {
    next(error);
  }
};

const updateSubAdmin = async (req, res, next) => {
  try {
    const updates = { $set: {} };
    if (req.body.name) updates.$set.name = req.body.name;
    if (req.body.email) updates.$set.email = req.body.email;
    if (req.body.roleId) updates.$set.roleId = req.body.roleId;
    if (req.body.isActive !== undefined) updates.$set.isActive = req.body.isActive;
    if (req.body.password) updates.$set.password = req.body.password;
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password').populate('roleId', 'name permissions');
    if (!user) return res.status(404).json({ success: false, message: 'Sub-admin not found' });
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

const deleteSubAdmin = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Sub-admin deactivated' });
  } catch (error) {
    next(error);
  }
};

const createRole = async (req, res, next) => {
  try {
    const role = await Role.create(req.body);
    res.status(201).json({ success: true, role });
  } catch (error) {
    next(error);
  }
};

const getRoles = async (req, res, next) => {
  try {
    const roles = await Role.find();
    res.json({ success: true, roles });
  } catch (error) {
    next(error);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const role = await Role.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, role });
  } catch (error) {
    next(error);
  }
};

const deleteRole = async (req, res, next) => {
  try {
    await Role.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Role deleted' });
  } catch (error) {
    next(error);
  }
};

const getBanners = async (req, res, next) => {
  try {
    const banners = await Banner.find().sort('type priority');
    res.json({ success: true, banners });
  } catch (error) {
    next(error);
  }
};

const deleteCMSPage = async (req, res, next) => {
  try {
    const page = await CMS.findOneAndUpdate(
      { page: req.params.page },
      { isActive: false },
      { new: true }
    );
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
    res.json({ success: true, message: 'Page deactivated' });
  } catch (error) { next(error); }
};

const getCMS = async (req, res, next) => {
  try {
    const pages = await CMS.find({ isActive: true });
    res.json({ success: true, pages });
  } catch (error) {
    next(error);
  }
};

const updateCMS = async (req, res, next) => {
  try {
    const page = await CMS.findOneAndUpdate(
      { page: req.params.page },
      { ...req.body, publishedBy: req.user._id, publishedAt: new Date(), $inc: { version: 1 } },
      { new: true, upsert: true }
    );
    res.json({ success: true, page });
  } catch (error) {
    next(error);
  }
};

const sendNotification = async (req, res, next) => {
  try {
    const { recipientRole, title, message, type } = req.body;
    const notification = await Notification.create({
      recipientRole, title, message, type: type || 'push', sentAt: new Date(), status: 'sent',
      data: req.body.data,
    });
    res.status(201).json({ success: true, notification });
  } catch (error) {
    next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const notifications = await Notification.find().sort('-createdAt').skip((page - 1) * limit).limit(limit);
    const total = await Notification.countDocuments();
    res.json({ success: true, notifications, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const getShippingSettings = async (req, res, next) => {
  try {
    const Commission = require('../models/Commission');
    const shipping = await Commission.findOne({ type: 'shipping' });
    res.json({ success: true, shipping: shipping || { charge: 99, freeThreshold: 999, isShippingEnabled: true, isFreeShippingEnabled: true } });
  } catch (error) {
    next(error);
  }
};

const updateShippingSettings = async (req, res, next) => {
  try {
    const Commission = require('../models/Commission');
    const shipping = await Commission.findOneAndUpdate(
      { type: 'shipping' },
      { $set: { name: 'Shipping Settings', charge: req.body.charge, freeThreshold: req.body.freeThreshold, isShippingEnabled: req.body.isShippingEnabled, isFreeShippingEnabled: req.body.isFreeShippingEnabled } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, shipping });
  } catch (error) {
    next(error);
  }
};

const getReferralSettings = async (req, res, next) => {
  try {
    const Commission = require('../models/Commission');
    const settings = await Commission.findOne({ type: 'referral' });
    res.json({
      success: true,
      settings: settings || { referrerReward: 100, referredReward: 50, minOrderAmount: 0, rewardDelayDays: 7, isEnabled: true }
    });
  } catch (error) {
    next(error);
  }
};

const updateReferralSettings = async (req, res, next) => {
  try {
    const Commission = require('../models/Commission');
    const settings = await Commission.findOneAndUpdate(
      { type: 'referral' },
      { ...req.body, type: 'referral' },
      { upsert: true, new: true }
    );
    res.json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

const getSEOSettings = async (req, res, next) => {
  try {
    const { type, id } = req.query;
    if (type === 'product') {
      const product = await Product.findById(id).select('metaTitle metaDescription ogImage slug title');
      return res.json({ success: true, seo: product });
    }
    if (type === 'category') {
      const category = await Category.findById(id).select('metaTitle metaDescription ogImage slug name');
      return res.json({ success: true, seo: category });
    }
    if (type === 'brand') {
      const brand = await Brand.findById(id).select('metaTitle metaDescription ogImage slug name');
      return res.json({ success: true, seo: brand });
    }
    res.json({ success: true, seo: null });
  } catch (error) {
    next(error);
  }
};

const updateSEOSettings = async (req, res, next) => {
  try {
    const { type, id, metaTitle, metaDescription, ogImage } = req.body;
    let updated;
    if (type === 'product') {
      updated = await Product.findByIdAndUpdate(id, { metaTitle, metaDescription, ogImage }, { new: true });
    } else if (type === 'category') {
      updated = await Category.findByIdAndUpdate(id, { metaTitle, metaDescription, ogImage }, { new: true });
    } else if (type === 'brand') {
      updated = await Brand.findByIdAndUpdate(id, { metaTitle, metaDescription, ogImage }, { new: true });
    }
    res.json({ success: true, seo: updated });
  } catch (error) {
    next(error);
  }
};

const getWalletTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { userId, category } = req.query;

    const filter = {};
    if (userId) filter.user = userId;
    if (category) filter.category = category;

    const transactions = await WalletTransaction.find(filter)
      .populate('user', 'name email')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await WalletTransaction.countDocuments(filter);
    res.json({ success: true, transactions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create({ ...req.body, code: req.body.code.toUpperCase(), createdBy: req.user._id });
    res.status(201).json({ success: true, coupon });
  } catch (error) {
    next(error);
  }
};

const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort('-createdAt');
    res.json({ success: true, coupons });
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
    await Coupon.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (error) {
    next(error);
  }
};

const hideProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.productId, {
      isActive: false, hideReason: req.body.reason, hiddenBy: req.user._id, hiddenAt: new Date(),
    }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (error) { next(error); }
};

const unhideProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.productId, {
      isActive: true, $unset: { hideReason: '', hiddenBy: '', hiddenAt: '' },
    }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (error) { next(error); }
};

const toggleFeaturedProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    product.isFeatured = !product.isFeatured;
    await product.save();
    res.json({ success: true, product });
  } catch (error) { next(error); }
};

const setFlashSale = async (req, res, next) => {
  try {
    const { flashSalePrice, flashSaleStart, flashSaleEnd } = req.body;
    const product = await Product.findByIdAndUpdate(req.params.productId, {
      isFlashSale: true, flashSalePrice, flashSaleStart, flashSaleEnd,
    }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (error) { next(error); }
};

const removeFlashSale = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.productId, {
      isFlashSale: false, $unset: { flashSalePrice: '', flashSaleStart: '', flashSaleEnd: '' },
    }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (error) { next(error); }
};

// ========== USER MANAGEMENT ==========

const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-sessions -password').populate('addresses');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const [orderCount, totalSpent, wallet, referralCount] = await Promise.all([
      Order.countDocuments({ user: user._id }),
      Order.aggregate([{ $match: { user: user._id, status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Wallet.findOne({ user: user._id }),
      Referral.countDocuments({ referrer: user._id }),
    ]);
    res.json({
      success: true, user: {
        ...user.toObject(),
        orderCount, totalSpent: totalSpent[0]?.total || 0,
        walletBalance: wallet?.balance || 0, referralCount,
      }
    });
  } catch (error) { next(error); }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isActive = !user.isActive;
    if (!user.isActive) user.sessions = [];
    await user.save();
    if (user.role === 'vendor') {
      await Vendor.findOneAndUpdate({ user: user._id }, { status: user.isActive ? 'approved' : 'suspended' });
    }
    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'suspended'}` });
  } catch (error) { next(error); }
};

const banUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isActive = false;
    user.bannedAt = new Date();
    user.bannedBy = req.user._id;
    user.banReason = req.body.reason || 'Banned by admin';
    user.sessions = [];
    await user.save();
    if (user.role === 'vendor') {
      await Vendor.findOneAndUpdate({ user: user._id }, { status: 'suspended' });
    }
    res.json({ success: true, message: 'User banned' });
  } catch (error) { next(error); }
};

const getUserOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const orders = await Order.find({ user: req.params.userId }).populate('items.product', 'title slug images').sort('-createdAt').skip((page - 1) * limit).limit(limit);
    const total = await Order.countDocuments({ user: req.params.userId });
    res.json({ success: true, orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const adminResetPassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.password = req.body.password;
    user.sessions = [];
    await user.save();
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) { next(error); }
};

const impersonateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const token = user.getSignedJwtToken();
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) { next(error); }
};

const adjustWallet = async (req, res, next) => {
  try {
    const { type, amount, description, category } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });
    let wallet = await Wallet.findOne({ user: req.params.userId });
    if (!wallet) {
      wallet = await Wallet.create({ user: req.params.userId, balance: 0, totalCredited: 0, totalDebited: 0 });
    }
    const balanceBefore = wallet.balance;
    if (type === 'credit') {
      wallet.balance += amount;
      wallet.totalCredited += amount;
    } else if (type === 'debit') {
      if (wallet.balance < amount) return res.status(400).json({ success: false, message: 'Insufficient balance' });
      wallet.balance -= amount;
      wallet.totalDebited += amount;
    } else return res.status(400).json({ success: false, message: 'Type must be credit or debit' });
    wallet.lastTransactionAt = new Date();
    await wallet.save();
    await WalletTransaction.create({
      wallet: wallet._id, user: req.params.userId, type, amount,
      balanceBefore, balanceAfter: wallet.balance,
      category: category || 'adjustment',
      description: description || `Admin ${type} of ₹${amount}`,
      referenceModel: 'User', referenceId: req.params.userId,
    });
    res.json({ success: true, wallet, message: `₹${amount} ${type === 'credit' ? 'credited to' : 'debited from'} wallet` });
  } catch (error) { next(error); }
};

// ========== VENDOR MANAGEMENT ==========

const getVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId).populate('user', 'name email phone avatar');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, vendor });
  } catch (error) { next(error); }
};

const suspendVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.vendorId,
      { status: 'suspended', statusReason: req.body.reason }, { new: true }).populate('user', 'name email');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    await Product.updateMany({ vendor: req.params.vendorId }, { isActive: false });
    res.json({ success: true, vendor, message: 'Vendor suspended' });
  } catch (error) { next(error); }
};

const banVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.vendorId,
      { status: 'banned', statusReason: req.body.reason }, { new: true }).populate('user', 'name email');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    await Product.updateMany({ vendor: req.params.vendorId }, { isActive: false });
    const user = await User.findById(vendor.user._id);
    if (user) { user.isActive = false; user.sessions = []; await user.save(); }
    res.json({ success: true, vendor, message: 'Vendor banned' });
  } catch (error) { next(error); }
};

const updateVendorDetails = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.vendorId,
      { $set: req.body }, { new: true, runValidators: true }).populate('user', 'name email');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, vendor });
  } catch (error) { next(error); }
};

// ========== ORDER MANAGEMENT ==========

const getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email phone')
      .populate('items.vendor', 'storeName')
      .populate('items.product', 'title slug images');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
  } catch (error) { next(error); }
};

const forceDeliverOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    order.status = 'delivered';
    order.deliveredAt = new Date();
    order.deliveryConfirmedBy = req.user._id;
    if (!order.returnWindowEnd) {
      order.returnWindowEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    for (const item of order.items) {
      if (!['cancelled', 'refunded', 'returned'].includes(item.status)) {
        item.status = 'delivered';
        item.tracking = item.tracking || {};
        if (!item.tracking.deliveredAt) item.tracking.deliveredAt = new Date();
        try { const v = await Vendor.findById(item.vendor); if (v) { v.totalRevenue += item.totalPrice; v.totalEarnings += item.vendorEarnings; await v.save(); } } catch (e) { /* non-blocking */ }
        try { await createSettlementForItem(order, item); } catch (e) { /* non-blocking */ }
      }
    }
    await order.save();
    res.json({ success: true, order });
  } catch (error) { next(error); }
};

const forceRefundOrder = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const refundAmount = amount || (order.subtotal - (order.discount || 0));
    let wallet = await Wallet.findOne({ user: order.user });
    if (!wallet) wallet = await Wallet.create({ user: order.user, balance: 0, totalCredited: 0, totalDebited: 0 });
    wallet.balance += refundAmount;
    wallet.totalCredited += refundAmount;
    wallet.lastTransactionAt = new Date();
    await wallet.save();
    await WalletTransaction.create({
      wallet: wallet._id, user: order.user, type: 'credit', amount: refundAmount,
      balanceBefore: wallet.balance - refundAmount, balanceAfter: wallet.balance,
      category: 'refund', description: `Admin forced refund for order #${order.orderNumber}`,
      referenceModel: 'Order', referenceId: order._id,
    });
    order.status = 'refunded';
    order.refund = { amount: refundAmount, processedAt: new Date(), processedBy: req.user._id };

    for (const item of order.items) {
      if (!['cancelled', 'refunded'].includes(item.status)) {
        item.status = 'refunded';
      }
      try {
        const product = await Product.findById(item.product);
        if (product && !['cancelled'].includes(item._previousStatus)) {
          if (item.variant) {
            const variant = product.variants.id(item.variant);
            if (variant) variant.stock += item.quantity;
          }
          product.totalSold = Math.max(0, product.totalSold - item.quantity);
          await product.save();
        }
      } catch (e) { console.error('Stock restore on force refund:', e.message); }
      try {
        const v = await Vendor.findById(item.vendor);
        if (v) { v.totalRevenue = Math.max(0, v.totalRevenue - item.totalPrice); v.totalEarnings = Math.max(0, v.totalEarnings - (item.vendorEarnings || 0)); await v.save(); }
      } catch (e) { console.error('Vendor totals restore on force refund:', e.message); }
      try { await Settlement.findOneAndUpdate({ orderItem: item._id, status: 'pending' }, { status: 'cancelled' }); } catch (e) { /* non-blocking */ }
    }

    await order.save();
    res.json({ success: true, order, message: `₹${refundAmount} refunded to customer` });
  } catch (error) { next(error); }
};

// ========== REFERRAL MANAGEMENT ==========

const getReferrals = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { status, isFraud } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (isFraud !== undefined) filter.isFraud = isFraud === 'true';

    const referrals = await Referral.find(filter)
      .populate('referrer', 'name email')
      .populate('referred', 'name email')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await Referral.countDocuments(filter);
    res.json({ success: true, referrals, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const flagReferralFraud = async (req, res, next) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found' });
    referral.isFraud = !referral.isFraud;
    if (referral.isFraud) {
      referral.fraudReason = req.body.reason || 'Flagged by admin';
      referral.fraudDetectedAt = new Date();
      if (referral.status !== 'rejected') referral.status = 'rejected';
    } else {
      referral.fraudReason = undefined;
      referral.fraudDetectedAt = undefined;
      if (referral.status === 'rejected') referral.status = 'pending';
    }
    await referral.save();
    res.json({ success: true, referral });
  } catch (error) { next(error); }
};

// ========== INVENTORY INSPECT ==========

const getInventoryInspector = async (req, res, next) => {
  try {
    const Inventory = require('../models/Inventory');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { vendorId, warehouseId, lowStock } = req.query;
    const filter = {};
    if (vendorId) filter.vendor = vendorId;
    if (warehouseId) filter.warehouse = warehouseId;
    if (lowStock === 'true') {
      filter.$expr = { $lte: [{ $subtract: ['$availableStock', '$reservedStock'] }, '$lowStockThreshold'] };
    }
    const inventory = await Inventory.find(filter)
      .populate('product', 'title slug images')
      .populate('variant', 'label price')
      .populate('warehouse', 'name location')
      .populate('vendor', 'storeName')
      .sort('-updatedAt')
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await Inventory.countDocuments(filter);
    res.json({ success: true, inventory, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const getOrderReport = async (req, res, next) => {
  try {
    const { startDate, endDate, status } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    const match = { createdAt: { $gte: start, $lte: end } };
    if (status) match.status = status;

    const orders = await Order.aggregate([
      { $match: match },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }, revenue: { $sum: '$total' },
      }},
      { $sort: { _id: 1 } },
    ]);

    const statusBreakdown = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } },
    ]);

    res.json({ success: true, report: { daily: orders, statusBreakdown, startDate: start, endDate: end } });
  } catch (error) { next(error); }
};

const toggleProductReturnable = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    product.isReturnable = !product.isReturnable;
    await product.save();
    res.json({ success: true, product });
  } catch (error) { next(error); }
};

const getReturnSettings = async (req, res, next) => {
  try {
    const settings = await Commission.findOne({ type: 'return_settings', isActive: true }).sort('-createdAt');
    res.json({ success: true, settings: settings || { rate: 7, name: 'Return Settings', isActive: true, type: 'return_settings' } });
  } catch (error) { next(error); }
};

const updateReturnSettings = async (req, res, next) => {
  try {
    const { rate, name } = req.body;
    const settings = await Commission.findOneAndUpdate(
      { type: 'return_settings' },
      { rate: rate || 7, name: name || 'Return Settings', type: 'return_settings', isActive: true },
      { upsert: true, new: true }
    );
    res.json({ success: true, settings });
  } catch (error) { next(error); }
};

module.exports = {
  getDashboard, getUsers, getUser, toggleUserStatus, banUser, getUserOrders, adminResetPassword, impersonateUser, adjustWallet,
  getVendors, getVendor, approveVendor, rejectVendor, suspendVendor, banVendor, updateVendorDetails,
  getProducts, approveProduct, rejectProduct,
  hideProduct, unhideProduct, toggleFeaturedProduct, setFlashSale, removeFlashSale,
  getOrders, getOrder, cancelOrder, forceDeliverOrder, forceRefundOrder,
  getReturns, getWithdrawals,
  getCategories, createCategory, updateCategory, deleteCategory,
  getBrands, createBrand, updateBrand, deleteBrand,
  getBanners, getCMS, updateCMS, deleteCMSPage,
  getNotifications, sendNotification,
  getRevenueReport, getVendorReport, getProductReport, getReferralReport, getOrderReport,
  getCommissionSettings, updateCommissionSettings,
  getAuditLogs,
  createSubAdmin, getSubAdmins, updateSubAdmin, deleteSubAdmin,
  createRole, getRoles, updateRole, deleteRole,
  getSEOSettings, updateSEOSettings,
  getShippingSettings, updateShippingSettings,
  getReferralSettings, updateReferralSettings,
  getWalletTransactions,
  createCoupon, getCoupons, updateCoupon, deleteCoupon,
  getReferrals, flagReferralFraud, getInventoryInspector,
  toggleProductReturnable,
  getReturnSettings, updateReturnSettings,
};
