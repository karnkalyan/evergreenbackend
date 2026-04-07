// routes/country.routes.js
const express = require('express');
const {
  createCountry,
  updateCountry,
  deleteCountry,
  getCountries,
  getAllCountries,
  getCountryById,
  getCountryByCode,
  toggleCountryStatus,
  detectCountry
} = require('../controllers/country.controller.js');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });

  // Public routes
  router.get('/public', getCountries);
  router.get('/detect', detectCountry);
  router.get('/code/:code', getCountryByCode);

  // Admin routes
  router.use(isAuthenticated(prisma));

  // Create Country
  router.post(
    '/',
    checkPermission('create_countries'),
    createCountry
  );

  // Get All Countries (for admin)
  router.get(
    '/',
    checkPermission('read_countries'),
    getAllCountries
  );

  // Get Country by ID
  router.get(
    '/:id',
    checkPermission('read_countries'),
    getCountryById
  );

  // Update Country
  router.put(
    '/:id',
    checkPermission('update_countries'),
    updateCountry
  );

  // Delete Country
  router.delete(
    '/:id',
    checkPermission('delete_countries'),
    deleteCountry
  );

  // Toggle Country status
  router.patch(
    '/:id/toggle-status',
    checkPermission('update_countries'),
    toggleCountryStatus
  );

  return router;
};