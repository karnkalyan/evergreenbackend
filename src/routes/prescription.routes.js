const express = require('express');

const {
    getUserPrescriptions,  // This handles GET /prescription
    getPrescriptionById,
    uploadPrescription,
    updatePrescription,
    deletePrescription,
    validatePrescription,
    getUserPrescriptionStats,
    getOrderPrescriptions,
    getAllPrescriptions
} = require('../controllers/prescription.controller');

// Middlewares
const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');
const { 
    uploadPrescriptionFile,
    processPrescriptionFiles,
    cleanupUploadedFiles 
} = require('../middlewares/upload');

module.exports = (prisma) => {
    const router = express.Router();

    // Attach Prisma client
    router.use((req, res, next) => { 
        req.prisma = prisma; 
        next(); 
    });

    // =============================================
    // AUTHENTICATED ROUTES (Require Authentication)
    // =============================================
    
    router.use(isAuthenticated(prisma));

 router.get(
    '/',
    checkPermission('read_prescriptions'),
    getUserPrescriptions
);

    // Get prescription statistics for user
    // GET /prescription/stats/user
    router.get(
        '/stats/user',
        checkPermission('read_prescriptions'),
        getUserPrescriptionStats
    );

    // Upload new prescription
    // POST /prescription/upload
    router.post(
        '/upload',
        checkPermission('create_prescriptions'),
        (req, res, next) => {
            uploadPrescriptionFile(req, res, (err) => {
                if (err) {
                    if (req.file) {
                        const fs = require('fs');
                        if (fs.existsSync(req.file.path)) {
                            fs.unlinkSync(req.file.path);
                        }
                    }
                    
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(400).json({
                            success: false,
                            message: 'File too large. Maximum size is 5MB.'
                        });
                    }
                    if (err.code === 'LIMIT_FILE_COUNT') {
                        return res.status(400).json({
                            success: false,
                            message: 'Too many files uploaded. Only one prescription file allowed.'
                        });
                    }
                    if (err.message.includes('Invalid file type')) {
                        return res.status(400).json({
                            success: false,
                            message: err.message
                        });
                    }
                    return res.status(400).json({
                        success: false,
                        message: 'File upload failed: ' + err.message
                    });
                }
                next();
            });
        },
        (req, res, next) => {
            try {
                if (req.file) {
                    // Convert single file to files array for consistency
                    req.files = {
                        prescription: [req.file]
                    };
                    
                    // Process uploaded files
                    req.uploadedFiles = processPrescriptionFiles(req);
                    
                    // Attach cleanup function to request for error handling
                    req.cleanupUploadedFiles = (files) => {
                        if (files && files.prescription) {
                            files.prescription.forEach(file => {
                                const fs = require('fs');
                                if (fs.existsSync(file.path)) {
                                    fs.unlinkSync(file.path);
                                }
                            });
                        }
                    };
                }
                next();
            } catch (error) {
                if (req.file) {
                    const fs = require('fs');
                    if (fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                }
                return res.status(500).json({
                    success: false,
                    message: 'Error processing uploaded files: ' + error.message
                });
            }
        },
        uploadPrescription
    );

    // Get prescription by ID
    // GET /prescription/:id
    router.get(
        '/:id',
        checkPermission('read_prescriptions'),
        getPrescriptionById
    );

    // Update prescription (notes)
    // PUT /prescription/:id
    router.put(
        '/:id',
        checkPermission('update_prescriptions'),
        updatePrescription
    );

    // Delete prescription
    // DELETE /prescription/:id
    router.delete(
        '/:id',
        checkPermission('delete_prescriptions'),
        deletePrescription
    );

    // Get prescriptions for a specific order
    // GET /prescription/order/:orderId
    router.get(
        '/order/:orderId',
        checkPermission('read_prescriptions'),
        getOrderPrescriptions
    );

    // =============================================
    // ADMIN ROUTES
    // =============================================

    // Get all prescriptions (admin view with filters)
    // GET /prescription/admin/all
    router.get(
        '/admin/all',
        checkPermission('read_all_prescriptions'),
        getAllPrescriptions
    );

    // Validate prescription (admin only)
    // POST /prescription/:id/validate
    router.post(
        '/:id/validate',
        checkPermission('validate_prescriptions'),
        validatePrescription
    );

    return router;
};