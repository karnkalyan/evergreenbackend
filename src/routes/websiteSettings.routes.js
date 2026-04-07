const express = require('express');
const {
  getWebsiteSettings,
  updateWebsiteSettings,
  getPageSeo,
  updatePageSeo,
  getNavigationMenus,
  createNavigationMenu,
  updateNavigationMenu,
  deleteNavigationMenu,
  getSitemap,
  getRobotsTxt
} = require('../controllers/websiteSettings.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

module.exports = (prisma) => {
  const router = express.Router();
  
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });

  // Public routes (no authentication required)
  router.get('/public/settings', getWebsiteSettings);
  router.get('/public/seo', getPageSeo);
  router.get('/public/navigation', getNavigationMenus);
  router.get('/public/sitemap.xml', getSitemap);
  router.get('/public/robots.txt', getRobotsTxt);

  // Protected routes
  router.use(isAuthenticated(prisma));

  // Website Settings
  router.get(
    '/settings',
    checkPermission('read_website_settings'),
    getWebsiteSettings
  );

  router.put(
    '/settings',
    checkPermission('update_website_settings'),
    updateWebsiteSettings
  );

  // SEO Management
  router.get(
    '/seo',
    checkPermission('read_seo'),
    getPageSeo
  );

  router.put(
    '/seo',
    checkPermission('update_seo'),
    updatePageSeo
  );

  // Navigation Management
  router.get(
    '/navigation',
    checkPermission('read_navigation'),
    getNavigationMenus
  );

  router.post(
    '/navigation',
    checkPermission('create_navigation'),
    createNavigationMenu
  );

  router.put(
    '/navigation/:id',
    checkPermission('update_navigation'),
    updateNavigationMenu
  );

  router.delete(
    '/navigation/:id',
    checkPermission('delete_navigation'),
    deleteNavigationMenu
  );

  return router;
};