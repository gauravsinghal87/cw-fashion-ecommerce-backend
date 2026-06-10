const { cloudinary } = require('../../config/cloudinary');

const uploadFiles = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    console.log('Uploaded files:', req.files);

    const files = req.files.map(file => ({
      url: file.path,
      publicId: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    }));

    res.json({ success: true, files });
  } catch (error) {
    console.error('Error uploading files:', error);
    next(error);
  }
};

const deleteFile = async (req, res, next) => {
  try {
    const result = await cloudinary.uploader.destroy(req.params.publicId);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadFiles, deleteFile };
