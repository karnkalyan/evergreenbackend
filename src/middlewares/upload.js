const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Supported file types configuration
const fileTypes = {
  images: {
    allowedMimes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml'
    ],
    maxSize: 5 * 1024 * 1024, // 5MB
    defaultFieldName: 'images'
  },
  pdf: {
    allowedMimes: [
      'application/pdf'
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
    defaultFieldName: 'documents'
  },
  documents: {
    allowedMimes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
    defaultFieldName: 'documents'
  },
  // NEW: Prescription-specific configuration
  prescriptions: {
    allowedMimes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/pdf'
    ],
    maxSize: 5 * 1024 * 1024, // 5MB
    defaultFieldName: 'prescription'
  }
};

// Entity-specific configurations
const entityConfigs = {
  products: {
    directory: 'products',
    fields: {
      primaryImage: { type: 'images', maxCount: 1 },
      secondaryImages: { type: 'images', maxCount: 20 },
      ogImage: { type: 'images', maxCount: 1 },
      documents: { type: 'documents', maxCount: 10 }
    }
  },
  categories: {
    directory: 'categories',
    fields: {
      image: { type: 'images', maxCount: 1 },
      banner: { type: 'images', maxCount: 1 },
      catLogo: { type: 'images', maxCount: 1 }
    }
  },
  brands: {
    directory: 'brands',
    fields: {
      logo: { type: 'images', maxCount: 1 },
      banner: { type: 'images', maxCount: 1 },
      documents: { type: 'documents', maxCount: 3 }
    }
  },
  media: {
    directory: 'media',
    fields: {
      files: { type: 'images', maxCount: 20 }
    }
  },
  // NEW: Blog entity for featured images
  blog: {
    directory: 'blog',
    fields: {
      featuredImage: { type: 'images', maxCount: 1 },
      contentImages: { type: 'images', maxCount: 10 }
    }
  },
  users: {
    directory: 'users',
    fields: {
      avatar: { type: 'images', maxCount: 1 },
      cover: { type: 'images', maxCount: 1 },
      documents: { type: 'documents', maxCount: 5 }
    }
  },
  // NEW: Prescriptions entity
  prescriptions: {
    directory: 'prescriptions',
    fields: {
      prescription: { type: 'prescriptions', maxCount: 1 }
    }
  },
  general: {
    directory: 'general',
    fields: {
      files: { type: 'images', maxCount: 10 }
    }
  }
};

// Ensure upload directories exist
const ensureDirectories = () => {
  const baseDirs = ['uploads', 'uploads/temp'];
  const entityDirs = Object.values(entityConfigs).map(config => 
    `uploads/${config.directory}`
  );
  
  [...baseDirs, ...entityDirs].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Initialize directories
ensureDirectories();

// Dynamic storage configuration
const createStorage = (entity, fileType = 'images') => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const entityConfig = entityConfigs[entity] || entityConfigs.general;
      // Handle fileType based on fieldname
      let specificFileType = fileType;
      
      // Check if entity has field-specific configuration
      if (entityConfig.fields[file.fieldname]) {
        specificFileType = entityConfig.fields[file.fieldname].type;
      }
      
      const dir = `uploads/${entityConfig.directory}/${specificFileType}`;
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileExtension = path.extname(file.originalname);
      const originalName = path.basename(file.originalname, fileExtension);
      const fileName = `${originalName}-${uniqueSuffix}${fileExtension}`
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .toLowerCase();
      
      cb(null, fileName);
    }
  });
};

