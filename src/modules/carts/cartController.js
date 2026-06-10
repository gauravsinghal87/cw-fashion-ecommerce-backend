const Cart = require('../carts/Cart');
const Product = require('../products/Product');
const Coupon = require('../coupons/Coupon');
const Order = require('../orders/Order');

const addShippingInfo = async (cart) => {
  const Commission = require('../commission/Commission');
  const shippingConfig = await Commission.findOne({ type: 'shipping' });
  const charge = shippingConfig?.charge ?? 99;
  const freeThreshold = shippingConfig?.freeThreshold ?? 999;
  const isShippingEnabled = shippingConfig?.isShippingEnabled ?? true;
  const isFreeShippingEnabled = shippingConfig?.isFreeShippingEnabled ?? true;
  const subtotal = cart.items.reduce((s, i) => s + (i.totalPrice || 0), 0);
  const discount = cart.coupon?.discount || 0;
  const shippingWaived = cart.coupon?.shippingWaived || false;

  let estimatedShipping = 0;
  if (!isShippingEnabled) {
    estimatedShipping = 0;
  } else if (shippingWaived) {
    estimatedShipping = 0;
  } else {
    const afterDiscount = Math.max(0, subtotal - discount);
    if (isFreeShippingEnabled && afterDiscount >= freeThreshold) {
      estimatedShipping = 0;
    } else {
      estimatedShipping = charge;
    }
  }

  const remainingForFree = isFreeShippingEnabled && estimatedShipping > 0
    ? Math.max(0, freeThreshold - Math.max(0, subtotal - discount))
    : 0;

  return {
    charge,
    freeThreshold,
    isShippingEnabled,
    isFreeShippingEnabled,
    estimatedShipping,
    remainingForFree,
    subtotal,
    discount,
    total: subtotal - discount + estimatedShipping,
  };
};

const getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'title slug minPrice maxPrice images status isActive vendor isReturnable returnWindow returnPolicy category brand isFlashSale flashSalePrice variants')
      .populate('items.vendor', 'storeName');

    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    // Backfill missing color/size/sku for items added before schema change
    let needsSave = false;
    for (const item of cart.items) {
      if ((!item.color || !item.size) && item.variant && item.product) {
        const prod = item.product;
        if (prod.variants && prod.variants.length > 0) {
          const v = prod.variants.id(item.variant);
          if (v) {
            if (!item.color && v.color) { item.color = v.color; needsSave = true; }
            if (!item.size && v.size) { item.size = v.size; needsSave = true; }
            if (!item.sku && v.sku) { item.sku = v.sku; needsSave = true; }
          }
        }
      }
    }
    if (needsSave) await cart.save();

    const shippingInfo = await addShippingInfo(cart);
    const cartObj = cart.toObject();
    cartObj.shippingInfo = shippingInfo;

    res.json({ success: true, cart: cartObj });
  } catch (error) {
    next(error);
  }
};

