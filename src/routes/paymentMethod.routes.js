const express = require('express');
const {
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getPaymentMethods,
  getAllPaymentMethods,
  getPaymentMethodById,
  getPaymentMethodByCode,
  togglePaymentMethodStatus,
  setDefaultPaymentMethod
} = require('../controllers/paymentMethod.controller.js');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });

  // Public routes
  router.get('/public', getPaymentMethods);

  // Admin routes
  router.use(isAuthenticated(prisma));

  // Create Payment Method
  router.post(
    '/',
    checkPermission('create_payment_method'),
    createPaymentMethod
  );

  // Get All Payment Methods (for admin)
  router.get(
    '/',
    checkPermission('read_payment_method'),
    getAllPaymentMethods
  );

  // Get Payment Method by ID
  router.get(
    '/:id',
    checkPermission('read_payment_method'),
    getPaymentMethodById
  );

  // Get Payment Method by Code
  router.get(
    '/code/:code',
    checkPermission('read_payment_method'),
    getPaymentMethodByCode
  );

  // Update Payment Method
  router.put(
    '/:id',
    checkPermission('update_payment_method'),
    updatePaymentMethod
  );

  // Delete Payment Method
  router.delete(
    '/:id',
    checkPermission('delete_payment_method'),
    deletePaymentMethod
  );

  // Toggle Payment Method status
  router.patch(
    '/:id/toggle-status',
    checkPermission('update_payment_method'),
    togglePaymentMethodStatus
  );

  // Set Default Payment Method
  router.patch(
    '/:id/set-default',
    checkPermission('update_payment_method'),
    setDefaultPaymentMethod
  );

  return router;
};