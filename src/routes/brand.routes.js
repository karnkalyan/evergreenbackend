const express = require('express');
const {
  createBrand,
  updateBrand,
  deleteBrand,
  getAllBrands,
  getBrandById,
  getBrandBySlug,
  getPopularBrands,
  searchBrands
} = require('../controllers/brand.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');
const { 
  uploadBrandFiles,
  processUploadedFiles,
  cleanupUploadedFiles 
} = require('../middlewares/upload');

module.exports = (prisma) => {
  const router = express.Router();
  
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });

  // =============================================
  // PUBLIC ROUTES (No Authentication Required)
  // =============================================

  // Get All Brands (Public)
  router.get(
    '/public/brands',
    getAllBrands
  );

  // Get Popular Brands (Public)
  router.get(
    '/public/brands/popular/brands',
    getPopularBrands
  );

  // Get Brand by Slug (Public)
  router.get(
    '/public/brands/slug/:slug',
    getBrandBySlug
  );

  // Get Brand by ID (Public)
  router.get(
    '/public/brands/:id',
    getBrandById
  );

  // Search Brands (Public)
  router.get(
    '/public/brands/search/brands',
    searchBrands
  );

  // =============================================
  // AUTHENTICATED ROUTES (Require Authentication)
  // =============================================
  
  router.use(isAuthenticated(prisma));

  // Create Brand - with logo upload
  router.post(
    '/',
    checkPermission('create_brands'),
    (req, res, next) => {
      uploadBrandFiles(req, res, (err) => {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: 'File too large. Please check the file size limits.'
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              success: false,
              message: 'Too many files uploaded. Please check the file count limits.'
            });
          }
          if (err.message.includes('Invalid file type')) {
            return res.status(400).json({
              success: false,
              message: err.message
            });
          }
          return res.status(400).json({
            success: false,
            message: 'File upload failed: ' + err.message
          });
        }
        next();
      });
    },
    (req, res, next) => {
      try {
        if (req.files) {
          req.uploadedFiles = processUploadedFiles(req, 'brands');
        }
        next();
      } catch (error) {
        if (req.files) {
          cleanupUploadedFiles(req.files);
        }
        return res.status(500).json({
          success: false,
          message: 'Error processing uploaded files: ' + error.message
        });
      }
    },
    createBrand
  );

  // Get All Brands
  router.get(
    '/',
    checkPermission('read_brands'),
    getAllBrands
  );

  // Get Popular Brands
  router.get(
    '/popular/brands',
    checkPermission('read_brands'),
    getPopularBrands
  );

  // Search Brands
  router.get(
    '/search/brands',
    checkPermission('read_brands'),
    searchBrands
  );

  // Get Brand by ID
  router.get(
    '/:id',
    checkPermission('read_brands'),
    getBrandById
  );

  // Get Brand by Slug
  router.get(
    '/slug/:slug',
    checkPermission('read_brands'),
    getBrandBySlug
  );

  // Update Brand - with logo upload
  router.put(
    '/:id',
    checkPermission('update_brands'),
    (req, res, next) => {
      uploadBrandFiles(req, res, (err) => {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: 'File too large. Please check the file size limits.'
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              success: false,
              message: 'Too many files uploaded. Please check the file count limits.'
            });
          }
          if (err.message.includes('Invalid file type')) {
            return res.status(400).json({
              success: false,
              message: err.message
            });
          }
          return res.status(400).json({
            success: false,
            message: 'File upload failed: ' + err.message
          });
        }
        next();
      });
    },
    (req, res, next) => {
      try {
        if (req.files) {
          req.uploadedFiles = processUploadedFiles(req, 'brands');
        }
        next();
      } catch (error) {
        if (req.files) {
          cleanupUploadedFiles(req.files);
        }
        return res.status(500).json({
          success: false,
          message: 'Error processing uploaded files: ' + error.message
        });
      }
    },
    updateBrand
  );

  // Delete Brand
  router.delete(
    '/:id',
    checkPermission('delete_brands'),
    deleteBrand
  );

  return router;
};