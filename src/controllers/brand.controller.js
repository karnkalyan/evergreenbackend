const { cleanupUploadedFiles } = require('../middlewares/upload');

const createBrand = async (req, res) => {
  let transaction;
  try {
    const { 
      name, 
      website, 
      description, 
      metaTitle, 
      metaDescription, 
      slug,
      isActive = true
    } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Brand name is required'
      });
    }

    // Access uploaded files
    const uploadedFiles = req.uploadedFiles || {};
    
    // Prepare brand data
    const brandData = {
      name: name.trim(),
      website: website?.trim() || null,
      description: description?.trim() || null,
      slug: slug?.trim() || generateSlug(name),
      metaTitle: metaTitle?.trim() || `${name} | Your Store`,
      metaDescription: metaDescription?.trim() || 
        (description ? description.substring(0, 160) : `Explore ${name} products and collections`),
      isActive: Boolean(isActive)
    };

    // Add logo if uploaded
    if (uploadedFiles.logo) {
      brandData.logo = uploadedFiles.logo.url;
    }

    // Check if brand name or slug already exists
    const existingBrand = await req.prisma.brand.findFirst({
      where: {
        OR: [
          { name: brandData.name },
          { slug: brandData.slug }
        ]
      }
    });

    if (existingBrand) {
      // Clean up uploaded files if brand exists
      if (Object.keys(uploadedFiles).length > 0) {
        cleanupUploadedFiles(uploadedFiles);
      }
      return res.status(400).json({
        success: false,
        message: 'Brand with this name or slug already exists'
      });
    }

    // Create brand
    const newBrand = await req.prisma.brand.create({
      data: brandData,
      include: {
        _count: {
          select: {
            products: {
              where: {
                isDeleted: false,
                isActive: true
              }
            }
          }
        }
      }
    });

    // Format response
    const response = {
      success: true,
      message: 'Brand created successfully',
      data: {
        id: newBrand.id,
        name: newBrand.name,
        slug: newBrand.slug,
        logo: newBrand.logo,
        website: newBrand.website,
        description: newBrand.description,
        metaTitle: newBrand.metaTitle,
        metaDescription: newBrand.metaDescription,
        isActive: newBrand.isActive,
        _count: newBrand._count,
        createdAt: newBrand.createdAt,
        updatedAt: newBrand.updatedAt
      }
    };

    res.status(201).json(response);

  } catch (error) {
    // Clean up uploaded files if brand creation fails
    if (req.uploadedFiles) {
      cleanupUploadedFiles(req.uploadedFiles);
    }

    console.error('Error creating brand:', error);

    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Brand with this name or slug already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while creating brand',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updateBrand = async (req, res) => {
  let oldBrand;
  let filesToCleanup = [];

  try {
    const { id } = req.params;
    const { 
      name, 
      website, 
      description, 
      metaTitle, 
      metaDescription, 
      slug,
      isActive
    } = req.body;

    // Validate brand ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid brand ID is required'
      });
    }

    const brandId = parseInt(id);

    // Check if brand exists
    oldBrand = await req.prisma.brand.findUnique({
      where: { 
        id: brandId,
        isDeleted: false 
      },
      include: {
        _count: {
          select: {
            products: {
              where: {
                isDeleted: false,
                isActive: true
              }
            }
          }
        }
      }
    });

    if (!oldBrand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    // Access uploaded files
    const uploadedFiles = req.uploadedFiles || {};
    
    // Prepare update data
    const updateData = {};

    // Text fields
    if (name !== undefined) updateData.name = name.trim();
    if (website !== undefined) updateData.website = website?.trim() || null;
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (slug !== undefined) updateData.slug = slug?.trim() || generateSlug(updateData.name || oldBrand.name);
    if (metaTitle !== undefined) updateData.metaTitle = metaTitle?.trim() || null;
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription?.trim() || null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    // Handle logo updates and track old files for cleanup
    if (uploadedFiles.logo) {
      // Track old file for cleanup
      if (oldBrand.logo) {
        filesToCleanup.push(oldBrand.logo);
      }
      updateData.logo = uploadedFiles.logo.url;
    }

    // Check if new slug already exists (excluding current brand)
    if (updateData.slug && updateData.slug !== oldBrand.slug) {
      const existingSlug = await req.prisma.brand.findUnique({
        where: { slug: updateData.slug }
      });

      if (existingSlug && existingSlug.id !== brandId) {
        // Clean up newly uploaded files if slug exists
        if (Object.keys(uploadedFiles).length > 0) {
          cleanupUploadedFiles(uploadedFiles);
        }
        return res.status(400).json({
          success: false,
          message: 'Slug already exists. Please use a different slug.'
        });
      }
    }

    // Update the brand
    const updatedBrand = await req.prisma.brand.update({
      where: { id: brandId },
      data: updateData,
      include: {
        _count: {
          select: {
            products: {
              where: {
                isDeleted: false,
                isActive: true
              }
            }
          }
        }
      }
    });

    // Clean up old files after successful update
    if (filesToCleanup.length > 0) {
      cleanupUploadedFiles(filesToCleanup);
    }

    // Format response
    const response = {
      success: true,
      message: 'Brand updated successfully',
      data: updatedBrand
    };

    res.status(200).json(response);

  } catch (error) {
    // Clean up newly uploaded files if update fails
    if (req.uploadedFiles) {
      cleanupUploadedFiles(req.uploadedFiles);
    }

    console.error('Error updating brand:', error);

    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Brand with this slug or name already exists'
      });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while updating brand',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid brand ID is required'
      });
    }

    const brandId = parseInt(id);

    // Check if brand exists
    const brand = await req.prisma.brand.findUnique({
      where: { 
        id: brandId,
        isDeleted: false 
      },
      include: {
        _count: {
          select: {
            products: {
              where: {
                isDeleted: false,
                isActive: true
              }
            }
          }
        }
      }
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    // Check if brand has products
    if (brand._count.products > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete brand with active products. Please remove or reassign products first.'
      });
    }

    // Soft delete the brand
    await req.prisma.brand.update({
      where: { id: brandId },
      data: { 
        isDeleted: true,
        isActive: false 
      }
    });

    res.json({
      success: true,
      message: 'Brand deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting brand',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getAllBrands = async (req, res) => {
  try {
    const { 
      includeProducts = 'false',
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const brands = await req.prisma.brand.findMany({
      where: { 
        isDeleted: false
      },
      include: {
        _count: {
          select: {
            products: {
              where: {
                isDeleted: false,
                isActive: true
              }
            }
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      }
    });

    res.json({
      success: true,
      data: {
        brands: brands
      }
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching brands',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getBrandById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid brand ID is required'
      });
    }

    const brandId = parseInt(id);

    const brand = await req.prisma.brand.findFirst({
      where: { 
        id: brandId, 
        isDeleted: false 
      },
      include: {
        products: {
          where: {
            isDeleted: false,
            isActive: true
          },
          take: 10,
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            mrp: true,
            images: true,
            rating: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        _count: {
          select: {
            products: {
              where: {
                isDeleted: false,
                isActive: true
              }
            }
          }
        }
      }
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    res.json({
      success: true,
      data: brand
    });
  } catch (error) {
    console.error('Error fetching brand:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching brand',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getBrandBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'Brand slug is required'
      });
    }

    const brand = await req.prisma.brand.findFirst({
      where: { 
        slug: slug, 
        isDeleted: false,
        isActive: true 
      },
      include: {
        products: {
          where: {
            isDeleted: false,
            isActive: true
          },
          take: 12,
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            mrp: true,
            images: true,
            rating: true,
            discount_percent: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          },
          orderBy: {
            isFeatured: 'desc'
          }
        },
        _count: {
          select: {
            products: {
              where: {
                isDeleted: false,
                isActive: true
              }
            }
          }
        }
      }
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    res.json({
      success: true,
      data: brand
    });
  } catch (error) {
    console.error('Error fetching brand by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching brand',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getPopularBrands = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const brands = await req.prisma.brand.findMany({
      where: { 
        isDeleted: false,
        isActive: true 
      },
      include: {
        _count: {
          select: {
            products: {
              where: {
                isDeleted: false,
                isActive: true
              }
            }
          }
        }
      },
      orderBy: {
        products: {
          _count: 'desc'
        }
      },
      take: parseInt(limit)
    });

    res.json({
      success: true,
      data: {
        brands: brands
      }
    });
  } catch (error) {
    console.error('Error fetching popular brands:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching popular brands',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const searchBrands = async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [brands, total] = await Promise.all([
      req.prisma.brand.findMany({
        where: { 
          isDeleted: false,
          isActive: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: {
          _count: {
            select: {
              products: {
                where: {
                  isDeleted: false,
                  isActive: true
                }
              }
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: {
          name: 'asc'
        }
      }),
      req.prisma.brand.count({
        where: { 
          isDeleted: false,
          isActive: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        brands,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error searching brands:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while searching brands',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Generate slug from name
 */
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

module.exports = {
  createBrand,
  updateBrand,
  deleteBrand,
  getAllBrands,
  getBrandById,
  getBrandBySlug,
  getPopularBrands,
  searchBrands
};