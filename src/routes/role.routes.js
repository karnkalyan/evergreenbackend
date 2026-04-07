const express = require('express');
const {
  createRole,
  updateRole,
  deleteRole,
  getAllRoles,
  getRoleById,
  getRolesForSelect
} = require('../controllers/role.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });
  
  router.use(isAuthenticated(prisma));

  // Create Role
  router.post(
    '/',
    checkPermission('create_roles'),
    createRole
  );

  // Get All Roles
  router.get(
    '/',
    checkPermission('read_roles'),
    getAllRoles
  );

  // Get Roles for Select/Dropdown
  router.get(
    '/select/roles',
    checkPermission('read_roles'),
    getRolesForSelect
  );

  // Get Role by ID
  router.get(
    '/:id',
    checkPermission('read_roles'),
    getRoleById
  );

  // Update Role
  router.put(
    '/:id',
    checkPermission('update_roles'),
    updateRole
  );

  // Delete Role
  router.delete(
    '/:id',
    checkPermission('delete_roles'),
    deleteRole
  );

  return router;
};