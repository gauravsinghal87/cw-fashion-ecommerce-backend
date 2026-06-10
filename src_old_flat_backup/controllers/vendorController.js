const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const Review = require('../models/Review');
const Order = require('../models/Order');
const User = require('../models/User');
const Return = require('../models/Return');
const Withdrawal = require('../models/Withdrawal');
const { Wallet, WalletTransaction } = require('../models/Wallet');
const Settlement = require('../models/Settlement');
const Warehouse = require('../models/Warehouse');
const { createSettlementForItem } = require('./settlementController');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { sendVendorApprovalEmail, sendOTPEmail, sendWelcomeEmail } = require('../utils/emailService');
const slugify = require('slugify');
const crypto = require('crypto');
const { generateToken, generateRefreshToken } = require('../utils/generateToken');

const registerVendor = async (req, res, next) => {
  try {
    const { name, email, password, phone, storeName, panNumber, aadhaarNumber, bankAccount, ifscCode, upiId } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: 'vendor' // Set role to vendor
    });

    user.generateReferralCode();
    await user.save();

    const storeSlug = slugify(storeName, { lower: true, strict: true }) + '-' + Date.now().toString(36);
    
    // Construct vendor data with proper bankAccount object
    const vendorData = {
      ...req.body,
      user: user._id,
      storeSlug,
      bankAccount: {
        accountHolderName: name, // Use the user's name as account holder name
        accountNumber: bankAccount?.trim() || '',
        bankName: '', // Will need to be updated by user later
        ifscCode: ifscCode?.trim() || '',
        accountType: 'Saving', // Default to saving account
        upiId: upiId?.trim() || '',
        isVerified: false // Initially not verified
      }
    };
    
    // Remove the individual bank fields since we've constructed the bankAccount object
    // vendorData.bankAccount is already the correct nested object — keep it
    delete vendorData.ifscCode;
    delete vendorData.upiId;

    const vendor = await Vendor.create(vendorData);

    await Wallet.create({ user: user._id });

    // Send email verification OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerificationToken = crypto.createHash('sha256').update(otp).digest('hex');
    user.emailVerificationExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendOTPEmail(email, otp);

    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Vendor registration successful. Please verify your email.',
      token,
      refreshToken,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      },
      vendor: {
        id: vendor._id,
        storeName: vendor.storeName,
        storeSlug: vendor.storeSlug
      }
    });
  } catch (error) {
    next(error);
  }
};

const loginVendor = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email first
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Check if user is a vendor
    if (user.role !== 'vendor') {
      return res.status(401).json({ success: false, message: 'Account is not a vendor account' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in. Check your inbox or request a new OTP.',
        needsVerification: true,
        email: user.email,
      });
    }

    // Find vendor profile
    const vendor = await Vendor.findOne({ user: user._id });
    if (!vendor) {
      return res.status(401).json({ success: false, message: 'Vendor profile not found' });
    }

    // Check if vendor is approved — pending vendors can log in but see pending screen
    if (['rejected', 'suspended', 'banned'].includes(vendor.status)) {
      return res.status(401).json({ success: false, message: `Vendor account is ${vendor.status}` });
    }

    // Generate tokens
    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true,
      message: 'Vendor login successful',
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        phone: user.phone,
        avatar: user.avatar,
        vendorInfo: {
          id: vendor._id,
          storeName: vendor.storeName,
          storeSlug: vendor.storeSlug,
          status: vendor.status,
        }
      },
    });
  } catch (error) {
    next(error);
  }
};

const getVendorProfile = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id }).select('+aadhaarNumber').populate('user', 'name email phone avatar');
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.json({ success: true, vendor });
  } catch (error) {
    next(error);
  }
};

const updateVendorProfile = async (req, res, next) => {
  try {
    const allowed = ['storeName', 'storeDescription', 'storeLogo', 'storeBanner', 'phone', 'address', 'bankAccount', 'gstNumber', 'aadhaarNumber', 'seoSettings'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const vendor = await Vendor.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );
    res.json({ success: true, vendor });
  } catch (error) {
    next(error);
  }
};

