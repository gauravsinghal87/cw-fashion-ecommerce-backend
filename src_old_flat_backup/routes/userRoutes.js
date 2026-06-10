const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { profileUpdateValidator, addressValidator } = require('../middleware/validators');
const {
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  deleteAccount,
} = require('../controllers/userController');

router.put('/profile', protect, profileUpdateValidator, validate, updateProfile);
router.get('/addresses', protect, getAddresses);
router.post('/addresses', protect, addressValidator, validate, addAddress);
router.put('/addresses/:addressId', protect, addressValidator, validate, updateAddress);
router.delete('/addresses/:addressId', protect, deleteAddress);
router.put('/addresses/:addressId/default', protect, setDefaultAddress);
router.get('/wishlist', protect, getWishlist);
router.post('/wishlist/:productId', protect, addToWishlist);
router.delete('/wishlist/:productId', protect, removeFromWishlist);
router.delete('/wishlist', protect, clearWishlist);
router.delete('/account', protect, deleteAccount);

module.exports = router;
