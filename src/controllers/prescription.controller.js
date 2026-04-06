const path = require('path');
const fs = require('fs');

// --- GET ALL PRESCRIPTIONS FOR AUTHENTICATED USER ---
async function getUserPrescriptions(req, res, next) {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, status, search } = req.query;

        // Build where clause - use deletedAt for soft delete
        const where = { 
            userId: userId,
            deletedAt: null // Soft delete check
        };

        // Add status filter
        if (status && status !== 'all') {
            if (status === 'validated') {
                where.isValidated = true;
            } else if (status === 'pending') {
                where.isValidated = false;
                where.validatedAt = null;
            } else if (status === 'rejected') {
                where.isValidated = false;
                where.validatedAt = { not: null };
            }
        }

        // Add search filter
        if (search) {
            where.OR = [
                { fileName: { contains: search, mode: 'insensitive' } },
                { notes: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        // Get prescriptions with pagination
        const [prescriptions, totalCount] = await req.prisma.$transaction([
            req.prisma.prescription.findMany({
                where,
                include: {
                    orderPrescriptions: {
                        include: {
                            order: {
                                select: {
                                    id: true,
                                    orderNumber: true,
                                    orderDate: true
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                skip,
                take
            }),
            req.prisma.prescription.count({ where })
        ]);

        // Format response
        const formattedPrescriptions = prescriptions.map(prescription => ({
            id: prescription.id,
            userId: prescription.userId,
            imageUrl: prescription.imageUrl,
            fileName: prescription.fileName,
            fileSize: prescription.fileSize,
            isValidated: prescription.isValidated,
            validatedBy: prescription.validatedBy,
            validatedAt: prescription.validatedAt,
            notes: prescription.notes,
            createdAt: prescription.createdAt,
            updatedAt: prescription.updatedAt,
            deletedAt: prescription.deletedAt,
            orderIds: prescription.orderPrescriptions.map(op => op.order.id)
        }));

        const totalPages = Math.ceil(totalCount / take);

        res.json({
            success: true,
            data: {
                prescriptions: formattedPrescriptions,
                pagination: {
                    page: parseInt(page),
                    limit: take,
                    total: totalCount,
                    pages: totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            }
        });

    } catch (err) {
        next(err);
    }
}

// --- GET USER PRESCRIPTIONS (for /my endpoint) ---
async function getMyPrescriptions(req, res, next) {
    try {
        const userId = req.user.id;

        // Get all non-deleted prescriptions for the user
        const prescriptions = await req.prisma.prescription.findMany({
            where: { 
                userId: userId,
                deletedAt: null
            },
            include: {
                orderPrescriptions: {
                    include: {
                        order: {
                            select: {
                                id: true,
                                orderNumber: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Format response
        const formattedPrescriptions = prescriptions.map(prescription => ({
            id: prescription.id,
            userId: prescription.userId,
            imageUrl: prescription.imageUrl,
            fileName: prescription.fileName,
            fileSize: prescription.fileSize,
            isValidated: prescription.isValidated,
            validatedBy: prescription.validatedBy,
            validatedAt: prescription.validatedAt,
            notes: prescription.notes,
            createdAt: prescription.createdAt,
            updatedAt: prescription.updatedAt,
            orderIds: prescription.orderPrescriptions.map(op => op.order.id)
        }));

        res.json({
            success: true,
            data: {
                prescriptions: formattedPrescriptions
            }
        });

    } catch (err) {
        next(err);
    }
}

// --- GET PRESCRIPTION BY ID ---
async function getPrescriptionById(req, res, next) {
    try {
        const id = Number(req.params.id);
        const userId = req.user.id;

        // Validate ID
        if (isNaN(id)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid prescription ID' 
            });
        }

        const prescription = await req.prisma.prescription.findFirst({
            where: { 
                id: id, // ADD THIS LINE - THE MISSING ID FILTER
                userId: userId,
                deletedAt: null
            },
            include: {
                orderPrescriptions: {
                    include: {
                        order: {
                            select: {
                                id: true,
                                orderNumber: true,
                                orderDate: true,
                                status: true
                            }
                        }
                    }
                },
                validatedByUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });

        if (!prescription) {
            return res.status(404).json({ 
                success: false,
                error: 'Prescription not found or unauthorized.' 
            });
        }

        // Format response
        const formattedPrescription = {
            id: prescription.id,
            userId: prescription.userId,
            imageUrl: prescription.imageUrl,
            fileName: prescription.fileName,
            fileSize: prescription.fileSize,
            isValidated: prescription.isValidated,
            validatedBy: prescription.validatedBy,
            validatedAt: prescription.validatedAt,
            notes: prescription.notes,
            createdAt: prescription.createdAt,
            updatedAt: prescription.updatedAt,
            deletedAt: prescription.deletedAt,
            orderIds: prescription.orderPrescriptions.map(op => op.order.id),
            validatedByUser: prescription.validatedByUser
        };

        res.json({
            success: true,
            data: {
                prescription: formattedPrescription
            }
        });
    } catch (err) {
        next(err);
    }
}

// --- UPLOAD PRESCRIPTION ---
async function uploadPrescription(req, res, next) {
    try {
        const userId = req.user.id;
        const { notes } = req.body;

        // Check if file was uploaded
        if (!req.file && (!req.files || !req.files.prescription)) {
            return res.status(400).json({ 
                success: false,
                error: 'Prescription file is required.' 
            });
        }

        // Get the uploaded file - handle both single file and files array
        let prescriptionFile;
        if (req.file) {
            prescriptionFile = req.file;
        } else if (req.files && req.files.prescription) {
            prescriptionFile = req.files.prescription[0];
        }

        if (!prescriptionFile) {
            return res.status(400).json({ 
                success: false,
                error: 'Prescription file is required.' 
            });
        }

        // Get file URL from processed files or generate from file path
        let imageUrl;
        if (req.uploadedFiles && req.uploadedFiles.length > 0) {
            imageUrl = req.uploadedFiles[0].url;
        } else {
            imageUrl = `/${prescriptionFile.path.replace(/\\/g, '/')}`;
        }

        // Create prescription record
        const prescription = await req.prisma.$transaction(async (prisma) => {
            const newPrescription = await prisma.prescription.create({
                data: {
                    userId: userId,
                    imageUrl: imageUrl,
                    fileName: prescriptionFile.originalname || prescriptionFile.originalName || 'prescription',
                    fileSize: prescriptionFile.size,
                    notes: notes || null,
                    isValidated: false,
                    deletedAt: null
                }
            });

            return newPrescription;
        });

        res.status(201).json({
            success: true,
            data: {
                prescription: prescription
            },
            message: 'Prescription uploaded successfully. It will be reviewed by our pharmacy team.'
        });

    } catch (err) {
        // Clean up uploaded file if error occurs
        if (req.file) {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
        }
        if (req.files && req.files.prescription) {
            req.cleanupUploadedFiles(req.files);
        }
        next(err);
    }
}

// --- UPDATE PRESCRIPTION (Notes, etc.) ---
async function updatePrescription(req, res, next) {
    try {
        const id = Number(req.params.id);
        const userId = req.user.id;
        const { notes } = req.body;

        // Validate ID
        if (isNaN(id)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid prescription ID' 
            });
        }

        // Check if prescription exists and belongs to the user
        const existingPrescription = await req.prisma.prescription.findFirst({
            where: { 
                id: id,
                userId: userId,
                deletedAt: null
            }
        });

        if (!existingPrescription) {
            return res.status(404).json({ 
                success: false,
                error: 'Prescription not found or unauthorized.' 
            });
        }

        // Only allow updating notes for now
        const updatedPrescription = await req.prisma.prescription.update({
            where: { id },
            data: {
                notes: notes || null,
                updatedAt: new Date()
            }
        });

        res.json({
            success: true,
            data: {
                prescription: updatedPrescription
            },
            message: 'Prescription updated successfully.'
        });

    } catch (err) {
        next(err);
    }
}

// --- DELETE PRESCRIPTION (Soft Delete) ---
async function deletePrescription(req, res, next) {
    try {
        const id = Number(req.params.id);
        const userId = req.user.id;

        // Validate ID
        if (isNaN(id)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid prescription ID' 
            });
        }

        // Check if prescription exists and belongs to the user
        const existingPrescription = await req.prisma.prescription.findFirst({
            where: { 
                id: id,
                userId: userId,
                deletedAt: null
            }
        });

        if (!existingPrescription) {
            return res.status(404).json({ 
                success: false,
                error: 'Prescription not found or unauthorized.' 
            });
        }

        // Check if prescription is used in any orders
        const orderUsage = await req.prisma.orderPrescription.count({
            where: { prescriptionId: id }
        });

        if (orderUsage > 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Cannot delete prescription that is associated with orders.' 
            });
        }

        // Soft delete the prescription by setting deletedAt
        const deletedPrescription = await req.prisma.prescription.update({
            where: { id },
            data: { 
                deletedAt: new Date(),
                updatedAt: new Date()
            }
        });

        res.json({
            success: true,
            message: 'Prescription deleted successfully.',
            data: {
                deletedPrescription: {
                    id: deletedPrescription.id,
                    fileName: deletedPrescription.fileName
                }
            }
        });

    } catch (err) {
        next(err);
    }
}

// --- VALIDATE PRESCRIPTION (Admin function) ---
async function validatePrescription(req, res, next) {
    try {
        const id = Number(req.params.id);
        const adminUserId = req.user.id;
        const { isValidated, notes } = req.body;

        // Validate ID
        if (isNaN(id)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid prescription ID' 
            });
        }

        if (typeof isValidated !== 'boolean') {
            return res.status(400).json({ 
                success: false,
                error: 'isValidated must be a boolean.' 
            });
        }

        // Check if prescription exists
        const existingPrescription = await req.prisma.prescription.findFirst({
            where: { 
                id: id,
                deletedAt: null
            }
        });

        if (!existingPrescription) {
            return res.status(404).json({ 
                success: false,
                error: 'Prescription not found.' 
            });
        }

        // Update prescription validation status
        const updatedPrescription = await req.prisma.prescription.update({
            where: { id },
            data: {
                isValidated: isValidated,
                validatedBy: adminUserId,
                validatedAt: new Date(),
                notes: notes || existingPrescription.notes,
                updatedAt: new Date()
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                validatedByUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });

        res.json({
            success: true,
            data: {
                prescription: updatedPrescription
            },
            message: `Prescription ${isValidated ? 'validated' : 'rejected'} successfully.`
        });

    } catch (err) {
        next(err);
    }
}

// --- GET PRESCRIPTION STATISTICS FOR USER ---
async function getUserPrescriptionStats(req, res, next) {
    try {
        const userId = req.user.id;

        const stats = await req.prisma.$transaction(async (prisma) => {
            const total = await prisma.prescription.count({
                where: { 
                    userId: userId,
                    deletedAt: null 
                }
            });

            const validated = await prisma.prescription.count({
                where: { 
                    userId: userId,
                    deletedAt: null,
                    isValidated: true 
                }
            });

            const pending = await prisma.prescription.count({
                where: { 
                    userId: userId,
                    deletedAt: null,
                    isValidated: false,
                    validatedAt: null
                }
            });

            const rejected = await prisma.prescription.count({
                where: { 
                    userId: userId,
                    deletedAt: null,
                    isValidated: false,
                    validatedAt: { not: null }
                }
            });

            // Recent uploads (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const recentUploads = await prisma.prescription.count({
                where: { 
                    userId: userId,
                    deletedAt: null,
                    createdAt: { gte: thirtyDaysAgo }
                }
            });

            return {
                total,
                validated,
                pending,
                rejected,
                recentUploads
            };
        });

        res.json({
            success: true,
            data: {
                stats: stats
            }
        });

    } catch (err) {
        next(err);
    }
}

// --- GET ORDER PRESCRIPTIONS ---
async function getOrderPrescriptions(req, res, next) {
    try {
        const orderId = Number(req.params.orderId);
        const userId = req.user.id;

        // Validate ID
        if (isNaN(orderId)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid order ID' 
            });
        }

        // Verify order belongs to user
        const order = await req.prisma.order.findFirst({
            where: { 
                id: orderId,
                userId: userId 
            }
        });

        if (!order) {
            return res.status(404).json({ 
                success: false,
                error: 'Order not found or unauthorized.' 
            });
        }

        const prescriptions = await req.prisma.prescription.findMany({
            where: {
                orderPrescriptions: {
                    some: {
                        orderId: orderId
                    }
                },
                deletedAt: null
            },
            include: {
                validatedByUser: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json({
            success: true,
            data: {
                prescriptions: prescriptions
            }
        });

    } catch (err) {
        next(err);
    }
}

// --- ADMIN: GET ALL PRESCRIPTIONS (with filters) ---
async function getAllPrescriptions(req, res, next) {
    try {
        const { page = 1, limit = 10, status, search, userId } = req.query;

        // Build where clause
        const where = { 
            deletedAt: null
        };

        // Add status filter
        if (status && status !== 'all') {
            if (status === 'validated') {
                where.isValidated = true;
            } else if (status === 'pending') {
                where.isValidated = false;
                where.validatedAt = null;
            } else if (status === 'rejected') {
                where.isValidated = false;
                where.validatedAt = { not: null };
            }
        }

        // Add user filter
        if (userId) {
            where.userId = parseInt(userId);
        }

        // Add search filter
        if (search) {
            where.OR = [
                { fileName: { contains: search, mode: 'insensitive' } },
                { notes: { contains: search, mode: 'insensitive' } },
                {
                    user: {
                        OR: [
                            { firstName: { contains: search, mode: 'insensitive' } },
                            { lastName: { contains: search, mode: 'insensitive' } },
                            { email: { contains: search, mode: 'insensitive' } }
                        ]
                    }
                }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        // Get prescriptions with pagination
        const [prescriptions, totalCount] = await req.prisma.$transaction([
            req.prisma.prescription.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    validatedByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    orderPrescriptions: {
                        include: {
                            order: {
                                select: {
                                    id: true,
                                    orderNumber: true
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                skip,
                take
            }),
            req.prisma.prescription.count({ where })
        ]);

        const totalPages = Math.ceil(totalCount / take);

        res.json({
            success: true,
            data: {
                prescriptions: prescriptions,
                pagination: {
                    page: parseInt(page),
                    limit: take,
                    total: totalCount,
                    pages: totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            }
        });

    } catch (err) {
        next(err);
    }
}

module.exports = {
    getUserPrescriptions,
    getMyPrescriptions, // ADD THIS
    getPrescriptionById,
    uploadPrescription,
    updatePrescription,
    deletePrescription,
    validatePrescription,
    getUserPrescriptionStats,
    getOrderPrescriptions,
    getAllPrescriptions
};