// Dynamic file filter
const createFileFilter = (type) => {
  return (req, file, cb) => {
    const config = fileTypes[type] || fileTypes.images;
    
    if (config.allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${config.allowedMimes.join(', ')}`), false);
    }
  };
};

// Main upload generator function
const createUploader = (options = {}) => {
  const {
    entity = 'general',
    type = 'images',
    fieldName = null,
    maxCount = 1,
    customFilter = null,
    customStorage = null
  } = options;

  const entityConfig = entityConfigs[entity] || entityConfigs.general;
  const fileTypeConfig = fileTypes[type] || fileTypes.images;
  const finalFieldName = fieldName || fileTypeConfig.defaultFieldName;
  const storage = customStorage || createStorage(entity, type);
  const fileFilter = customFilter || createFileFilter(type);
  const limits = {
    fileSize: fileTypeConfig.maxSize,
    files: maxCount
  };

  const upload = multer({
    storage,
    fileFilter,
    limits
  });

  return upload;
};

// --- Pre-configured upload middlewares ---

// For single file upload
const uploadFile = (entity, type = 'images', fieldName = null) => {
  const uploader = createUploader({ entity, type, fieldName, maxCount: 1 });
  return uploader.single(fieldName || fileTypes[type]?.defaultFieldName || 'file');
};

// For multiple files upload
const uploadFiles = (entity, type = 'images', fieldName = null, maxCount = 10) => {
  const uploader = createUploader({ entity, type, fieldName, maxCount });
  return uploader.array(fieldName || fileTypes[type]?.defaultFieldName || 'files', maxCount);
};

// For multiple fields with different types
const uploadMultipleFields = (entity, fieldsConfig) => {
  const fields = [];
  
  Object.entries(fieldsConfig).forEach(([fieldName, config]) => {
    fields.push({
      name: fieldName,
      maxCount: config.maxCount || 1
    });
  });

  const storage = createStorage(entity);

  const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
      const fieldConfig = fieldsConfig[file.fieldname];
      if (!fieldConfig) {
        return cb(new Error(`Unexpected file field: ${file.fieldname}`), false);
      }
      
      const fileType = fieldConfig.type || 'images';
      const typeConfig = fileTypes[fileType] || fileTypes.images;

      if (typeConfig.allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type for ${file.fieldname}. Allowed: ${typeConfig.allowedMimes.join(', ')}`), false);
      }
    },
    limits: {
      fileSize: fileTypes.images.maxSize 
    }
  });

  return upload.fields(fields);
};

// --- NEW: Prescription-specific uploader ---
const uploadPrescriptionFile = uploadFile('prescriptions', 'prescriptions', 'prescription');

// --- Entity-specific pre-configured uploaders ---

// Products
const uploadProductImages = uploadMultipleFields('products', {
  primaryImage: { type: 'images', maxCount: 1 },
  secondaryImages: { type: 'images', maxCount: 20 },
  ogImage: { type: 'images', maxCount: 1 },
  documents: { type: 'documents', maxCount: 10 }
});

// Categories
const uploadCategoryFiles = uploadMultipleFields('categories', {
  image: { type: 'images', maxCount: 1 },
  banner: { type: 'images', maxCount: 1 },
  catLogo: { type: 'images', maxCount: 1 }
});

// Brands
const uploadBrandFiles = uploadMultipleFields('brands', {
  logo: { type: 'images', maxCount: 1 },
  banner: { type: 'images', maxCount: 1 },
  documents: { type: 'documents', maxCount: 3 }
});

// Media
const uploadMediaFiles = uploadMultipleFields('media', {
  files: { type: 'images', maxCount: 20 }
});

// Blog
const uploadBlogFiles = uploadMultipleFields('blog', {
  featuredImage: { type: 'images', maxCount: 1 },
  contentImages: { type: 'images', maxCount: 10 }
});

// Users
const uploadUserFiles = uploadMultipleFields('users', {
  avatar: { type: 'images', maxCount: 1 },
  cover: { type: 'images', maxCount: 1 },
  documents: { type: 'documents', maxCount: 5 }
});

// --- Utility functions ---

// Process uploaded files and return structured data
const processUploadedFiles = (req, entity = 'general') => {
  const files = req.files || {};
  const entityConfig = entityConfigs[entity] || entityConfigs.general;
  const processedFiles = {};

  Object.keys(entityConfig.fields).forEach(fieldName => {
    if (files[fieldName]) {
      const fieldConfig = entityConfig.fields[fieldName];
      const isArray = fieldConfig.maxCount > 1;
      
      if (isArray) {
        processedFiles[fieldName] = files[fieldName].map((file, index) => ({
          url: `/${file.path.replace(/\\/g, '/')}`,
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          fieldName: fieldName,
          order: index,
          alt: req.body[`${fieldName}Alt_${index}`] || req.body[`${fieldName}Alt`] || '',
          isPrimary: fieldName === 'primaryImage',
          path: file.path
        }));
      } else {
        const file = files[fieldName][0];
        processedFiles[fieldName] = {
          url: `/${file.path.replace(/\\/g, '/')}`,
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          fieldName: fieldName,
          alt: req.body[`${fieldName}Alt`] || '',
          isPrimary: fieldName === 'primaryImage',
          path: file.path
        };
      }
    }
  });

  return processedFiles;
};

