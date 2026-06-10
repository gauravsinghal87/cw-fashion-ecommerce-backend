const Banner = require('../banners/Banner');

const createBanner = async (req, res, next) => {
  try {
    const banner = await Banner.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, banner });
  } catch (error) {
    next(error);
  }
};

const getBanners = async (req, res, next) => {
  try {
    const { type } = req.query;
    const filter = { isActive: true };
    if (type) filter.type = type;
    const banners = await Banner.find(filter).sort('priority').lean();
    res.json({ success: true, banners });
  } catch (error) {
    next(error);
  }
};

const getBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id).lean();
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, banner });
  } catch (error) {
    next(error);
  }
};

const updateBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, banner });
  } catch (error) {
    next(error);
  }
};

const deleteBanner = async (req, res, next) => {
  try {
    await Banner.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Banner deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { createBanner, getBanners, getBanner, updateBanner, deleteBanner };
