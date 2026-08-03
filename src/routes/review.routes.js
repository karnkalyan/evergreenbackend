// backend/src/routes/review.routes.js
const express = require('express');
const {
  createReview,
  getProductReviews,
  getAdminReviews,
  updateReviewStatus,
  deleteReview,
} = require('../controllers/review.controller');
const isAuthenticated = require('../middlewares/isAuthenticated');

module.exports = (prisma) => {
  const router = express.Router();

  // Public endpoints (Guest allowed)
  router.post('/', createReview(prisma));
  router.get('/product/:productId', getProductReviews(prisma));

  // Admin endpoints (Protected)
  router.get('/admin', isAuthenticated(prisma), getAdminReviews(prisma));
  router.patch('/admin/:id/status', isAuthenticated(prisma), updateReviewStatus(prisma));
  router.delete('/admin/:id', isAuthenticated(prisma), deleteReview(prisma));

  return router;
};
