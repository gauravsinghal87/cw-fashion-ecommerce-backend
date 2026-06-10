const Order = require('../orders/Order');
const Product = require('../products/Product');
const Vendor = require('../vendors/Vendor');
const Cart = require('../carts/Cart');
const Coupon = require('../coupons/Coupon');
const Inventory = require('../inventory/Inventory');
const InventoryTransaction = require('../inventory/InventoryTransaction');
const Warehouse = require('../warehouses/Warehouse');
const { Wallet } = require('../wallets/Wallet');
const { WalletTransaction } = require('../wallets/Wallet');
const { createSettlementForItem } = require('../settlements/settlementController');
const { generateOrderNumber, generateInvoiceNumber } = require('../../shared/utils/generateOrderNumber');

const createOrder = async (req, res, next) => {
  try {
    const { items, shippingAddress, billingAddress, paymentMethod, couponCode, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    if (!shippingAddress) {
      return res.status(400).json({ success: false, message: 'Shipping address required' });
    }

    let subtotal = 0;
    const orderItems = [];
    const vendorMap = {};
    let couponDiscounts = [];
    let rawItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId).populate('vendor');
      if (!product || !product.isActive || product.status !== 'approved') {
        return res.status(400).json({ success: false, message: `Product ${item.productId} not available` });
      }

      let variant = null;
      let price = product.minPrice;
      let mrp = product.maxPrice;

      if (item.variantId) {
        variant = product.variants.id(item.variantId);
        if (!variant || !variant.isActive) {
          return res.status(400).json({ success: false, message: 'Variant not available' });
        }
        price = variant.price;
        mrp = variant.mrp;
      }

      if (product.isFlashSale && product.flashSalePrice) {
        price = product.flashSalePrice;
      }

      if (item.quantity > 10) {
        return res.status(400).json({ success: false, message: `Max quantity per product is 10` });
      }

      if (!product.vendor) {
        return res.status(400).json({ success: false, message: `Vendor unavailable for ${product.title || item.productId}` });
      }
      const vendorId = product.vendor._id;
      if (!vendorMap[vendorId]) {
        vendorMap[vendorId] = product.vendor;
      }

      const totalPrice = price * item.quantity;
      subtotal += totalPrice;
      rawItems.push({ product, variant, vendorId, price, mrp, totalPrice, quantity: item.quantity });

      const vendorSettings = product.vendor.settings || {};
      const now = new Date();
      const commission = await require('../commission/Commission').findOne({
        $or: [
          { type: 'global', isActive: true },
          { type: 'vendor', applicableId: vendorId, isActive: true },
          { type: 'category', applicableId: product.category, isActive: true },
        ],
        $and: [
          { $or: [{ effectiveFrom: { $exists: false } }, { effectiveFrom: null }, { effectiveFrom: { $lte: now } }] },
          { $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }] },
        ]
      }).sort({ priority: -1 });

      const commissionRate = commission ? commission.rate : 0;
      const commissionAmount = (totalPrice * commissionRate) / 100;

      orderItems.push({
        product: product._id,
        variant: variant?._id,
        vendor: vendorId,
        name: product.title,
        image: (variant?.images?.[0] || product.images?.[0])?.url || '',
        sku: variant?.sku || product.variants?.[0]?.sku || '',
        color: variant?.color || '',
        size: variant?.size || '',
        mrp,
        price,
        quantity: item.quantity,
        totalPrice,
        couponDiscount: 0,
        finalPrice: totalPrice,
        commission: commissionAmount,
        commissionRate,
        vendorEarnings: totalPrice - commissionAmount,
        status: 'pending',
        statusHistory: [{ status: 'pending', date: new Date(), note: 'Order placed' }],
      });
    }

    let discount = 0;
    let shippingWaived = false;
    let couponData = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (!coupon) return res.status(400).json({ success: false, message: 'Invalid coupon' });
      if (new Date() < coupon.startDate || new Date() > coupon.endDate) return res.status(400).json({ success: false, message: 'Coupon expired' });
      if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });

      if (coupon.usagePerUser > 0) {
        const userRedemption = coupon.userRedemptions.find(r => r.user.toString() === req.user._id.toString());
        if (userRedemption && userRedemption.count >= coupon.usagePerUser) return res.status(400).json({ success: false, message: 'Coupon usage limit per user reached' });
      }

      if (coupon.isFirstOrderOnly) {
        const existingOrders = await Order.countDocuments({ user: req.user._id });
        if (existingOrders > 0) return res.status(400).json({ success: false, message: 'This coupon is for first order only' });
      }

      if (subtotal < coupon.minAmount) return res.status(400).json({ success: false, message: `Minimum amount ₹${coupon.minAmount} required` });

      if (coupon.applicableOn !== 'all' && coupon.applicableIds.length > 0) {
        const valid = rawItems.some(ri => {
          if (coupon.applicableOn === 'category') return coupon.applicableIds.some(id => id.toString() === (ri.product.category?.toString() || ''));
          if (coupon.applicableOn === 'brand') return coupon.applicableIds.some(id => id.toString() === (ri.product.brand?.toString() || ''));
          if (coupon.applicableOn === 'vendor') return coupon.applicableIds.some(id => id.toString() === (ri.vendorId?.toString() || ''));
          return false;
        });
        if (!valid) return res.status(400).json({ success: false, message: 'Coupon not applicable to items in your order' });
      }

      if (coupon.type === 'free_shipping') {
        shippingWaived = true;
        discount = 0;
      } else if (coupon.type === 'fixed') {
        discount = Math.min(coupon.value, subtotal);
      } else {
        const pct = subtotal * ((coupon.value || 0) / 100);
        discount = coupon.maxDiscount ? Math.min(pct, coupon.maxDiscount) : pct;
      }

      // Distribute coupon proportionally across items
      if (discount > 0 && subtotal > 0) {
        let distributed = 0;
        for (let i = 0; i < orderItems.length; i++) {
          const share = Math.round((orderItems[i].totalPrice / subtotal) * discount);
          const itemShare = i === orderItems.length - 1 ? discount - distributed : share;
          orderItems[i].couponDiscount = itemShare;
          orderItems[i].finalPrice = orderItems[i].totalPrice - itemShare;
          distributed += itemShare;
        }

        // Recalculate commission on finalPrice after coupon distribution
        for (const item of orderItems) {
          item.commission = (item.finalPrice * item.commissionRate) / 100;
          item.vendorEarnings = item.finalPrice - item.commission;
        }
      }

      couponData = { code: coupon.code, discount, couponId: coupon._id };
      coupon.usedCount += 1;
      coupon.totalDiscountGiven = (coupon.totalDiscountGiven || 0) + discount;
      coupon.userRedemptions = coupon.userRedemptions || [];
      const existingRedemption = coupon.userRedemptions.find(r => r.user.toString() === req.user._id.toString());
      if (existingRedemption) {
        existingRedemption.count += 1;
        existingRedemption.lastUsed = new Date();
      } else {
        coupon.userRedemptions.push({ user: req.user._id, count: 1, lastUsed: new Date() });
      }
      if (coupon.redemptions) {
        coupon.redemptions.push({ user: req.user._id, order: null, discount, redeemedAt: new Date() });
      }
      await coupon.save();
    }

    const Commission = require('../commission/Commission');
    const shippingConfig = await Commission.findOne({ type: 'shipping' });
    const shipCharge = shippingConfig?.charge ?? 99;
    const freeThreshold = shippingConfig?.freeThreshold ?? 999;
    const isShippingEnabled = shippingConfig?.isShippingEnabled ?? true;
    const isFreeShippingEnabled = shippingConfig?.isFreeShippingEnabled ?? true;

    let shippingCharge = 0;
    if (!isShippingEnabled) {
      shippingCharge = 0;
    } else if (shippingWaived) {
      shippingCharge = 0;
    } else {
      const afterDiscount = subtotal - discount;
      if (isFreeShippingEnabled && afterDiscount >= freeThreshold) {
        shippingCharge = 0;
      } else {
        shippingCharge = shipCharge;
      }
    }
    const total = subtotal - discount + shippingCharge;

    let paymentStatus = 'pending';
    let transactionId = null;

    if (paymentMethod === 'cod') {
      paymentStatus = 'pending';
    } else if (paymentMethod === 'wallet') {
      const wallet = await Wallet.findOne({ user: req.user._id });
      if (!wallet || wallet.balance < total) {
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
      }
      wallet.balance -= total;
      wallet.totalDebited += total;
      wallet.lastTransactionAt = new Date();
      await wallet.save();
      await WalletTransaction.create({
        wallet: wallet._id, user: req.user._id, type: 'debit', amount: total,
        balanceBefore: wallet.balance + total, balanceAfter: wallet.balance,
        category: 'purchase', description: `Payment for order`,
        referenceModel: 'Order',
      });
      paymentStatus = 'completed';
    }

    const order = await Order.create({
      user: req.user._id,
      orderNumber: generateOrderNumber(),
      items: orderItems,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      payment: { method: paymentMethod, status: paymentStatus, transactionId },
      coupon: couponData,
      subtotal,
      shippingCharge,
      discount,
      total,
      notes,
    });

    if (couponCode && couponData) {
      const coupon = await Coupon.findById(couponData.couponId);
      if (coupon && coupon.redemptions && coupon.redemptions.length > 0) {
        const lastRedemption = coupon.redemptions[coupon.redemptions.length - 1];
        if (lastRedemption && !lastRedemption.order) {
          lastRedemption.order = order._id;
          await coupon.save();
        }
      }
      // Clear coupon from cart
      const cart = await Cart.findOne({ user: req.user._id });
      if (cart) {
        cart.coupon = undefined;
        cart.items.forEach(i => { i.couponDiscount = 0; i.finalPrice = 0; });
        await cart.save();
      }
    }

    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (item.variant) {
        const variant = product.variants.id(item.variant);
        if (variant) {
          variant.stock = Math.max(0, variant.stock - item.quantity);
        }
      }
      product.totalSold += item.quantity;
      await product.save();

      const vendor = await Vendor.findById(item.vendor);
      if (vendor) {
        vendor.totalOrders += 1;
        await vendor.save();
      }
    }

    // Warehouse allocation & stock reservation
    try {
      const city = shippingAddress?.city || '';
      const nearestWarehouses = city ? await Warehouse.find({ isActive: true }).sort({ city: city === '$city' ? 1 : 1 }) : [];
      const pickWarehouse = nearestWarehouses.length > 0 ? nearestWarehouses[0] : null;

      for (const item of orderItems) {
        const product = await Product.findById(item.product);
        if (!product) continue;
        const sku = item.sku || product.variants?.[0]?.sku;
        if (!sku) continue;

        const vendorId = item.vendor;
        const inventories = await Inventory.find({
          vendor: vendorId, product: item.product, variantSku: sku,
          availableStock: { $gte: item.quantity },
        }).sort('-availableStock');

        let assigned = false;
        if (pickWarehouse) {
          const whInv = inventories.find(i => i.warehouse.toString() === pickWarehouse._id.toString());
          if (whInv) {
            const availBefore = whInv.availableStock;
            const resBefore = whInv.reservedStock;
            whInv.availableStock -= item.quantity;
            whInv.reservedStock = (whInv.reservedStock || 0) + item.quantity;
            await whInv.save();
            await InventoryTransaction.create({
              vendor: vendorId, warehouse: whInv.warehouse, product: item.product, variantSku: sku,
              type: 'order', quantity: item.quantity,
              availableBefore: availBefore, availableAfter: whInv.availableStock,
              reservedBefore: resBefore, reservedAfter: whInv.reservedStock,
              referenceId: order._id, referenceModel: 'Order', note: `Order ${order.orderNumber}`,
            });
            assigned = true;
          }
        }
        if (!assigned) {
          const anyInv = inventories[0];
          if (anyInv) {
            const availBefore = anyInv.availableStock;
            const resBefore = anyInv.reservedStock;
            anyInv.availableStock -= item.quantity;
            anyInv.reservedStock = (anyInv.reservedStock || 0) + item.quantity;
            await anyInv.save();
            await InventoryTransaction.create({
              vendor: vendorId, warehouse: anyInv.warehouse, product: item.product, variantSku: sku,
              type: 'order', quantity: item.quantity,
              availableBefore: availBefore, availableAfter: anyInv.availableStock,
              reservedBefore: resBefore, reservedAfter: anyInv.reservedStock,
              referenceId: order._id, referenceModel: 'Order', note: `Order ${order.orderNumber}`,
            });
          }
        }
      }
    } catch (invErr) {
      console.error('Inventory allocation error:', invErr.message);
    }

    // Clear cart after successful order
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { $set: { items: [], coupon: null } },
    );

    res.status(201).json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

const getUserOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;

    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-payment.transactionId');

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      orders,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      }
    });
  } catch (error) {
    next(error);
  }
};

const getOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
      .populate('items.product', 'title slug images isReturnable returnWindow returnPolicy')
      .populate('items.vendor', 'storeName');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (!['pending', 'accepted', 'packed'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled after shipping' });
    }

    order.status = 'cancelled';
    order.cancellation = {
      isRequested: true,
      reason: req.body.reason,
      cancelledAt: new Date(),
      cancelledBy: req.user._id,
    };

    for (const item of order.items) {
      item.status = 'cancelled';
      item.statusHistory.push({ status: 'cancelled', date: new Date(), note: req.body.reason || 'Cancelled by customer', updatedBy: req.user._id });

      const product = await Product.findById(item.product);
      if (product) {
        if (item.variant) {
          const variant = product.variants.id(item.variant);
          if (variant) variant.stock += item.quantity;
        }
        product.totalSold = Math.max(0, product.totalSold - item.quantity);
        await product.save();
      }

      // Release reserved inventory
      const sku = item.sku || product?.variants?.[0]?.sku;
      if (sku) {
        const inventories = await Inventory.find({ product: item.product, variantSku: sku, reservedStock: { $gt: 0 } });
        for (const inv of inventories) {
          const release = Math.min(inv.reservedStock, item.quantity);
          if (release <= 0) continue;
          const resBefore = inv.reservedStock;
          inv.reservedStock -= release;
          inv.availableStock += release;
          await inv.save();
          await InventoryTransaction.create({
            vendor: item.vendor, warehouse: inv.warehouse, product: item.product, variantSku: sku,
            type: 'order_cancel', quantity: release,
            availableBefore: inv.availableStock - release, availableAfter: inv.availableStock,
            reservedBefore: resBefore, reservedAfter: inv.reservedStock,
            referenceId: order._id, referenceModel: 'Order',
            note: `Cancelled ${order.orderNumber}`,
          });
        }
      }

      const v = await Vendor.findById(item.vendor);
      if (v) { v.totalOrders = Math.max(0, v.totalOrders - 1); v.totalRevenue = Math.max(0, v.totalRevenue - item.totalPrice); v.totalEarnings = Math.max(0, v.totalEarnings - (item.vendorEarnings || 0)); await v.save(); }
      try { await require('../settlements/Settlement').findOneAndUpdate({ orderItem: item._id, status: 'pending' }, { status: 'cancelled' }); } catch (e) { /* non-blocking */ }
    }

    if (order.payment.status === 'completed') {
      let wallet = await Wallet.findOne({ user: req.user._id });
      if (!wallet) wallet = await Wallet.create({ user: req.user._id, balance: 0, totalCredited: 0, totalDebited: 0 });
      const balBefore = wallet.balance;
      wallet.balance += order.total;
      wallet.totalCredited += order.total;
      wallet.lastTransactionAt = new Date();
      await wallet.save();
      await WalletTransaction.create({
        wallet: wallet._id, user: req.user._id, type: 'credit', amount: order.total,
        balanceBefore: balBefore, balanceAfter: wallet.balance,
        category: 'refund', description: `Refund for cancelled order #${order.orderNumber}`,
        referenceModel: 'Order', referenceId: order._id,
      });
    }

    await order.save();
    res.json({ success: true, message: 'Order cancelled', order });
  } catch (error) {
    next(error);
  }
};