// NEW: Process blog files specifically
const processBlogFiles = (req) => {
  const files = req.files || {};
  const processedFiles = {};

  if (files.featuredImage && files.featuredImage.length > 0) {
    const file = files.featuredImage[0];
    processedFiles.featuredImage = {
      url: `/${file.path.replace(/\\/g, '/')}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      fieldName: 'featuredImage',
      path: file.path
    };
  }

  if (files.contentImages && files.contentImages.length > 0) {
    processedFiles.contentImages = files.contentImages.map((file, index) => ({
      url: `/${file.path.replace(/\\/g, '/')}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      fieldName: 'contentImages',
      order: index,
      path: file.path
    }));
  }

  return processedFiles;
};

// NEW: Process media files specifically
const processMediaFiles = (req) => {
  const files = req.files || {};
  const processedFiles = [];

  if (files.files && files.files.length > 0) {
    files.files.forEach((file, index) => {
      processedFiles.push({
        url: `/${file.path.replace(/\\/g, '/')}`,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        fieldName: 'files',
        order: index,
        path: file.path
      });
    });
  }

  return processedFiles;
};

// NEW: Process prescription files specifically
const processPrescriptionFiles = (req) => {
  const files = req.files || {};
  const processedFiles = [];

  if (files.prescription && files.prescription.length > 0) {
    files.prescription.forEach((file, index) => {
      processedFiles.push({
        url: `/${file.path.replace(/\\/g, '/')}`,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        fieldName: 'prescription',
        order: index,
        path: file.path
      });
    });
  }

  return processedFiles;
};

// Delete file utility
const deleteFile = (filePath) => {
  try {
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    
    if (fs.existsSync(cleanPath)) {
      fs.unlinkSync(cleanPath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

// Delete multiple files
const deleteFiles = (filePaths) => {
  const results = {
    success: [],
    failed: []
  };
  filePaths.forEach(filePath => {
    const success = deleteFile(filePath);
    if (success) {
      results.success.push(filePath);
    } else {
      results.failed.push(filePath);
    }
  });
  return results;
};

// Clean up uploaded files on error
const cleanupUploadedFiles = (uploadedFiles) => {
  const filesToDelete = [];
  const collectFilePaths = (files) => {
    if (Array.isArray(files)) {
      files.forEach(file => {
        if (file.url) filesToDelete.push(file.url);
        if (file.path) filesToDelete.push(file.path);
      });
    } else if (files && typeof files === 'object') {
      Object.values(files).forEach(value => {
        if (Array.isArray(value)) {
          value.forEach(file => {
            if (file.url) filesToDelete.push(file.url);
            if (file.path) filesToDelete.push(file.path);
          });
        } else if (value && value.url) {
          filesToDelete.push(value.url);
        } else if (value && value.path) {
          filesToDelete.push(value.path);
        }
      });
    }
  };
  
  collectFilePaths(uploadedFiles);
  return deleteFiles(filesToDelete);
};

// Get file information
const getFileInfo = (filePath) => {
  try {
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    
    if (fs.existsSync(cleanPath)) {
      const stats = fs.statSync(cleanPath);
      return {
        exists: true,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime
      };
    }
    return { exists: false };
  } catch (error) {
    return { exists: false, error: error.message };
  }
};

// Validate file type
const validateFileType = (file, allowedTypes = ['images']) => {
  const allowedMimes = allowedTypes.flatMap(type => 
    fileTypes[type]?.allowedMimes || []
  );
  
  return allowedMimes.includes(file.mimetype);
};

module.exports = {
  // Core upload functions
  createUploader,
  uploadFile,
  uploadFiles,
  uploadMultipleFields,
  
  // NEW: Prescription upload function
  uploadPrescriptionFile,
  
  // Pre-configured entity uploaders
  uploadProductImages,
  uploadCategoryFiles,
  uploadBrandFiles,
  uploadUserFiles,
  uploadMediaFiles,
  uploadBlogFiles, // NEW: Blog uploader
  
  // Utility functions
  processUploadedFiles,
  processBlogFiles, // NEW
  processMediaFiles,
  processPrescriptionFiles,
  deleteFile,
  deleteFiles,
  cleanupUploadedFiles,
  getFileInfo,
  validateFileType,
  
  // Configuration (for external use if needed)
  fileTypes,
  entityConfigs
};