const createPaymentMethod = async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      name,
      code,
      description = '',
      instructions = '',
      isActive = true,
      isDefault = false,
      isQrAvailable = false,
      qrCodeUrl = '',
      sortOrder = 0,
      requiresAuthorization = false,
      supportsRefunds = true,
      processingFee = 0,
      minAmount = 0,
      maxAmount = null
    } = req.body;

    // Validate required fields
    if (!name || !code) {
      return res.status(400).json({
        error: 'Name and code are required'
      });
    }

    // Check if payment method code already exists
    const existingPaymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        OR: [
          { code: code.toUpperCase(), isDeleted: false },
          { name: name, isDeleted: false }
        ]
      }
    });

    if (existingPaymentMethod) {
      return res.status(400).json({
        error: `Payment method with ${existingPaymentMethod.code === code.toUpperCase() ? 'code' : 'name'} already exists`
      });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.paymentMethod.updateMany({
        where: {
          isDefault: true,
          isDeleted: false
        },
        data: { isDefault: false }
      });
    }

    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        name: name.trim(),
        code: code.toUpperCase().trim(),
        description: description?.trim(),
        instructions: instructions?.trim(),
        isActive,
        isDefault,
        isQrAvailable,
        qrCodeUrl: qrCodeUrl?.trim(),
        sortOrder: parseInt(sortOrder) || 0,
        requiresAuthorization,
        supportsRefunds,
        processingFee: parseFloat(processingFee) || 0,
        minAmount: parseFloat(minAmount) || 0,
        maxAmount: maxAmount ? parseFloat(maxAmount) : null
      }
    });

    res.status(201).json({
      message: 'Payment method created successfully',
      paymentMethod
    });
  } catch (error) {
    console.error('Create payment method error:', error);
    res.status(500).json({
      error: 'Failed to create payment method'
    });
  }
};

const updatePaymentMethod = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const updateData = req.body;

    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: parseInt(id),
        isDeleted: false
      }
    });

    if (!paymentMethod) {
      return res.status(404).json({
        error: 'Payment method not found'
      });
    }

    // Check for duplicate code if updating code
    if (updateData.code && updateData.code !== paymentMethod.code) {
      const existingPaymentMethod = await prisma.paymentMethod.findFirst({
        where: {
          code: updateData.code.toUpperCase(),
          isDeleted: false,
          id: { not: parseInt(id) }
        }
      });

      if (existingPaymentMethod) {
        return res.status(400).json({
          error: 'Payment method code already exists'
        });
      }
      updateData.code = updateData.code.toUpperCase().trim();
    }

    // If setting as default, unset other defaults
    if (updateData.isDefault) {
      await prisma.paymentMethod.updateMany({
        where: {
          isDefault: true,
          isDeleted: false,
          id: { not: parseInt(id) }
        },
        data: { isDefault: false }
      });
    }

    // Parse numbers and trim strings
    if (updateData.name) updateData.name = updateData.name.trim();
    if (updateData.description) updateData.description = updateData.description.trim();
    if (updateData.instructions) updateData.instructions = updateData.instructions.trim();
    if (updateData.qrCodeUrl) updateData.qrCodeUrl = updateData.qrCodeUrl.trim();
    if (updateData.sortOrder) updateData.sortOrder = parseInt(updateData.sortOrder) || 0;
    if (updateData.processingFee) updateData.processingFee = parseFloat(updateData.processingFee) || 0;
    if (updateData.minAmount) updateData.minAmount = parseFloat(updateData.minAmount) || 0;
    if (updateData.maxAmount) updateData.maxAmount = parseFloat(updateData.maxAmount);

    const updatedPaymentMethod = await prisma.paymentMethod.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.status(200).json({
      message: 'Payment method updated successfully',
      paymentMethod: updatedPaymentMethod
    });
  } catch (error) {
    console.error('Update payment method error:', error);
    res.status(500).json({
      error: 'Failed to update payment method'
    });
  }
};

