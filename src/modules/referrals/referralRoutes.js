const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../shared/middleware/auth');
const {
  getReferralCode, getReferrals, getReferralAnalytics,
  getReferralSettings, updateReferralSettings,
  releaseReferralRewards, reverseReferralReward,
} = require('../referrals/referralController');

router.get('/code', protect, getReferralCode);
router.get('/list', protect, getReferrals);
router.get('/analytics', protect, getReferralAnalytics);
router.get('/settings', getReferralSettings);
router.put('/settings', protect, authorize('admin'), updateReferralSettings);
router.post('/release', protect, authorize('admin'), releaseReferralRewards);
router.put('/:id/reverse', protect, authorize('admin'), reverseReferralReward);

module.exports = router;
