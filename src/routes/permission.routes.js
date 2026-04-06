const express = require('express');
const {
  createPermission,
  updatePermission,
  deletePermission,
  getAllPermissions,
  getPermissionById,
  getPermissionsByMenu
} = require('../controllers/permission.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });
  
  router.use(isAuthenticated(prisma));

  // Create Permission
  router.post(
    '/',
    checkPermission('create_permissions'),
    createPermission
  );

  // Get All Permissions
  router.get(
    '/',
    checkPermission('read_permissions'),
    getAllPermissions
  );

  // Get Permissions Grouped by Menu
  router.get(
    '/menu/permissions',
    checkPermission('read_permissions'),
    getPermissionsByMenu
  );

  // Get Permission by ID
  router.get(
    '/:id',
    checkPermission('read_permissions'),
    getPermissionById
  );

  // Update Permission
  router.put(
    '/:id',
    checkPermission('update_permissions'),
    updatePermission
  );

  // Delete Permission
  router.delete(
    '/:id',
    checkPermission('delete_permissions'),
    deletePermission
  );

  return router;
};