const getVendorProducts = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = { vendor: vendor._id, isActive: true, status: { $ne: 'archived' } };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.showAll === 'true') { delete filter.isActive; delete filter.status; }

    const products = await Product.find(filter)
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Product.countDocuments(filter);
    res.json({ success: true, products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const getVendorOrders = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;

    const filter = { 'items.vendor': vendor._id };
    if (status) filter['items.status'] = status;

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

const updateOrderStatus = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const order = await Order.findOne({ _id: req.params.orderId, 'items.vendor': vendor._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Order item not found' });
    }

    const terminalStatuses = ['cancelled', 'refunded', 'return_rejected', 'return_received', 'settled'];
    if (terminalStatuses.includes(item.status)) {
      return res.status(400).json({ success: false, message: `Cannot update item with status: ${item.status}` });
    }

    const currentStatus = item.status;
    const VALID_TRANSITIONS = {
      'pending': ['accepted', 'cancelled'],
      'accepted': ['packed', 'cancelled'],
      'packed': ['shipped', 'cancelled'],
      'shipped': ['out_for_delivery', 'cancelled'],
      'out_for_delivery': ['delivered', 'cancelled'],
    };

    if (VALID_TRANSITIONS[currentStatus] && !VALID_TRANSITIONS[currentStatus].includes(req.body.status)) {
      return res.status(400).json({ success: false, message: `Cannot transition from ${currentStatus} to ${req.body.status}` });
    }

    item.status = req.body.status;
    item.statusHistory.push({ status: req.body.status, date: new Date(), note: req.body.note, updatedBy: req.user._id });

    if (req.body.status === 'shipped' && req.body.tracking) {
      item.tracking = { ...item.tracking, ...req.body.tracking, shippedAt: new Date() };
    }
    if (req.body.status === 'out_for_delivery') {
      item.tracking.estimatedDelivery = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    if (req.body.status === 'delivered') {
      item.tracking.deliveredAt = new Date();
      try {
        const v = await Vendor.findById(item.vendor);
        if (v) { v.totalRevenue += item.totalPrice; v.totalEarnings += item.vendorEarnings; await v.save(); }
      } catch (e) { /* vendor totals update non-blocking */ }
      try { await createSettlementForItem(order, item); } catch (e) { /* settlement creation non-blocking */ }
      try {
        const { triggerReferralReward } = require('./referralController');
        await triggerReferralReward(order, item);
      } catch (e) { /* referral reward trigger non-blocking */ }
    }

    const allItems = order.items.filter(i => i.vendor.toString() === vendor._id.toString());
    const allDelivered = allItems.every(i => i.status === 'delivered' || i.status === 'refunded');
    const allOutForDelivery = allItems.every(i => ['out_for_delivery', 'delivered', 'refunded'].includes(i.status));
    const allShipped = allItems.every(i => ['shipped', 'out_for_delivery', 'delivered', 'refunded'].includes(i.status));

    if (allDelivered) {
      order.status = 'delivered';
      order.deliveredAt = new Date();
      if (!order.returnWindowEnd) {
        order.returnWindowEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }
    } else if (allOutForDelivery) {
      order.status = 'out_for_delivery';
    } else if (allShipped) {
      order.status = 'shipped';
    } else {
      order.status = req.body.status;
    }

    await order.save();
    res.json({ success: true, order });
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
      totalProducts, activeProducts, totalOrders,
      pendingOrders, shippedOrders, deliveredOrders,
      monthlyRevenue, recentOrders, lowStockProducts,
      returnRequests, wallet, totalStats,
    ] = await Promise.all([
      Product.countDocuments({ vendor: vendor._id }),
      Product.countDocuments({ vendor: vendor._id, isActive: true, status: 'approved' }),
      Order.countDocuments({ 'items.vendor': vendor._id }),
      Order.countDocuments({ 'items.vendor': vendor._id, 'items.status': 'pending' }),
      Order.countDocuments({ 'items.vendor': vendor._id, 'items.status': 'shipped' }),
      Order.countDocuments({ 'items.vendor': vendor._id, 'items.status': 'delivered' }),
      Order.aggregate([
        { $unwind: '$items' },
        { $match: { 'items.vendor': vendor._id, createdAt: { $gte: thisMonth }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$items.totalPrice' } } },
      ]),
      Order.find({ 'items.vendor': vendor._id }).sort('-createdAt').limit(5).populate('user', 'name'),
      Product.find({ vendor: vendor._id, totalStock: { $lte: 10 } }).limit(5),
      require('../models/Return').countDocuments({ vendor: vendor._id, status: { $in: ['requested', 'approved', 'pickup_scheduled'] } }),
      require('../models/Wallet').Wallet.findOne({ user: req.user._id }),
      Order.aggregate([
        { $unwind: '$items' },
        { $match: { 'items.vendor': vendor._id, 'items.status': 'delivered' } },
        { $group: { _id: null, totalRevenue: { $sum: '$items.totalPrice' }, totalEarnings: { $sum: '$items.vendorEarnings' } } },
      ]),
    ]);

    res.json({
      success: true,
      dashboard: {
        totalProducts, activeProducts, totalOrders, pendingOrders,
        shippedOrders, deliveredOrders,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        totalRevenue: totalStats[0]?.totalRevenue || 0,
        totalEarnings: totalStats[0]?.totalEarnings || 0,
        totalWithdrawn: vendor.totalWithdrawn,
        pendingWithdrawal: vendor.pendingWithdrawal,
        walletBalance: wallet?.balance || 0,
        returnRequests,
        recentOrders,
        lowStockProducts,
      }
    });
  } catch (error) {
    next(error);
  }
};

const getVendorReturns = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = { vendor: vendor._id };
    if (req.query.status) filter.status = req.query.status;
    const returns = await Return.find(filter)
      .populate('user', 'name email phone')
      .populate('product', 'title slug images isReturnable')
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

const getVendorReturn = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const returnItem = await Return.findOne({ _id: req.params.returnId, vendor: vendor._id })
      .populate('user', 'name email phone')
      .populate('product', 'title slug images isReturnable')
      .populate('order', 'orderNumber shippingAddress items.name items.tracking items._id items.status items.image');
    if (!returnItem) return res.status(404).json({ success: false, message: 'Return not found' });
    res.json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

const updateReturnStatus = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const returnItem = await Return.findOne({ _id: req.params.returnId, vendor: vendor._id });
    if (!returnItem) {
      return res.status(404).json({ success: false, message: 'Return not found' });
    }

    const { status, reason, pickupDate, trackingNumber } = req.body;

    if (status === 'return_approved') {
      if (returnItem.status !== 'return_requested') {
        return res.status(400).json({ success: false, message: `Cannot approve return in ${returnItem.status} status` });
      }
      returnItem.status = 'return_approved';
      returnItem.approvedAt = new Date();
      returnItem.approvedBy = req.user._id;
      const order = await Order.findById(returnItem.order);
      const item = order?.items?.id(returnItem.orderItem);
      if (item) {
        item.returnRequest.status = 'return_approved';
        item.returnRequest.approvedAt = new Date();
        item.status = 'return_approved';
        await order.save();
      }
    } else if (status === 'return_rejected') {
      if (!['return_requested'].includes(returnItem.status)) {
        return res.status(400).json({ success: false, message: `Cannot reject return in ${returnItem.status} status` });
      }
      returnItem.status = 'return_rejected';
      returnItem.rejectionReason = reason || 'Return rejected by vendor';
      const order = await Order.findById(returnItem.order);
      const item = order?.items?.id(returnItem.orderItem);
      if (item) {
        item.returnRequest.status = 'return_rejected';
        item.returnRequest.rejectionReason = reason;
        item.returnRequest.rejectedAt = new Date();
        item.status = 'return_rejected';
        await order.save();
      }
    } else if (status === 'pickup_scheduled') {
      if (returnItem.status !== 'return_approved') {
        return res.status(400).json({ success: false, message: 'Return must be approved first' });
      }
      returnItem.status = 'pickup_scheduled';
      returnItem.pickupScheduled = pickupDate ? new Date(pickupDate) : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    } else if (status === 'picked_up') {
      if (returnItem.status !== 'pickup_scheduled') {
        return res.status(400).json({ success: false, message: 'Pickup not scheduled' });
      }
      returnItem.status = 'picked_up';
      returnItem.pickupCompleted = new Date();
      if (trackingNumber) returnItem.trackingNumber = trackingNumber;
    } else if (status === 'return_received') {
      if (returnItem.status !== 'picked_up') {
        return res.status(400).json({ success: false, message: 'Item not yet picked up' });
      }
      returnItem.status = 'return_received';
      returnItem.itemReceivedAt = new Date();
      const order = await Order.findById(returnItem.order);
      const item = order?.items?.id(returnItem.orderItem);
      if (item) {
        item.returnRequest.status = 'return_received';
        await order.save();
      }
    } else {
      return res.status(400).json({ success: false, message: `Invalid status transition: ${status}` });
    }

    await returnItem.save();
    res.json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

const getVendorAnalytics = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [revenueData, topProducts, orderStats] = await Promise.all([
      Order.aggregate([
        { $unwind: '$items' },
        { $match: { 'items.vendor': vendor._id, createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$items.totalPrice' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Product.find({ vendor: vendor._id }).sort('-totalSold').limit(10).select('title slug totalSold minPrice images'),
      Order.aggregate([
        { $unwind: '$items' },
        { $match: { 'items.vendor': vendor._id } },
        { $group: { _id: '$items.status', count: { $sum: 1 } } },
      ]),
    ]);
    const [returnCount, orderCount] = await Promise.all([
      Return.countDocuments({ vendor: vendor._id, createdAt: { $gte: since } }),
      Order.countDocuments({ 'items.vendor': vendor._id, createdAt: { $gte: since } }),
    ]);
    const returnRate = ((returnCount / Math.max(1, orderCount)) * 100).toFixed(2);

    res.json({ success: true, analytics: { revenueData, topProducts, orderStats, returnRate } });
  } catch (error) {
    next(error);
  }
};

const getVendorWallet = async (req, res, next) => {
  try {
    const [wallet, vendor] = await Promise.all([
      Wallet.findOne({ user: req.user._id }),
      Vendor.findOne({ user: req.user._id }).select('totalEarnings totalWithdrawn pendingWithdrawal'),
    ]);
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });
    const transactions = await WalletTransaction.find({ user: req.user._id }).sort('-createdAt').limit(50);
    res.json({
      success: true,
      wallet: {
        ...wallet.toObject(),
        pendingWithdrawal: vendor?.pendingWithdrawal || 0,
        totalWithdrawn: vendor?.totalWithdrawn || 0,
      },
      transactions,
    });
  } catch (error) { next(error); }
};

const getVendorReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const vendor = await Vendor.findOne({ user: req.user._id });
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

const uploadBulkProducts = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const { products } = req.body;
    const created = [];
    const allowed = ['title', 'description', 'category', 'brand', 'images', 'variants', 'tags', 'specifications', 'isReturnable', 'returnPeriod'];

    for (const data of products) {
      const productData = {};
      allowed.forEach(f => { if (data[f] !== undefined) productData[f] = data[f]; });
      productData.vendor = vendor._id;
      productData.slug = slugify(data.title, { lower: true, strict: true }) + '-' + Date.now().toString(36);
      const product = await Product.create(productData);
      created.push(product);
    }

    vendor.totalProducts += created.length;
    await vendor.save();

    res.status(201).json({ success: true, count: created.length, products: created });
  } catch (error) {
    next(error);
  }
};

const exportProducts = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const products = await Product.find({ vendor: vendor._id })
      .populate('category', 'name')
      .populate('brand', 'name')
      .lean();

    res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
};

