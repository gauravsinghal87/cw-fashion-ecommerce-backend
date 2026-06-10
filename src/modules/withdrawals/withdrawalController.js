const Withdrawal = require('../withdrawals/Withdrawal');
const Vendor = require('../vendors/Vendor');
const { Wallet, WalletTransaction } = require('../wallets/Wallet');

// Vendor requests withdrawal
const requestWithdrawal = async (req, res, next) => {
  try {
    const { amount, paymentMethod } = req.body;
    if (!amount || amount < 1) return res.status(400).json({ success: false, message: 'Invalid amount' });

    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });

    const minWithdrawal = wallet.withdrawalMinimum || 500;
    if (amount < minWithdrawal) return res.status(400).json({ success: false, message: `Minimum withdrawal is ₹${minWithdrawal}` });
    if (amount > wallet.balance) return res.status(400).json({ success: false, message: `Insufficient balance. Available: ₹${wallet.balance}` });

    const pendingCount = await Withdrawal.countDocuments({ vendor: vendor._id, status: 'pending' });
    if (pendingCount > 0) return res.status(400).json({ success: false, message: 'You already have a pending withdrawal request' });

    const fee = 0;
    const netAmount = amount - fee;

    // Use vendor-chosen method, fallback to auto-detect
    const method = paymentMethod || (vendor.bankAccount?.upiId ? 'upi' : 'bank_transfer');

    const withdrawal = await Withdrawal.create({
      vendor: vendor._id,
      user: req.user._id,
      amount,
      fee,
      netAmount,
      paymentMethod: method,
      accountDetails: {
        accountHolderName: vendor.bankAccount?.accountHolderName || '',
        accountNumber: vendor.bankAccount?.accountNumber || '',
        bankName: vendor.bankAccount?.bankName || '',
        ifscCode: vendor.bankAccount?.ifscCode || '',
        upiId: vendor.bankAccount?.upiId || '',
      },
      status: 'pending',
    });

    vendor.pendingWithdrawal = (vendor.pendingWithdrawal || 0) + amount;
    await vendor.save();

    res.status(201).json({ success: true, withdrawal });
  } catch (error) { next(error); }
};

// Admin approves withdrawal
const approveWithdrawal = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id).populate('vendor');
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ success: false, message: 'Withdrawal already processed' });

    const wallet = await Wallet.findOne({ user: withdrawal.user });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });
    if (wallet.balance < withdrawal.amount) return res.status(400).json({ success: false, message: 'Insufficient balance' });

    const balBefore = wallet.balance;
    wallet.balance -= withdrawal.amount;
    wallet.totalDebited += withdrawal.amount;
    wallet.lastTransactionAt = new Date();
    await wallet.save();

    const txn = await WalletTransaction.create({
      wallet: wallet._id, user: withdrawal.user, type: 'debit', amount: withdrawal.amount,
      balanceBefore: balBefore, balanceAfter: wallet.balance,
      category: 'withdrawal',
      description: `Withdrawal of ₹${withdrawal.amount} approved`,
      referenceModel: 'Withdrawal', referenceId: withdrawal._id,
    });

    withdrawal.status = 'completed';
    withdrawal.processedBy = req.user._id;
    withdrawal.processedAt = new Date();
    withdrawal.completedAt = new Date();
    withdrawal.walletTransaction = txn._id;
    await withdrawal.save();

    // Update vendor totals
    const vendor = await Vendor.findById(withdrawal.vendor);
    if (vendor) {
      vendor.totalWithdrawn = (vendor.totalWithdrawn || 0) + withdrawal.amount;
      vendor.pendingWithdrawal = Math.max(0, (vendor.pendingWithdrawal || 0) - withdrawal.amount);
      await vendor.save();
    }

    res.json({ success: true, message: 'Withdrawal approved and completed', withdrawal });
  } catch (error) { next(error); }
};

// Admin rejects withdrawal
const rejectWithdrawal = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ success: false, message: 'Withdrawal already processed' });

    withdrawal.status = 'rejected';
    withdrawal.rejectionReason = reason || 'Rejected by admin';
    withdrawal.rejectedAt = new Date();
    withdrawal.processedBy = req.user._id;
    await withdrawal.save();

    const vendor = await Vendor.findById(withdrawal.vendor);
    if (vendor) {
      vendor.pendingWithdrawal = Math.max(0, (vendor.pendingWithdrawal || 0) - withdrawal.amount);
      await vendor.save();
    }

    res.json({ success: true, message: 'Withdrawal rejected', withdrawal });
  } catch (error) { next(error); }
};

// Get vendor withdrawal history
const getMyWithdrawals = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = { vendor: vendor._id };

    const withdrawals = await Withdrawal.find(filter)
      .sort('-createdAt').skip((page - 1) * limit).limit(limit);
    const total = await Withdrawal.countDocuments(filter);

    res.json({ success: true, withdrawals, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

// Admin get all withdrawals
const getAllWithdrawals = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const filter = {};
    if (status) filter.status = status;

    const withdrawals = await Withdrawal.find(filter)
      .sort('-createdAt').skip((page - 1) * limit).limit(limit)
      .populate('vendor', 'storeName bankAccount')
      .populate('user', 'name email phone');
    const total = await Withdrawal.countDocuments(filter);

    res.json({ success: true, withdrawals, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

// Get wallet info for vendor
const getWalletInfo = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });

    const transactions = await WalletTransaction.find({ user: req.user._id })
      .sort('-createdAt').limit(50);

    res.json({ success: true, wallet, transactions });
  } catch (error) { next(error); }
};

// Admin holds withdrawal
const holdWithdrawal = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ success: false, message: 'Withdrawal already processed' });
    withdrawal.status = 'hold';
    withdrawal.adminNote = req.body.note || '';
    withdrawal.processedBy = req.user._id;
    await withdrawal.save();
    res.json({ success: true, message: 'Withdrawal held', withdrawal });
  } catch (error) { next(error); }
};

module.exports = {
  requestWithdrawal, approveWithdrawal, rejectWithdrawal, holdWithdrawal,
  getMyWithdrawals, getAllWithdrawals, getWalletInfo,
};
