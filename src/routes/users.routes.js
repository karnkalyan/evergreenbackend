const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, param, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');

// Controllers
const {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/users.controller');

// Middlewares
const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');

// --- Multer Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve(__dirname, '../../uploads')),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`)
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed!'), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter
});

// --- Validation Schemas ---

// Create User
const createUserValidation = [
  body('firstName').isString().notEmpty().withMessage('First name is required'),
  body('lastName').isString().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('roleId').isInt({ gt: 0 }).withMessage('Role ID must be a positive integer'),
  body('status').optional().isIn(['active', 'inactive', 'pending', 'disabled']).withMessage('Invalid status'),
  body('phoneNumber').optional().isString(),
  body('streetAddress').optional().isString(),
  body('city').optional().isString(),
  body('state').optional().isString(),
  body('zipCode').optional().isString(),
  body('middleName').optional().isString()
];

// Update User
const updateUserValidation = [
  body('firstName').optional().isString(),
  body('lastName').optional().isString(),
  body('email').optional().isEmail(),
  body('password').optional().isLength({ min: 8 }),
  body('roleId').optional().isInt({ gt: 0 }),
  body('status').optional().isIn(['active', 'inactive', 'pending', 'disabled']),
  body('phoneNumber').optional().isString(),
  body('streetAddress').optional().isString(),
  body('city').optional().isString(),
  body('state').optional().isString(),
  body('zipCode').optional().isString(),
  body('middleName').optional().isString()
];

// ID validation
const idParamValidation = [param('id').isInt({ gt: 0 }).withMessage('User ID must be a positive integer')];

// --- Validation Handler ---
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// --- Router ---
module.exports = (prisma) => {
  const router = express.Router();

  // Attach Prisma client
  router.use((req, res, next) => { req.prisma = prisma; next(); });

  // Authenticate all routes


  // Create User
  router.post(
    '/',
    // checkPermission('create_users'),
    upload.single('profilePicture'),
    createUserValidation,
    // handleValidationErrors,
    createUser
  );


    router.use(isAuthenticated(prisma));
  // Get All Users
  router.get('/', checkPermission('read_users'), getAllUsers);

  // Get One User
  router.get(
    '/:id',
    idParamValidation,
    handleValidationErrors,
    checkPermission('read_users'),
    getUserById
  );

  // Update User
  router.put(
    '/:id',
    idParamValidation,
    handleValidationErrors,
    checkPermission('update_users'),
    upload.single('profilePicture'),
    updateUserValidation,
    handleValidationErrors,
    updateUser
  );

  // Delete User (Soft Delete)
  router.delete(
    '/:id',
    idParamValidation,
    handleValidationErrors,
    checkPermission('delete_users'),
    deleteUser
  );

  return router;
};