const createAuditLog = async (vendorId, userId, action, resource, details) => {
  await AuditLog.create({
    user: userId, vendor: vendorId, action, resource, details, ip: '127.0.0.1'
  });
};

const getVendorStoreSEO = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id }).select('metaTitle metaDescription storeSlug');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, seo: { metaTitle: vendor.metaTitle, metaDescription: vendor.metaDescription, storeSlug: vendor.storeSlug } });
  } catch (error) { next(error); }
};

const updateVendorStoreSEO = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOneAndUpdate(
      { user: req.user._id },
      { $set: { metaTitle: req.body.metaTitle, metaDescription: req.body.metaDescription, storeSlug: req.body.storeSlug } },
      { new: true, runValidators: true }
    );
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, seo: { metaTitle: vendor.metaTitle, metaDescription: vendor.metaDescription, storeSlug: vendor.storeSlug } });
  } catch (error) { next(error); }
};

const getWarehouses = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const warehouses = await Warehouse.find({ vendor: vendor._id });
    res.json({ success: true, warehouses });
  } catch (error) { next(error); }
};

const createWarehouse = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const warehouse = await Warehouse.create({ ...req.body, vendor: vendor._id });
    await createAuditLog(vendor._id, req.user._id, 'create', 'warehouse', `Created warehouse: ${warehouse.name}`);
    res.status(201).json({ success: true, warehouse });
  } catch (error) { next(error); }
};

