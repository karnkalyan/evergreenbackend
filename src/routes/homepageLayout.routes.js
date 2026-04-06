// src/routes/homepageLayout.routes.js
const express = require('express');
const {
  getAllHomepageSections,
  getHomepageSectionById,
  createHomepageSection,
  updateHomepageSection,
  deleteHomepageSection,
  reorderHomepageSections,
  bulkUpdateHomepageSections
} = require('../controllers/homepageLayout.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

// Middleware imports
const cache = require('../middlewares/cache');
const rateLimit = require('express-rate-limit');

module.exports = (prisma) => {
  const router = express.Router();
  
  // Prisma instance middleware
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });

  // Rate limiting for public endpoints
  const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again after 15 minutes',
      retryAfter: 900
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });

  // Public routes - no authentication required
  router.get(
    '/', 
    publicLimiter,
    // cache(300), // Cache for 5 minutes (300 seconds)
    getAllHomepageSections
  );

  router.get(
    '/:id',
    publicLimiter,
    // cache(300), // Cache for 5 minutes
    getHomepageSectionById
  );

  // All other routes require authentication
  router.use(isAuthenticated(prisma));

  // Rate limiting for authenticated endpoints (more generous)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Higher limit for authenticated users
    message: {
      error: 'Too many requests, please try again after 15 minutes',
      retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Create new homepage section
  router.post(
    '/',
    authLimiter,
    checkPermission('create_homepage_layout'),
    createHomepageSection
  );

  // Update homepage section
  router.put(
    '/:id',
    authLimiter,
    checkPermission('update_homepage_layout'),
    updateHomepageSection
  );

  // Delete homepage section
  router.delete(
    '/:id',
    authLimiter,
    checkPermission('delete_homepage_layout'),
    deleteHomepageSection
  );

  // Reorder homepage sections
  router.patch(
    '/reorder',
    authLimiter,
    checkPermission('update_homepage_layout'),
    reorderHomepageSections
  );

  // Bulk update homepage sections
  router.patch(
    '/bulk-update',
    authLimiter,
    checkPermission('update_homepage_layout'),
    bulkUpdateHomepageSections
  );

  return router;
};