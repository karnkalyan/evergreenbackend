const express = require('express');

// Controllers
const {
    getUserPayments,
    getPaymentById,
    processPayment,
    updatePaymentStatus,
    initiateRefund,
    getPaymentMethods
} = require('../controllers/payment.controller');

// Middlewares
const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

// --- Router ---
module.exports = (prisma) => {
  const router = express.Router();

  // Attach Prisma client
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });

  // Get available payment methods (public route)
  router.get('/methods', getPaymentMethods);

  // Authenticate all other payment routes
  router.use(isAuthenticated(prisma));

  // Get all payments for authenticated user
  router.get(
    '/',
    checkPermission('read_payments'),
    getUserPayments
  );

  // Get specific payment by ID
  router.get(
    '/:id',
    checkPermission('read_payments'),
    getPaymentById
  );

  // Process new payment
  router.post(
    '/process',
    checkPermission('create_payments'),
    processPayment
  );

  // Update payment status (admin/system)
  router.patch(
    '/:id/status',
    checkPermission('update_payments'),
    updatePaymentStatus
  );

  // Initiate refund
  router.post(
    '/:id/refund',
    checkPermission('update_payments'),
    initiateRefund
  );

  return router;
};