const updateWarehouse = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const warehouse = await Warehouse.findOneAndUpdate(
      { _id: req.params.id, vendor: vendor._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!warehouse) return res.status(404).json({ success: false, message: 'Warehouse not found' });
    res.json({ success: true, warehouse });
  } catch (error) { next(error); }
};

const deleteWarehouse = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const warehouse = await Warehouse.findOneAndDelete({ _id: req.params.id, vendor: vendor._id });
    if (!warehouse) return res.status(404).json({ success: false, message: 'Warehouse not found' });
    await createAuditLog(vendor._id, req.user._id, 'delete', 'warehouse', `Deleted warehouse: ${warehouse.name}`);
    res.json({ success: true, message: 'Warehouse deleted' });
  } catch (error) { next(error); }
};

const getInventory = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const q = req.query.q;
    const filter = { vendor: vendor._id };
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { 'variants.sku': { $regex: q, $options: 'i' } },
      ];
    }
    const products = await Product.find(filter).select('title slug images variants totalStock').lean();
    const result = products.map(p => ({
      ...p,
      variants: p.variants.map(v => ({ sku: v.sku, color: v.color, size: v.size, stock: v.stock, price: v.price })),
      totalStock: p.totalStock,
    }));
    res.json({ success: true, products: result });
  } catch (error) { next(error); }
};

