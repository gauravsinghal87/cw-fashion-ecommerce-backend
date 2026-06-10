const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: String,
  description: String,
  type: { type: String, enum: ['hero', 'festival', 'sale', 'promotional'], required: true },
  image: { type: { url: String, publicId: String }, required: true },
  mobileImage: { url: String, publicId: String },
  link: String,
  linkType: { type: String, enum: ['category', 'product', 'collection', 'external', 'none'], default: 'none' },
  linkValue: String,
  isActive: { type: Boolean, default: true },
  priority: { type: Number, default: 0 },
  backgroundColor: String,
  textColor: String,
  buttonText: String,
  buttonColor: String,
  startDate: Date,
  endDate: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

bannerSchema.index({ type: 1, priority: 1, isActive: 1 });
bannerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Banner', bannerSchema);
