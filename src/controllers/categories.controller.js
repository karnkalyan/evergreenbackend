const { cleanupUploadedFiles } = require('../middlewares/upload');

/**
 * Create a new category
 */
const createCategory = async (req, res) => {
  let transaction;
  try {
    const { name, description, parentId, slug, metaTitle, metaDescription, isActive, displayOrder, catColor } = req.body;
    
    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    // Access uploaded files
    const uploadedFiles = req.uploadedFiles || {};
    
    // Prepare category data
    const categoryData = {
      name: name.trim(),
      description: description?.trim() || null,
      slug: slug?.trim() || generateSlug(name),
      metaTitle: metaTitle?.trim() || null,
      metaDescription: metaDescription?.trim() || null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      displayOrder: displayOrder ? parseInt(displayOrder) : 0,
      parentId: parentId ? parseInt(parentId) : null,
      catColor: catColor || null
    };

    // Add file URLs if uploaded
    if (uploadedFiles.catLogo) {
      categoryData.catLogo = uploadedFiles.catLogo.url;
    }

    if (uploadedFiles.image) {
      categoryData.image = uploadedFiles.image.url;
    }

    if (uploadedFiles.banner) {
      categoryData.banner = uploadedFiles.banner.url;
    }

    // Check if slug already exists
    const existingSlug = await req.prisma.category.findUnique({
      where: { slug: categoryData.slug }
    });

    if (existingSlug) {
      // Clean up uploaded files if slug exists
      if (Object.keys(uploadedFiles).length > 0) {
        cleanupUploadedFiles(uploadedFiles);
      }
      return res.status(400).json({
        success: false,
        message: 'Slug already exists. Please use a different slug.'
      });
    }

    // Check parent category exists if provided
    if (categoryData.parentId) {
      const parentCategory = await req.prisma.category.findUnique({
        where: { id: categoryData.parentId }
      });

      if (!parentCategory) {
        // Clean up uploaded files if parent doesn't exist
        if (Object.keys(uploadedFiles).length > 0) {
          cleanupUploadedFiles(uploadedFiles);
        }
        return res.status(400).json({
          success: false,
          message: 'Parent category not found'
        });
      }
    }

    // Start transaction
    transaction = await req.prisma.$transaction(async (prisma) => {
      // Create category
      const newCategory = await prisma.category.create({
        data: categoryData,
        include: {
          parent: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          children: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          _count: {
            select: {
              products: true,
              children: true
            }
          }
        }
      });

      // Update parent category's hasChildren if this is a child category
      if (newCategory.parentId) {
        await prisma.category.update({
          where: { id: newCategory.parentId },
          data: { hasChildren: true }
        });
      }

      return newCategory;
    });

    // Format response
    const response = {
      success: true,
      message: 'Category created successfully',
      data: {
        id: transaction.id,
        name: transaction.name,
        slug: transaction.slug,
        description: transaction.description,
        catLogo: transaction.catLogo,
        catColor: transaction.catColor,
        image: transaction.image,
        banner: transaction.banner,
        metaTitle: transaction.metaTitle,
        metaDescription: transaction.metaDescription,
        isActive: transaction.isActive,
        displayOrder: transaction.displayOrder,
        parent: transaction.parent,
        children: transaction.children,
        _count: transaction._count,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt
      }
    };

    res.status(201).json(response);

  } catch (error) {
    // Clean up uploaded files if category creation fails
    if (req.uploadedFiles) {
      cleanupUploadedFiles(req.uploadedFiles);
    }

    console.error('Error creating category:', error);

    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Category with this slug or name already exists'
      });
    }

    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent category'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while creating category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update an existing category
 */
