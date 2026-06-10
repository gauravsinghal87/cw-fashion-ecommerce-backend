const jwt = require('jsonwebtoken');
const User = require('../../modules/users/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password -refreshToken');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (!req.user.isActive) {
      return res.status(401).json({ success: false, message: 'Account deactivated' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this action' });
    }
    next();
  };
};

const checkPermission = (resource, action) => {
  return async (req, res, next) => {
    if (req.user.role === 'admin') return next();
    if (req.user.role === 'subadmin') {
      const Role = require('../../modules/subadmins/Role');
      const role = await Role.findOne({ _id: req.user.roleId, isActive: true });
      if (!role || !role.permissions?.[resource]?.[action]) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }
    }
    next();
  };
};

module.exports = { protect, authorize, checkPermission };
