const User = require('../models/User');
const Wallet = require('../models/Wallet').Wallet;
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../utils/generateToken');
const { sendOTPEmail, sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/emailService');
const crypto = require('crypto');

const Referral = require('../models/Referral');

const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, referralCode } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Fraud detection: same phone
    if (phone) {
      const phoneUser = await User.findOne({ phone });
      if (phoneUser) {
        return res.status(400).json({ success: false, message: 'Phone number already registered' });
      }
    }

    const user = await User.create({ name, email, password, phone });
    user.generateReferralCode();
    await user.save();

    let fraudFlags = [];

    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer && !referrer._id.equals(user._id)) {
        user.referredBy = referrer._id;
        await user.save();

        // Fraud detection: multiple referrals from same IP
        const ip = req.ip || req.connection?.remoteAddress;
        const sameIpReferrals = await Referral.countDocuments({
          referrer: referrer._id,
          ipAddress: ip,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        if (sameIpReferrals > 5) {
          fraudFlags.push('Multiple referrals from same IP');
        }

        await Referral.create({
          referrer: referrer._id,
          referred: user._id,
          referralCode,
          ipAddress: ip,
          isFraud: fraudFlags.length > 0,
          fraudReason: fraudFlags.length > 0 ? fraudFlags.join('; ') : undefined,
        });
      }
    }

    await Wallet.create({ user: user._id });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerificationToken = crypto.createHash('sha256').update(otp).digest('hex');
    user.emailVerificationExpire = Date.now() + 10 * 60 * 1000;
    user.emailVerificationSentAt = Date.now();
    await user.save();

    await sendOTPEmail(email, otp);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ success: false, message: `Account locked. Try again in ${remaining} minutes` });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 30 * 60 * 1000;
        user.loginAttempts = 0;
      }
      await user.save();
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

    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = Date.now();

    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);
    user.refreshToken = refreshToken;

    if (req.headers['user-agent']) {
      user.sessions.push({
        token,
        device: req.headers['user-agent'],
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        lastActivity: Date.now(),
      });
    }

    await user.save();

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      phone: user.phone,
      avatar: user.avatar,
      addresses: user.addresses,
      referralCode: user.referralCode,
      roleId: user.roleId || null,
    };

    if (user.role === 'subadmin' && user.roleId) {
      const Role = require('../models/Role');
      const role = await Role.findById(user.roleId);
      if (role) {
        const raw = role.permissions?.toObject ? role.permissions.toObject() : (role.permissions || {});
        const flat = {};
        for (const [resource, actions] of Object.entries(raw)) {
          if (typeof actions === 'object' && actions !== null) {
            for (const [action, val] of Object.entries(actions)) {
              flat[`${resource}.${action}`] = val;
            }
          } else {
            flat[resource] = actions;
          }
        }
        userResponse.rolePermissions = flat;
      }
    }

    res.json({
      success: true,
      message: 'Login successful',
      token,
      refreshToken,
      user: userResponse,
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      try {
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) {
          user.refreshToken = null;
          user.sessions = [];
          await user.save();
        }
      } catch (_) {}
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const newToken = generateToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id, user.role);
    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({ success: true, token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
    return next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email }).select('+emailVerificationToken +emailVerificationExpire');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
    if (hashedOTP !== user.emailVerificationToken || user.emailVerificationExpire < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    await sendWelcomeEmail(email, user.name);

    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true, message: 'Email verified successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    next(error);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.isEmailVerified) {
      return res.json({ success: true, message: 'Email already verified' });
    }

    // Cooldown check: must wait 60s since last send
    const COOLDOWN_SECONDS = 60;
    const EXTEND_MINUTES = 5;
    if (user.emailVerificationSentAt) {
      const elapsed = (Date.now() - new Date(user.emailVerificationSentAt).getTime()) / 1000;
      if (elapsed < COOLDOWN_SECONDS) {
        const remaining = Math.ceil(COOLDOWN_SECONDS - elapsed);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remaining} second${remaining > 1 ? 's' : ''} before resending`,
          cooldownSeconds: remaining,
        });
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerificationToken = crypto.createHash('sha256').update(otp).digest('hex');
    user.emailVerificationExpire = Date.now() + EXTEND_MINUTES * 60 * 1000;
    user.emailVerificationSentAt = Date.now();
    await user.save();

    await sendOTPEmail(email, otp);
    res.json({ success: true, message: 'Verification OTP resent' });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordToken = crypto.createHash('sha256').update(otp).digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendOTPEmail(email, otp);

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
    }

    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
    const user = await User.findOne({
      email,
      resetPasswordToken: hashedOTP,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpire');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-sessions');
    const userObj = user.toObject();
    if (user.role === 'subadmin' && user.roleId) {
      const Role = require('../models/Role');
      const role = await Role.findById(user.roleId);
      if (role) {
        const raw = role.permissions?.toObject ? role.permissions.toObject() : (role.permissions || {});
        const flat = {};
        for (const [resource, actions] of Object.entries(raw)) {
          if (typeof actions === 'object' && actions !== null) {
            for (const [action, val] of Object.entries(actions)) {
              flat[`${resource}.${action}`] = val;
            }
          } else {
            flat[resource] = actions;
          }
        }
        userObj.rolePermissions = flat;
      }
    }
    res.json({ success: true, user: userObj });
  } catch (error) {
    next(error);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+password');
    const { currentPassword, newPassword } = req.body;

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};

const enableTwoFactor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+twoFactorSecret');
    const speakeasy = require('speakeasy');
    const secret = speakeasy.generateSecret({ length: 20 });
    user.twoFactorSecret = secret.base32;
    user.twoFactorEnabled = true;
    await user.save();

    res.json({
      success: true,
      secret: secret.base32,
      otpauth_url: secret.otpauth_url,
    });
  } catch (error) {
    next(error);
  }
};

const verifyTwoFactor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+twoFactorSecret');
    const speakeasy = require('speakeasy');
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: req.body.token,
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid 2FA token' });
    }

    res.json({ success: true, message: '2FA verified' });
  } catch (error) {
    next(error);
  }
};

const disableTwoFactor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+twoFactorSecret');
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();
    res.json({ success: true, message: '2FA disabled' });
  } catch (error) {
    next(error);
  }
};

const socialLogin = async (req, res, next) => {
  try {
    const { provider, providerId, email, name, avatar } = req.body;
    let user = await User.findOne({ email });

    if (!user) {
      const password = crypto.randomBytes(20).toString('hex');
      user = await User.create({ name, email, password, isEmailVerified: true });
      user.generateReferralCode();
      await user.save();
      await require('../models/Wallet').Wallet.create({ user: user._id });
    }

    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true,
      token,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register, login, logout, refreshToken, verifyEmail, resendVerification,
  forgotPassword, resetPassword, getMe, updatePassword,
  enableTwoFactor, verifyTwoFactor, disableTwoFactor, socialLogin,
};
