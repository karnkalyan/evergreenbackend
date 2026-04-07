async function createMedicationRequest(req, res, next) {
  try {
    const { name, email, phone, medicineName, message } = req.body;

    // Validation
    if (!name || !email || !phone || !medicineName) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, phone, and medicine name are required'
      });
    }

    const medicationRequest = await req.prisma.medicationRequest.create({
      data: {
        name,
        email,
        phone,
        medicineName,
        message: message || null
      }
    });

    res.status(201).json({
      success: true,
      data: medicationRequest,
      message: 'Medication request submitted successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function getMedicationRequests(req, res, next) {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    // Build where clause
    const where = {};
    
    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { medicineName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [requests, total] = await Promise.all([
      req.prisma.medicationRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      req.prisma.medicationRequest.count({ where })
    ]);

    res.json({
      success: true,
      data: requests,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Get single medication request
// @route   GET /api/medication-requests/:id
// @access  Private/Admin
async function getMedicationRequest(req, res, next) {
  try {
    const id = Number(req.params.id);

    const request = await req.prisma.medicationRequest.findUnique({
      where: { id }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Medication request not found'
      });
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Update medication request status
// @route   PUT /api/medication-requests/:id
// @access  Private/Admin
async function updateMedicationRequest(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { status, message } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const validStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    // First, check if the medication request exists
    const existingRequest = await req.prisma.medicationRequest.findUnique({ 
      where: { id } 
    });
    
    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Medication request not found'
      });
    }

    const data = {
      status,
      ...(message && { message })
    };

    const request = await req.prisma.medicationRequest.update({
      where: { id },
      data
    });

    res.json({
      success: true,
      data: request,
      message: 'Medication request updated successfully'
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Medication request not found'
      });
    }
    next(error);
  }
}

// @desc    Delete medication request
// @route   DELETE /api/medication-requests/:id
// @access  Private/Admin
async function deleteMedicationRequest(req, res, next) {
  try {
    const id = Number(req.params.id);

    // First, check if the medication request exists
    const existingRequest = await req.prisma.medicationRequest.findUnique({ 
      where: { id } 
    });
    
    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Medication request not found'
      });
    }

    await req.prisma.medicationRequest.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Medication request deleted successfully'
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Medication request not found'
      });
    }
    next(error);
  }
}

// @desc    Get medication requests stats
// @route   GET /api/medication-requests/stats
// @access  Private/Admin
async function getMedicationRequestStats(req, res, next) {
  try {
    const stats = await req.prisma.medicationRequest.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });

    const total = await req.prisma.medicationRequest.count();
    const pending = await req.prisma.medicationRequest.count({
      where: { status: 'PENDING' }
    });

    res.json({
      success: true,
      data: {
        byStatus: stats,
        total,
        pending
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createMedicationRequest,
  getMedicationRequests,
  getMedicationRequest,
  updateMedicationRequest,
  deleteMedicationRequest,
  getMedicationRequestStats
};