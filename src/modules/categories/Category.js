const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: String,
  image: { url: String, publicId: String },
  icon: String,
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
  metaTitle: String,
  metaDescription: String,
  ogImage: { url: String, publicId: String },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

categorySchema.index({ isActive: 1, displayOrder: 1 });

categorySchema.virtual('subCategories', {
  ref: 'SubCategory',
  localField: '_id',
  foreignField: 'category',
});

module.exports = mongoose.model('Category', categorySchema);
