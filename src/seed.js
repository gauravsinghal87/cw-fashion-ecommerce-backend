require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');

const User = require('./modules/users/User');
const Category = require('./modules/categories/Category');
const SubCategory = require('./modules/categories/SubCategory');
const Brand = require('./modules/brands/Brand');
const Commission = require('./modules/commission/Commission');
const CMS = require('./modules/cms/CMS');
const Role = require('./modules/subadmins/Role');

const seed = async () => {
  try {
    await connectDB();

    const adminExists = await User.findOne({ email: 'admin@luxefashion.com' });
    if (adminExists) {
      console.log('Seed data already exists');
      process.exit(0);
    }

    const admin = await User.create({
      name: 'Super Admin',
      email: 'admin@luxefashion.com',
      password: 'Admin@1234',
      role: 'admin',
      isEmailVerified: true,
    });
    admin.generateReferralCode();
    await admin.save();
    console.log('Admin created: admin@luxefashion.com / Admin@1234');

    const categories = await Category.insertMany([
      { name: 'Men', slug: 'men', description: 'Men fashion', displayOrder: 1, isActive: true, metaTitle: 'Men Fashion', metaDescription: 'Shop men fashion' },
      { name: 'Women', slug: 'women', description: 'Women fashion', displayOrder: 2, isActive: true, metaTitle: 'Women Fashion', metaDescription: 'Shop women fashion' },
      { name: 'Kids', slug: 'kids', description: 'Kids fashion', displayOrder: 3, isActive: true, metaTitle: 'Kids Fashion', metaDescription: 'Shop kids fashion' },
      { name: 'Accessories', slug: 'accessories', description: 'Accessories', displayOrder: 4, isActive: true, metaTitle: 'Accessories', metaDescription: 'Shop accessories' },
      { name: 'Footwear', slug: 'footwear', description: 'Footwear', displayOrder: 5, isActive: true, metaTitle: 'Footwear', metaDescription: 'Shop footwear' },
    ]);
    console.log('Categories created');

    await SubCategory.insertMany([
      { name: 'T-Shirts', slug: 't-shirts', category: categories[0]._id, displayOrder: 1 },
      { name: 'Shirts', slug: 'shirts', category: categories[0]._id, displayOrder: 2 },
      { name: 'Jeans', slug: 'jeans', category: categories[0]._id, displayOrder: 3 },
      { name: 'Kurta', slug: 'kurta', category: categories[1]._id, displayOrder: 1 },
      { name: 'Dresses', slug: 'dresses', category: categories[1]._id, displayOrder: 2 },
      { name: 'Tops', slug: 'tops', category: categories[1]._id, displayOrder: 3 },
      { name: 'Toys', slug: 'toys', category: categories[2]._id, displayOrder: 1 },
      { name: 'Bags', slug: 'bags', category: categories[3]._id, displayOrder: 1 },
      { name: 'Watches', slug: 'watches', category: categories[3]._id, displayOrder: 2 },
      { name: 'Sports Shoes', slug: 'sports-shoes', category: categories[4]._id, displayOrder: 1 },
    ]);
    console.log('SubCategories created');

    await Brand.insertMany([
      { name: 'Nike', slug: 'nike', isFeatured: true, isActive: true, description: 'Nike - Just Do It' },
      { name: 'Adidas', slug: 'adidas', isFeatured: true, isActive: true, description: 'Adidas - Impossible Is Nothing' },
      { name: 'Puma', slug: 'puma', isFeatured: true, isActive: true, description: 'Puma - Forever Faster' },
      { name: 'Zara', slug: 'zara', isFeatured: true, isActive: true, description: 'Zara fashion' },
      { name: 'H&M', slug: 'hm', isFeatured: true, isActive: true, description: 'H&M fashion' },
      { name: 'Levi\'s', slug: 'levis', isFeatured: true, isActive: true, description: 'Levi\'s jeans' },
      { name: 'Roadster', slug: 'roadster', isFeatured: false, isActive: true, description: 'Roadster casual wear' },
      { name: 'HRX', slug: 'hrx', isFeatured: false, isActive: true, description: 'HRX by Hrithik Roshan' },
    ]);
    console.log('Brands created');

    await Commission.create([
      { name: 'Global Commission', type: 'global', rate: 10, priority: 0, isActive: true },
      // { name: 'Referral Reward', type: 'referral', rate: 0, referrerReward: 100, referredReward: 50, minWithdrawal: 500, isActive: true },
    ]);
    console.log('Commission rates set');

    await CMS.insertMany([
      { page: 'about_us', title: 'About Us', content: '<h2>Welcome to Luxe Fashion</h2><p>Your premium fashion destination.</p>', isActive: true },
      { page: 'contact_us', title: 'Contact Us', content: '<p>Email: support@luxefashion.com<br/>Phone: +91-1800-XXX-XXXX</p>', isActive: true },
      { page: 'privacy_policy', title: 'Privacy Policy', content: '<h2>Privacy Policy</h2><p>We value your privacy.</p>', isActive: true },
      { page: 'terms', title: 'Terms & Conditions', content: '<h2>Terms & Conditions</h2><p>Terms of service.</p>', isActive: true },
      { page: 'refund_policy', title: 'Refund Policy', content: '<h2>Refund Policy</h2><p>7-day return policy.</p>', isActive: true },
      { page: 'shipping_policy', title: 'Shipping Policy', content: '<h2>Shipping Policy</h2><p>Free shipping above ₹999.</p>', isActive: true },
    ]);
    console.log('CMS pages created');

    console.log('\n✅ Seed completed successfully!');
    console.log('Admin login: admin@luxefashion.com / Admin@1234');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
