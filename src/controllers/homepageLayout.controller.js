// src/controllers/homepageLayout.controller.js

const getAllHomepageSections = async (req, res) => {
  try {
    const prisma = req.prisma;
    
    const sections = await prisma.homepageSection.findMany({
      where: {
        isDeleted: false,
        parentId: null // Only get top-level sections
      },
      include: {
        children: {
          where: { isDeleted: false },
          include: {
            children: {
              where: { isDeleted: false }
            }
          },
          orderBy: { orderIndex: 'asc' }
        }
      },
      orderBy: { orderIndex: 'asc' }
    });

    res.json({
      success: true,
      sections
    });
  } catch (error) {
    console.error('Get homepage sections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch homepage sections'
    });
  }
};

const getHomepageSectionById = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const section = await prisma.homepageSection.findFirst({
      where: {
        id,
        isDeleted: false
      },
      include: {
        children: {
          where: { isDeleted: false },
          include: {
            children: {
              where: { isDeleted: false }
            }
          },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    if (!section) {
      return res.status(404).json({
        success: false,
        error: 'Homepage section not found'
      });
    }

    res.json({
      success: true,
      section
    });
  } catch (error) {
    console.error('Get homepage section error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch homepage section'
    });
  }
};

const createHomepageSection = async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      type,
      title,
      enabled = true,
      config = {},
      parentId = null,
      orderIndex = 0
    } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Section type is required'
      });
    }

    // If parentId is provided, verify parent exists
    if (parentId) {
      const parent = await prisma.homepageSection.findFirst({
        where: {
          id: parentId,
          isDeleted: false
        }
      });

      if (!parent) {
        return res.status(400).json({
          success: false,
          error: 'Parent section not found'
        });
      }
    }

    const section = await prisma.homepageSection.create({
      data: {
        type,
        title,
        enabled,
        config,
        parentId,
        orderIndex
      },
      include: {
        children: {
          where: { isDeleted: false },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Homepage section created successfully',
      section
    });
  } catch (error) {
    console.error('Create homepage section error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create homepage section'
    });
  }
};

const updateHomepageSection = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const updateData = req.body;

    const section = await prisma.homepageSection.findFirst({
      where: {
        id,
        isDeleted: false
      }
    });

    if (!section) {
      return res.status(404).json({
        success: false,
        error: 'Homepage section not found'
      });
    }

    // Remove fields that shouldn't be updated directly
    const { id: sectionId, createdAt, ...safeUpdateData } = updateData;

    const updatedSection = await prisma.homepageSection.update({
      where: { id },
      data: safeUpdateData,
      include: {
        children: {
          where: { isDeleted: false },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    res.json({
      success: true,
      message: 'Homepage section updated successfully',
      section: updatedSection
    });
  } catch (error) {
    console.error('Update homepage section error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update homepage section'
    });
  }
};

const deleteHomepageSection = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const section = await prisma.homepageSection.findFirst({
      where: {
        id,
        isDeleted: false
      },
      include: {
        children: {
          where: { isDeleted: false }
        }
      }
    });

    if (!section) {
      return res.status(404).json({
        success: false,
        error: 'Homepage section not found'
      });
    }

    // Use transaction to handle recursive deletion
    await prisma.$transaction(async (tx) => {
      // Recursively soft delete children
      const deleteChildrenRecursively = async (parentId) => {
        const children = await tx.homepageSection.findMany({
          where: { parentId, isDeleted: false }
        });

        for (const child of children) {
          await tx.homepageSection.update({
            where: { id: child.id },
            data: { isDeleted: true }
          });
          await deleteChildrenRecursively(child.id);
        }
      };

      // Delete current section
      await tx.homepageSection.update({
        where: { id },
        data: { isDeleted: true }
      });

      // Delete all children
      await deleteChildrenRecursively(id);
    });

    res.json({
      success: true,
      message: 'Homepage section and its children deleted successfully'
    });
  } catch (error) {
    console.error('Delete homepage section error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete homepage section'
    });
  }
};

const reorderHomepageSections = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { sections } = req.body;

    if (!Array.isArray(sections)) {
      return res.status(400).json({
        success: false,
        error: 'Sections array is required'
      });
    }

    await prisma.$transaction(async (tx) => {
      for (const section of sections) {
        await tx.homepageSection.updateMany({
          where: {
            id: section.id,
            isDeleted: false
          },
          data: {
            orderIndex: section.orderIndex,
            parentId: section.parentId || null
          }
        });

        // Recursively update children if provided
        if (section.children && Array.isArray(section.children)) {
          for (const child of section.children) {
            await tx.homepageSection.updateMany({
              where: {
                id: child.id,
                isDeleted: false
              },
              data: {
                orderIndex: child.orderIndex,
                parentId: child.parentId || section.id
              }
            });
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Homepage sections reordered successfully'
    });
  } catch (error) {
    console.error('Reorder homepage sections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reorder homepage sections'
    });
  }
};

