require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { configureCloudinary } = require('./config/cloudinary');
const errorHandler = require('./shared/middleware/errorHandler');
const { limiter } = require('./shared/middleware/rateLimit');

const authRoutes = require('./modules/auth/authRoutes');
const userRoutes = require('./modules/users/userRoutes');
const vendorRoutes = require('./modules/vendors/vendorRoutes');
const productRoutes = require('./modules/products/productRoutes');
const categoryRoutes = require('./modules/categories/categoryRoutes');
const brandRoutes = require('./modules/brands/brandRoutes');
const orderRoutes = require('./modules/orders/orderRoutes');
const cartRoutes = require('./modules/carts/cartRoutes');
const couponRoutes = require('./modules/coupons/couponRoutes');
const referralRoutes = require('./modules/referrals/referralRoutes');
const walletRoutes = require('./modules/wallets/walletRoutes');
const returnRoutes = require('./modules/returns/returnRoutes');
const bannerRoutes = require('./modules/banners/bannerRoutes');
const notificationRoutes = require('./modules/notifications/notificationRoutes');
const cmsRoutes = require('./modules/cms/cmsRoutes');
const footerRoutes = require('./modules/footer/footerRoutes');
const adminRoutes = require('./modules/admin/adminRoutes');
const commissionRoutes = require('./modules/commission/commissionRoutes');
const searchRoutes = require('./modules/analytics/searchRoutes');
const uploadRoutes = require('./modules/upload/uploadRoutes');
const reviewRoutes = require('./modules/reviews/reviewRoutes');
const dashboardRoutes = require('./modules/analytics/dashboardRoutes');
const customerSupportRoutes = require('./modules/support/customerSupportRoutes');
const adminSupportRoutes = require('./modules/support/adminSupportRoutes');

const app = express();

connectDB();
configureCloudinary();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: "*",
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/footer', footerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/commission', commissionRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/support', customerSupportRoutes);
app.use('/api/admin/support', adminSupportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Luxe Fashion API is running', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

module.exports = app;