const Razorpay = require('razorpay');
const crypto = require('crypto');

const createRazorpayOrder = async (req, res, next) => {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(order.total * 100),
      currency: 'INR',
      receipt: `order_${order.orderNumber}`,
      notes: { orderId: order._id.toString(), orderNumber: order.orderNumber },
    });

    order.payment.razorpayOrderId = rzpOrder.id;
    await order.save();

    res.json({
      success: true,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    next(error);
  }
};

const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      order.payment.status = 'failed';
      await order.save();
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    order.payment.status = 'completed';
    order.payment.transactionId = razorpayPaymentId;
    order.payment.razorpayPaymentId = razorpayPaymentId;
    order.payment.razorpaySignature = razorpaySignature;
    order.payment.paidAt = new Date();
    order.status = 'accepted';
    await order.save();

    res.json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

const downloadInvoice = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
      .populate('items.product', 'title')
      .populate('items.vendor', 'storeName');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!order.invoiceNumber) {
      order.invoiceNumber = generateInvoiceNumber();
      await order.save();
    }

    const address = order.shippingAddress || {};
    const invoice = {
      invoiceNumber: order.invoiceNumber,
      createdAt: order.createdAt,
      orderNumber: order.orderNumber,
      user: {
        name: order.user?.name || order.shippingAddress?.fullName || '',
        email: order.user?.email || '',
        phone: order.user?.phone || order.shippingAddress?.phone || '',
      },
      shippingAddress: {
        addressLine1: address.address || address.addressLine1 || '',
        city: address.city || '',
        state: address.state || '',
        pincode: address.pincode || '',
      },
      items: order.items.map(i => ({
        name: i.productName || i.name || (i.product?.title) || '',
        sku: i.sku || '',
        quantity: i.quantity || 1,
        price: i.price || 0,
        totalPrice: i.totalPrice || 0,
      })),
      subtotal: order.subtotal || 0,
      shippingCharge: order.shippingCharge || 0,
      discount: order.discount || 0,
      tax: order.tax || 0,
      total: order.total || 0,
    };
    res.json({ success: true, invoice });
  } catch (error) {
    next(error);
  }
};