const deletePaymentMethod = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: parseInt(id),
        isDeleted: false
      }
    });

    if (!paymentMethod) {
      return res.status(404).json({
        error: 'Payment method not found'
      });
    }

    // Check if this payment method is being used in any payments
    const existingPayments = await prisma.payment.count({
      where: {
        paymentMethodId: parseInt(id)
      }
    });

    if (existingPayments > 0) {
      return res.status(400).json({
        error: 'Cannot delete payment method that is being used in existing payments'
      });
    }

    await prisma.paymentMethod.update({
      where: { id: parseInt(id) },
      data: { isDeleted: true }
    });

    res.status(200).json({
      message: 'Payment method deleted successfully'
    });
  } catch (error) {
    console.error('Delete payment method error:', error);
    res.status(500).json({
      error: 'Failed to delete payment method'
    });
  }
};

const getPaymentMethods = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { includeInactive } = req.query;

    const where = {
      isDeleted: false
    };

    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const paymentMethods = await prisma.paymentMethod.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });

    res.status(200).json({
      paymentMethods
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      error: 'Failed to fetch payment methods'
    });
  }
};

const getAllPaymentMethods = async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      page = 1,
      limit = 10,
      isActive,
      search
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {
      isDeleted: false
    };

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [paymentMethods, total] = await Promise.all([
      prisma.paymentMethod.findMany({
        where,
        skip,
        take,
        orderBy: [
          { isDefault: 'desc' },
          { sortOrder: 'asc' },
          { name: 'asc' }
        ]
      }),
      prisma.paymentMethod.count({ where })
    ]);

    res.status(200).json({
      paymentMethods,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all payment methods error:', error);
    res.status(500).json({
      error: 'Failed to fetch payment methods'
    });
  }
};

const getPaymentMethodById = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: parseInt(id),
        isDeleted: false
      }
    });

    if (!paymentMethod) {
      return res.status(404).json({
        error: 'Payment method not found'
      });
    }

    res.status(200).json({
      paymentMethod
    });
  } catch (error) {
    console.error('Get payment method by ID error:', error);
    res.status(500).json({
      error: 'Failed to fetch payment method'
    });
  }
};

const getPaymentMethodByCode = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { code } = req.params;

    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        code: code.toUpperCase(),
        isDeleted: false,
        isActive: true
      }
    });

    if (!paymentMethod) {
      return res.status(404).json({
        error: 'Payment method not found'
      });
    }

    res.status(200).json({
      paymentMethod
    });
  } catch (error) {
    console.error('Get payment method by code error:', error);
    res.status(500).json({
      error: 'Failed to fetch payment method'
    });
  }
};

const togglePaymentMethodStatus = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: parseInt(id),
        isDeleted: false
      }
    });

    if (!paymentMethod) {
      return res.status(404).json({
        error: 'Payment method not found'
      });
    }

    const updatedPaymentMethod = await prisma.paymentMethod.update({
      where: { id: parseInt(id) },
      data: { isActive: !paymentMethod.isActive }
    });

    res.status(200).json({
      message: `Payment method ${updatedPaymentMethod.isActive ? 'activated' : 'deactivated'} successfully`,
      paymentMethod: updatedPaymentMethod
    });
  } catch (error) {
    console.error('Toggle payment method status error:', error);
    res.status(500).json({
      error: 'Failed to toggle payment method status'
    });
  }
};

const setDefaultPaymentMethod = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: parseInt(id),
        isDeleted: false
      }
    });

    if (!paymentMethod) {
      return res.status(404).json({
        error: 'Payment method not found'
      });
    }

    // Unset all other defaults
    await prisma.paymentMethod.updateMany({
      where: {
        isDefault: true,
        isDeleted: false,
        id: { not: parseInt(id) }
      },
      data: { isDefault: false }
    });

    // Set this as default
    const updatedPaymentMethod = await prisma.paymentMethod.update({
      where: { id: parseInt(id) },
      data: { isDefault: true }
    });

    res.status(200).json({
      message: 'Default payment method set successfully',
      paymentMethod: updatedPaymentMethod
    });
  } catch (error) {
    console.error('Set default payment method error:', error);
    res.status(500).json({
      error: 'Failed to set default payment method'
    });
  }
};

module.exports = {
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getPaymentMethods,
  getAllPaymentMethods,
  getPaymentMethodById,
  getPaymentMethodByCode,
  togglePaymentMethodStatus,
  setDefaultPaymentMethod
};