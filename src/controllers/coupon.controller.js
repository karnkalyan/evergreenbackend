const createCoupon = async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      code,
      type,
      value,
      freeShipping,
      status,
      minPurchase,
      usageLimit,
      perUserLimit,
      startDate,
      endDate,
      appliesTo,
      applicableIds,
      isPublic = true  // NEW: Default to public
    } = req.body;

    // Check if coupon code already exists
    const existingCoupon = await prisma.coupon.findFirst({
      where: {
        code,
        isDeleted: false
      }
    });

    if (existingCoupon) {
      return res.status(400).json({
        error: 'Coupon code already exists'
      });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        type,
        value,
        freeShipping,
        status,
        minPurchase,
        usageLimit,
        perUserLimit,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        appliesTo,
        applicableIds,
        isPublic  // NEW: Include isPublic
      }
    });

    res.status(201).json({
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({
      error: 'Failed to create coupon'
    });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const updateData = req.body;

    const coupon = await prisma.coupon.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!coupon) {
      return res.status(404).json({
        error: 'Coupon not found'
      });
    }

    // Check for duplicate code if updating code
    if (updateData.code && updateData.code !== coupon.code) {
      const existingCoupon = await prisma.coupon.findFirst({
        where: {
          code: updateData.code,
          isDeleted: false,
          id: { not: Number(id) }
        }
      });

      if (existingCoupon) {
        return res.status(400).json({
          error: 'Coupon code already exists'
        });
      }
    }

    // Convert date strings to Date objects
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);

    const updatedCoupon = await prisma.coupon.update({
      where: { id: Number(id) },
      data: updateData
    });

    res.status(200).json({
      message: 'Coupon updated successfully',
      coupon: updatedCoupon
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({
      error: 'Failed to update coupon'
    });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const coupon = await prisma.coupon.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!coupon) {
      return res.status(404).json({
        error: 'Coupon not found'
      });
    }

    await prisma.coupon.update({
      where: { id: Number(id) },
      data: { isDeleted: true }
    });

    res.status(200).json({
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({
      error: 'Failed to delete coupon'
    });
  }
};

const getAllCoupons = async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      page = 1,
      limit = 10,
      status,
      search
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = {
      isDeleted: false
    };

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        include: {
          _count: {
            select: {
              orders: true,
              couponUsage: true
            }
          }
        },
        skip,
        take,
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.coupon.count({ where })
    ]);

    // Debug: Check if isPublic is included
    console.log('🔍 Backend - Checking isPublic in coupons:');
    coupons.forEach(coupon => {
      console.log(`  ${coupon.code}: isPublic = ${coupon.isPublic}`);
    });

    res.status(200).json({
      coupons,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get all coupons error:', error);
    res.status(500).json({
      error: 'Failed to fetch coupons'
    });
  }
};

const getCouponById = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const coupon = await prisma.coupon.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      },
      include: {
        orders: {
          take: 10,
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        _count: {
          select: {
            orders: true,
            couponUsage: true
          }
        }
      }
    });

    if (!coupon) {
      return res.status(404).json({
        error: 'Coupon not found'
      });
    }

    res.status(200).json({
      coupon
    });
  } catch (error) {
    console.error('Get coupon by ID error:', error);
    res.status(500).json({
      error: 'Failed to fetch coupon'
    });
  }
};

const getCouponByCode = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { code } = req.params;

    const coupon = await prisma.coupon.findFirst({
      where: {
        code: code.toUpperCase(),
        isDeleted: false
      }
    });

    if (!coupon) {
      return res.status(404).json({
        error: 'Coupon not found'
      });
    }

    res.status(200).json({
      coupon
    });
  } catch (error) {
    console.error('Get coupon by code error:', error);
    res.status(500).json({
      error: 'Failed to fetch coupon'
    });
  }
};

// Update validateCoupon to check isPublic
const validateCoupon = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { code, userId, cartTotal } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Coupon code is required'
      });
    }

    const coupon = await prisma.coupon.findFirst({
      where: {
        code: code.toUpperCase(),
        isDeleted: false,
        status: 'Active'
      }
    });

    if (!coupon) {
      return res.status(404).json({
        error: 'Invalid coupon code'
      });
    }

    // NEW: Check if coupon is public
    if (!coupon.isPublic) {
      return res.status(403).json({
        error: 'This is a private coupon and cannot be used'
      });
    }

    // Check date validity
    const now = new Date();
    if (coupon.startDate && now < coupon.startDate) {
      return res.status(400).json({
        error: 'Coupon is not yet active'
      });
    }

    if (coupon.endDate && now > coupon.endDate) {
      return res.status(400).json({
        error: 'Coupon has expired'
      });
    }

    // Check minimum purchase
    if (cartTotal < coupon.minPurchase) {
      return res.status(400).json({
        error: `Minimum purchase of $${coupon.minPurchase} required`
      });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({
        error: 'Coupon usage limit reached'
      });
    }

    // Check per user limit
    if (userId) {
      const userUsageCount = await prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          userId: userId
        }
      });

      if (userUsageCount >= coupon.perUserLimit) {
        return res.status(400).json({
          error: 'You have already used this coupon the maximum number of times'
        });
      }
    }

    // Calculate discount
    let discount = 0;
    if (coupon.type === 'Percentage') {
      discount = (cartTotal * coupon.value) / 100;
    } else {
      discount = coupon.value;
    }

    res.status(200).json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        freeShipping: coupon.freeShipping,
        discount,
        minPurchase: coupon.minPurchase,
        isPublic: coupon.isPublic  // NEW: Include in response
      }
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({
      error: 'Failed to validate coupon'
    });
  }
};

const getCouponStats = async (req, res) => {
  try {
    const prisma = req.prisma;
    const stats = await prisma.coupon.aggregate({
      where: {
        isDeleted: false
      },
      _count: {
        id: true
      },
      _sum: {
        usageCount: true
      }
    });

    const activeCoupons = await prisma.coupon.count({
      where: {
        isDeleted: false,
        status: 'Active'
      }
    });

    res.status(200).json({
      stats: {
        totalCoupons: stats._count.id,
        totalUsage: stats._sum.usageCount || 0,
        activeCoupons
      }
    });
  } catch (error) {
    console.error('Get coupon stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch coupon stats'
    });
  }
};

module.exports = {
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getAllCoupons,
  getCouponById,
  getCouponByCode,
  validateCoupon,
  getCouponStats
};