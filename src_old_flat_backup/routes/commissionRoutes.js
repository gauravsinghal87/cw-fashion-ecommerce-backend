const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getCommissionRates,
  createCommission,
  updateCommission,
  deleteCommission,
} = require('../controllers/commissionController');

router.get('/', getCommissionRates);
router.post('/', protect, authorize('admin'), createCommission);
router.put('/:id', protect, authorize('admin'), updateCommission);
router.delete('/:id', protect, authorize('admin'), deleteCommission);

module.exports = router;
