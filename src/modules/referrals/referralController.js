const Referral = require('../referrals/Referral');
const User = require('../users/User');
const Order = require('../orders/Order');
const { Wallet, WalletTransaction } = require('../wallets/Wallet');

const getReferralCode = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('referralCode');
    res.json({ success: true, code: user.referralCode });
  } catch (error) { next(error); }
};

const getReferrals = async (req, res, next) => {
  try {
    const referrals = await Referral.find({ referrer: req.user._id })
      .populate('referred', 'name email avatar createdAt')
      .sort('-createdAt');
    res.json({ success: true, referrals });
  } catch (error) { next(error); }
};

const getReferralAnalytics = async (req, res, next) => {
  try {
    const [total, completed, pending, earnings] = await Promise.all([
      Referral.countDocuments({ referrer: req.user._id }),
      Referral.countDocuments({ referrer: req.user._id, status: 'completed' }),
      Referral.countDocuments({ referrer: req.user._id, status: 'pending' }),
      Referral.aggregate([
        { $match: { referrer: req.user._id, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$rewardReferrer' } } },
      ]),
    ]);

    res.json({
      success: true,
      analytics: { totalReferrals: total, completedReferrals: completed, pendingReferrals: pending, totalEarnings: earnings[0]?.total || 0 }
    });
  } catch (error) { next(error); }
};

const getReferralSettings = async (req, res, next) => {
  try {
    const Commission = require('../commission/Commission');
    const settings = await Commission.findOne({ type: 'referral' });
    res.json({
      success: true,
      settings: settings || {
        referrerReward: 100, referredReward: 50, minOrderAmount: 0,
        rewardDelayDays: 7, isEnabled: true
      }
    });
  } catch (error) { next(error); }
};

const updateReferralSettings = async (req, res, next) => {
  try {
    const Commission = require('../commission/Commission');
    const settings = await Commission.findOneAndUpdate(
      { type: 'referral' },
      { ...req.body, type: 'referral' },
      { upsert: true, new: true }
    );
    res.json({ success: true, settings });
  } catch (error) { next(error); }
};

const triggerReferralReward = async (order, orderItem) => {
  try {
    const referredUser = order.user;
    const referral = await Referral.findOne({ referred: referredUser._id, status: 'pending' });
    if (!referral) return null;

    const settings = await require('../commission/Commission').findOne({ type: 'referral' });
    const minOrder = settings?.minOrderAmount || 0;
    if (orderItem.finalPrice < minOrder) return null;

    referral.orderId = order._id;
    referral.orderAmount = orderItem.finalPrice;
    referral.completedAt = new Date();
    referral.rewardReferrer = settings?.referrerReward || 100;
    referral.rewardReferred = settings?.referredReward || 50;
    await referral.save();

    return referral;
  } catch (error) {
    console.error('Referral trigger error:', error);
    return null;
  }
};

const releaseReferralRewards = async (req, res, next) => {
  try {
    const { days } = req.query;
    const returnDays = parseInt(days) || 7;
    const cutoff = new Date(Date.now() - returnDays * 24 * 60 * 60 * 1000);

    const referrals = await Referral.find({
      status: 'pending',
      completedAt: { $lte: cutoff },
      referrerRewarded: false,
      isFraud: false,
    }).populate('referrer referred');

    const result = { released: 0, skipped: 0, details: [] };

    for (const referral of referrals) {
      const detail = { id: referral._id, referrer: referral.referrer?.name || 'N/A', referred: referral.referred?.name || 'N/A', status: 'skipped', reason: '' };

      if (!referral.referrer || !referral.referred) {
        detail.reason = 'Referrer or referred user missing';
        result.skipped++; result.details.push(detail); continue;
      }

      if (referral.referrerRewarded && referral.referredRewarded) {
        detail.reason = 'Both already rewarded';
        result.skipped++; result.details.push(detail); continue;
      }

      if (referral.rewardReferrer <= 0 && referral.rewardReferred <= 0) {
        detail.reason = 'No reward amount configured';
        result.skipped++; result.details.push(detail); continue;
      }

      const referrerWallet = await Wallet.findOne({ user: referral.referrer._id });
      const referredWallet = await Wallet.findOne({ user: referral.referred._id });

      if (!referrerWallet && referral.rewardReferrer > 0 && !referral.referrerRewarded) {
        detail.reason = 'Referrer wallet not found';
        result.skipped++; result.details.push(detail); continue;
      }
      if (!referredWallet && referral.rewardReferred > 0 && !referral.referredRewarded) {
        detail.reason = 'Referred user wallet not found';
        result.skipped++; result.details.push(detail); continue;
      }

      if (referrerWallet && !referral.referrerRewarded && referral.rewardReferrer > 0) {
        const balBefore = referrerWallet.balance;
        referrerWallet.balance += referral.rewardReferrer;
        referrerWallet.totalCredited += referral.rewardReferrer;
        referrerWallet.totalReferralEarnings += referral.rewardReferrer;
        referrerWallet.lastTransactionAt = new Date();
        await referrerWallet.save();

        await WalletTransaction.create({
          wallet: referrerWallet._id, user: referral.referrer._id,
          type: 'credit', amount: referral.rewardReferrer,
          balanceBefore: balBefore, balanceAfter: referrerWallet.balance,
          category: 'referral_earnings',
          description: `Referral reward for ${referral.referred.name || 'new user'} joining via your link`,
          referenceModel: 'Referral', referenceId: referral._id,
        });

        referral.referrerRewarded = true;
        referral.referrerRewardPaidAt = new Date();
      }

      if (referredWallet && !referral.referredRewarded && referral.rewardReferred > 0) {
        const balBefore = referredWallet.balance;
        referredWallet.balance += referral.rewardReferred;
        referredWallet.totalCredited += referral.rewardReferred;
        referredWallet.totalReferralEarnings += referral.rewardReferred;
        referredWallet.lastTransactionAt = new Date();
        await referredWallet.save();

        await WalletTransaction.create({
          wallet: referredWallet._id, user: referral.referred._id,
          type: 'credit', amount: referral.rewardReferred,
          balanceBefore: balBefore, balanceAfter: referredWallet.balance,
          category: 'referral_earnings',
          description: 'Welcome reward for joining via referral',
          referenceModel: 'Referral', referenceId: referral._id,
        });

        referral.referredRewarded = true;
        referral.referredRewardPaidAt = new Date();
      }

      if (referral.referrerRewarded && referral.referredRewarded) {
        referral.status = 'completed';
        detail.status = 'released';
      } else {
        detail.reason = 'Partial reward (one side already rewarded)';
        result.skipped++; result.details.push(detail); continue;
      }
      await referral.save();
      result.released++;
      result.details.push(detail);
    }

    res.json({
      success: true,
      message: `${result.released} released, ${result.skipped} skipped`,
      released: result.released,
      skipped: result.skipped,
      details: result.details,
    });
  } catch (error) { next(error); }
};

const reverseReferralReward = async (req, res, next) => {
  try {
    const referral = await Referral.findById(req.params.id).populate('referrer referred');
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found' });

    if (referral.referrerRewarded && referral.rewardReferrer > 0) {
      const wallet = await Wallet.findOne({ user: referral.referrer._id });
      if (wallet && wallet.balance >= referral.rewardReferrer) {
        const balBefore = wallet.balance;
        wallet.balance -= referral.rewardReferrer;
        wallet.totalDebited += referral.rewardReferrer;
        wallet.totalReferralEarnings = Math.max(0, (wallet.totalReferralEarnings || 0) - referral.rewardReferrer);
        wallet.lastTransactionAt = new Date();
        await wallet.save();

        await WalletTransaction.create({
          wallet: wallet._id, user: referral.referrer._id,
          type: 'debit', amount: referral.rewardReferrer,
          balanceBefore: balBefore, balanceAfter: wallet.balance,
          category: 'referral_earnings',
          description: `Referral reward reversed for ${referral.referred?.name || 'user'} (fraud)`,
          referenceModel: 'Referral', referenceId: referral._id,
        });
      }
    }

    if (referral.referredRewarded && referral.rewardReferred > 0) {
      const wallet = await Wallet.findOne({ user: referral.referred._id });
      if (wallet && wallet.balance >= referral.rewardReferred) {
        const balBefore = wallet.balance;
        wallet.balance -= referral.rewardReferred;
        wallet.totalDebited += referral.rewardReferred;
        wallet.totalReferralEarnings = Math.max(0, (wallet.totalReferralEarnings || 0) - referral.rewardReferred);
        wallet.lastTransactionAt = new Date();
        await wallet.save();

        await WalletTransaction.create({
          wallet: wallet._id, user: referral.referred._id,
          type: 'debit', amount: referral.rewardReferred,
          balanceBefore: balBefore, balanceAfter: wallet.balance,
          category: 'referral_earnings',
          description: 'Referral reward reversed (fraud)',
          referenceModel: 'Referral', referenceId: referral._id,
        });
      }
    }

    referral.status = 'rejected';
    referral.referrerRewarded = false;
    referral.referredRewarded = false;
    referral.isFraud = true;
    referral.fraudReason = req.body.reason || 'Reversed by admin';
    referral.fraudDetectedAt = new Date();
    await referral.save();

    res.json({ success: true, message: 'Referral reward reversed', referral });
  } catch (error) { next(error); }
};

module.exports = {
  getReferralCode, getReferrals, getReferralAnalytics,
  getReferralSettings, updateReferralSettings,
  triggerReferralReward, releaseReferralRewards, reverseReferralReward,
};
