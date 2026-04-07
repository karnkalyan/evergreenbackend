const express = require('express');
const prisma = require('../prisma/client.js'); // Adjust the path as necessary
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const emailProcessor = require('./cron/emailProcessor');

const app = express();
emailProcessor.startEmailProcessor();

const usersRouter = require('./routes/users.routes');
const authRouter = require('./routes/auth.routes');
const categoriesRouter = require('./routes/categories.routes');
const brandRouter = require('./routes/brand.routes');
const productRouter = require('./routes/products.routes');
const roleRoutes = require('./routes/role.routes');
const permissionRoutes = require('./routes/permission.routes');
const medicationRouter = require('./routes/medicinerequest.routes');
const addressRouter = require('./routes/address.routes');
const couponRouter = require('./routes/coupon.routes');
const cartRouter = require('./routes/cart.routes');
const orderRouter = require('./routes/order.routes');
const prescriptionRouter = require('./routes/prescription.routes');
const paymentRouter = require('./routes/payment.routes');
const mediaRouter = require('./routes/media.routes');
const blogRouter = require('./routes/blogPosts.routes');
const homepageLayoutRouter = require('./routes/homepageLayout.routes');
const websiteRouter = require('./routes/websiteSettings.routes');
const integration = require('./routes/integrations.routes');
const emailTemplatesRouter = require('./routes/emailTemplates.routes');
const automationRulesRouter = require('./routes/automationRules.routes');
const contactRouter = require('./routes/contact.routes');
const aboutUsRoute = require('./routes/aboutUs.routes'); // ✅ Singular
const countryRouter = require('./routes/country.routes');
const shippingRouter = require('./routes/shipping.routes');
const paymentMethodRouter = require('./routes/paymentMethod.routes');
const websiteController = require('./controllers/websiteSettings.controller');





// const multer = require('multer');






// Increase payload size limit for large blog content with images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Enhanced CORS configuration
app.use(cors({
    origin: process.env.CLIENT_ORIGIN || ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Handle preflight requests
app.options('*', cors());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error handling for file uploads
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        details: `Maximum size allowed: ${Math.round(error.limit / 1024 / 1024)}MB`
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected field',
        details: `Field '${error.field}' is not allowed`
      });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: error.message
    });
  }
  
  next(error);
});

app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// SEO routes
app.get('/sitemap.xml', (req, res) => {
  req.prisma = prisma;
  websiteController.getSitemap(req, res);
});
app.get('/robots.txt', (req, res) => {
  req.prisma = prisma;
  websiteController.getRobotsTxt(req, res);
});

app.use('/users', usersRouter(prisma));
app.use('/categories', categoriesRouter(prisma));
app.use('/brands', brandRouter(prisma));
app.use('/products', productRouter(prisma));
app.use('/auth', authRouter(prisma));
app.use('/roles', roleRoutes(prisma));
app.use('/permissions', permissionRoutes(prisma));
app.use('/medication-requests', medicationRouter(prisma));
app.use('/addresses', addressRouter(prisma));
app.use('/coupons', couponRouter(prisma));
app.use('/cart', cartRouter(prisma));
app.use('/orders', orderRouter(prisma));
app.use('/prescription', prescriptionRouter(prisma));
app.use('/payments', paymentRouter(prisma));
app.use('/media', mediaRouter(prisma));
app.use('/blog-posts', blogRouter(prisma));
app.use('/homepage-layout', homepageLayoutRouter(prisma));
app.use('/website', websiteRouter(prisma));
app.use('/integrations', integration(prisma));
app.use('/email-templates', emailTemplatesRouter(prisma));
app.use('/automation-rules', automationRulesRouter(prisma));
app.use('/contact-requests', contactRouter(prisma));
app.use('/about-us', aboutUsRoute(prisma)); // ✅ Use singular variable name
app.use('/countries', countryRouter(prisma));
app.use('/shipping', shippingRouter(prisma));
app.use('/payment-methods', paymentMethodRouter(prisma));


// app.use('')



app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        details: process.env.NODE_ENV === 'development' ? err : {},
    });
});

const PORT = process.env.PORT || 3200;

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`CORS Client Origin: ${process.env.CLIENT_ORIGIN}`);
    console.log(`JWT Secret: ${process.env.ACCESS_SECRET ? '***** (Set)' : 'NOT SET (Using default in auth.js)'}`);
    console.log(`Payload limit: 50MB`);
});

process.on('beforeExit', async () => {
    await prisma.$disconnect();
});