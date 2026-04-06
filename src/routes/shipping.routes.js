// routes/shipping.routes.js
const express = require('express');
const {
  createShipping,
  updateShipping,
  deleteShipping,
  getShippingOptions,
  getAllShippingOptions,
  getShippingById,
  getShippingByCode,
  toggleShippingStatus,
  setDefaultShipping
} = require('../controllers/shipping.controller.js');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });

  // Public routes
  router.get('/public', getShippingOptions);

  // Admin routes
  router.use(isAuthenticated(prisma));

  // Create Shipping
  router.post(
    '/',
    checkPermission('create_shipping'),
    createShipping
  );

  // Get All Shipping Options (for admin)
  router.get(
    '/',
    checkPermission('read_shipping'),
    getAllShippingOptions
  );

  // Get Shipping by ID
  router.get(
    '/:id',
    checkPermission('read_shipping'),
    getShippingById
  );

  // Get Shipping by Code
  router.get(
    '/code/:code',
    checkPermission('read_shipping'),
    getShippingByCode
  );

  // Update Shipping
  router.put(
    '/:id',
    checkPermission('update_shipping'),
    updateShipping
  );

  // Delete Shipping
  router.delete(
    '/:id',
    checkPermission('delete_shipping'),
    deleteShipping
  );

  // Toggle Shipping status
  router.patch(
    '/:id/toggle-status',
    checkPermission('update_shipping'),
    toggleShippingStatus
  );

  // Set Default Shipping
  router.patch(
    '/:id/set-default',
    checkPermission('update_shipping'),
    setDefaultShipping
  );

  return router;
};