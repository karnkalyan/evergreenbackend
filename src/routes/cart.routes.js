const express = require('express');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartTotal
} = require('../controllers/cart.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });
  
  router.use(isAuthenticated(prisma));

  // Get Cart
  router.get(
    '/:userId',
    // checkPermission('read_orders'),
    getCart
  );

  // Get Cart Total
  router.get(
    '/:userId/total',
    // checkPermission('read_orders'),
    getCartTotal
  );

  // Add to Cart
  router.post(
    '/:userId/items',
    // checkPermission('create_orders'),
    addToCart
  );

  // Update Cart Item
  router.patch(
    '/:userId/items/:itemId',
    // checkPermission('update_orders'),
    updateCartItem
  );

  // Remove from Cart
  router.delete(
    '/:userId/items/:itemId',
    // checkPermission('update_orders'),
    removeFromCart
  );

  // Clear Cart
  router.delete(
    '/:userId/clear',
    // checkPermission('update_orders'),
    clearCart
  );

  return router;
};