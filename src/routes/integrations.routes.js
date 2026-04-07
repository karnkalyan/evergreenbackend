const express = require('express');
const {
  getIntegrationSettings,
  updateIntegrationSettings,
  testSmtpConnection,
  testSmsGateway,
  testPaymentGateway
} = require('../controllers/integrations.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });

  // All routes require authentication
  router.use(isAuthenticated(prisma));

  // Get Integration Settings
  router.get(
    '/',
    checkPermission('read_integrations'),
    getIntegrationSettings
  );

  // Update Integration Settings
  router.put(
    '/',
    checkPermission('update_integrations'),
    updateIntegrationSettings
  );

  // Test SMTP Connection
  router.post(
    '/test/smtp',
    checkPermission('update_integrations'),
    testSmtpConnection
  );

  // Test SMS Gateway
  router.post(
    '/test/sms',
    checkPermission('update_integrations'),
    testSmsGateway
  );

  // Test Payment Gateway
  router.post(
    '/test/payment',
    checkPermission('update_integrations'),
    testPaymentGateway
  );

  return router;
};