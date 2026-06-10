const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: (req) => {
      const folder = req.uploadFolder || 'general';
      return `luxe-fashion/${folder}`;
    },
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov'],
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, GIF, MP4, and MOV allowed.'), false);
    }
  },
});

const uploadImages = (fields) => upload.fields(fields);
const uploadSingle = (field) => upload.single(field);
const uploadMultiple = (field, maxCount) => upload.array(field, maxCount || 5);

module.exports = { upload, uploadImages, uploadSingle, uploadMultiple };
