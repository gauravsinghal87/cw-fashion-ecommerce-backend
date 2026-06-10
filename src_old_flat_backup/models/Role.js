const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: String,
  permissions: {
    dashboard: { view: { type: Boolean, default: false } },
    users: {
      view: { type: Boolean, default: false },
      suspend: { type: Boolean, default: false },
      ban: { type: Boolean, default: false },
      wallet: { type: Boolean, default: false },
    },
    products: {
      view: { type: Boolean, default: false },
      approve: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    orders: {
      view: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      cancel: { type: Boolean, default: false },
      refund: { type: Boolean, default: false },
      forceDeliver: { type: Boolean, default: false },
    },
    vendors: {
      view: { type: Boolean, default: false },
      approve: { type: Boolean, default: false },
      suspend: { type: Boolean, default: false },
      ban: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
    },
    returns: {
      view: { type: Boolean, default: false },
      approve: { type: Boolean, default: false },
      reject: { type: Boolean, default: false },
      refund: { type: Boolean, default: false },
    },
    coupons: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
    categories: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
    brands: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
    banners: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
    cms: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
    notifications: {
      view: { type: Boolean, default: false },
      send: { type: Boolean, default: false },
    },
    reports: {
      view: { type: Boolean, default: false },
    },
    withdrawals: {
      view: { type: Boolean, default: false },
      approve: { type: Boolean, default: false },
    },
    settlements: {
      view: { type: Boolean, default: false },
      release: { type: Boolean, default: false },
    },
    settings: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
    auditLogs: { view: { type: Boolean, default: false } },
    seo: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
    wallet: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
    shipping: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
    reviews: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
    payments: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
    subAdmins: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
    roles: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
    inventory: { view: { type: Boolean, default: false } },
    referrals: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
    support: {
      view: { type: Boolean, default: false },
      reply: { type: Boolean, default: false },
      assign: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