const adminDownloadInvoice = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'title')
      .populate('items.vendor', 'storeName')
      .populate('user', 'name email phone');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!order.invoiceNumber) {
      order.invoiceNumber = generateInvoiceNumber();
      await order.save();
    }
    const address = order.shippingAddress || {};
    const invoice = {
      invoiceNumber: order.invoiceNumber,
      createdAt: order.createdAt,
      orderNumber: order.orderNumber,
      user: { name: order.user?.name || '', email: order.user?.email || '', phone: order.user?.phone || '' },
      shippingAddress: { addressLine1: address.address || address.addressLine1 || '', city: address.city || '', state: address.state || '', pincode: address.pincode || '' },
      items: order.items.map(i => ({
        name: i.productName || i.name || (i.product?.title) || '', sku: i.sku || '',
        quantity: i.quantity || 1, price: i.price || 0, totalPrice: i.totalPrice || 0,
      })),
      subtotal: order.subtotal || 0, shippingCharge: order.shippingCharge || 0,
      discount: order.discount || 0, tax: order.tax || 0, total: order.total || 0,
    };
    res.json({ success: true, invoice });
  } catch (error) { next(error); }
};

const trackOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
      .select('orderNumber status items.status items.statusHistory estimatedDelivery createdAt');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, tracking: order });
  } catch (error) {
    next(error);
  }
};

