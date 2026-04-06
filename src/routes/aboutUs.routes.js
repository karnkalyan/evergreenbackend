// routes/aboutUs.routes.js
const express = require('express');
const {
  createAboutUs,
  updateAboutUs,
  deleteAboutUs,
  getAboutUs,
  getAllAboutUs,
  getAboutUsById,
  toggleAboutUsStatus
} = require('../controllers/aboutUs.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });

  // Public route - get active About Us content
  router.get('/public', getAboutUs); // Endpoint is /public, relative to the base path
  // Admin routes
  router.use(isAuthenticated(prisma));

  // Create About Us
  router.post(
    '/',
    checkPermission('create_about_us'),
    createAboutUs
  );

  // Get All About Us (for admin)
  router.get(
    '/',
    checkPermission('read_about_us'),
    getAllAboutUs
  );

  // Get About Us by ID
  router.get(
    '/:id',
    checkPermission('read_about_us'),
    getAboutUsById
  );

  // Update About Us
  router.put(
    '/:id',
    checkPermission('update_about_us'),
    updateAboutUs
  );

  // Delete About Us
  router.delete(
    '/:id',
    checkPermission('update_about_us'),
    deleteAboutUs
  );

  // Toggle About Us status
  router.patch(
    '/:id/toggle-status',
    checkPermission('update_about_us'),
    toggleAboutUsStatus
  );

  return router;
};