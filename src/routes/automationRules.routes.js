const express = require('express');
const {
  getAllAutomationRules,
  getAutomationRuleById,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  testAutomationRule,
  getAutomationStats
} = require('../controllers/automationRules.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });
  
  router.use(isAuthenticated(prisma));

  router.get('/', checkPermission('read_automation_rules'), getAllAutomationRules);
  router.get('/:id', checkPermission('read_automation_rules'), getAutomationRuleById);
  router.post('/', checkPermission('create_automation_rules'), createAutomationRule);
  router.put('/:id', checkPermission('update_automation_rules'), updateAutomationRule);
  router.delete('/:id', checkPermission('delete_automation_rules'), deleteAutomationRule);
  router.post('/:id/test', checkPermission('update_automation_rules'), testAutomationRule);
  router.get('/stats/overview', checkPermission('read_automation_rules'), getAutomationStats);

  return router;
};