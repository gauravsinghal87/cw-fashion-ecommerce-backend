const FooterSetting = require('./FooterSetting');

const footerDefaults = {
  title: 'LUXE', supportEmail: '', supportPhone: '', address: '',
  logo: { url: '', publicId: '' },
  socialLinks: { facebook: '', instagram: '', twitter: '', youtube: '', linkedin: '', whatsapp: '' },
};

const getFooterSettings = async (req, res, next) => {
  try {
    let settings = await FooterSetting.findOne().lean();
    if (!settings) settings = { ...footerDefaults };
    res.json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

const updateFooterSettings = async (req, res, next) => {
  try {
    const { title, supportEmail, supportPhone, address, logo, socialLinks } = req.body;

    let settings = await FooterSetting.findOne();
    if (!settings) {
      settings = new FooterSetting();
    }

    settings.title = title || '';
    settings.supportEmail = supportEmail || '';
    settings.supportPhone = supportPhone || '';
    settings.address = address || '';

    if (logo) {
      settings.logo = { url: logo.url || '', publicId: logo.publicId || '' };
    }

    if (socialLinks) {
      settings.socialLinks = {
        facebook: socialLinks.facebook || '',
        instagram: socialLinks.instagram || '',
        twitter: socialLinks.twitter || '',
        youtube: socialLinks.youtube || '',
        linkedin: socialLinks.linkedin || '',
        whatsapp: socialLinks.whatsapp || '',
      };
    }

    await settings.save();

    res.json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

module.exports = { getFooterSettings, updateFooterSettings };
