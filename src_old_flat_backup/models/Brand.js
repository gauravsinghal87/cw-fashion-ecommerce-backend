const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: String,
  logo: { url: String, publicId: String },
  coverImage: { url: String, publicId: String },
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  displayOrder: { type: Number, default: 0 },
  metaTitle: String,
  metaDescription: String,
  ogImage: { url: String, publicId: String },
}, { timestamps: true });

brandSchema.index({ isActive: 1, isFeatured: 1 });

module.exports = mongoose.model('Brand', brandSchema);