const updateInventoryItem = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const { productId, variantId, stock, price } = req.body;
    const product = await Product.findOne({ _id: productId, vendor: vendor._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const variant = product.variants.id(variantId);
    if (!variant) return res.status(404).json({ success: false, message: 'Variant not found' });
    if (stock !== undefined) {
      variant.stock = stock;
      variant.availableStock = stock;
    }
    if (price !== undefined) variant.price = price;
    await product.save();
    await createAuditLog(vendor._id, req.user._id, 'update', 'inventory', `Updated variant ${variant.sku} of product ${product.title}`);
    res.json({ success: true, product });
  } catch (error) { next(error); }
};

const bulkUpdateInventory = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const { items } = req.body;
    const results = [];
    for (const item of items) {
      const product = await Product.findOne({ _id: item.productId, vendor: vendor._id });
      if (!product) continue;
      const variant = product.variants.id(item.variantId);
      if (!variant) continue;
      if (item.stock !== undefined) { variant.stock = item.stock; variant.availableStock = item.stock; }
      if (item.price !== undefined) variant.price = item.price;
      await product.save();
      results.push({ productId: item.productId, variantId: item.variantId, updated: true });
    }
    res.json({ success: true, updated: results.length, results });
  } catch (error) { next(error); }
};

const getVendorCustomers = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const orders = await Order.find({ 'items.vendor': vendor._id })
      .populate('user', 'name email phone')
      .lean();
    const customerMap = {};
    for (const order of orders) {
      const userId = order.user?._id?.toString();
      if (!userId) continue;
      if (!customerMap[userId]) {
        customerMap[userId] = { user: order.user, orderCount: 0, totalSpend: 0 };
      }
      customerMap[userId].orderCount += 1;
      const vendorItems = order.items.filter(i => i.vendor?.toString() === vendor._id.toString());
      customerMap[userId].totalSpend += vendorItems.reduce((sum, i) => sum + (i.totalPrice || 0), 0);
    }
    res.json({ success: true, customers: Object.values(customerMap) });
  } catch (error) { next(error); }
};