const settleOrder = async (req, res, next) => {
  try {
    const { days } = req.query;
    const returnDays = parseInt(days) || 7;
    const cutoff = new Date(Date.now() - returnDays * 24 * 60 * 60 * 1000);

    const orders = await Order.find({
      status: 'delivered',
      deliveredAt: { $lte: cutoff },
      paymentSettled: { $ne: true },
    }).populate('items.vendor');

    const Settlement = require('../settlements/Settlement');
    let settled = 0;
    for (const order of orders) {
      for (const item of order.items) {
        if (item.status !== 'delivered' || item.vendorEarnings <= 0) continue;
        const vendorDoc = item.vendor;
        if (!vendorDoc || !vendorDoc.user) continue;

        // Skip if already settled via Settlement model
        const existingSettlement = await Settlement.findOne({ order: order._id, orderItem: item._id, status: 'released' });
        if (existingSettlement) continue;

        let wallet = await Wallet.findOne({ user: vendorDoc.user });
        if (!wallet) continue;

        wallet.balance += item.vendorEarnings;
        wallet.totalCredited += item.vendorEarnings;
        wallet.lastTransactionAt = new Date();
        await wallet.save();

        await WalletTransaction.create({
          wallet: wallet._id, user: vendorDoc.user, type: 'credit', amount: item.vendorEarnings,
          balanceBefore: wallet.balance - item.vendorEarnings, balanceAfter: wallet.balance,
          category: 'commission',
          description: `Settlement for order #${order.orderNumber} item "${item.name}"`,
          referenceModel: 'Order', referenceId: order._id,
        });

        item.paymentSettled = true;
        item.settlementDate = new Date();
      }

      const allSettled = order.items.every(i => i.paymentSettled);
      if (allSettled) {
        order.status = 'settled';
        order.paymentSettled = true;
        order.settlementDate = new Date();
        order.settledAt = new Date();
      }
      await order.save();
      settled++;
    }

    res.json({ success: true, message: `${settled} orders settled`, settled });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder, getUserOrders, getOrder, cancelOrder, downloadInvoice, adminDownloadInvoice,
  createRazorpayOrder, verifyRazorpayPayment, trackOrder, settleOrder,
};
