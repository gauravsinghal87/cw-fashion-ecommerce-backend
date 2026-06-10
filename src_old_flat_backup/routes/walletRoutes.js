const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getWallet,
  getTransactions,
  addMoney,
  payWithWallet,
} = require('../controllers/walletController');

router.get('/', protect, getWallet);
router.get('/transactions', protect, getTransactions);
router.post('/add-money', protect, require('../middleware/auth').authorize('admin'), addMoney);
router.post('/pay', protect, payWithWallet);

module.exports = router;
