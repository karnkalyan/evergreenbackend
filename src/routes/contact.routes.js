const express = require('express');
const {
  createContactRequest,
  getContactRequests,
  getContactRequest,
  updateContactRequest,
  deleteContactRequest,
  getContactRequestStats
} = require('../controllers/contact.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  // Inject prisma into request
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });

  // Public route - no authentication required for creating contact requests
  router.post('/', createContactRequest);

  // Admin routes - require authentication and permissions
  router.use(isAuthenticated(prisma));

  // Get all contact requests
  router.get(
    '/',
    checkPermission('read_contact_requests'),
    getContactRequests
  );

  // Get contact request stats
  router.get(
    '/stats',
    checkPermission('read_contact_requests'),
    getContactRequestStats
  );

  // Get contact request by ID
  router.get(
    '/:id',
    checkPermission('read_contact_requests'),
    getContactRequest
  );

  // Update contact request
  router.put(
    '/:id',
    checkPermission('update_contact_requests'),
    updateContactRequest
  );

  // Delete contact request
  router.delete(
    '/:id',
    checkPermission('delete_contact_requests'),
    deleteContactRequest
  );

  return router;
};