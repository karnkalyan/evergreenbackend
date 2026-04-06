// controllers/shipping.controller.js

const createShipping = async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      name,
      code,
      description = '',
      cost = 0,
      isActive = true,
      isDefault = false,
      estimatedDays = 3,
      sortOrder = 0
    } = req.body;

    // Validate required fields
    if (!name || !code) {
      return res.status(400).json({
        error: 'Name and code are required'
      });
    }

    // Check if shipping code already exists
    const existingShipping = await prisma.shipping.findFirst({
      where: {
        OR: [
          { code: code.toUpperCase(), isDeleted: false },
          { name, isDeleted: false }
        ]
      }
    });

    if (existingShipping) {
      return res.status(400).json({
        error: `Shipping option with ${existingShipping.code === code.toUpperCase() ? 'code' : 'name'} already exists`
      });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.shipping.updateMany({
        where: {
          isDefault: true,
          isDeleted: false
        },
        data: { isDefault: false }
      });
    }

    const shipping = await prisma.shipping.create({
      data: {
        name,
        code: code.toUpperCase(),
        description,
        cost: parseFloat(cost),
        isActive,
        isDefault,
        estimatedDays: parseInt(estimatedDays),
        sortOrder: parseInt(sortOrder)
      }
    });

    res.status(201).json({
      message: 'Shipping option created successfully',
      shipping
    });
  } catch (error) {
    console.error('Create shipping error:', error);
    res.status(500).json({
      error: 'Failed to create shipping option'
    });
  }
};

const updateShipping = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const updateData = req.body;

    const shipping = await prisma.shipping.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!shipping) {
      return res.status(404).json({
        error: 'Shipping option not found'
      });
    }

    // Check for duplicate code if updating code
    if (updateData.code && updateData.code !== shipping.code) {
      const existingShipping = await prisma.shipping.findFirst({
        where: {
          code: updateData.code.toUpperCase(),
          isDeleted: false,
          id: { not: Number(id) }
        }
      });

      if (existingShipping) {
        return res.status(400).json({
          error: 'Shipping code already exists'
        });
      }
      updateData.code = updateData.code.toUpperCase();
    }

    // If setting as default, unset other defaults
    if (updateData.isDefault) {
      await prisma.shipping.updateMany({
        where: {
          isDefault: true,
          isDeleted: false,
          id: { not: Number(id) }
        },
        data: { isDefault: false }
      });
    }

    // Parse numbers
    if (updateData.cost) updateData.cost = parseFloat(updateData.cost);
    if (updateData.estimatedDays) updateData.estimatedDays = parseInt(updateData.estimatedDays);
    if (updateData.sortOrder) updateData.sortOrder = parseInt(updateData.sortOrder);

    const updatedShipping = await prisma.shipping.update({
      where: { id: Number(id) },
      data: updateData
    });

    res.status(200).json({
      message: 'Shipping option updated successfully',
      shipping: updatedShipping
    });
  } catch (error) {
    console.error('Update shipping error:', error);
    res.status(500).json({
      error: 'Failed to update shipping option'
    });
  }
};

const deleteShipping = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const shipping = await prisma.shipping.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!shipping) {
      return res.status(404).json({
        error: 'Shipping option not found'
      });
    }

    await prisma.shipping.update({
      where: { id: Number(id) },
      data: { isDeleted: true }
    });

    res.status(200).json({
      message: 'Shipping option deleted successfully'
    });
  } catch (error) {
    console.error('Delete shipping error:', error);
    res.status(500).json({
      error: 'Failed to delete shipping option'
    });
  }
};

const getShippingOptions = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { includeInactive } = req.query;

    const where = {
      isDeleted: false
    };

    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const shippingOptions = await prisma.shipping.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });

    res.status(200).json({
      shippingOptions
    });
  } catch (error) {
    console.error('Get shipping options error:', error);
    res.status(500).json({
      error: 'Failed to fetch shipping options'
    });
  }
};

const getAllShippingOptions = async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      page = 1,
      limit = 10,
      isActive,
      search
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

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

    const [shippingOptions, total] = await Promise.all([
      prisma.shipping.findMany({
        where,
        skip,
        take,
        orderBy: [
          { isDefault: 'desc' },
          { sortOrder: 'asc' },
          { name: 'asc' }
        ]
      }),
      prisma.shipping.count({ where })
    ]);

    res.status(200).json({
      shippingOptions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get all shipping options error:', error);
    res.status(500).json({
      error: 'Failed to fetch shipping options'
    });
  }
};

const getShippingById = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const shipping = await prisma.shipping.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!shipping) {
      return res.status(404).json({
        error: 'Shipping option not found'
      });
    }

    res.status(200).json({
      shipping
    });
  } catch (error) {
    console.error('Get shipping by ID error:', error);
    res.status(500).json({
      error: 'Failed to fetch shipping option'
    });
  }
};

const getShippingByCode = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { code } = req.params;

    const shipping = await prisma.shipping.findFirst({
      where: {
        code: code.toUpperCase(),
        isDeleted: false,
        isActive: true
      }
    });

    if (!shipping) {
      return res.status(404).json({
        error: 'Shipping option not found'
      });
    }

    res.status(200).json({
      shipping
    });
  } catch (error) {
    console.error('Get shipping by code error:', error);
    res.status(500).json({
      error: 'Failed to fetch shipping option'
    });
  }
};

const toggleShippingStatus = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const shipping = await prisma.shipping.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!shipping) {
      return res.status(404).json({
        error: 'Shipping option not found'
      });
    }

    const updatedShipping = await prisma.shipping.update({
      where: { id: Number(id) },
      data: { isActive: !shipping.isActive }
    });

    res.status(200).json({
      message: `Shipping option ${updatedShipping.isActive ? 'activated' : 'deactivated'} successfully`,
      shipping: updatedShipping
    });
  } catch (error) {
    console.error('Toggle shipping status error:', error);
    res.status(500).json({
      error: 'Failed to toggle shipping status'
    });
  }
};

const setDefaultShipping = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const shipping = await prisma.shipping.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!shipping) {
      return res.status(404).json({
        error: 'Shipping option not found'
      });
    }

    // Unset all other defaults
    await prisma.shipping.updateMany({
      where: {
        isDefault: true,
        isDeleted: false,
        id: { not: Number(id) }
      },
      data: { isDefault: false }
    });

    // Set this as default
    const updatedShipping = await prisma.shipping.update({
      where: { id: Number(id) },
      data: { isDefault: true }
    });

    res.status(200).json({
      message: 'Default shipping option set successfully',
      shipping: updatedShipping
    });
  } catch (error) {
    console.error('Set default shipping error:', error);
    res.status(500).json({
      error: 'Failed to set default shipping option'
    });
  }
};

module.exports = {
  createShipping,
  updateShipping,
  deleteShipping,
  getShippingOptions,
  getAllShippingOptions,
  getShippingById,
  getShippingByCode,
  toggleShippingStatus,
  setDefaultShipping
};