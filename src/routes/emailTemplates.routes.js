const express = require('express');
const {
  getAllEmailTemplates,
  getEmailTemplateById,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  previewEmailTemplate,
  duplicateEmailTemplate
} = require('../controllers/emailTemplates.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });
  
  router.use(isAuthenticated(prisma));

  router.get('/', checkPermission('read_email_templates'), getAllEmailTemplates);
  router.get('/:id', checkPermission('read_email_templates'), getEmailTemplateById);
  router.post('/', checkPermission('create_email_templates'), createEmailTemplate);
  router.put('/:id', checkPermission('update_email_templates'), updateEmailTemplate);
  router.delete('/:id', checkPermission('delete_email_templates'), deleteEmailTemplate);
  router.post('/:id/preview', checkPermission('read_email_templates'), previewEmailTemplate);
  router.post('/:id/duplicate', checkPermission('create_email_templates'), duplicateEmailTemplate);

  return router;
};