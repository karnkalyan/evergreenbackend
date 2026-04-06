const express = require('express');
const {
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getAllCoupons,
  getCouponById,
  getCouponByCode,
  validateCoupon,
  getCouponStats
} = require('../controllers/coupon.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });

    router.get(
    '/',
    getAllCoupons
  );
  
  router.use(isAuthenticated(prisma));

  // Create Coupon
  router.post(
    '/',
    checkPermission('create_coupons'),
    createCoupon
  );

  // Get All Coupons
  router.get(
    '/',
    checkPermission('read_coupons'),
    getAllCoupons
  );

  // Get Coupon Statistics
  router.get(
    '/stats/coupons',
    checkPermission('read_coupons'),
    getCouponStats
  );

  // Validate Coupon
  router.post(
    '/validate',
    checkPermission('read_coupons'),
    validateCoupon
  );

  // Get Coupon by ID
  router.get(
    '/:id',
    checkPermission('read_coupons'),
    getCouponById
  );

  // Get Coupon by Code
  router.get(
    '/code/:code',
    checkPermission('read_coupons'),
    getCouponByCode
  );

  // Update Coupon
  router.put(
    '/:id',
    checkPermission('update_coupons'),
    updateCoupon
  );

  // Delete Coupon
  router.delete(
    '/:id',
    checkPermission('delete_coupons'),
    deleteCoupon
  );

  return router;
};