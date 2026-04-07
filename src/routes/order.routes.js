const express = require('express');
const {
  createOrder,
  getAllOrders,
  getOrderById,
  getOrderByNumber,
  getUserOrders,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderStats,
  updateOrderShipping,
  updateOrderPaymentStatus,
  getAdminDashboardStats,
  getMonthlyRevenue,
  getOrderStatusDistribution,
  getTopSellingProducts,
  getSalesReports,
  sendOrderEmail // Add this new controller
} = require('../controllers/order.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });
  
  router.use(isAuthenticated(prisma));

  // Create Order
  router.post(
    '/',
    checkPermission('create_orders'),
    createOrder
  );

  router.get(
  '/reports/sales',
  checkPermission('read_orders'),
  getSalesReports
);

  // Get All Orders (Admin)
  router.get(
    '/',
    checkPermission('read_orders'),
    getAllOrders
  );

  // Get Order Statistics (General)
  router.get(
    '/stats/orders',
    checkPermission('read_orders'),
    getOrderStats
  );

  // 🆕 Get Admin Dashboard Statistics
  router.get(
    '/stats/admin',
    checkPermission('read_orders'),
    getAdminDashboardStats
  );




router.get(
  '/stats/revenue/monthly',
  checkPermission('read_orders'),
  getMonthlyRevenue
);

// Order Status Distribution Chart Data
router.get(
  '/stats/orders/distribution',
  checkPermission('read_orders'),
  getOrderStatusDistribution
);

// Top Selling Products Chart Data
router.get(
  '/stats/products/top-selling',
  checkPermission('read_orders'),
  getTopSellingProducts
);








  // Get User Orders
  router.get(
    '/user/:userId',
    checkPermission('read_orders'),
    getUserOrders
  );

  // Get Order by ID
  router.get(
    '/:id',
    checkPermission('read_orders'),
    getOrderById
  );

  // Get Order by Order Number
  router.get(
    '/number/:orderNumber',
    checkPermission('read_orders'),
    getOrderByNumber
  );

  // Update Order Shipping
  router.patch(
    '/:id/shipping',
    checkPermission('update_orders'),
    updateOrderShipping
  );

  // Update Order Payment Status
  router.patch(
    '/:id/payment-status',
    checkPermission('update_orders'),
    updateOrderPaymentStatus
  );

  // Update Order Status
  router.patch(
    '/:id/status',
    checkPermission('update_orders'),
    updateOrderStatus
  );

  // Update Payment Status
  router.patch(
    '/:id/payment',
    checkPermission('update_orders'),
    updatePaymentStatus
  );

  // 🆕 Send Email for Order
  router.post(
    '/:id/send-email',
    checkPermission('update_orders'),
    sendOrderEmail
  );

  return router;
};