const updateCategory = async (req, res) => {
  let oldCategory;
  let filesToCleanup = [];

  try {
    const { id } = req.params;
    const { name, description, parentId, slug, metaTitle, metaDescription, isActive, displayOrder, catColor } = req.body;

    // Validate category ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    const categoryId = parseInt(id);

    // Check if category exists
    oldCategory = await req.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        parent: {
          select: {
            id: true,
            name: true
          }
        },
        children: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            products: true,
            children: true
          }
        }
      }
    });

    if (!oldCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Access uploaded files
    const uploadedFiles = req.uploadedFiles || {};
    
    // Prepare update data
    const updateData = {};

    // Text fields
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (slug !== undefined) updateData.slug = slug?.trim() || generateSlug(updateData.name || oldCategory.name);
    if (metaTitle !== undefined) updateData.metaTitle = metaTitle?.trim() || null;
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription?.trim() || null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (displayOrder !== undefined) updateData.displayOrder = parseInt(displayOrder) || 0;
    if (catColor !== undefined) updateData.catColor = catColor || null;

    // Handle parent category change
    if (parentId !== undefined) {
      const newParentId = parentId ? parseInt(parentId) : null;
      
      // Prevent self-parenting
      if (newParentId === categoryId) {
        return res.status(400).json({
          success: false,
          message: 'Category cannot be its own parent'
        });
      }

      // Check if new parent exists
      if (newParentId) {
        const newParent = await req.prisma.category.findUnique({
          where: { id: newParentId }
        });

        if (!newParent) {
          return res.status(400).json({
            success: false,
            message: 'Parent category not found'
          });
        }

        // Check for circular dependency
        let currentParentId = newParentId;
        while (currentParentId) {
          if (currentParentId === categoryId) {
            return res.status(400).json({
              success: false,
              message: 'Circular dependency detected in category hierarchy'
            });
          }
          const currentParent = await req.prisma.category.findUnique({
            where: { id: currentParentId },
            select: { parentId: true }
          });
          currentParentId = currentParent?.parentId;
        }
      }

      updateData.parentId = newParentId;
    }

    // Handle file updates and track old files for cleanup
    if (uploadedFiles.catLogo) {
      // Track old file for cleanup
      if (oldCategory.catLogo) {
        filesToCleanup.push(oldCategory.catLogo);
      }
      updateData.catLogo = uploadedFiles.catLogo.url;
    }

    if (uploadedFiles.image) {
      // Track old file for cleanup
      if (oldCategory.image) {
        filesToCleanup.push(oldCategory.image);
      }
      updateData.image = uploadedFiles.image.url;
    }

    if (uploadedFiles.banner) {
      // Track old file for cleanup
      if (oldCategory.banner) {
        filesToCleanup.push(oldCategory.banner);
      }
      updateData.banner = uploadedFiles.banner.url;
    }

    // Check if new slug already exists (excluding current category)
    if (updateData.slug && updateData.slug !== oldCategory.slug) {
      const existingSlug = await req.prisma.category.findUnique({
        where: { slug: updateData.slug }
      });

      if (existingSlug && existingSlug.id !== categoryId) {
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

    // Start transaction for update
    const updatedCategory = await req.prisma.$transaction(async (prisma) => {
      // Update the category
      const category = await prisma.category.update({
        where: { id: categoryId },
        data: updateData,
        include: {
          parent: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          children: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          _count: {
            select: {
              products: true,
              children: true
            }
          }
        }
      });

      // Update hasChildren for old parent if parent changed
      if (updateData.parentId !== undefined && updateData.parentId !== oldCategory.parentId) {
        // Update old parent's hasChildren
        if (oldCategory.parentId) {
          const oldParentChildrenCount = await prisma.category.count({
            where: {
              parentId: oldCategory.parentId,
              id: { not: categoryId }
            }
          });
          
          await prisma.category.update({
            where: { id: oldCategory.parentId },
            data: { hasChildren: oldParentChildrenCount > 0 }
          });
        }

        // Update new parent's hasChildren
        if (updateData.parentId) {
          await prisma.category.update({
            where: { id: updateData.parentId },
            data: { hasChildren: true }
          });
        }
      }

      return category;
    });

    // Clean up old files after successful update
    if (filesToCleanup.length > 0) {
      cleanupUploadedFiles(filesToCleanup);
    }

    // Format response
    const response = {
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory
    };

    res.status(200).json(response);

  } catch (error) {
    // Clean up newly uploaded files if update fails
    if (req.uploadedFiles) {
      cleanupUploadedFiles(req.uploadedFiles);
    }

    console.error('Error updating category:', error);

    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Category with this slug or name already exists'
      });
    }

    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent category'
      });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while updating category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all categories
 */
