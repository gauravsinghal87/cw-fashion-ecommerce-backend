const mongoose = require('mongoose');

const vendorDocumentSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  documentType: { type: String, enum: ['gst_certificate', 'pan_card', 'aadhaar_card', 'bank_proof', 'business_license', 'other'], required: true },
  documentNumber: String,
  fileUrl: { type: String, required: true },
  publicId: String,
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  remarks: String,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
}, { timestamps: true });

vendorDocumentSchema.index({ vendor: 1 });

module.exports = mongoose.model('VendorDocument', vendorDocumentSchema);
