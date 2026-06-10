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

module.exports = { authorize, checkPermission };