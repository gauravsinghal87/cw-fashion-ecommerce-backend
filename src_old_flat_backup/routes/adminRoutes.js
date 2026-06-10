const express = require('express');
const router = express.Router();
const { protect, authorize, checkPermission } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { couponValidator, categoryValidator, brandValidator } = require('../middleware/validators');
const {
  getDashboard, getUsers, getUser, toggleUserStatus, banUser, getUserOrders, adminResetPassword, impersonateUser, adjustWallet,
  getVendors, getVendor, approveVendor, rejectVendor, suspendVendor, banVendor, updateVendorDetails,
  getProducts, approveProduct, rejectProduct,
  hideProduct, unhideProduct, toggleFeaturedProduct, setFlashSale, removeFlashSale, toggleProductReturnable,
  getOrders, getOrder, cancelOrder, forceDeliverOrder, forceRefundOrder,
  getReturns, getWithdrawals,
  getCategories, createCategory, updateCategory, deleteCategory,
  getBrands, createBrand, updateBrand, deleteBrand,
  getBanners, getCMS, updateCMS, deleteCMSPage,
  getNotifications, sendNotification,
  getRevenueReport, getVendorReport, getProductReport, getReferralReport, getOrderReport,
  getCommissionSettings, updateCommissionSettings,
  getAuditLogs,
  createSubAdmin, getSubAdmins, updateSubAdmin, deleteSubAdmin,
  getRoles, createRole, updateRole, deleteRole,
  getSEOSettings, updateSEOSettings,
  getShippingSettings, updateShippingSettings,
  getReferralSettings, updateReferralSettings,
  getWalletTransactions, getReturnSettings, updateReturnSettings,
  createCoupon, getCoupons, updateCoupon, deleteCoupon,
  getReferrals, flagReferralFraud, getInventoryInspector,
} = require('../controllers/adminController');
const { approveWithdrawal, rejectWithdrawal, holdWithdrawal } = require('../controllers/withdrawalController');
const { getCouponAnalytics } = require('../controllers/couponController');
const { reverseReferralReward } = require('../controllers/referralController');
const { releaseSettlements, getAllSettlements } = require('../controllers/settlementController');
const { settleOrder, adminDownloadInvoice } = require('../controllers/orderController');
const { createCMSPage } = require('../controllers/cmsController');
const {
  approveReturn, rejectReturn, processRefund,
  getReturnDetail, schedulePickup, confirmPickup, receiveReturn,
  qcPass, qcFail, resolveDispute,
} = require('../controllers/returnController');
const { createBanner: bannerCreate, updateBanner: bannerUpdate, deleteBanner: bannerDelete } = require('../controllers/bannerController');

const a = [protect, authorize('admin', 'subadmin')];

router.get('/dashboard', ...a, checkPermission('dashboard', 'view'), getDashboard);
router.get('/users', ...a, checkPermission('users', 'view'), getUsers);
router.get('/users/:id', ...a, checkPermission('users', 'view'), getUser);
router.put('/users/:id/toggle-status', ...a, checkPermission('users', 'suspend'), toggleUserStatus);
router.put('/users/:id/ban', ...a, checkPermission('users', 'ban'), banUser);
router.get('/users/:userId/orders', ...a, checkPermission('users', 'view'), getUserOrders);
router.put('/users/:id/reset-password', ...a, checkPermission('users', 'suspend'), adminResetPassword);
router.get('/users/:id/impersonate', protect, authorize('admin'), impersonateUser);
router.post('/users/:userId/wallet/adjust', ...a, checkPermission('users', 'wallet'), adjustWallet);

router.get('/vendors', ...a, checkPermission('vendors', 'view'), getVendors);
router.get('/vendors/:vendorId', ...a, checkPermission('vendors', 'view'), getVendor);
router.put('/vendors/:vendorId/approve', ...a, checkPermission('vendors', 'approve'), approveVendor);
router.put('/vendors/:vendorId/reject', ...a, checkPermission('vendors', 'approve'), rejectVendor);
router.put('/vendors/:vendorId/suspend', ...a, checkPermission('vendors', 'suspend'), suspendVendor);
router.put('/vendors/:vendorId/ban', ...a, checkPermission('vendors', 'ban'), banVendor);
router.put('/vendors/:vendorId', ...a, checkPermission('vendors', 'edit'), updateVendorDetails);

