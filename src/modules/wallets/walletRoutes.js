const express = require('express');
const router = express.Router();
const { protect } = require('../../shared/middleware/auth');
const {
  getWallet,
  getTransactions,
  addMoney,
  payWithWallet,
} = require('../wallets/walletController');

router.get('/', protect, getWallet);
router.get('/transactions', protect, getTransactions);
router.post('/add-money', protect, require('../../shared/middleware/auth').authorize('admin'), addMoney);
router.post('/pay', protect, payWithWallet);

module.exports = router;
