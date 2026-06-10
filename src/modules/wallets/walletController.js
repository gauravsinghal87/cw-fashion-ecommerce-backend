const { Wallet, WalletTransaction } = require('../wallets/Wallet');

const getWallet = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      const created = await Wallet.create({ user: req.user._id });
      return res.json({ success: true, wallet: created });
    }
    res.json({ success: true, wallet });
  } catch (error) {
    next(error);
  }
};

const getTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { category, type } = req.query;

    const filter = { user: req.user._id };
    if (category) filter.category = category;
    if (type) filter.type = type;

    const transactions = await WalletTransaction.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await WalletTransaction.countDocuments(filter);

    res.json({
      success: true,
      transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

const addMoney = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (amount < 1) {
      return res.status(400).json({ success: false, message: 'Amount must be at least ₹1' });
    }

    const wallet = await Wallet.findOne({ user: req.user._id });
    wallet.balance += amount;
    wallet.totalCredited += amount;
    wallet.lastTransactionAt = new Date();
    await wallet.save();

    await WalletTransaction.create({
      wallet: wallet._id, user: req.user._id, type: 'credit', amount,
      balanceBefore: wallet.balance - amount, balanceAfter: wallet.balance,
      category: 'bonus', description: 'Money added to wallet',
    });

    res.json({ success: true, wallet });
  } catch (error) {
    next(error);
  }
};

const payWithWallet = async (req, res, next) => {
  try {
    const { amount, description, referenceId } = req.body;
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    wallet.balance -= amount;
    wallet.totalDebited += amount;
    wallet.lastTransactionAt = new Date();
    await wallet.save();

    await WalletTransaction.create({
      wallet: wallet._id, user: req.user._id, type: 'debit', amount,
      balanceBefore: wallet.balance + amount, balanceAfter: wallet.balance,
      category: 'purchase', description: description || 'Wallet payment',
      referenceModel: 'Order', referenceId,
    });

    res.json({ success: true, wallet });
  } catch (error) {
    next(error);
  }
};

module.exports = { getWallet, getTransactions, addMoney, payWithWallet };
