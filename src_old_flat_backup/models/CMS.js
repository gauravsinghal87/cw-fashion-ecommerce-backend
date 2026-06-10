const mongoose = require('mongoose');

const cmsSchema = new mongoose.Schema({
  page: {
    type: String,
    required: true,
    unique: true,
    default: 'custom',
  },
  title: { type: String, required: true },
  slug: String,
  content: { type: String, required: true },
  metaTitle: String,
  metaDescription: String,
  ogImage: { url: String, publicId: String },
  isActive: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('CMS', cmsSchema);
