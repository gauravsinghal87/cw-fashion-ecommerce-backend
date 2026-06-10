const express = require('express');
const router = express.Router();
const { protect } = require('../../shared/middleware/auth');
const validate = require('../../shared/middleware/validation');
const { registerValidator, loginValidator, forgotPasswordValidator, resetPasswordValidator, changePasswordValidator } = require('./validators');
const {
  register,
  login,
  logout,
  refreshToken,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  getMe,
  updatePassword,
  socialLogin,
} = require('../auth/authController');

router.post('/register', registerValidator, validate, register);
router.post('/login', loginValidator, validate, login);
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPasswordValidator, validate, forgotPassword);
router.post('/reset-password', resetPasswordValidator, validate, resetPassword);
router.post('/social-login', socialLogin);
router.get('/me', protect, getMe);
router.put('/update-password', protect, changePasswordValidator, validate, updatePassword);

module.exports = router;