const getVendorCustomerDetail = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const customer = await User.findById(req.params.id).select('name email phone');
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    const orders = await Order.find({ user: req.params.id, 'items.vendor': vendor._id }).sort('-createdAt').lean();
    const returns = await Return.find({ user: req.params.id, vendor: vendor._id }).sort('-createdAt').lean();
    const productIds = (await Product.find({ vendor: vendor._id }).select('_id').lean()).map(p => p._id);
    const reviews = await Review.find({ product: { $in: productIds }, user: customer._id })
      .populate('product', 'title slug').lean();
    res.json({ success: true, customer, orders, returns, reviews });
  } catch (error) { next(error); }
};

const getSettlements = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const filter = { vendor: vendor._id };
    if (status) filter.status = status;

    const settlements = await Settlement.find(filter)
      .sort('-createdAt').skip((page - 1) * limit).limit(limit)
      .populate('order', 'orderNumber');

    const total = await Settlement.countDocuments(filter);
    const agg = await Settlement.aggregate([
      { $match: { vendor: vendor._id } },
      { $group: { _id: null, totalEarnings: { $sum: '$vendorEarnings' }, pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$vendorEarnings', 0] } }, released: { $sum: { $cond: [{ $eq: ['$status', 'released'] }, '$vendorEarnings', 0] } }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, '$vendorEarnings', 0] } } } }
    ]);

    res.json({ success: true, settlements, summary: agg[0] || {}, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const getSettlementDetail = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const settlement = await Settlement.findOne({ _id: req.params.id, vendor: vendor._id }).populate('order', 'orderNumber createdAt');
    if (!settlement) return res.status(404).json({ success: false, message: 'Settlement not found' });
    res.json({ success: true, settlement });
  } catch (error) { next(error); }
};

const generateInvoice = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const order = await Order.findById(req.params.orderId).populate('user', 'name email phone').lean();
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const vendorItems = order.items.filter(i => i.vendor?.toString() === vendor._id.toString());
    if (vendorItems.length === 0) return res.status(404).json({ success: false, message: 'No items from this vendor in the order' });
    const subtotal = vendorItems.reduce((s, i) => s + (i.totalPrice || 0), 0);
    const discount = vendorItems.reduce((s, i) => s + ((i.totalPrice || 0) - (i.finalPrice || i.totalPrice || 0)), 0);
    const shipping = order.shippingCharge || 0;
    const total = subtotal - discount + shipping;
    const address = order.shippingAddress || {};
    const invoice = {
      invoiceNumber: `INV-${order.orderNumber}-${vendor._id.toString().slice(-6).toUpperCase()}`,
      createdAt: order.createdAt,
      orderNumber: order.orderNumber,
      user: {
        name: order.user?.name || '',
        email: order.user?.email || '',
        phone: order.user?.phone || '',
      },
      shippingAddress: {
        addressLine1: address.address || address.addressLine1 || '',
        city: address.city || '',
        state: address.state || '',
        pincode: address.pincode || '',
      },
      vendorStoreName: vendor.storeName,
      vendorAddress: `${vendor.addressLine1 || ''}, ${vendor.city || ''}, ${vendor.state || ''} - ${vendor.pincode || ''}`,
      items: vendorItems.map(i => ({
        name: i.productName || i.name || i.product?.toString(),
        sku: i.sku || '',
        quantity: i.quantity || 1,
        price: i.price || 0,
        totalPrice: i.totalPrice || 0,
      })),
      subtotal,
      discount,
      shippingCharge: shipping,
      total,
    };
    res.json({ success: true, invoice });
  } catch (error) { next(error); }
};