router.get('/products', ...a, checkPermission('products', 'view'), getProducts);
router.put('/products/:productId/approve', ...a, checkPermission('products', 'approve'), approveProduct);
router.put('/products/:productId/reject', ...a, checkPermission('products', 'approve'), rejectProduct);
router.put('/products/:productId/hide', ...a, checkPermission('products', 'delete'), hideProduct);
router.put('/products/:productId/unhide', ...a, checkPermission('products', 'delete'), unhideProduct);
router.put('/products/:productId/toggle-featured', ...a, checkPermission('products', 'edit'), toggleFeaturedProduct);
router.put('/products/:productId/flash-sale', ...a, checkPermission('products', 'edit'), setFlashSale);
router.delete('/products/:productId/flash-sale', ...a, checkPermission('products', 'edit'), removeFlashSale);
router.put('/products/:productId/toggle-returnable', ...a, checkPermission('products', 'edit'), toggleProductReturnable);

router.get('/orders', ...a, checkPermission('orders', 'view'), getOrders);
router.get('/orders/:orderId', ...a, checkPermission('orders', 'view'), getOrder);
router.put('/orders/:orderId/cancel', ...a, checkPermission('orders', 'cancel'), cancelOrder);
router.put('/orders/:orderId/force-deliver', ...a, checkPermission('orders', 'forceDeliver'), forceDeliverOrder);
router.put('/orders/:orderId/force-refund', ...a, checkPermission('orders', 'refund'), forceRefundOrder);
router.get('/orders/:orderId/invoice', ...a, checkPermission('orders', 'view'), adminDownloadInvoice);
router.post('/orders/settle', ...a, checkPermission('settlements', 'release'), settleOrder);
router.get('/settlements', ...a, checkPermission('settlements', 'view'), getAllSettlements);
router.post('/settlements/release', ...a, checkPermission('settlements', 'release'), releaseSettlements);

router.get('/returns', ...a, checkPermission('returns', 'view'), getReturns);
router.get('/returns/:id', ...a, checkPermission('returns', 'view'), getReturnDetail);
router.put('/returns/:id/approve', ...a, checkPermission('returns', 'approve'), approveReturn);
router.put('/returns/:id/reject', ...a, checkPermission('returns', 'reject'), rejectReturn);
router.put('/returns/:id/schedule-pickup', ...a, checkPermission('returns', 'approve'), schedulePickup);
router.put('/returns/:id/confirm-pickup', ...a, checkPermission('returns', 'approve'), confirmPickup);
router.put('/returns/:id/receive', ...a, checkPermission('returns', 'approve'), receiveReturn);
router.put('/returns/:id/qc-pass', ...a, checkPermission('returns', 'approve'), qcPass);
router.put('/returns/:id/qc-fail', ...a, checkPermission('returns', 'approve'), qcFail);
router.put('/returns/:id/refund', ...a, checkPermission('returns', 'refund'), processRefund);
router.put('/returns/:id/resolve-dispute', ...a, checkPermission('returns', 'approve'), resolveDispute);

router.get('/withdrawals', ...a, checkPermission('withdrawals', 'view'), getWithdrawals);
router.put('/withdrawals/:id/approve', ...a, checkPermission('withdrawals', 'approve'), approveWithdrawal);
router.put('/withdrawals/:id/reject', ...a, checkPermission('withdrawals', 'approve'), rejectWithdrawal);
router.put('/withdrawals/:id/hold', ...a, checkPermission('withdrawals', 'approve'), holdWithdrawal);

router.get('/coupons', ...a, checkPermission('coupons', 'view'), getCoupons);
router.get('/coupons/analytics', ...a, checkPermission('coupons', 'view'), getCouponAnalytics);
router.post('/coupons', ...a, checkPermission('coupons', 'create'), couponValidator, validate, createCoupon);
router.put('/coupons/:id', ...a, checkPermission('coupons', 'edit'), updateCoupon);
router.delete('/coupons/:id', ...a, checkPermission('coupons', 'delete'), deleteCoupon);

router.get('/categories', ...a, checkPermission('categories', 'view'), getCategories);
router.post('/categories', ...a, checkPermission('categories', 'manage'), categoryValidator, validate, createCategory);
router.put('/categories/:id', ...a, checkPermission('categories', 'manage'), updateCategory);
router.delete('/categories/:id', ...a, checkPermission('categories', 'manage'), deleteCategory);