const bulkUpdateHomepageSections = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { sections } = req.body;

    if (!Array.isArray(sections)) {
      return res.status(400).json({
        success: false,
        error: 'Sections array is required'
      });
    }

    const results = await prisma.$transaction(
      sections.map(section => {
        // Handle both data structures: with or without nested 'data'
        const updateData = section.data || section;
        
        // Extract only the fields that exist in the Prisma model
        const {
          id: sectionId,
          createdAt,
          updatedAt,
          children,
          keyMetrics, // Remove fields that don't exist in Prisma model
          trustBadgeItems,
          promoGridItems, 
          featureCards,
          galleryImages,
          galleryLayout,
          promoBannerTitle,
          promoBannerSubtitle,
          promoBannerButtonText,
          promoBannerLink,
          promoBannerImage,
          promoBannerButtonVariant,
          faqItems,
          videoUrl,
          ctaSubtitle,
          ctaButtonText,
          ctaLink,
          ctaButtonVariant,
          columnTemplate,
          items,
          promoCards,
          brandIds,
          categorySlug,
          productCount,
          categoryDisplayStart,
          categoryDisplayCount,
          postCount,
          testimonialItems,
          // Keep only valid Prisma fields
          ...validFields
        } = updateData;

        // Ensure config contains all the section-specific data
        const config = {};
        
        // Move section-specific fields to config
        if (keyMetrics) config.keyMetrics = keyMetrics;
        if (trustBadgeItems) config.trustBadgeItems = trustBadgeItems;
        if (promoGridItems) config.promoGridItems = promoGridItems;
        if (featureCards) config.featureCards = featureCards;
        if (galleryImages) config.galleryImages = galleryImages;
        if (galleryLayout) config.galleryLayout = galleryLayout;
        if (promoBannerTitle) config.promoBannerTitle = promoBannerTitle;
        if (promoBannerSubtitle) config.promoBannerSubtitle = promoBannerSubtitle;
        if (promoBannerButtonText) config.promoBannerButtonText = promoBannerButtonText;
        if (promoBannerLink) config.promoBannerLink = promoBannerLink;
        if (promoBannerImage) config.promoBannerImage = promoBannerImage;
        if (promoBannerButtonVariant) config.promoBannerButtonVariant = promoBannerButtonVariant;
        if (faqItems) config.faqItems = faqItems;
        if (videoUrl) config.videoUrl = videoUrl;
        if (ctaSubtitle) config.ctaSubtitle = ctaSubtitle;
        if (ctaButtonText) config.ctaButtonText = ctaButtonText;
        if (ctaLink) config.ctaLink = ctaLink;
        if (ctaButtonVariant) config.ctaButtonVariant = ctaButtonVariant;
        if (columnTemplate) config.columnTemplate = columnTemplate;
        if (items) config.items = items;
        if (promoCards) config.promoCards = promoCards;
        if (brandIds) config.brandIds = brandIds;
        if (categorySlug) config.categorySlug = categorySlug;
        if (productCount) config.productCount = productCount;
        if (categoryDisplayStart) config.categoryDisplayStart = categoryDisplayStart;
        if (categoryDisplayCount) config.categoryDisplayCount = categoryDisplayCount;
        if (postCount) config.postCount = postCount;
        if (testimonialItems) config.testimonialItems = testimonialItems;

        // Merge existing config with new config fields
        const finalConfig = {
          ...(validFields.config || {}),
          ...config
        };

        // Create the final update data with only valid Prisma fields
        const safeUpdateData = {
          ...validFields,
          ...(Object.keys(finalConfig).length > 0 && { config: finalConfig })
        };

        return prisma.homepageSection.updateMany({
          where: {
            id: section.id || sectionId,
            isDeleted: false
          },
          data: safeUpdateData
        });
      })
    );

    res.json({
      success: true,
      message: `${results.length} homepage sections updated successfully`,
      updatedCount: results.length
    });
  } catch (error) {
    console.error('Bulk update homepage sections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update homepage sections'
    });
  }
};

module.exports = {
  getAllHomepageSections,
  getHomepageSectionById,
  createHomepageSection,
  updateHomepageSection,
  deleteHomepageSection,
  reorderHomepageSections,
  bulkUpdateHomepageSections
};