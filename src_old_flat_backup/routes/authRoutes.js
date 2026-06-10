const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { registerValidator, loginValidator, forgotPasswordValidator, resetPasswordValidator, changePasswordValidator } = require('../middleware/validators');
const {
  register,
  login,
  logout,
  refreshToken,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  enableTwoFactor,
  verifyTwoFactor,
  disableTwoFactor,
  getMe,
  updatePassword,
  socialLogin,
} = require('../controllers/authController');

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
router.post('/enable-2fa', protect, enableTwoFactor);
router.post('/verify-2fa', protect, verifyTwoFactor);
router.post('/disable-2fa', protect, disableTwoFactor);

module.exports = router;
