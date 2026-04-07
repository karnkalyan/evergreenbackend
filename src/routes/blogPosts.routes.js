// src/routes/blogPosts.routes.js
const express = require('express');
const {
  getAllBlogPosts,
  getBlogPostById,
  getBlogPostBySlug,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  toggleBlogPostStatus,
  likeBlogPost,
  unlikeBlogPost,
  getLikeStatus,
  shareBlogPost
} = require('../controllers/blogPosts.controller');

// --- Import the FACTORIES ---
const isAuthenticatedFactory = require('../middlewares/isAuthenticated');
const checkPermissionFactory = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  // --- Create the ACTUAL MIDDLEWARE functions by invoking the factories ---
  const isAuthenticated = isAuthenticatedFactory(prisma);
  // Assuming checkPermission follows the same factory pattern
  const checkPermission = (permission) => checkPermissionFactory(prisma, permission); 

  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });

  // Public routes (no authentication required)
  router.get('/', getAllBlogPosts);
  router.get('/slug/:slug', getBlogPostBySlug);

  // --- Use the invoked middleware functions ---
  // Like/Share routes
  router.post('/:id/like', isAuthenticated, likeBlogPost);
  router.post('/:id/unlike', isAuthenticated, unlikeBlogPost);
  router.get('/:id/like-status', isAuthenticated, getLikeStatus);
  router.post('/:id/share', isAuthenticated, shareBlogPost);

  // Protected routes (require authentication and permissions)
  // This line will now correctly apply the real middleware
  router.use(isAuthenticated); 

  // Get blog post by ID (protected)
  router.get(
    '/:id',
    // checkPermission factory likely needs prisma too, but your app.js
    // implies it's instantiated inside the factory. If it doesn't need
    // prisma, the original "checkPermission('...')" is fine.
    // We pass the string to our new checkPermission function.
    checkPermission('read_blog_posts'), 
    getBlogPostById
  );

  // Create blog post
  router.post(
    '/',
    checkPermission('create_blog_posts'),
    createBlogPost
  );

  // Update blog post
  router.put(
    '/:id',
    checkPermission('update_blog_posts'),
    updateBlogPost
  );

  // Toggle blog post status
  router.patch(
    '/:id/toggle-status',
    checkPermission('update_blog_posts'),
  toggleBlogPostStatus
  );

  // Delete blog post
  router.delete(
    '/:id',
    checkPermission('delete_blog_posts'),
    deleteBlogPost
  );

  return router;
};