const addToCart = async (req, res, next) => {
  try {
    const { productId, variantId, quantity = 1 } = req.body;
    const product = await Product.findById(productId);
    if (!product || !product.isActive || product.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Product not available' });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    const existingIndex = cart.items.findIndex(
      i => i.product.toString() === productId && (!variantId || i.variant?.toString() === variantId)
    );

    const variant = variantId ? product.variants.id(variantId) : null;
    if (variantId && !variant) {
      return res.status(400).json({ success: false, message: 'Variant not found' });
    }

    const variantStock = variant ? variant.stock ?? 0 : product.totalStock ?? 0;
    const requestedQty = existingIndex >= 0 ? cart.items[existingIndex].quantity + quantity : quantity;
    if (requestedQty > variantStock) {
      return res.status(400).json({ success: false, message: `Only ${variantStock} unit${variantStock > 1 ? 's' : ''} available` });
    }
    if (requestedQty > 10) {
      return res.status(400).json({ success: false, message: 'Max 10 units per product' });
    }

    const effectivePrice = (product.isFlashSale && product.flashSalePrice) ? product.flashSalePrice : (variant?.price || product.minPrice);

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity = requestedQty;
      cart.items[existingIndex].totalPrice = cart.items[existingIndex].price * requestedQty;
    } else {
      cart.items.push({
        product: productId,
        variant: variantId || null,
        vendor: product.vendor,
        name: product.title,
        image: (variant?.images?.[0] || product.images?.[0])?.url || '',
        price: effectivePrice,
        mrp: variant?.mrp || product.maxPrice,
        quantity,
        totalPrice: effectivePrice * quantity,
        couponDiscount: 0,
        finalPrice: effectivePrice * quantity,
        color: variant?.color || '',
        size: variant?.size || '',
        sku: variant?.sku || '',
      });
      await Product.findByIdAndUpdate(productId, { $inc: { cartCount: 1 } });
    }

    if (cart.coupon?.code) {
      await recalculateCoupon(cart);
    }

    await cart.save();
    await cart.populate('items.product', 'title slug minPrice maxPrice images status isActive vendor isReturnable returnWindow returnPolicy isFlashSale flashSalePrice');
    await cart.populate('items.vendor', 'storeName');

    res.json({ success: true, cart });
  } catch (error) {
    next(error);
  }
};

const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (quantity > 10) return res.status(400).json({ success: false, message: 'Max 10 units per product' });
    if (quantity < 1) return res.status(400).json({ success: false, message: 'Min 1 unit required' });

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    const item = cart.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found in cart' });

    item.quantity = quantity;
    item.totalPrice = item.price * quantity;

    if (cart.coupon?.code) {
      await recalculateCoupon(cart);
    }

    await cart.save();
    res.json({ success: true, cart });
  } catch (error) {
    next(error);
  }
};

const removeFromCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    const item = cart.items.id(req.params.itemId);
    if (item) {
      await Product.findByIdAndUpdate(item.product, { $inc: { cartCount: -1 } });
    }
    cart.items.pull(req.params.itemId);

    if (cart.coupon?.code) {
      if (cart.items.length === 0) {
        cart.coupon = undefined;
      } else {
        await recalculateCoupon(cart);
      }
    }

    await cart.save();
    res.json({ success: true, cart });
  } catch (error) {
    next(error);
  }
};

const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      for (const item of cart.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { cartCount: -1 } });
      }
      cart.items = [];
      cart.coupon = undefined;
      await cart.save();
    }
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    next(error);
  }
};

const recalculateCoupon = async (cart) => {
  const coupon = await Coupon.findById(cart.coupon.couponId);
  if (!coupon || !coupon.isActive) {
    cart.coupon = undefined;
    cart.items.forEach(i => { i.couponDiscount = 0; i.finalPrice = i.totalPrice; });
    return;
  }

  if (new Date() < coupon.startDate || new Date() > coupon.endDate) {
    cart.coupon = undefined;
    cart.items.forEach(i => { i.couponDiscount = 0; i.finalPrice = i.totalPrice; });
    return;
  }

  const subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
  const totalDiscount = calculateDiscountAmount(coupon, subtotal);

  cart.coupon.discount = totalDiscount;
  cart.coupon.shippingWaived = coupon.type === 'free_shipping' || coupon.shippingWaived;

  distributeCouponProportionally(cart.items, totalDiscount, subtotal);
};

const calculateDiscountAmount = (coupon, subtotal) => {
  if (coupon.type === 'free_shipping') return 0;
  if (coupon.type === 'fixed') return Math.min(coupon.value || 0, subtotal);
  if (coupon.type === 'percentage' || coupon.type === 'new_user') {
    const pct = subtotal * ((coupon.value || 0) / 100);
    return coupon.maxDiscount ? Math.min(pct, coupon.maxDiscount) : pct;
  }
  return 0;
};

