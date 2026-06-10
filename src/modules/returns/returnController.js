const Return = require('../returns/Return');
const Order = require('../orders/Order');
const Product = require('../products/Product');
const Vendor = require('../vendors/Vendor');
const Inventory = require('../inventory/Inventory');
const InventoryTransaction = require('../inventory/InventoryTransaction');
const Commission = require('../commission/Commission');
const { Wallet, WalletTransaction } = require('../wallets/Wallet');
const Settlement = require('../settlements/Settlement');

const getReturnWindow = async (product, vendor) => {
  // Hierarchy: product.returnPolicy → vendor.returnPolicy → global Commission setting → 7 days default
  const policy = product.returnPolicy || 'vendor_default';

  if (policy === 'no_return') return 0;
  if (policy === '7_days') return 7;
  if (policy === '10_days') return 10;

  if (policy === 'vendor_default' && vendor) {
    const vPolicy = vendor.returnPolicy || '7_days';
    if (vPolicy === 'no_return') return 0;
    if (vPolicy === '7_days') return 7;
    if (vPolicy === '10_days') return 10;
  }

  const setting = await Commission.findOne({ type: 'return_settings', isActive: true }).sort('-createdAt');
  return setting?.rate || 7;
};

const requestReturn = async (req, res, next) => {
  try {
    const { orderId, orderItemId, reason, details, images } = req.body;

    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.items.id(orderItemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Order item not found' });
    }
    if (item.status !== 'delivered') {
      if (item.status === 'return_rejected') {
        return res.status(400).json({ success: false, message: 'Return request was previously rejected. Please contact support or file a dispute.' });
      }
      return res.status(400).json({ success: false, message: 'Item not yet delivered' });
    }

    const product = await Product.findById(item.product);
    if (!product || !product.isReturnable) {
      return res.status(400).json({ success: false, message: 'Product is not returnable' });
    }

    if (item.returnRequest?.isRequested) {
      return res.status(400).json({ success: false, message: 'Return already requested for this item' });
    }

    const vendor = await Vendor.findById(item.vendor);
    const returnWindowDays = await getReturnWindow(product, vendor);
    if (returnWindowDays === 0) {
      return res.status(400).json({ success: false, message: 'Returns are not accepted for this product' });
    }
    if (order.returnWindowEnd && new Date() > order.returnWindowEnd) {
      return res.status(400).json({ success: false, message: `Return window of ${returnWindowDays} days has expired` });
    }

    const returnItem = await Return.create({
      order: orderId,
      orderItem: orderItemId,
      user: req.user._id,
      vendor: item.vendor,
      product: item.product,
      reason,
      details,
      images: images || [],
      quantity: item.quantity,
      refundAmount: item.price * item.quantity,
      status: 'return_requested',
      pickupAddress: order.shippingAddress,
    });

    item.returnRequest = {
      isRequested: true,
      reason,
      status: 'return_requested',
      requestedAt: new Date(),
    };
    item.status = 'return_requested';
    await order.save();

    res.status(201).json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

const getReturns = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const returns = await Return.find({ user: req.user._id })
      .populate('product', 'title slug images isReturnable')
      .populate('order', 'orderNumber items.name items.tracking items._id items.status')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await Return.countDocuments({ user: req.user._id });
    res.json({ success: true, returns, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const getReturn = async (req, res, next) => {
  try {
    const returnItem = await Return.findOne({ _id: req.params.id, user: req.user._id })
      .populate('product', 'title slug images isReturnable')
      .populate('order', 'orderNumber items.name items.tracking items._id items.status');
    if (!returnItem) return res.status(404).json({ success: false, message: 'Return not found' });
    res.json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

const getReturnDetail = async (req, res, next) => {
  try {
    const returnItem = await Return.findById(req.params.id)
      .populate('product', 'title slug images isReturnable')
      .populate('order', 'orderNumber items.name items.tracking items._id items.status items.image')
      .populate('user', 'name email phone')
      .populate('vendor', 'storeName');
    if (!returnItem) return res.status(404).json({ success: false, message: 'Return not found' });
    res.json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

const approveReturn = async (req, res, next) => {
  try {
    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) return res.status(404).json({ success: false, message: 'Return not found' });
    if (returnItem.status !== 'return_requested') {
      return res.status(400).json({ success: false, message: `Cannot approve return in ${returnItem.status} status` });
    }

    returnItem.status = 'return_approved';
    returnItem.approvedAt = new Date();
    returnItem.approvedBy = req.user._id;
    await returnItem.save();

    const order = await Order.findById(returnItem.order);
    const item = order.items.id(returnItem.orderItem);
    if (item) {
      item.returnRequest.status = 'return_approved';
      item.returnRequest.approvedAt = new Date();
      item.status = 'return_approved';
      await order.save();
    }

    res.json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

const rejectReturn = async (req, res, next) => {
  try {
    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) return res.status(404).json({ success: false, message: 'Return not found' });
    if (!['return_requested', 'qc_failed'].includes(returnItem.status)) {
      return res.status(400).json({ success: false, message: `Cannot reject return in ${returnItem.status} status` });
    }

    returnItem.status = 'return_rejected';
    returnItem.rejectionReason = req.body.reason || 'Return rejected';
    await returnItem.save();

    const order = await Order.findById(returnItem.order);
    const item = order.items.id(returnItem.orderItem);
    if (item) {
      item.returnRequest.status = 'return_rejected';
      item.returnRequest.rejectionReason = req.body.reason;
      item.returnRequest.rejectedAt = new Date();
      item.status = 'return_rejected';
      await order.save();
    }

    res.json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

const schedulePickup = async (req, res, next) => {
  try {
    const { pickupDate } = req.body;
    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) return res.status(404).json({ success: false, message: 'Return not found' });
    if (returnItem.status !== 'return_approved') {
      return res.status(400).json({ success: false, message: 'Return must be approved first' });
    }

    returnItem.status = 'pickup_scheduled';
    returnItem.pickupScheduled = new Date(pickupDate);
    await returnItem.save();

    const order = await Order.findById(returnItem.order);
    const item = order.items.id(returnItem.orderItem);
    if (item) {
      item.returnRequest.status = 'pickup_scheduled';
      await order.save();
    }

    res.json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

const confirmPickup = async (req, res, next) => {
  try {
    const { trackingNumber } = req.body;
    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) return res.status(404).json({ success: false, message: 'Return not found' });
    if (returnItem.status !== 'pickup_scheduled') {
      return res.status(400).json({ success: false, message: 'Pickup not scheduled' });
    }

    returnItem.status = 'picked_up';
    returnItem.pickupCompleted = new Date();
    if (trackingNumber) returnItem.trackingNumber = trackingNumber;
    await returnItem.save();

    res.json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

const receiveReturn = async (req, res, next) => {
  try {
    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) return res.status(404).json({ success: false, message: 'Return not found' });
    if (returnItem.status !== 'picked_up') {
      return res.status(400).json({ success: false, message: 'Item not yet picked up' });
    }

    returnItem.status = 'return_received';
    returnItem.itemReceivedAt = new Date();
    await returnItem.save();

    const order = await Order.findById(returnItem.order);
    const item = order.items.id(returnItem.orderItem);
    if (item) {
      item.returnRequest.status = 'return_received';
      await order.save();
    }

    res.json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

const qcPass = async (req, res, next) => {
  try {
    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) return res.status(404).json({ success: false, message: 'Return not found' });
    if (returnItem.status !== 'return_received') {
      return res.status(400).json({ success: false, message: 'Return not yet received' });
    }

    returnItem.status = 'qc_passed';
    returnItem.qcNotes = req.body.notes || 'QC passed';
    returnItem.qcPerformedBy = req.user._id;
    returnItem.qcPassedAt = new Date();
    returnItem.damagedInventory = false;
    await returnItem.save();

    const order = await Order.findById(returnItem.order);
    const item = order.items.id(returnItem.orderItem);

    try {
      const product = await Product.findById(returnItem.product);
      if (product) {
        if (item && item.variant) {
          const variant = product.variants.id(item.variant);
          if (variant) variant.stock += (returnItem.quantity || item.quantity);
        }
        product.totalSold = Math.max(0, product.totalSold - (returnItem.quantity || item?.quantity || 1));
        await product.save();
      }
    } catch (stockErr) {
      console.error('Stock restoration error on QC pass:', stockErr.message);
    }

    try {
      const sku = item?.sku || '';
      if (sku && returnItem.product) {
        const inventories = await Inventory.find({ product: returnItem.product, variantSku: sku });
        for (const inv of inventories) {
          const release = Math.min(inv.reservedStock, returnItem.quantity || item?.quantity || 1);
          if (release <= 0) continue;
          const availBefore = inv.availableStock;
          const resBefore = inv.reservedStock;
          inv.reservedStock -= release;
          inv.availableStock += release;
          await inv.save();
          await InventoryTransaction.create({
            vendor: returnItem.vendor, warehouse: inv.warehouse, product: returnItem.product, variantSku: sku,
            type: 'return', quantity: release,
            availableBefore: availBefore, availableAfter: inv.availableStock,
            reservedBefore: resBefore, reservedAfter: inv.reservedStock,
            referenceId: returnItem._id, referenceModel: 'Return',
            note: `QC passed - return #${returnItem._id}`,
          });
        }
      }
    } catch (invErr) {
      console.error('Inventory restoration error on QC pass:', invErr.message);
    }

    if (item) {
      item.returnRequest.status = 'qc_passed';
      await order.save();
    }

    await processRefundLogic(returnItem, item, order);

    res.json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

const qcFail = async (req, res, next) => {
  try {
    const { notes, moveToDamaged } = req.body;
    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) return res.status(404).json({ success: false, message: 'Return not found' });
    if (returnItem.status !== 'return_received') {
      return res.status(400).json({ success: false, message: 'Return not yet received' });
    }

    returnItem.status = 'qc_failed';
    returnItem.qcNotes = notes || 'QC failed';
    returnItem.qcPerformedBy = req.user._id;
    returnItem.qcFailedAt = new Date();
    returnItem.damagedInventory = !!moveToDamaged;
    returnItem.rejectionReason = notes || 'Item failed quality check';
    await returnItem.save();

    if (moveToDamaged) {
      try {
        const sku = order?.items?.id(returnItem.orderItem)?.sku || '';
        if (sku && returnItem.product) {
          const inventories = await Inventory.find({ product: returnItem.product, variantSku: sku });
          for (const inv of inventories) {
            const qty = Math.min(inv.availableStock, returnItem.quantity);
            if (qty <= 0) continue;
            const availBefore = inv.availableStock;
            inv.availableStock -= qty;
            inv.damagedStock = (inv.damagedStock || 0) + qty;
            await inv.save();
            await InventoryTransaction.create({
              vendor: returnItem.vendor, warehouse: inv.warehouse, product: returnItem.product, variantSku: sku,
              type: 'damaged', quantity: qty,
              availableBefore: availBefore, availableAfter: inv.availableStock,
              reservedBefore: inv.reservedStock, reservedAfter: inv.reservedStock,
              referenceId: returnItem._id, referenceModel: 'Return',
              note: `QC failed - damaged item from return #${returnItem._id}`,
            });
          }
        }
      } catch (invErr) {
        console.error('Damaged inventory move error:', invErr.message);
      }
    }

    const order = await Order.findById(returnItem.order);
    const item = order.items.id(returnItem.orderItem);
    if (item) {
      item.returnRequest.status = 'qc_failed';
      item.returnRequest.rejectionReason = notes || 'Item failed quality check';
      item.returnRequest.rejectedAt = new Date();
      item.status = 'return_rejected';
      await order.save();
    }

    res.json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

const processRefundLogic = async (returnItem, item, order) => {
  // Calculate refund amount based on proportional coupon share
  // Refund = item's finalPrice (original totalPrice - couponDiscount share)
  // This ensures customer doesn't get more than they effectively paid
  const effectiveRefund = item?.finalPrice && item.finalPrice > 0
    ? Math.min(returnItem.refundAmount, item.finalPrice)
    : returnItem.refundAmount;
  const couponShare = item ? (item.totalPrice - (item.finalPrice || item.totalPrice)) : 0;

  returnItem.status = 'refund_processed';
  returnItem.refundProcessedAt = new Date();
  returnItem.refundTransactionId = `REF${Date.now()}`;
  returnItem.refundAmount = effectiveRefund;
  await returnItem.save();

  const wallet = await Wallet.findOne({ user: returnItem.user });
  if (wallet) {
    wallet.balance += effectiveRefund;
    wallet.totalCredited += effectiveRefund;
    wallet.lastTransactionAt = new Date();
    await wallet.save();

    await WalletTransaction.create({
      wallet: wallet._id, user: returnItem.user, type: 'credit', amount: effectiveRefund,
      balanceBefore: wallet.balance - effectiveRefund,
      balanceAfter: wallet.balance,
      category: 'refund',
      description: `Refund for return #${returnItem._id} (item price ₹${item?.totalPrice || 0} - coupon share ₹${couponShare})`,
      referenceModel: 'Return',
      referenceId: returnItem._id,
    });
  }

  if (item) {
    item.returnRequest.status = 'refunded';
    item.returnRequest.refundAmount = effectiveRefund;
    item.returnRequest.refundProcessedAt = new Date();
    item.status = 'refunded';
    if (order.coupon && order.coupon.discount > 0) {
      const remainingItems = order.items.filter(i => i._id.toString() !== item._id.toString() && !['cancelled', 'refunded'].includes(i.status));
      if (remainingItems.length === 0) {
        // Full order return - keep coupon discount recorded but refund exactly what paid
      }
    }
    await order.save();
    try { await Settlement.findOneAndUpdate({ orderItem: item._id, status: 'pending' }, { status: 'cancelled' }); } catch (e) { /* non-blocking */ }
  }

  try {
    if (item && item.vendor) {
      const vendor = await Vendor.findById(item.vendor);
      if (vendor) {
        const earningsToReverse = item.vendorEarnings || 0;
        vendor.totalEarnings = Math.max(0, vendor.totalEarnings - earningsToReverse);
        vendor.totalRevenue = Math.max(0, vendor.totalRevenue - (item.totalPrice || 0));
        await vendor.save();
      }
    }
  } catch (vendErr) {
    console.error('Vendor earnings reversal error:', vendErr.message);
  }
};

const processRefund = async (req, res, next) => {
  try {
    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) return res.status(404).json({ success: false, message: 'Return not found' });
    if (!['qc_passed', 'return_received'].includes(returnItem.status)) {
      return res.status(400).json({ success: false, message: `Cannot process refund in ${returnItem.status} status` });
    }

    const order = await Order.findById(returnItem.order);
    const item = order.items.id(returnItem.orderItem);

    if (returnItem.status === 'return_received') {
      try {
        const product = await Product.findById(returnItem.product);
        if (product) {
          if (item && item.variant) {
            const variant = product.variants.id(item.variant);
            if (variant) variant.stock += (returnItem.quantity || item.quantity);
          }
          product.totalSold = Math.max(0, product.totalSold - (returnItem.quantity || item?.quantity || 1));
          await product.save();
        }
      } catch (stockErr) {
        console.error('Stock restoration error on refund:', stockErr.message);
      }
      try {
        const sku = item?.sku || '';
        if (sku && returnItem.product) {
          const inventories = await Inventory.find({ product: returnItem.product, variantSku: sku });
          for (const inv of inventories) {
            const release = Math.min(inv.reservedStock, returnItem.quantity || item?.quantity || 1);
            if (release <= 0) continue;
            const availBefore = inv.availableStock;
            const resBefore = inv.reservedStock;
            inv.reservedStock -= release;
            inv.availableStock += release;
            await inv.save();
            await InventoryTransaction.create({
              vendor: returnItem.vendor, warehouse: inv.warehouse, product: returnItem.product, variantSku: sku,
              type: 'return', quantity: release,
              availableBefore: availBefore, availableAfter: inv.availableStock,
              reservedBefore: resBefore, reservedAfter: inv.reservedStock,
              referenceId: returnItem._id, referenceModel: 'Return',
              note: `Manual refund - return #${returnItem._id}`,
            });
          }
        }
      } catch (invErr) {
        console.error('Inventory restoration error on manual refund:', invErr.message);
      }
    }

    await processRefundLogic(returnItem, item, order);

    res.json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

const createDispute = async (req, res, next) => {
  try {
    const { reason, details } = req.body;
    const returnItem = await Return.findOne({ _id: req.params.id, user: req.user._id });
    if (!returnItem) return res.status(404).json({ success: false, message: 'Return not found' });
    if (!['return_rejected', 'qc_failed'].includes(returnItem.status)) {
      return res.status(400).json({ success: false, message: 'Can only dispute rejected returns' });
    }

    returnItem.status = 'dispute_open';
    returnItem.dispute = {
      reason,
      details,
      openedAt: new Date(),
    };
    await returnItem.save();

    res.json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

const resolveDispute = async (req, res, next) => {
  try {
    const { resolution, approveReturn: shouldApprove } = req.body;
    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) return res.status(404).json({ success: false, message: 'Return not found' });
    if (returnItem.status !== 'dispute_open') {
      return res.status(400).json({ success: false, message: 'No open dispute' });
    }

    returnItem.status = 'dispute_resolved';
    returnItem.dispute.resolvedAt = new Date();
    returnItem.dispute.resolvedBy = req.user._id;
    returnItem.dispute.resolution = resolution || 'Dispute resolved';
    await returnItem.save();

    if (shouldApprove) {
      const order = await Order.findById(returnItem.order);
      const item = order.items.id(returnItem.orderItem);
      returnItem.status = 'return_approved';
      returnItem.approvedAt = new Date();
      returnItem.approvedBy = req.user._id;
      await returnItem.save();
      if (item) {
        item.returnRequest.status = 'return_approved';
        item.returnRequest.approvedAt = new Date();
        item.status = 'return_approved';
        await order.save();
      }
    }

    res.json({ success: true, return: returnItem });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestReturn, getReturns, getReturn, getReturnDetail,
  approveReturn, rejectReturn,
  schedulePickup, confirmPickup, receiveReturn,
  qcPass, qcFail,
  processRefund,
  createDispute, resolveDispute,
};