router.get('/brands', ...a, checkPermission('brands', 'view'), getBrands);
router.post('/brands', ...a, checkPermission('brands', 'manage'), brandValidator, validate, createBrand);
router.put('/brands/:id', ...a, checkPermission('brands', 'manage'), updateBrand);
router.delete('/brands/:id', ...a, checkPermission('brands', 'manage'), deleteBrand);

router.get('/banners', ...a, checkPermission('banners', 'view'), getBanners);
router.post('/banners', ...a, checkPermission('banners', 'manage'), bannerCreate);
router.put('/banners/:id', ...a, checkPermission('banners', 'manage'), bannerUpdate);
router.delete('/banners/:id', ...a, checkPermission('banners', 'manage'), bannerDelete);

router.get('/cms', ...a, checkPermission('cms', 'view'), getCMS);
router.post('/cms', ...a, checkPermission('cms', 'manage'), createCMSPage);
router.put('/cms/:page', ...a, checkPermission('cms', 'manage'), updateCMS);
router.delete('/cms/:page', ...a, checkPermission('cms', 'manage'), deleteCMSPage);

router.get('/notifications', ...a, checkPermission('notifications', 'view'), getNotifications);
router.post('/notifications/send', ...a, checkPermission('notifications', 'send'), sendNotification);

router.get('/reports/revenue', ...a, checkPermission('reports', 'view'), getRevenueReport);
router.get('/reports/vendors', ...a, checkPermission('reports', 'view'), getVendorReport);
router.get('/reports/products', ...a, checkPermission('reports', 'view'), getProductReport);
router.get('/reports/referrals', ...a, checkPermission('reports', 'view'), getReferralReport);
router.get('/reports/orders', ...a, checkPermission('reports', 'view'), getOrderReport);

router.get('/commission', ...a, checkPermission('settings', 'view'), getCommissionSettings);
router.put('/commission', ...a, checkPermission('settings', 'manage'), updateCommissionSettings);

router.get('/audit-logs', ...a, checkPermission('auditLogs', 'view'), getAuditLogs);

router.post('/sub-admins', ...a, checkPermission('subAdmins', 'manage'), createSubAdmin);
router.get('/sub-admins', ...a, checkPermission('subAdmins', 'view'), getSubAdmins);
router.put('/sub-admins/:id', ...a, checkPermission('subAdmins', 'manage'), updateSubAdmin);
router.delete('/sub-admins/:id', ...a, checkPermission('subAdmins', 'manage'), deleteSubAdmin);

router.get('/roles', ...a, checkPermission('roles', 'view'), getRoles);
router.post('/roles', ...a, checkPermission('roles', 'manage'), createRole);
router.put('/roles/:id', ...a, checkPermission('roles', 'manage'), updateRole);
router.delete('/roles/:id', ...a, checkPermission('roles', 'manage'), deleteRole);

router.get('/seo', ...a, checkPermission('seo', 'view'), getSEOSettings);
router.put('/seo', ...a, checkPermission('seo', 'manage'), updateSEOSettings);

router.get('/shipping', ...a, checkPermission('shipping', 'view'), getShippingSettings);
router.put('/shipping', ...a, checkPermission('shipping', 'manage'), updateShippingSettings);

router.get('/return-settings', ...a, checkPermission('settings', 'view'), getReturnSettings);
router.put('/return-settings', ...a, checkPermission('settings', 'manage'), updateReturnSettings);

router.get('/referral-settings', ...a, checkPermission('settings', 'view'), getReferralSettings);
router.put('/referral-settings', ...a, checkPermission('settings', 'manage'), updateReferralSettings);

router.get('/wallet-transactions', ...a, checkPermission('wallet', 'view'), getWalletTransactions);

router.get('/referrals', ...a, checkPermission('referrals', 'view'), getReferrals);
router.put('/referrals/:id/flag-fraud', ...a, checkPermission('referrals', 'manage'), flagReferralFraud);
router.put('/referrals/:id/reverse', ...a, checkPermission('referrals', 'manage'), reverseReferralReward);

router.get('/inventory', ...a, checkPermission('inventory', 'view'), getInventoryInspector);

module.exports = router;
