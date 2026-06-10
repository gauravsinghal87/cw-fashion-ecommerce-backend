const Product = require('../products/Product');
const Category = require('../categories/Category');
const Brand = require('../brands/Brand');

const searchProducts = async (req, res, next) => {
  try {
    const { q, category, brand, minPrice, maxPrice, color, size, rating, sort, page: p, limit: l } = req.query;
    const page = parseInt(p) || 1;
    const limit = Math.min(parseInt(l) || 20, 100);

    const filter = { isActive: true, status: 'approved' };

    if (q) {
      filter.$text = { $search: q };
    }

    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    if (rating) filter.rating = { $gte: parseFloat(rating) };

    if (minPrice || maxPrice) {
      filter.minPrice = {};
      if (minPrice) filter.minPrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter.minPrice.$lte = parseFloat(maxPrice);
    }

    if (color || size) {
      filter['variants'] = { $elemMatch: {} };
      if (color) filter['variants'].$elemMatch.color = color;
      if (size) filter['variants'].$elemMatch.size = size;
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { minPrice: 1 };
    else if (sort === 'price_desc') sortOption = { minPrice: -1 };
    else if (sort === 'rating') sortOption = { rating: -1 };
    else if (sort === 'popular') sortOption = { totalSold: -1 };
    else if (sort === 'newest') sortOption = { createdAt: -1 };

    const products = await Product.find(filter)
      .populate('vendor', 'storeName')
      .populate('category', 'name slug')
      .populate('brand', 'name slug')
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-variants').lean();

    const total = await Product.countDocuments(filter);

    const filters = {};
    if (!category) {
      const catAgg = await Product.aggregate([
        { $match: { isActive: true, status: 'approved' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]);
      await Category.populate(catAgg, { path: '_id', select: 'name slug' });
      filters.categories = catAgg.map(c => ({ id: c._id?._id, name: c._id?.name, slug: c._id?.slug, count: c.count }));
    }

    if (!brand) {
      const brandAgg = await Product.aggregate([
        { $match: { isActive: true, status: 'approved' } },
        { $group: { _id: '$brand', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]);
      await Brand.populate(brandAgg, { path: '_id', select: 'name slug' });
      filters.brands = brandAgg.map(b => ({ id: b._id?._id, name: b._id?.name, slug: b._id?.slug, count: b.count }));
    }

    res.json({
      success: true,
      products,
      filters,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

const searchSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    const [products, categories, brands] = await Promise.all([
      Product.find({ title: { $regex: q, $options: 'i' }, isActive: true, status: 'approved' })
        .limit(5).select('title slug minPrice maxPrice images').lean(),
      Category.find({ name: { $regex: q, $options: 'i' }, isActive: true })
        .limit(3).select('name slug').lean(),
      Brand.find({ name: { $regex: q, $options: 'i' }, isActive: true })
        .limit(3).select('name slug').lean(),
    ]);

    res.json({ success: true, suggestions: { products, categories, brands } });
  } catch (error) {
    next(error);
  }
};

module.exports = { searchProducts, searchSuggestions };
