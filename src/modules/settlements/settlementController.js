const Settlement = require('../settlements/Settlement');
const Order = require('../orders/Order');
const Vendor = require('../vendors/Vendor');
const Product = require('../products/Product');
const Withdrawal = require('../withdrawals/Withdrawal');
const { Wallet, WalletTransaction } = require('../wallets/Wallet');

// Called when an item is delivered - creates settlement entry
const createSettlementForItem = async (order, item) => {
  const vendor = await Vendor.findById(item.vendor);
  if (!vendor) return null;

  let returnWindowDays = 7;
  try {
    const product = await Product.findById(item.product);
    if (product && !product.isReturnable) {
      returnWindowDays = 0;
    }
  } catch (_) {}

  const returnWindowEnd = new Date();
  returnWindowEnd.setDate(returnWindowEnd.getDate() + returnWindowDays);

  const existing = await Settlement.findOne({ order: order._id, orderItem: item._id });
  if (existing) return existing;

  return Settlement.create({
    vendor: item.vendor,
    order: order._id,
    orderItem: item._id,
    itemName: item.name,
    originalPrice: item.totalPrice,
    couponDiscount: item.couponDiscount || 0,
    finalPrice: item.finalPrice || (item.totalPrice - (item.couponDiscount || 0)),
    commissionRate: item.commissionRate || vendor.commissionRate || 0,
    commissionAmount: item.commission || 0,
    vendorEarnings: item.vendorEarnings || 0,
    status: 'pending',
    deliveredAt: new Date(),
    returnWindowEnd,
  });
};

// Release all settlements past return window for a vendor
const releaseSettlements = async (req, res, next) => {
  try {
    const vendorFilter = req.user?.role === 'vendor'
      ? { vendor: (await Vendor.findOne({ user: req.user._id }))?._id }
      : {};

    const settlements = await Settlement.find({
      ...vendorFilter,
      status: 'pending',
      returnWindowEnd: { $lte: new Date() },
    }).populate('order');

    let released = 0;
    for (const s of settlements) {
      const order = s.order;
      if (!order) continue;

      const item = order.items.id(s.orderItem);
      if (!item || item.paymentSettled) continue;
      if (item.status !== 'delivered' && item.status !== 'settled') continue;

      const vendorDoc = await Vendor.findById(s.vendor);
      if (!vendorDoc || !vendorDoc.user) continue;

      const wallet = await Wallet.findOne({ user: vendorDoc.user });
      if (!wallet) continue;

      const balBefore = wallet.balance;
      wallet.balance += s.vendorEarnings;
      wallet.totalCredited += s.vendorEarnings;
      wallet.lastTransactionAt = new Date();
      await wallet.save();

      const txn = await WalletTransaction.create({
        wallet: wallet._id, user: vendorDoc.user, type: 'credit', amount: s.vendorEarnings,
        balanceBefore: balBefore, balanceAfter: wallet.balance,
        category: 'commission',
        description: `Settlement for "${s.itemName}" (Order #${order.orderNumber})`,
        referenceModel: 'Order', referenceId: order._id,
      });

      s.status = 'released';
      s.releasedAt = new Date();
      s.walletTransaction = txn._id;
      await s.save();

      if (item) {
        item.paymentSettled = true;
        item.settlementDate = new Date();
      }

      const allSettled = order.items.every(i => i.paymentSettled);
      if (allSettled) {
        order.paymentSettled = true;
        order.settlementDate = new Date();
        order.settledAt = new Date();
      }
      await order.save();
      released++;
    }

    res.json({ success: true, message: `${released} settlements released`, released });
  } catch (error) { next(error); }
};

// Cancel/reverse settlement (used when return/refund happens)
const cancelSettlement = async (req, res, next) => {
  try {
    const { orderItemId } = req.params;
    const settlement = await Settlement.findOne({ orderItem: orderItemId, status: 'pending' });
    if (!settlement) return res.status(404).json({ success: false, message: 'Settlement not found or already released' });

    settlement.status = 'cancelled';
    await settlement.save();
    res.json({ success: true, message: 'Settlement cancelled' });
  } catch (error) { next(error); }
};

// Get vendor settlements
const getVendorSettlements = async (req, res, next) => {
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

    // Aggregations
    const agg = await Settlement.aggregate([
      { $match: { vendor: vendor._id } },
      { $group: {
        _id: null,
        totalEarnings: { $sum: '$vendorEarnings' },
        pendingAmount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$vendorEarnings', 0] } },
        releasedAmount: { $sum: { $cond: [{ $eq: ['$status', 'released'] }, '$vendorEarnings', 0] } },
        cancelledAmount: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, '$vendorEarnings', 0] } },
        count: { $sum: 1 },
      }}
    ]);

    res.json({
      success: true,
      settlements,
      summary: agg[0] || { totalEarnings: 0, pendingAmount: 0, releasedAmount: 0, cancelledAmount: 0, count: 0 },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) { next(error); }
};

// Admin get all settlements
const getAllSettlements = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const filter = {};
    if (status) filter.status = status;

    const settlements = await Settlement.find(filter)
      .sort('-createdAt').skip((page - 1) * limit).limit(limit)
      .populate('vendor', 'storeName').populate('order', 'orderNumber');

    const total = await Settlement.countDocuments(filter);
    res.json({ success: true, settlements, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

module.exports = {
  createSettlementForItem, releaseSettlements, cancelSettlement,
  getVendorSettlements, getAllSettlements,
};
