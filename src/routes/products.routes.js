const express = require('express');
const {
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  getProductBySlug, // For public routes
  getProductBySlugForAdmin, // For admin routes
  bulkUpdateProducts,
  getFeaturedProducts,
  getTrendingProducts,
  updateProductSeo,
  getProductsNeedingSeo,
  recordSeoAudit,
  updateProductVariants,
  uploadProductImage,
  deleteProductImage,
  updateProductImages,
  getProductImages,
  getPublicProducts
} = require('../controllers/products.controller');

const isAuthenticated = require('../middlewares/isAuthenticated');
const checkPermission = require('../middlewares/checkPermission');
const { 
  uploadProductImages, 
  uploadFiles,
  uploadFile 
} = require('../middlewares/upload');

module.exports = (prisma) => {
  const router = express.Router();
  
  // Add prisma to request object
  router.use((req, res, next) => { 
    req.prisma = prisma; 
    next(); 
  });

  // ==================== PUBLIC ROUTES ====================
  // These routes don't require authentication and apply country filtering

  // Get Public Products with country filtering
  router.get(
    '/public/products',
    getPublicProducts
  );

  // Get Featured Products (Public) with country filtering
  router.get(
    '/public/products/featured',
    getFeaturedProducts
  );

  // Get Trending Products (Public) with country filtering
  router.get(
    '/public/products/trending',
    getTrendingProducts
  );

  // Get Product by Slug (Public) with country filtering
  router.get(
    '/public/products/slug/:slug',
    getProductBySlug
  );

  // Get Product by ID (Public) with country filtering
  router.get(
    '/public/products/:id',
    getProductById
  );

  // Search products (Public) with country filtering
  router.get(
    '/public/products/search/products',
    getPublicProducts
  );

  // ==================== AUTHENTICATED ROUTES ====================
  // These routes require authentication and DON'T apply country filtering
  
  router.use(isAuthenticated(prisma));

  // --- ⚙️ PRODUCT CRUD ROUTES ---
  // ------------------------------------------

  // Create Product with structured image upload
  router.post(
    '/',
    checkPermission('create_products'),
    uploadProductImages, 
    createProduct
  );

  // Get All Products (Admin - no country filtering)
  router.get(
    '/',
    checkPermission('read_products'),
    getAllProducts
  );

  // Get Product by ID (Admin - no country filtering)
  router.get(
    '/:id',
    checkPermission('read_products'),
    getProductById
  );

  // Get Product by Slug (Admin - no country filtering)
  router.get(
    '/slug/:slug',
    checkPermission('read_products'),
    getProductBySlugForAdmin // 🚨 CHANGED: Use admin-specific function
  );

  // Update Product (Full Update) with image upload
  router.put(
    '/:id',
    checkPermission('update_products'),
    uploadProductImages,
    updateProduct
  );

  // Delete Product
  router.delete(
    '/:id',
    checkPermission('delete_products'),
    deleteProduct
  );

  // --- 🖼️ PRODUCT IMAGES MANAGEMENT ROUTES ---
  // ------------------------------------------

  // Get product images
  router.get(
    '/:id/images',
    checkPermission('read_products'),
    getProductImages
  );

  // Upload additional product images (multiple)
  router.post(
    '/:id/images',
    checkPermission('update_products'),
    uploadFiles('products', 'images', 'images', 10),
    uploadProductImage
  );

  // Upload single product image
  router.post(
    '/:id/image',
    checkPermission('update_products'),
    uploadFile('products', 'images', 'image'),
    uploadProductImage
  );

  // Update product images (replace existing)
  router.put(
    '/:id/images',
    checkPermission('update_products'),
    uploadFiles('products', 'images', 'images', 10),
    updateProductImages
  );

  // Delete product image
  router.delete(
    '/:id/images/:imageId',
    checkPermission('update_products'),
    deleteProductImage
  );

  // --- 📦 PRODUCT VARIANTS ROUTES ---
  // ------------------------------------------

  // Update product variants
  router.put(
    '/:id/variants',
    checkPermission('update_products'),
    updateProductVariants
  );

  // --- 🗃️ BULK OPERATIONS ROUTES ---
  // ------------------------------------------

  // Bulk Update Products
  router.patch(
    '/bulk/update',
    checkPermission('update_products'),
    bulkUpdateProducts
  );

  // Bulk upload product images
  router.post(
    '/bulk/images',
    checkPermission('update_products'),
    uploadFiles('products', 'images', 'images', 50),
    async (req, res) => {
      try {
        const files = req.files || [];
        const uploadedImages = files.map(file => ({
          url: `/${file.path.replace(/\\/g, '/')}`,
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          tempId: req.body.tempId
        }));

        res.json({
          message: 'Images uploaded successfully',
          images: uploadedImages,
          count: uploadedImages.length
        });
      } catch (error) {
        console.error('Bulk image upload error:', error);
        res.status(500).json({
          error: 'Failed to upload images'
        });
      }
    }
  );

  // --- ⭐ FEATURED & TRENDING PRODUCTS ROUTES ---
  // ------------------------------------------

  // Get Featured Products (Admin - no country filtering)
  router.get(
    '/featured/products',
    checkPermission('read_products'),
    getFeaturedProducts
  );

  // Get Trending Products (Admin - no country filtering)
  router.get(
    '/trending/products',
    checkPermission('read_products'),
    getTrendingProducts
  );

  // --- 🌐 SEO & OPTIMIZATION ROUTES ---
  // ------------------------------------------

  // Update Product SEO Only
  router.patch(
    '/:id/seo',
    checkPermission('update_products'),
    updateProductSeo
  );

  // Get Products Needing SEO Optimization
  router.get(
    '/seo/needs-optimization',
    checkPermission('read_products'),
    getProductsNeedingSeo
  );

  // Record SEO Audit
  router.post(
    '/seo/audit',
    checkPermission('update_products'),
    recordSeoAudit
  );

  // --- 📄 PRODUCT DOCUMENTS ROUTES ---
  // ------------------------------------------

  // Upload product documents (PDF, etc.)
  router.post(
    '/:id/documents',
    checkPermission('update_products'),
    uploadFiles('products', 'documents', 'documents', 5),
    async (req, res) => {
      try {
        const prisma = req.prisma;
        const { id } = req.params;

        if (isNaN(Number(id))) {
          return res.status(400).json({ error: 'Invalid product ID' });
        }

        const product = await prisma.product.findFirst({
          where: {
            id: Number(id),
            isDeleted: false
          }
        });

        if (!product) {
          req.files.forEach(file => {
            require('fs').unlinkSync(file.path);
          });
          return res.status(404).json({ error: 'Product not found' });
        }

        const uploadedDocuments = req.files.map(file => ({
          url: `/${file.path.replace(/\\/g, '/')}`,
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          type: 'document',
          title: req.body.titles ? req.body.titles[file.originalname] : file.originalname
        }));

        const existingDocuments = product.documents || [];
        const updatedDocuments = [...existingDocuments, ...uploadedDocuments];

        const updatedProduct = await prisma.product.update({
          where: { id: Number(id) },
          data: { documents: updatedDocuments },
          include: {
            brand: {
              select: {
                id: true,
                name: true,
                logo: true,
                slug: true
              }
            },
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                catLogo: true
              }
            }
          }
        });

        res.json({
          message: 'Documents uploaded successfully',
          documents: uploadedDocuments,
          product: updatedProduct
        });
      } catch (error) {
        console.error('Upload product documents error:', error);
        
        if (req.files) {
          req.files.forEach(file => {
            require('fs').unlinkSync(file.path);
          });
        }
        
        res.status(500).json({
          error: 'Failed to upload documents'
        });
      }
    }
  );

  // Delete product document
  router.delete(
    '/:id/documents/:documentId',
    checkPermission('update_products'),
    async (req, res) => {
      try {
        const prisma = req.prisma;
        const { id, documentId } = req.params;

        if (isNaN(Number(id))) {
          return res.status(400).json({ error: 'Invalid product ID' });
        }

        const product = await prisma.product.findFirst({
          where: {
            id: Number(id),
            isDeleted: false
          }
        });

        if (!product) {
          return res.status(404).json({ error: 'Product not found' });
        }

        const existingDocuments = product.documents || [];
        const documentToDelete = existingDocuments.find(doc => 
          doc.filename === documentId || doc.url.includes(documentId)
        );

        if (!documentToDelete) {
          return res.status(404).json({ error: 'Document not found' });
        }

        const updatedDocuments = existingDocuments.filter(doc => 
          !(doc.filename === documentId || doc.url.includes(documentId))
        );

        const updatedProduct = await prisma.product.update({
          where: { id: Number(id) },
          data: { documents: updatedDocuments }
        });

        const { deleteFile } = require('../middlewares/upload');
        deleteFile(documentToDelete.url);

        res.json({
          message: 'Document deleted successfully',
          product: updatedProduct
        });
      } catch (error) {
        console.error('Delete product document error:', error);
        res.status(500).json({
          error: 'Failed to delete document'
        });
      }
    }
  );

  // --- 🚦 PRODUCT STATUS & VISIBILITY ROUTES ---
  // ------------------------------------------

  // Toggle product active status
  router.patch(
    '/:id/status',
    checkPermission('update_products'),
    async (req, res) => {
      try {
        const prisma = req.prisma;
        const { id } = req.params;
        const { isActive } = req.body;

        if (isNaN(Number(id))) {
          return res.status(400).json({ error: 'Invalid product ID' });
        }

        if (typeof isActive !== 'boolean') {
          return res.status(400).json({ error: 'isActive must be a boolean' });
        }

        const product = await prisma.product.findFirst({
          where: {
            id: Number(id),
            isDeleted: false
          }
        });

        if (!product) {
          return res.status(404).json({ error: 'Product not found' });
        }

        const updatedProduct = await prisma.product.update({
          where: { id: Number(id) },
          data: { isActive },
          include: {
            brand: {
              select: {
                id: true,
                name: true,
                logo: true,
                slug: true
              }
            },
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                catLogo: true
              }
            }
          }
        });

        res.json({
          message: `Product ${isActive ? 'activated' : 'deactivated'} successfully`,
          product: updatedProduct
        });
      } catch (error) {
        console.error('Toggle product status error:', error);
        res.status(500).json({
          error: 'Failed to update product status'
        });
      }
    }
  );

  // Toggle featured status
  router.patch(
    '/:id/featured',
    checkPermission('update_products'),
    async (req, res) => {
      try {
        const prisma = req.prisma;
        const { id } = req.params;
        const { isFeatured } = req.body;

        if (isNaN(Number(id))) {
          return res.status(400).json({ error: 'Invalid product ID' });
        }

        const product = await prisma.product.findFirst({
          where: {
            id: Number(id),
            isDeleted: false
          }
        });

        if (!product) {
          return res.status(404).json({ error: 'Product not found' });
        }

        const updatedProduct = await prisma.product.update({
          where: { id: Number(id) },
          data: { isFeatured: !!isFeatured },
          include: {
            brand: {
              select: {
                id: true,
                name: true,
                logo: true,
                slug: true
              }
            },
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                catLogo: true
              }
            }
          }
        });

        res.json({
          message: `Product ${isFeatured ? 'added to' : 'removed from'} featured successfully`,
          product: updatedProduct
        });
      } catch (error) {
        console.error('Toggle featured status error:', error);
        res.status(500).json({
          error: 'Failed to update featured status'
        });
      }
    }
  );

  // Toggle trending status
  router.patch(
    '/:id/trending',
    checkPermission('update_products'),
    async (req, res) => {
      try {
        const prisma = req.prisma;
        const { id } = req.params;
        const { isTrending } = req.body;

        if (isNaN(Number(id))) {
          return res.status(400).json({ error: 'Invalid product ID' });
        }

        const product = await prisma.product.findFirst({
          where: {
            id: Number(id),
            isDeleted: false
          }
        });

        if (!product) {
          return res.status(404).json({ error: 'Product not found' });
        }

        const updatedProduct = await prisma.product.update({
          where: { id: Number(id) },
          data: { isTrending: !!isTrending },
          include: {
            brand: {
              select: {
                id: true,
                name: true,
                logo: true,
                slug: true
              }
            },
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                catLogo: true
              }
            }
          }
        });

        res.json({
          message: `Product ${isTrending ? 'added to' : 'removed from'} trending successfully`,
          product: updatedProduct
        });
      } catch (error) {
        console.error('Toggle trending status error:', error);
        res.status(500).json({
          error: 'Failed to update trending status'
        });
      }
    }
  );

  // --- 📈 PRODUCT SEARCH & ANALYTICS ROUTES ---
  // ------------------------------------------

  // Search products (Admin - no country filtering)
  router.get(
    '/search/products',
    checkPermission('read_products'),
    getAllProducts
  );

  // Get product analytics
  router.get(
    '/:id/analytics',
    checkPermission('read_products'),
    async (req, res) => {
      try {
        const prisma = req.prisma;
        const { id } = req.params;

        if (isNaN(Number(id))) {
          return res.status(400).json({ error: 'Invalid product ID' });
        }

        const product = await prisma.product.findFirst({
          where: {
            id: Number(id),
            isDeleted: false
          },
          select: {
            id: true,
            name: true,
            sku: true,
            views: true,
            rating: true,
            reviews: true,
            searchImpressions: true,
            clickThroughRate: true,
            createdAt: true,
            orderItems: {
              select: {
                id: true,
                quantity: true,
                order: {
                  select: {
                    createdAt: true,
                    status: true
                  }
                }
              }
            }
          }
        });

        if (!product) {
          return res.status(404).json({ error: 'Product not found' });
        }

        const totalSold = product.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        const successfulOrders = product.orderItems.filter(item => 
          item.order.status === 'DELIVERED'
        ).length;

        const analytics = {
          basic: {
            views: product.views,
            rating: product.rating,
            reviews: product.reviews,
            searchImpressions: product.searchImpressions,
            clickThroughRate: product.clickThroughRate
          },
          sales: {
            totalSold,
            successfulOrders,
            conversionRate: product.views > 0 ? (totalSold / product.views) * 100 : 0
          },
          performance: {
            createdAt: product.createdAt,
            daysActive: Math.floor((new Date() - new Date(product.createdAt)) / (1000 * 60 * 60 * 24))
          }
        };

        res.json({
          product: {
            id: product.id,
            name: product.name,
            sku: product.sku
          },
          analytics
        });
      } catch (error) {
        console.error('Get product analytics error:', error);
        res.status(500).json({
          error: 'Failed to fetch product analytics'
        });
      }
    }
  );

  return router;
};