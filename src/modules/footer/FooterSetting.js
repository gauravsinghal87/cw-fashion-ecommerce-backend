const mongoose = require('mongoose');

const footerSettingSchema = new mongoose.Schema({
  title: { type: String, default: 'LUXE' },
  supportEmail: { type: String, default: '' },
  supportPhone: { type: String, default: '' },
  address: { type: String, default: '' },
  logo: {
    url: { type: String, default: '' },
    publicId: { type: String, default: '' },
  },
  socialLinks: {
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' },
    twitter: { type: String, default: '' },
    youtube: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
  },
}, { timestamps: true });

module.exports = mongoose.model('FooterSetting', footerSettingSchema);
