const Category = require('../categories/Category');
const SubCategory = require('../categories/SubCategory');
const slugify = require('slugify');

const createCategory = async (req, res, next) => {
  try {
    const slug = slugify(req.body.name, { lower: true, strict: true });
    const category = await Category.create({ ...req.body, slug });
    res.status(201).json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true })
      .populate({
        path: 'subCategories',
        match: { isActive: true },
        select: 'name slug image',
        options: { sort: { displayOrder: 1 } },
      })
      .sort('displayOrder').lean();
    res.json({ success: true, categories });
  } catch (error) {
    next(error);
  }
};

const getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id).populate({
      path: 'subCategories',
      match: { isActive: true },
      options: { sort: { displayOrder: 1 } },
    }).lean();
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.name) {
      data.slug = slugify(data.name, { lower: true, strict: true });
    }
    const category = await Category.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    await SubCategory.updateMany({ category: req.params.id }, { isActive: false });
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
};

const createSubCategory = async (req, res, next) => {
  try {
    const slug = slugify(req.body.name, { lower: true, strict: true });
    const subCategory = await SubCategory.create({ ...req.body, slug });
    res.status(201).json({ success: true, subCategory });
  } catch (error) {
    next(error);
  }
};

const getSubCategories = async (req, res, next) => {
  try {
    const filter = req.params.id ? { category: req.params.id } : {};
    const subCategories = await SubCategory.find({ ...filter, isActive: true }).sort('displayOrder').lean();
    res.json({ success: true, subCategories });
  } catch (error) {
    next(error);
  }
};

const updateSubCategory = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.name) {
      data.slug = slugify(data.name, { lower: true, strict: true });
    }
    const subCategory = await SubCategory.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!subCategory) {
      return res.status(404).json({ success: false, message: 'SubCategory not found' });
    }
    res.json({ success: true, subCategory });
  } catch (error) {
    next(error);
  }
};

const deleteSubCategory = async (req, res, next) => {
  try {
    const subCategory = await SubCategory.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!subCategory) {
      return res.status(404).json({ success: false, message: 'SubCategory not found' });
    }
    res.json({ success: true, message: 'SubCategory deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCategory, getCategories, getCategory, updateCategory, deleteCategory,
  createSubCategory, getSubCategories, updateSubCategory, deleteSubCategory,
};
