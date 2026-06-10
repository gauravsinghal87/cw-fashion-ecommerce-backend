const mongoose = require('mongoose');

const subCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, lowercase: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  description: String,
  image: { url: String, publicId: String },
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
  metaTitle: String,
  metaDescription: String,
}, { timestamps: true });

subCategorySchema.index({ category: 1, slug: 1 }, { unique: true });
subCategorySchema.index({ isActive: 1 });

module.exports = mongoose.model('SubCategory', subCategorySchema);
