const Commission = require('../models/Commission');

const getCommissionRates = async (req, res, next) => {
  try {
    const commissions = await Commission.find({ isActive: true }).sort({ type: 1, priority: -1 });
    res.json({ success: true, commissions });
  } catch (error) {
    next(error);
  }
};

const createCommission = async (req, res, next) => {
  try {
    const commission = await Commission.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, commission });
  } catch (error) {
    next(error);
  }
};

const updateCommission = async (req, res, next) => {
  try {
    const commission = await Commission.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!commission) return res.status(404).json({ success: false, message: 'Commission not found' });
    res.json({ success: true, commission });
  } catch (error) {
    next(error);
  }
};

const deleteCommission = async (req, res, next) => {
  try {
    await Commission.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Commission deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCommissionRates, createCommission, updateCommission, deleteCommission };
