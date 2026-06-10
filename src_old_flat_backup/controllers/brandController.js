const Brand = require('../models/Brand');
const slugify = require('slugify');

const createBrand = async (req, res, next) => {
  try {
    const slug = slugify(req.body.name, { lower: true, strict: true });
    const brand = await Brand.create({ ...req.body, slug });
    res.status(201).json({ success: true, brand });
  } catch (error) {
    next(error);
  }
};

const getBrands = async (req, res, next) => {
  try {
    const brands = await Brand.find({ isActive: true }).sort('displayOrder');
    res.json({ success: true, brands });
  } catch (error) {
    next(error);
  }
};

const getBrand = async (req, res, next) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' });
    res.json({ success: true, brand });
  } catch (error) {
    next(error);
  }
};

const getBrandBySlug = async (req, res, next) => {
  try {
    const brand = await Brand.findOne({ slug: req.params.slug, isActive: true });
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' });
    res.json({ success: true, brand });
  } catch (error) {
    next(error);
  }
};

const updateBrand = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.name) data.slug = slugify(data.name, { lower: true, strict: true });
    const brand = await Brand.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json({ success: true, brand });
  } catch (error) {
    next(error);
  }
};

const deleteBrand = async (req, res, next) => {
  try {
    await Brand.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Brand deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { createBrand, getBrands, getBrand, getBrandBySlug, updateBrand, deleteBrand };
