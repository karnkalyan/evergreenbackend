// routes/media.js

const express = require('express');
const {
  getAllMedia,
  getMediaById,
  uploadMedia,
  updateMedia,
  deleteMedia,
  bulkDeleteMedia,
  getMediaStats
} = require('../controllers/media.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');
const { 
  uploadMediaFiles,
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

  // Get Media by ID (Public - for serving files)
  router.get('/public/:id', getMediaById);

  // =============================================
  // AUTHENTICATED ROUTES (Require Authentication)
  // =============================================
  
  router.use(isAuthenticated(prisma));

  // Get all media with pagination and filters
  router.get(
    '/',
    checkPermission('read_media'),
    getAllMedia
  );

  // Get media statistics
  router.get(
    '/stats',
    checkPermission('read_media'),
    getMediaStats
  );

  // Get single media by ID
  router.get(
    '/:id',
    checkPermission('read_media'),
    getMediaById
  );

  // Upload media files - FIXED: Use uploadMediaFiles middleware
  router.post(
    '/upload',
    checkPermission('create_media'),
    (req, res, next) => {
      // Use the pre-configured uploadMediaFiles middleware
      uploadMediaFiles(req, res, (err) => {
        if (err) {
          console.error('Upload middleware error:', err);
          
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: 'File too large. Maximum size is 5MB for images.'
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              success: false,
              message: 'Too many files uploaded. Maximum is 20 files.'
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
        console.log('Uploaded files:', req.files); // Debug log
        
        if (req.files && req.files.files) {
          req.uploadedFiles = processUploadedFiles(req, 'media');
          console.log('Processed files:', req.uploadedFiles); // Debug log
        } else {
          console.log('No files found in req.files'); // Debug log
          req.uploadedFiles = {};
        }
        next();
      } catch (error) {
        console.error('Error processing uploaded files:', error);
        if (req.files) {
          cleanupUploadedFiles(req.files);
        }
        return res.status(500).json({
          success: false,
          message: 'Error processing uploaded files: ' + error.message
        });
      }
    },
    uploadMedia
  );

  // Update media metadata
  router.put(
    '/:id',
    checkPermission('update_media'),
    updateMedia
  );

  // Delete media
  router.delete(
    '/:id',
    checkPermission('delete_media'),
    deleteMedia
  );

  // Bulk delete media
  router.post(
    '/bulk-delete',
    checkPermission('delete_media'),
    bulkDeleteMedia
  );

  return router;
};