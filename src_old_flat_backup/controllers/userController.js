const User = require('../models/User');
const Product = require('../models/Product');

const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, gender, dob, avatar } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (gender !== undefined) user.gender = gender;
    if (dob) user.dob = dob;
    if (avatar) user.avatar = avatar;

    await user.save();
    res.json({ success: true, message: 'Profile updated', user });
  } catch (error) {
    next(error);
  }
};

const getAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

const addAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const address = req.body;

    if (address.isDefault || user.addresses.length === 0) {
      user.addresses.forEach(a => a.isDefault = false);
      address.isDefault = true;
    }

    user.addresses.push(address);
    await user.save();

    res.status(201).json({ success: true, addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

const updateAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);

    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    Object.assign(address, req.body);

    if (req.body.isDefault) {
      user.addresses.forEach(a => a.isDefault = false);
      address.isDefault = true;
    }

    await user.save();
    res.json({ success: true, addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

const deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);

    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    const wasDefault = address.isDefault;
    address.deleteOne();

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    res.json({ success: true, addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

const setDefaultAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);

    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    user.addresses.forEach(a => a.isDefault = false);
    address.isDefault = true;
    await user.save();

    res.json({ success: true, addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

const getWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'wishlist',
      select: 'title slug minPrice maxPrice images rating numRatings status vendor',
      match: { isActive: true, status: 'approved' },
    });
    res.json({ success: true, wishlist: user.wishlist || [] });
  } catch (error) {
    next(error);
  }
};

const addToWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.wishlist.includes(req.params.productId)) {
      user.wishlist.push(req.params.productId);
      await user.save();
      await Product.findByIdAndUpdate(req.params.productId, { $inc: { wishlistCount: 1 } });
    }
    res.json({ success: true, wishlist: user.wishlist });
  } catch (error) {
    next(error);
  }
};

const removeFromWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    user.wishlist.pull(req.params.productId);
    await user.save();
    await Product.findByIdAndUpdate(req.params.productId, { $inc: { wishlistCount: -1 } });
    res.json({ success: true, wishlist: user.wishlist });
  } catch (error) {
    next(error);
  }
};

const clearWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const productIds = user.wishlist.map(id => id.toString());
    user.wishlist = [];
    await user.save();
    if (productIds.length > 0) {
      await Product.updateMany({ _id: { $in: productIds } }, { $inc: { wishlistCount: -1 } });
    }
    res.json({ success: true, message: 'Wishlist cleared' });
  } catch (error) { next(error); }
};

const deleteAccount = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false });
    res.json({ success: true, message: 'Account deactivated' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateProfile, getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress,
  getWishlist, addToWishlist, removeFromWishlist, clearWishlist, deleteAccount,
};