/**
 * Get all categories
 */
const getAllCategories = async (req, res) => {
  try {
    const categories = await req.prisma.category.findMany({
      where: {
        isDeleted: false
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        _count: {
          select: {
            products: {
              where: {
                isDeleted: false,
                isActive: true
              }
            },
            children: {
              where: {
                isDeleted: false
              }
            }
          }
        }
      },
      orderBy: [
        { displayOrder: 'asc' },
        { name: 'asc' }
      ]
    });

    // Return consistent JSON structure
    res.json({
      success: true,
      data: {
        categories: categories
      }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching categories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get category by ID
 */
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    const categoryId = parseInt(id);

    const category = await req.prisma.category.findUnique({
      where: { 
        id: categoryId,
        isDeleted: false 
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        children: {
          where: {
            isDeleted: false
          },
          select: {
            id: true,
            name: true,
            slug: true,
            catLogo: true,
            catColor: true
          }
        },
        products: {
          where: {
            isDeleted: false,
            isActive: true
          },
          select: {
            id: true,
            name: true,
            slug: true,
            sku: true,
            price: true,
            mrp: true,
            images: true,
            brand: {
              select: {
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            products: {
              where: {
                isDeleted: false,
                isActive: true
              }
            },
            children: {
              where: {
                isDeleted: false
              }
            }
          }
        }
      }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get category by slug
 */
const getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'Category slug is required'
      });
    }

    const category = await req.prisma.category.findUnique({
      where: { 
        slug: slug,
        isDeleted: false 
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        children: {
          where: {
            isDeleted: false,
            isActive: true
          },
          select: {
            id: true,
            name: true,
            slug: true,
            catLogo: true,
            catColor: true
          }
        },
        products: {
          where: {
            isDeleted: false,
            isActive: true
          },
          include: {
            brand: {
              select: {
                name: true,
                logo: true
              }
            },
            variants: {
              include: {
                options: true
              }
            }
          }
        },
        _count: {
          select: {
            products: {
              where: {
                isDeleted: false,
                isActive: true
              }
            },
            children: {
              where: {
                isDeleted: false
              }
            }
          }
        }
      }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching category by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get category hierarchy
 */
const getCategoryHierarchy = async (req, res) => {
  try {
    const categories = await req.prisma.category.findMany({
      where: {
        isDeleted: false,
        isActive: true
      },
      include: {
        children: {
          where: {
            isDeleted: false,
            isActive: true
          },
          include: {
            children: {
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
      },
      orderBy: [
        { displayOrder: 'asc' },
        { name: 'asc' }
      ]
    });

    // Filter only top-level categories (no parent)
    const topLevelCategories = categories.filter(cat => !cat.parentId);

    res.json({
      success: true,
      data: topLevelCategories
    });
  } catch (error) {
    console.error('Error fetching category hierarchy:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching category hierarchy',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete category
 */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    const categoryId = parseInt(id);

    // Check if category exists
    const category = await req.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: {
            products: true,
            children: true
          }
        }
      }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has products or children
    if (category._count.products > 0 || category._count.children > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category that has products or subcategories. Please remove them first.'
      });
    }

    // Soft delete the category
    await req.prisma.category.update({
      where: { id: categoryId },
      data: { 
        isDeleted: true,
        isActive: false 
      }
    });

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting category',
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
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  getCategoryHierarchy
};