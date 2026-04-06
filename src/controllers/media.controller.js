const { PrismaClient } = require('@prisma/client');
const { processUploadedFiles, cleanupUploadedFiles, deleteFile } = require('../middlewares/upload');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Get all media with pagination and filtering
const getAllMedia = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      unusedOnly = false
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};
    
    if (type && type !== 'ALL') {
      where.type = type;
    }
    
    if (category) {
      where.category = category;
    }
    
    if (search) {
      where.OR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { altText: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (unusedOnly === 'true') {
      where.isUsed = false;
    }

    // Get media with pagination
    const [media, totalCount] = await Promise.all([
      prisma.media.findMany({
        where,
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder.toLowerCase()
        },
        select: {
          id: true,
          fileName: true,
          originalName: true,
          filePath: true,
          mimeType: true,
          size: true,
          extension: true,
          width: true,
          height: true,
          duration: true,
          title: true,
          altText: true,
          description: true,
          caption: true,
          type: true,
          category: true,
          isUsed: true,
          uploadedBy: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.media.count({ where })
    ]);

    // Add full URLs to media items
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const mediaWithUrls = media.map(item => ({
      ...item,
      url: `/${item.filePath}`,
      fullUrl: `${baseUrl}/${item.filePath}`,
      thumbnailUrl: item.type === 'IMAGE' ? `/${item.filePath}` : null
    }));

    const totalPages = Math.ceil(totalCount / take);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        media: mediaWithUrls,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit: take
        }
      }
    });

  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// Get single media by ID
const getMediaById = async (req, res) => {
  try {
    const { id } = req.params;

    const media = await prisma.media.findUnique({
      where: { id: parseInt(id) }
    });

    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    // Add full URL
    const mediaWithUrl = {
      ...media,
      url: `/${media.filePath.replace(/\\/g, '/')}`,
      thumbnailUrl: media.type === 'IMAGE' ? `/${media.filePath.replace(/\\/g, '/')}` : null
    };

    res.json({
      success: true,
      data: mediaWithUrl
    });

  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Upload media files
const uploadMedia = async (req, res) => {
  let uploadedFiles = [];
  
  try {
    const { title, altText, description, caption, category } = req.body;
    const uploadedBy = req.user?.id; // From authentication middleware

    console.log('Request body:', req.body);
    console.log('Uploaded files from middleware:', req.uploadedFiles);
    console.log('Raw req.files:', req.files);

    // Check if files were processed by middleware
    if (!req.uploadedFiles || !req.uploadedFiles.files || req.uploadedFiles.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files were processed. Please check file type and size limits.'
      });
    }

    const processedFiles = req.uploadedFiles.files;
    uploadedFiles = processedFiles;

    // Process each uploaded file
    const mediaPromises = processedFiles.map(async (file) => {
      // Determine media type based on MIME type
      let type = 'OTHER';
      if (file.mimetype.startsWith('image/')) {
        type = 'IMAGE';
      } else if (file.mimetype.startsWith('video/')) {
        type = 'VIDEO';
      } else if (file.mimetype.startsWith('audio/')) {
        type = 'AUDIO';
      } else if (file.mimetype.includes('pdf') || 
                 file.mimetype.includes('document') || 
                 file.mimetype.includes('text')) {
        type = 'DOCUMENT';
      }

      // Get file extension
      const extension = path.extname(file.originalName).toLowerCase().slice(1) || 
                       file.mimetype.split('/')[1] || 'unknown';

      // Prepare media data
      const mediaData = {
        fileName: file.filename,
        originalName: file.originalName,
        filePath: file.path.startsWith('/') ? file.path.slice(1) : file.path, // Remove leading slash for storage
        mimeType: file.mimetype,
        size: file.size,
        extension,
        type,
        title: title || file.originalName,
        altText: altText || null,
        description: description || null,
        caption: caption || null,
        category: category || null,
        uploadedBy: uploadedBy || null,
        isUsed: false
      };

      console.log('Creating media record:', mediaData);

      return await prisma.media.create({
        data: mediaData
      });
    });

    const createdMedia = await Promise.all(mediaPromises);

    // Add URLs to response
    const mediaWithUrls = createdMedia.map(media => ({
      ...media,
      url: `/${media.filePath}`,
      fullUrl: `${req.protocol}://${req.get('host')}/${media.filePath}`,
      thumbnailUrl: media.type === 'IMAGE' ? `/${media.filePath}` : null
    }));

    res.status(201).json({
      success: true,
      message: `${processedFiles.length} file(s) uploaded successfully`,
      data: {
        media: mediaWithUrls
      }
    });

  } catch (error) {
    // Clean up uploaded files if media creation fails
    if (uploadedFiles.length > 0) {
      cleanupUploadedFiles(uploadedFiles);
    }

    console.error('Error uploading media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload media',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update media metadata
const updateMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, altText, description, caption, category, isUsed } = req.body;

    const existingMedia = await prisma.media.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingMedia) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    const updatedMedia = await prisma.media.update({
      where: { id: parseInt(id) },
      data: {
        ...(title !== undefined && { title }),
        ...(altText !== undefined && { altText }),
        ...(description !== undefined && { description }),
        ...(caption !== undefined && { caption }),
        ...(category !== undefined && { category }),
        ...(isUsed !== undefined && { isUsed })
      }
    });

    // Add URL to response
    const mediaWithUrl = {
      ...updatedMedia,
      url: `/${updatedMedia.filePath.replace(/\\/g, '/')}`,
      thumbnailUrl: updatedMedia.type === 'IMAGE' ? `/${updatedMedia.filePath.replace(/\\/g, '/')}` : null
    };

    res.json({
      success: true,
      message: 'Media updated successfully',
      data: mediaWithUrl
    });

  } catch (error) {
    console.error('Error updating media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update media',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete media
const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;

    const media = await prisma.media.findUnique({
      where: { id: parseInt(id) }
    });

    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    // Check if media is being used
    if (media.isUsed) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete media that is currently in use'
      });
    }

    // Delete physical file
    const fileDeleted = deleteFile(media.filePath);
    
    if (!fileDeleted) {
      console.warn(`Physical file not found for media ID ${id}: ${media.filePath}`);
    }

    // Delete database record
    await prisma.media.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Media deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete media',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Bulk delete media
