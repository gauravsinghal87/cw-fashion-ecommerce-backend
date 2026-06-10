const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  requestReturn, getReturns, getReturn, getReturnDetail,
  approveReturn, rejectReturn,
  schedulePickup, confirmPickup, receiveReturn,
  qcPass, qcFail,
  processRefund,
  createDispute, resolveDispute,
} = require('../controllers/returnController');

router.post('/', protect, requestReturn);
router.get('/', protect, getReturns);
router.get('/:id', protect, getReturn);
router.get('/:id/detail', protect, authorize('admin', 'vendor'), getReturnDetail);
router.put('/:id/approve', protect, authorize('admin', 'vendor'), approveReturn);
router.put('/:id/reject', protect, authorize('admin', 'vendor'), rejectReturn);
router.put('/:id/schedule-pickup', protect, authorize('admin', 'vendor'), schedulePickup);
router.put('/:id/confirm-pickup', protect, authorize('admin', 'vendor'), confirmPickup);
router.put('/:id/receive', protect, authorize('admin', 'vendor'), receiveReturn);
router.put('/:id/qc-pass', protect, authorize('admin'), qcPass);
router.put('/:id/qc-fail', protect, authorize('admin'), qcFail);
router.put('/:id/refund', protect, authorize('admin'), processRefund);
router.post('/:id/dispute', protect, createDispute);
router.put('/:id/resolve-dispute', protect, authorize('admin'), resolveDispute);

module.exports = router;