const getNotifications = async (req, res, next) => {
  try {
    const filter = { $or: [{ recipientRole: 'vendor' }, { recipient: req.user._id }] };
    if (req.query.isRead !== undefined) filter.isRead = req.query.isRead === 'true';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const notifications = await Notification.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ ...filter, isRead: false });
    res.json({ success: true, notifications, unreadCount, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, $or: [{ recipientRole: 'vendor' }, { recipient: req.user._id }] },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, notification });
  } catch (error) { next(error); }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { $or: [{ recipientRole: 'vendor' }, { recipient: req.user._id }], isRead: false },
      { isRead: true }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) { next(error); }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.action) filter.action = req.query.action;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const logs = await AuditLog.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit).lean();
    const total = await AuditLog.countDocuments(filter);
    res.json({ success: true, logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const duplicateProduct = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const original = await Product.findOne({ _id: req.params.id, vendor: vendor._id });
    if (!original) return res.status(404).json({ success: false, message: 'Product not found' });
    const data = original.toObject();
    delete data._id;
    delete data.createdAt;
    delete data.updatedAt;
    data.title = `${data.title} (Copy)`;
    data.slug = slugify(data.title, { lower: true, strict: true }) + '-' + Date.now().toString(36);
    data.status = 'draft';
    const copy = await Product.create(data);
    await createAuditLog(vendor._id, req.user._id, 'create', 'product', `Duplicated product: ${original.title} -> ${copy.title}`);
    res.status(201).json({ success: true, product: copy });
  } catch (error) { next(error); }
};

const getProductVariants = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const product = await Product.findOne({ _id: req.params.id, vendor: vendor._id }).select('title slug variants');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, variants: product.variants });
  } catch (error) { next(error); }
};

const createProductVariant = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const product = await Product.findOne({ _id: req.params.id, vendor: vendor._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    product.variants.push(req.body);
    await product.save();
    await createAuditLog(vendor._id, req.user._id, 'create', 'product_variant', `Added variant to product ${product.title}`);
    res.status(201).json({ success: true, product });
  } catch (error) { next(error); }
};

const updateProductVariant = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const product = await Product.findOne({ _id: req.params.id, vendor: vendor._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const variant = product.variants.id(req.params.variantId);
    if (!variant) return res.status(404).json({ success: false, message: 'Variant not found' });
    Object.assign(variant, req.body);
    await product.save();
    await createAuditLog(vendor._id, req.user._id, 'update', 'product_variant', `Updated variant of product ${product.title}`);
    res.json({ success: true, product });
  } catch (error) { next(error); }
};

const deleteProductVariant = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const product = await Product.findOne({ _id: req.params.id, vendor: vendor._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    product.variants.pull(req.params.variantId);
    await product.save();
    await createAuditLog(vendor._id, req.user._id, 'delete', 'product_variant', `Removed variant from product ${product.title}`);
    res.json({ success: true, product });
  } catch (error) { next(error); }
};

const getVendorProductDetail = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const product = await Product.findOne({ _id: req.params.id, vendor: vendor._id })
      .populate('category', 'name')
      .populate('brand', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (error) { next(error); }
};

const getVendorOrderDetail = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const order = await Order.findOne({ _id: req.params.id, 'items.vendor': vendor._id })
      .populate('user', 'name email phone')
      .populate('items.product', 'title images price');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const vendorItems = order.items.filter(item => item.vendor && item.vendor.toString() === vendor._id.toString());
    res.json({ success: true, order: { ...order.toObject(), items: vendorItems } });
  } catch (error) { next(error); }
};

module.exports = {
  registerVendor, loginVendor, getVendorProfile, updateVendorProfile,
  getVendorProducts, getVendorOrders, updateOrderStatus,
  getVendorDashboard, getVendorReturns, getVendorReturn, updateReturnStatus,
  getVendorAnalytics, getVendorWallet, getVendorReviews, uploadBulkProducts, exportProducts,
  getVendorStoreSEO, updateVendorStoreSEO,
  getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse,
  getInventory, updateInventoryItem, bulkUpdateInventory,
  getVendorCustomers, getVendorCustomerDetail,
  getSettlements, getSettlementDetail,
  generateInvoice,
  getNotifications, markNotificationRead, markAllNotificationsRead,
  getAuditLogs,
  duplicateProduct,
  getProductVariants, createProductVariant, updateProductVariant, deleteProductVariant,
  getVendorProductDetail, getVendorOrderDetail,
};
