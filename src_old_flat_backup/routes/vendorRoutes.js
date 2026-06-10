const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { vendorRegisterValidator, productValidator, supportTicketValidator } = require('../middleware/validators');
const {
  registerVendor,
  loginVendor,
  getVendorProfile,
  updateVendorProfile,
  getVendorProducts, getVendorProductDetail,
  getVendorOrders, getVendorOrderDetail,
  updateOrderStatus,
  getVendorDashboard,
  getVendorReturns,
} = require('../controllers/vendorController');
const {
  getInventoryList, getWarehouseInventory,
  addStock, removeStock, transferStock, markDamaged,
  getInventoryHistory, getLowStockAlerts, getInventoryDashboard, bulkImport,
} = require('../controllers/inventoryController');
const {
  updateReturnStatus, getVendorReturn,
  getVendorAnalytics,
  getVendorWallet,
  getVendorReviews,
  uploadBulkProducts,
  exportProducts,
  getVendorStoreSEO, updateVendorStoreSEO,
  getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse,
  getInventory, updateInventoryItem, bulkUpdateInventory,
  getVendorCustomers, getVendorCustomerDetail,
  getSettlements, getSettlementDetail,
  generateInvoice,
  getNotifications, markNotificationRead, markAllNotificationsRead,
  getAuditLogs,
  duplicateProduct,
  getProductVariants, createProductVariant, updateProductVariant, deleteProductVariant,
} = require('../controllers/vendorController');
const { requestWithdrawal, getMyWithdrawals, getWalletInfo } = require('../controllers/withdrawalController');
const { createTicket, getMyTickets, getTicketDetail, replyTicket, reopenTicket, addFeedback } = require('../controllers/supportController');

router.post('/register', vendorRegisterValidator, validate, registerVendor);
router.post('/login', loginVendor);
router.get('/profile', protect, authorize('vendor'), getVendorProfile);
router.put('/profile', protect, authorize('vendor'), updateVendorProfile);
router.get('/products', protect, authorize('vendor'), getVendorProducts);
router.get('/products/:id', protect, authorize('vendor'), getVendorProductDetail);
router.get('/orders', protect, authorize('vendor'), getVendorOrders);
router.get('/orders/:id', protect, authorize('vendor'), getVendorOrderDetail);
router.put('/orders/:orderId/items/:itemId/status', protect, authorize('vendor'), updateOrderStatus);
router.get('/dashboard', protect, authorize('vendor'), getVendorDashboard);
router.get('/returns', protect, authorize('vendor'), getVendorReturns);
router.get('/returns/:returnId', protect, authorize('vendor'), getVendorReturn);
router.put('/returns/:returnId/status', protect, authorize('vendor'), updateReturnStatus);
router.get('/analytics', protect, authorize('vendor'), getVendorAnalytics);
router.get('/wallet', protect, authorize('vendor'), getVendorWallet);
router.post('/withdrawals', protect, authorize('vendor'), requestWithdrawal);
router.get('/withdrawals', protect, authorize('vendor'), getMyWithdrawals);
router.get('/wallet/transactions', protect, authorize('vendor'), getWalletInfo);
router.get('/reviews', protect, authorize('vendor'), getVendorReviews);
router.post('/bulk-upload', protect, authorize('vendor'), uploadBulkProducts);
router.get('/export-products', protect, authorize('vendor'), exportProducts);

// Store SEO
router.get('/store/seo', protect, authorize('vendor'), getVendorStoreSEO);
router.put('/store/seo', protect, authorize('vendor'), updateVendorStoreSEO);

// Warehouses
router.get('/warehouses', protect, authorize('vendor'), getWarehouses);
router.post('/warehouses', protect, authorize('vendor'), createWarehouse);
router.put('/warehouses/:id', protect, authorize('vendor'), updateWarehouse);
router.delete('/warehouses/:id', protect, authorize('vendor'), deleteWarehouse);

// Inventory
router.get('/inventory', protect, authorize('vendor'), getInventoryList);
router.get('/inventory/warehouse/:warehouseId', protect, authorize('vendor'), getWarehouseInventory);
router.post('/inventory/add-stock', protect, authorize('vendor'), addStock);
router.post('/inventory/remove-stock', protect, authorize('vendor'), removeStock);
router.post('/inventory/transfer', protect, authorize('vendor'), transferStock);
router.post('/inventory/damaged', protect, authorize('vendor'), markDamaged);
router.get('/inventory/history', protect, authorize('vendor'), getInventoryHistory);
router.get('/inventory/low-stock', protect, authorize('vendor'), getLowStockAlerts);
router.get('/inventory/dashboard', protect, authorize('vendor'), getInventoryDashboard);
router.post('/inventory/bulk-import', protect, authorize('vendor'), bulkImport);

// Customers
router.get('/customers', protect, authorize('vendor'), getVendorCustomers);
router.get('/customers/:id', protect, authorize('vendor'), getVendorCustomerDetail);

// Settlements
router.get('/settlements', protect, authorize('vendor'), getSettlements);
router.get('/settlements/:id', protect, authorize('vendor'), getSettlementDetail);

// Invoice
router.get('/invoices/generate/:orderId', protect, authorize('vendor'), generateInvoice);

// Notifications
router.get('/notifications', protect, authorize('vendor'), getNotifications);
router.put('/notifications/mark-read/:id', protect, authorize('vendor'), markNotificationRead);
router.put('/notifications/mark-all-read', protect, authorize('vendor'), markAllNotificationsRead);

// Support Tickets
router.post('/support/tickets', protect, authorize('vendor'), createTicket);
router.get('/support/tickets', protect, authorize('vendor'), getMyTickets);
router.get('/support/tickets/:id', protect, authorize('vendor'), getTicketDetail);
router.post('/support/tickets/:id/reply', protect, authorize('vendor'), replyTicket);
router.post('/support/tickets/:id/reopen', protect, authorize('vendor'), reopenTicket);
router.post('/support/tickets/:id/feedback', protect, authorize('vendor'), addFeedback);

// Audit Logs
router.get('/audit-logs', protect, authorize('vendor'), getAuditLogs);

// Product Actions
router.post('/products/:id/duplicate', protect, authorize('vendor'), duplicateProduct);
router.get('/products/:id/variants', protect, authorize('vendor'), getProductVariants);
router.post('/products/:id/variants', protect, authorize('vendor'), createProductVariant);
router.put('/products/:id/variants/:variantId', protect, authorize('vendor'), updateProductVariant);
router.delete('/products/:id/variants/:variantId', protect, authorize('vendor'), deleteProductVariant);

module.exports = router;
