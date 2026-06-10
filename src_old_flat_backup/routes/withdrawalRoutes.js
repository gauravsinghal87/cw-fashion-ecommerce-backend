const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getWithdrawals,
  getWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  holdWithdrawal,
} = require('../controllers/withdrawalController');

router.get('/', protect, authorize('admin'), getWithdrawals);
router.get('/:id', protect, authorize('admin'), getWithdrawal);
router.put('/:id/approve', protect, authorize('admin'), approveWithdrawal);
router.put('/:id/reject', protect, authorize('admin'), rejectWithdrawal);
router.put('/:id/hold', protect, authorize('admin'), holdWithdrawal);

module.exports = router;
