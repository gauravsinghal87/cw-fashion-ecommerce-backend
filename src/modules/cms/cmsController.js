const CMS = require('../cms/CMS');

const pageAliases = {
  about: ['about', 'about_us'],
  contact: ['contact', 'contact_us'],
  privacy: ['privacy', 'privacy_policy'],
  terms: ['terms', 'terms_conditions'],
  shipping: ['shipping', 'shipping_policy'],
  faq: ['faq'],
  'size-guide': ['size-guide', 'size_guide'],
  'refund-policy': ['refund-policy', 'refund_policy'],
  about_us: ['about_us', 'about'],
  contact_us: ['contact_us', 'contact'],
  privacy_policy: ['privacy_policy', 'privacy'],
  shipping_policy: ['shipping_policy', 'shipping'],
  refund_policy: ['refund_policy', 'refund-policy'],
};

const getCMSPage = async (req, res, next) => {
  try {
    const aliases = pageAliases[req.params.page] || [req.params.page];
    const page = await CMS.findOne({ page: { $in: aliases }, isActive: true }).lean();
    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }
    res.json({ success: true, page });
  } catch (error) {
    next(error);
  }
};

const getAllCMSPages = async (req, res, next) => {
  try {
    const pages = await CMS.find({ isActive: true }).lean();
    res.json({ success: true, pages });
  } catch (error) {
    next(error);
  }
};

const updateCMSPage = async (req, res, next) => {
  try {
    const page = await CMS.findOneAndUpdate(
      { page: req.params.page },
      { ...req.body, publishedBy: req.user._id, publishedAt: new Date(), $inc: { version: 1 } },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, page });
  } catch (error) {
    next(error);
  }
};

const createCMSPage = async (req, res, next) => {
  try {
    const page = await CMS.create({ ...req.body, publishedBy: req.user._id, publishedAt: new Date() });
    res.status(201).json({ success: true, page });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCMSPage, getAllCMSPages, updateCMSPage, createCMSPage };
