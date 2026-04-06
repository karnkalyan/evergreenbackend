// medicinerequest.routes.js
const express = require('express');
const {
  createMedicationRequest,
  getMedicationRequests,
  getMedicationRequest,
  updateMedicationRequest,
  deleteMedicationRequest,
  getMedicationRequestStats
} = require('../controllers/medicinerequest.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  // Inject prisma into request
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });

  // Public route - no authentication required for creating medication requests
  router.post(
    '/',
    createMedicationRequest
  );

  // Admin routes - require authentication and permissions
  router.use(isAuthenticated(prisma));

  // Get all medication requests
  router.get(
    '/',
    checkPermission('read_medication_requests'),
    getMedicationRequests
  );

  // Get medication request stats
  router.get(
    '/stats',
    checkPermission('read_medication_requests'),
    getMedicationRequestStats
  );

  // Get medication request by ID
  router.get(
    '/:id',
    checkPermission('read_medication_requests'),
    getMedicationRequest
  );

  // Update medication request
  router.put(
    '/:id',
    checkPermission('update_medication_requests'),
    updateMedicationRequest
  );

  // Delete medication request
  router.delete(
    '/:id',
    checkPermission('delete_medication_requests'),
    deleteMedicationRequest
  );

  return router;
};