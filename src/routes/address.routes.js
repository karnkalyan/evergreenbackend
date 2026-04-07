const express = require('express');

// Controllers
const {
    getUserAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
} = require('../controllers/address.controller');

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

  // Authenticate all address routes
  router.use(isAuthenticated(prisma));

  // Create Address
  router.post(
    '/',
    checkPermission('create_addresses'),
    createAddress
  );

  // Get All Addresses for the authenticated user
  router.get(
    '/',
    checkPermission('read_addresses'),
    getUserAddresses
  );

  // Update Address
  router.put(
    '/:id',
    checkPermission('update_addresses'),
    updateAddress
  );
  
  // Set Address as Default
  router.patch(
    '/:id/default',
    checkPermission('update_addresses'),
    setDefaultAddress
  );

  // Delete Address (Soft Delete)
  router.delete(
    '/:id',
    checkPermission('delete_addresses'),
    deleteAddress
  );

  return router;
};