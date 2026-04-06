// controllers/country.controller.js

const createCountry = async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      name,
      code,
      currency,
      currencySymbol,
      flag,
      isActive = true,
      isGlobal = false,
      sortOrder = 0
    } = req.body;

    // Validate required fields
    if (!name || !code || !currency || !currencySymbol || !flag) {
      return res.status(400).json({
        error: 'All fields are required: name, code, currency, currencySymbol, flag'
      });
    }

    // Check if country code already exists
    const existingCountry = await prisma.country.findFirst({
      where: {
        OR: [
          { code: code.toUpperCase(), isDeleted: false },
          { name, isDeleted: false }
        ]
      }
    });

    if (existingCountry) {
      return res.status(400).json({
        error: `Country with ${existingCountry.code === code.toUpperCase() ? 'code' : 'name'} already exists`
      });
    }

    const country = await prisma.country.create({
      data: {
        name,
        code: code.toUpperCase(),
        currency: currency.toUpperCase(),
        currencySymbol,
        flag,
        isActive,
        isGlobal,
        sortOrder
      }
    });

    res.status(201).json({
      message: 'Country created successfully',
      country
    });
  } catch (error) {
    console.error('Create country error:', error);
    res.status(500).json({
      error: 'Failed to create country'
    });
  }
};

const updateCountry = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const updateData = req.body;

    const country = await prisma.country.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!country) {
      return res.status(404).json({
        error: 'Country not found'
      });
    }

    // Check for duplicate code if updating code
    if (updateData.code && updateData.code !== country.code) {
      const existingCountry = await prisma.country.findFirst({
        where: {
          code: updateData.code.toUpperCase(),
          isDeleted: false,
          id: { not: Number(id) }
        }
      });

      if (existingCountry) {
        return res.status(400).json({
          error: 'Country code already exists'
        });
      }
      updateData.code = updateData.code.toUpperCase();
    }

    // Update currency to uppercase if provided
    if (updateData.currency) {
      updateData.currency = updateData.currency.toUpperCase();
    }

    const updatedCountry = await prisma.country.update({
      where: { id: Number(id) },
      data: updateData
    });

    res.status(200).json({
      message: 'Country updated successfully',
      country: updatedCountry
    });
  } catch (error) {
    console.error('Update country error:', error);
    res.status(500).json({
      error: 'Failed to update country'
    });
  }
};

const deleteCountry = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const country = await prisma.country.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!country) {
      return res.status(404).json({
        error: 'Country not found'
      });
    }

    await prisma.country.update({
      where: { id: Number(id) },
      data: { isDeleted: true }
    });

    res.status(200).json({
      message: 'Country deleted successfully'
    });
  } catch (error) {
    console.error('Delete country error:', error);
    res.status(500).json({
      error: 'Failed to delete country'
    });
  }
};

const getCountries = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { includeInactive } = req.query;

    const where = {
      isDeleted: false
    };

    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const countries = await prisma.country.findMany({
      where,
      orderBy: [
        { isGlobal: 'desc' },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });

    res.status(200).json({
      countries
    });
  } catch (error) {
    console.error('Get countries error:', error);
    res.status(500).json({
      error: 'Failed to fetch countries'
    });
  }
};

const getAllCountries = async (req, res) => {
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
        { currency: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [countries, total] = await Promise.all([
      prisma.country.findMany({
        where,
        skip,
        take,
        orderBy: [
          { isGlobal: 'desc' },
          { sortOrder: 'asc' },
          { name: 'asc' }
        ]
      }),
      prisma.country.count({ where })
    ]);

    res.status(200).json({
      countries,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get all countries error:', error);
    res.status(500).json({
      error: 'Failed to fetch countries'
    });
  }
};

const getCountryById = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const country = await prisma.country.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!country) {
      return res.status(404).json({
        error: 'Country not found'
      });
    }

    res.status(200).json({
      country
    });
  } catch (error) {
    console.error('Get country by ID error:', error);
    res.status(500).json({
      error: 'Failed to fetch country'
    });
  }
};

const getCountryByCode = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { code } = req.params;

    const country = await prisma.country.findFirst({
      where: {
        code: code.toUpperCase(),
        isDeleted: false,
        isActive: true
      }
    });

    if (!country) {
      return res.status(404).json({
        error: 'Country not found'
      });
    }

    res.status(200).json({
      country
    });
  } catch (error) {
    console.error('Get country by code error:', error);
    res.status(500).json({
      error: 'Failed to fetch country'
    });
  }
};

const toggleCountryStatus = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const country = await prisma.country.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!country) {
      return res.status(404).json({
        error: 'Country not found'
      });
    }

    const updatedCountry = await prisma.country.update({
      where: { id: Number(id) },
      data: { isActive: !country.isActive }
    });

    res.status(200).json({
      message: `Country ${updatedCountry.isActive ? 'activated' : 'deactivated'} successfully`,
      country: updatedCountry
    });
  } catch (error) {
    console.error('Toggle country status error:', error);
    res.status(500).json({
      error: 'Failed to toggle country status'
    });
  }
};

const detectCountry = async (req, res) => {
  try {
    const prisma = req.prisma;
    
    // Get client IP from request
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // For development, we'll use a simple IP detection
    // In production, you might want to use a service like ipapi.co, ipinfo.io, etc.
    let detectedCountryCode = 'US'; // Default fallback
    
    // Simple IP-based detection (you can enhance this with a proper IP geolocation service)
    if (clientIP) {
      console.log('Detecting country for IP:', clientIP);
      
      // This is a simplified version - in production, use a proper IP geolocation service
      // For now, we'll return the first active country or Global
      const defaultCountry = await prisma.country.findFirst({
        where: {
          isActive: true,
          isDeleted: false,
          OR: [
            { code: 'US' },
            { isGlobal: true }
          ]
        },
        orderBy: [
          { isGlobal: 'desc' },
          { sortOrder: 'asc' }
        ]
      });
      
      if (defaultCountry) {
        return res.status(200).json({
          country: defaultCountry
        });
      }
    }

    // If no specific detection, return the first active country
    const fallbackCountry = await prisma.country.findFirst({
      where: {
        isActive: true,
        isDeleted: false
      },
      orderBy: [
        { isGlobal: 'desc' },
        { sortOrder: 'asc' }
      ]
    });

    if (!fallbackCountry) {
      return res.status(404).json({
        error: 'No active countries found'
      });
    }

    res.status(200).json({
      country: fallbackCountry
    });
  } catch (error) {
    console.error('Detect country error:', error);
    res.status(500).json({
      error: 'Failed to detect country'
    });
  }
};

module.exports = {
  createCountry,
  updateCountry,
  deleteCountry,
  getCountries,
  getAllCountries,
  getCountryById,
  getCountryByCode,
  toggleCountryStatus,
  detectCountry
};