const express = require('express');
const { 
  createCategory, 
  updateCategory, 
  deleteCategory, 
  getAllCategories, 
  getCategoryById,
  getCategoryBySlug,
  getCategoryHierarchy
} = require('../controllers/categories.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');
const { 
  uploadCategoryFiles,
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

  // Get All Categories (Public)
  router.get(
    '/public/categories',
    getAllCategories
  );

  // Get Category by Slug (Public)
  router.get(
    '/public/categories/slug/:slug',
    getCategoryBySlug
  );

  // Get Category Hierarchy (Public)
  router.get(
    '/public/categories/hierarchy/tree',
    getCategoryHierarchy
  );

  // Get Category by ID (Public)
  router.get(
    '/public/categories/:id',
    getCategoryById
  );

  // =============================================
  // AUTHENTICATED ROUTES (Require Authentication)
  // =============================================
  
  router.use(isAuthenticated(prisma));

  // Create Category - with multiple file upload support
  router.post(
    '/',
    checkPermission('create_categories'),
    (req, res, next) => {
      uploadCategoryFiles(req, res, (err) => {
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
        // Process uploaded files and attach to request
        if (req.files) {
          req.uploadedFiles = processUploadedFiles(req, 'categories');
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
    createCategory
  );

  // Get All Categories
  router.get(
    '/',
    checkPermission('read_categories'),
    getAllCategories
  );

  // Get Category Hierarchy
  router.get(
    '/hierarchy/tree',
    checkPermission('read_categories'),
    getCategoryHierarchy
  );

  // Get Category by ID
  router.get(
    '/:id',
    checkPermission('read_categories'),
    getCategoryById
  );

  // Get Category by Slug
  router.get(
    '/slug/:slug',
    checkPermission('read_categories'),
    getCategoryBySlug
  );

  // Update Category - with multiple file upload support
  router.put(
    '/:id',
    checkPermission('update_categories'),
    (req, res, next) => {
      uploadCategoryFiles(req, res, (err) => {
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
          req.uploadedFiles = processUploadedFiles(req, 'categories');
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
    updateCategory
  );

  // Delete Category
  router.delete(
    '/:id',
    checkPermission('delete_categories'),
    deleteCategory
  );

  return router;
};