const distributeCouponProportionally = (items, totalDiscount, subtotal) => {
  if (totalDiscount <= 0 || subtotal <= 0) {
    items.forEach(i => { i.couponDiscount = 0; i.finalPrice = i.totalPrice; });
    return;
  }

  let distributed = 0;
  for (let i = 0; i < items.length; i++) {
    const share = Math.round((items[i].totalPrice / subtotal) * totalDiscount);
    const itemShare = i === items.length - 1 ? totalDiscount - distributed : share;
    items[i].couponDiscount = itemShare;
    items[i].finalPrice = items[i].totalPrice - itemShare;
    distributed += itemShare;
  }
};

const applyCoupon = async (req, res, next) => {
  try {
    const { code } = req.body;
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) return res.status(400).json({ success: false, message: 'Invalid coupon code' });
    if (new Date() < coupon.startDate || new Date() > coupon.endDate) {
      return res.status(400).json({ success: false, message: 'Coupon has expired' });
    }
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
    }

    if (coupon.usagePerUser > 0) {
      const userRedemption = coupon.userRedemptions.find(r => r.user.toString() === req.user._id.toString());
      if (userRedemption && userRedemption.count >= coupon.usagePerUser) {
        return res.status(400).json({ success: false, message: 'You have already used this coupon the maximum number of times' });
      }
    }

    if (coupon.isFirstOrderOnly) {
      const existingOrders = await Order.countDocuments({ user: req.user._id });
      if (existingOrders > 0) {
        return res.status(400).json({ success: false, message: 'This coupon is for first order only' });
      }
    }

    const subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);

    if (coupon.minAmount > 0 && subtotal < coupon.minAmount) {
      return res.status(400).json({ success: false, message: `Minimum order amount ₹${coupon.minAmount} required` });
    }

    // Check category/brand restrictions
    if (coupon.applicableOn !== 'all' && coupon.applicableIds.length > 0) {
      const populatedCart = await cart.populate('items.product');
      const isValid = cart.items.some(item => {
        const prod = item.product;
        if (!prod) return false;
        if (coupon.applicableOn === 'category') {
          return coupon.applicableIds.some(id => id.toString() === (prod.category?.toString() || ''));
        }
        if (coupon.applicableOn === 'brand') {
          return coupon.applicableIds.some(id => id.toString() === (prod.brand?.toString() || ''));
        }
        if (coupon.applicableOn === 'vendor') {
          return coupon.applicableIds.some(id => id.toString() === (item.vendor?.toString() || ''));
        }
        if (coupon.applicableOn === 'product') {
          return coupon.applicableIds.some(id => id.toString() === (prod._id?.toString() || ''));
        }
        return false;
      });
      if (!isValid) {
        return res.status(400).json({ success: false, message: 'Coupon not applicable to items in your cart' });
      }
    }

    const totalDiscount = calculateDiscountAmount(coupon, subtotal);

    cart.coupon = {
      code: coupon.code,
      discount: totalDiscount,
      couponId: coupon._id,
      shippingWaived: coupon.type === 'free_shipping' || coupon.shippingWaived,
    };

    distributeCouponProportionally(cart.items, totalDiscount, subtotal);

    await cart.save();
    await cart.populate('items.product', 'title slug minPrice maxPrice images status isActive vendor isReturnable returnWindow returnPolicy isFlashSale flashSalePrice');
    await cart.populate('items.vendor', 'storeName');

    res.json({ success: true, cart, discount: totalDiscount });
  } catch (error) {
    next(error);
  }
};

const removeCoupon = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.coupon = undefined;
      cart.items.forEach(i => { i.couponDiscount = 0; i.finalPrice = i.totalPrice || (i.effectivePrice || i.price || 0) * i.quantity; });
      await cart.save();
    }
    res.json({ success: true, message: 'Coupon removed' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeFromCart, clearCart, applyCoupon, removeCoupon };