const bulkDeleteMedia = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No media IDs provided'
      });
    }

    // Check if any media is being used
    const usedMedia = await prisma.media.findMany({
      where: {
        id: { in: ids.map(id => parseInt(id)) },
        isUsed: true
      },
      select: { id: true, originalName: true }
    });

    if (usedMedia.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some media files are currently in use and cannot be deleted',
        data: {
          usedMedia: usedMedia.map(media => ({
            id: media.id,
            name: media.originalName
          }))
        }
      });
    }

    // Get media files to delete physical files
    const mediaToDelete = await prisma.media.findMany({
      where: {
        id: { in: ids.map(id => parseInt(id)) }
      }
    });

    // Delete physical files
    mediaToDelete.forEach(media => {
      deleteFile(media.filePath);
    });

    // Delete database records
    await prisma.media.deleteMany({
      where: {
        id: { in: ids.map(id => parseInt(id)) }
      }
    });

    res.json({
      success: true,
      message: `${ids.length} media file(s) deleted successfully`
    });

  } catch (error) {
    console.error('Error bulk deleting media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete media',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get media statistics
const getMediaStats = async (req, res) => {
  try {
    const stats = await prisma.media.groupBy({
      by: ['type'],
      _count: {
        id: true
      },
      _sum: {
        size: true
      }
    });

    const totalStats = await prisma.media.aggregate({
      _count: {
        id: true
      },
      _sum: {
        size: true
      }
    });

    const usedStats = await prisma.media.groupBy({
      by: ['isUsed'],
      _count: {
        id: true
      }
    });

    res.json({
      success: true,
      data: {
        byType: stats,
        total: {
          count: totalStats._count.id,
          totalSize: totalStats._sum.size
        },
        usage: usedStats
      }
    });

  } catch (error) {
    console.error('Error fetching media stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllMedia,
  getMediaById,
  uploadMedia,
  updateMedia,
  deleteMedia,
  bulkDeleteMedia,
  getMediaStats
};