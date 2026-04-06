// src/routes/authRoutes.js
const express           = require('express');
const { 
   authMe, 
  login, 
  refresh, 
  logout, 
  logoutAll,
  googleLogin 
 } = require('../controllers/auth.controller');

module.exports = () => {
  const router = express.Router();
  router.get('/me',    authMe);
  router.post('/login',   login);
  router.post('/refresh', refresh);
  router.post('/logout',  logout);
  router.post('/logout-all', logoutAll);
  router.post('/google', googleLogin); 

  return router;
};
