const { processUploadedFiles, cleanupUploadedFiles, deleteFile } = require('../middlewares/upload');

const createProduct = async (req, res) => {
  let uploadedImages = null;
  let variantsData = [];

  try {
    const prisma = req.prisma;
    const productData = req.body;

    // --- 🔑 Data Type Conversion for Prisma 🔑 ---
    const brandId = parseInt(productData.brand_id, 10);
    const categoryId = parseInt(productData.category_id, 10);
    const price = parseFloat(productData.price);
    const mrp = parseFloat(productData.mrp);

    // 🆕 NEW FIELDS PARSING
    const stock = parseInt(productData.stock, 10) || 0;
    const minOrderQuantity = parseInt(productData.min_order_quantity, 10) || 1;
    const maxOrderQuantity = parseInt(productData.max_order_quantity, 10) || 10;
    const weight = productData.weight ? parseFloat(productData.weight) : 0;
    const country = productData.country || 'Global';

    // --- 💡 Parse the 'variants' JSON string 💡 ---
    if (productData.variants && typeof productData.variants === 'string') {
      try {
        variantsData = JSON.parse(productData.variants);
        if (!Array.isArray(variantsData)) {
          variantsData = [];
        }
      } catch (parseError) {
        console.error('Failed to parse variants JSON:', parseError);
        return res.status(400).json({ error: 'Invalid variants JSON format.' });
      }
    } else if (Array.isArray(productData.variants)) {
      variantsData = productData.variants;
    }

    // Process uploaded files if any
    if (req.files) {
      uploadedImages = processUploadedFiles(req, 'products');
    }

    // Validate required fields
    if (!productData.sku || !productData.name || !productData.slug ||
      isNaN(brandId) || isNaN(categoryId) ||
      isNaN(price) || isNaN(mrp)) {

      if (uploadedImages) {
        cleanupUploadedFiles(uploadedImages);
      }

      return res.status(400).json({
        error: 'Missing or invalid required fields: sku, name, slug, brand_id, category_id, price, mrp.'
      });
    }

    // --- 🔍 Existence Check (SKU/Slug) ---
    const existingProduct = await prisma.product.findFirst({
      where: {
        OR: [
          { sku: productData.sku },
          { slug: productData.slug }
        ],
        isDeleted: false
      }
    });

    if (existingProduct) {
      if (uploadedImages) {
        cleanupUploadedFiles(uploadedImages);
      }
      return res.status(400).json({
        error: 'Product with this SKU or Slug already exists'
      });
    }

    // --- 📦 Validate Brand and Category ---
    const [brand, category] = await Promise.all([
      prisma.brand.findFirst({
        where: { id: brandId, isDeleted: false, isActive: true }
      }),
      prisma.category.findFirst({
        where: { id: categoryId, isDeleted: false, isActive: true }
      })
    ]);

    if (!brand) {
      if (uploadedImages) cleanupUploadedFiles(uploadedImages);
      return res.status(400).json({ error: 'Brand not found or inactive' });
    }
    if (!category) {
      if (uploadedImages) cleanupUploadedFiles(uploadedImages);
      return res.status(400).json({ error: 'Category not found or inactive' });
    }

    // --- 🖼️ Prepare Data ---
    const imagesData = [];
    if (uploadedImages) {
      if (uploadedImages.primaryImage) {
        imagesData.push(uploadedImages.primaryImage);
      }
      if (uploadedImages.secondaryImages && uploadedImages.secondaryImages.length > 0) {
        imagesData.push(...uploadedImages.secondaryImages);
      }
    }

    const metaTitle = productData.metaTitle ||
      `${productData.name} | ${brand.name} | Your Store`;

    const metaDescription = productData.metaDescription ||
      (productData.shortDescription ? productData.shortDescription.substring(0, 160) : null);

    const searchableText = productData.searchableText || [
      productData.name,
      productData.shortDescription,
      productData.tags ? JSON.stringify(productData.tags) : '',
      productData.symptoms ? JSON.stringify(productData.symptoms) : '',
      productData.benefits ? JSON.stringify(productData.benefits) : ''
    ].filter(Boolean).join(' ').substring(0, 1000);

    const discount_percent = productData.discount_percent !== undefined ?
      parseFloat(productData.discount_percent) :
      Math.round(((mrp - price) / mrp) * 100);

    // 🆕 PARSE JSON FIELDS
    const strengths = productData.strengths ? (typeof productData.strengths === 'string' ? JSON.parse(productData.strengths) : productData.strengths) : [];
    const forms = productData.forms ? (typeof productData.forms === 'string' ? JSON.parse(productData.forms) : productData.forms) : [];
    const tags = productData.tags ? (typeof productData.tags === 'string' ? JSON.parse(productData.tags) : productData.tags) : [];
    const symptoms = productData.symptoms ? (typeof productData.symptoms === 'string' ? JSON.parse(productData.symptoms) : productData.symptoms) : [];

    const productCreateData = {
      sku: productData.sku,
      name: productData.name,
      slug: productData.slug,
      description: productData.description,
      shortDescription: productData.shortDescription,
      metaTitle,
      metaDescription,
      canonicalUrl: productData.canonicalUrl,
      ogImage: uploadedImages?.ogImage?.url || productData.ogImage,
      structuredData: productData.structuredData,
      seoKeywords: productData.seoKeywords,
      searchableText,
      altText: productData.altText,
      composition: productData.composition,
      benefits: productData.benefits,
      usageInstructions: productData.usageInstructions,
      faqs: productData.faqs,
      ingredients: productData.ingredients,
      specifications: productData.specifications,
      strengths: strengths,
      forms: forms,
      images: imagesData.length > 0 ? imagesData : (productData.images ? (typeof productData.images === 'string' ? JSON.parse(productData.images) : productData.images) : []),
      tags: tags,
      symptoms: symptoms,
      price: price,
      mrp: mrp,
      discount_percent,
      prescription_required: productData.prescription_required === 'true' || productData.prescription_required === true,
      isFeatured: productData.isFeatured === 'true' || productData.isFeatured === true,
      isTrending: productData.isTrending === 'true' || productData.isTrending === true,
      isActive: productData.isActive === 'true' || productData.isActive === true,

      // 🆕 NEW FIELDS
      country: country,
      stock: stock,
      min_order_quantity: minOrderQuantity,
      max_order_quantity: maxOrderQuantity,
      weight: weight,
      dimensions: productData.dimensions || '',

      brand_id: brandId,
      category_id: categoryId,
      lastSeoUpdate: (productData.metaTitle || productData.metaDescription || productData.seoKeywords) ?
        new Date() : null
    };

    // --- 💾 Prisma Create Operation ---
    const product = await prisma.product.create({
      data: {
        ...productCreateData,
        variants: variantsData.length > 0 ? {
          create: variantsData.map(variant => ({
            country: variant.country,
            shipping: variant.shipping,
            currency: variant.currency,
            options: {
              create: variant.options.map(option => ({
                label: option.label,
                price: parseFloat(option.price),
                mrp: parseFloat(option.mrp),
                stock: parseInt(option.stock, 10),
                sku: option.sku,
                weight: option.weight ? parseFloat(option.weight) : null,
                dimensions: option.dimensions
              }))
            }
          }))
        } : undefined
      },
      include: {
        brand: {
          select: { id: true, name: true, logo: true, slug: true }
        },
        category: {
          select: { id: true, name: true, slug: true, catLogo: true }
        },
        variants: {
          include: { options: true }
        }
      }
    });

    // --- ✅ Success Response ---
    res.status(201).json({
      message: 'Product created successfully',
      product
    });

  } catch (error) {
    console.error('Create product error:', error);

    if (uploadedImages) {
      cleanupUploadedFiles(uploadedImages);
    }

    if (error.code === 'P2002') {
      return res.status(400).json({
        error: 'Unique constraint violation - SKU or Slug already exists'
      });
    }

    res.status(500).json({
      error: 'Failed to create product',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const prisma = req.prisma;

    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      inStock,
      isActive,
      // 🚨 REMOVED: country parameter for admin panel
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build where clause - NO country filtering for admin
    const where = {
      isDeleted: false
    };

    // Search by product name, description, or SKU
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { searchableText: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Filter by category
    if (category) {
      where.category = {
        OR: [
          { id: isNaN(Number(category)) ? undefined : Number(category) },
          { slug: { contains: category, mode: 'insensitive' } },
          { name: { contains: category, mode: 'insensitive' } }
        ].filter(Boolean)
      };
    }

    // Filter by brand
    if (brand) {
      where.brand = {
        OR: [
          { id: isNaN(Number(brand)) ? undefined : Number(brand) },
          { slug: { contains: brand, mode: 'insensitive' } },
          { name: { contains: brand, mode: 'insensitive' } }
        ].filter(Boolean)
      };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    // Stock filter
    if (inStock !== undefined) {
      if (inStock === 'true' || inStock === true) {
        where.stock = { gt: 0 };
      } else if (inStock === 'false' || inStock === false) {
        where.stock = { lte: 0 };
      }
    }

    // Active status filter
    if (isActive !== undefined) {
      where.isActive = isActive === 'true' || isActive === true;
    }

    // Validate and parse pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Validate sort parameters
    const validSortFields = ['name', 'price', 'createdAt', 'updatedAt', 'views', 'stock', 'rating', 'country'];
    const validSortOrders = ['asc', 'desc'];

    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

    // Execute queries in parallel for better performance
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              logo: true,
              website: true,
              description: true,
              slug: true
            }
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              catLogo: true,
              catColor: true,
              description: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              }
            }
          },
          variants: {
            where: { isDeleted: false, isActive: true },
            include: {
              options: {
                where: { isDeleted: false, isActive: true }
              }
            }
          },
          searchKeywords: {
            select: {
              id: true,
              keyword: true,
              rank: true,
              volume: true,
              difficulty: true
            },
            take: 10,
            orderBy: { rank: 'asc' }
          }
        },
        skip,
        take: limitNum,
        orderBy: { [sortField]: sortDirection }
      }),
      prisma.product.count({ where })
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Increment search impressions for products that are active
    if (search && products.length > 0) {
      const activeProductIds = products
        .filter(product => product.isActive)
        .map(product => product.id);

      if (activeProductIds.length > 0) {
        await prisma.product.updateMany({
          where: {
            id: { in: activeProductIds }
          },
          data: {
            searchImpressions: { increment: 1 }
          }
        });
      }
    }

    // Prepare response
    const response = {
      success: true,
      data: {
        products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalCount,
          totalPages,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? pageNum + 1 : null,
          prevPage: hasPrevPage ? pageNum - 1 : null
        },
        filters: {
          search: search || null,
          category: category || null,
          brand: brand || null,
          minPrice: minPrice ? parseFloat(minPrice) : null,
          maxPrice: maxPrice ? parseFloat(maxPrice) : null,
          inStock: inStock !== undefined ? (inStock === 'true' || inStock === true) : null,
          isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : null,
          sortBy: sortField,
          sortOrder: sortDirection
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

const getPublicProducts = async (req, res) => {
  try {
    const prisma = req.prisma;

    const {
      page = 1,
      limit = 1000,
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      inStock,
      country = 'Global',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const where = {
      isDeleted: false,
      isActive: true,
      brand: { isDeleted: false, isActive: true },
      category: { isDeleted: false, isActive: true }
    };

    if (country && country !== 'all') {
      where.OR = [
        { country: 'Global' },
        { country: country },
        {
          variants: {
            some: {
              country: { in: [country, 'Global'] },
              isDeleted: false,
              isActive: true
            }
          }
        }
      ];
    }

    if (search) {
      where.OR = [
        ...(where.OR || []),
        { name: { contains: search } },
        { description: { contains: search } },
        { sku: { contains: search } },
        { searchableText: { contains: search } }
      ].filter(Boolean);
    }

    if (category) {
      where.category = {
        OR: [
          { id: isNaN(Number(category)) ? undefined : Number(category) },
          { slug: { contains: category } },
          { name: { contains: category } }
        ].filter(Boolean)
      };
    }

    if (brand) {
      where.brand = {
        OR: [
          { id: isNaN(Number(brand)) ? undefined : Number(brand) },
          { slug: { contains: brand } },
          { name: { contains: brand } }
        ].filter(Boolean)
      };
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    if (inStock !== undefined) {
      if (inStock === 'true' || inStock === true) {
        where.stock = { gt: 0 };
      } else if (inStock === 'false' || inStock === false) {
        where.stock = { lte: 0 };
      }
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const validSortFields = ['name', 'price', 'createdAt', 'updatedAt', 'views', 'stock', 'rating'];
    const validSortOrders = ['asc', 'desc'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          sku: true,
          name: true,
          slug: true,
          description: true,
          shortDescription: true,
          composition: true,
          price: true,
          mrp: true,
          discount_percent: true,
          prescription_required: true,
          rating: true,
          reviews: true,
          views: true,
          isFeatured: true,
          isTrending: true,
          isActive: true,
          country: true,
          stock: true,
          min_order_quantity: true,
          max_order_quantity: true,
          weight: true,
          dimensions: true,
          images: true,
          strengths: true,
          forms: true,
          tags: true,
          symptoms: true,
          createdAt: true,
          updatedAt: true,
          brand: {
            select: {
              id: true,
              name: true,
              logo: true,
              website: true,
              description: true,
              slug: true
            }
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              catLogo: true,
              catColor: true,
              description: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              }
            }
          },
          variants: {
            where: {
              isDeleted: false,
              isActive: true,
              OR: [
                { country: 'Global' },
                { country: country && country !== 'all' ? country : undefined }
              ].filter(Boolean)
            },
            include: {
              options: {
                where: { isDeleted: false, isActive: true }
              }
            }
          }
        },
        skip,
        take: limitNum,
        orderBy: { [sortField]: sortDirection }
      }),
      prisma.product.count({ where })
    ]);

    const filteredProducts = products.filter(product => {
      if (product.variants && product.variants.length > 0) {
        return product.variants.some(variant =>
          variant.country === country || variant.country === 'Global'
        );
      }
      return product.country === country || product.country === 'Global';
    });

    const totalPages = Math.ceil(filteredProducts.length / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      success: true,
      data: {
        products: filteredProducts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalCount: filteredProducts.length,
          totalPages,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? pageNum + 1 : null,
          prevPage: hasPrevPage ? pageNum - 1 : null
        },
        filters: {
          search: search || null,
          category: category || null,
          brand: brand || null,
          country: country || null,
          minPrice: minPrice ? parseFloat(minPrice) : null,
          maxPrice: maxPrice ? parseFloat(maxPrice) : null,
          inStock: inStock !== undefined ? (inStock === 'true' || inStock === true) : null,
          sortBy: sortField,
          sortOrder: sortDirection
        }
      }
    });
  } catch (error) {
    console.error('Get public products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

const getProductById = async (req, res) => {
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
        sku: true,
        name: true,
        slug: true,
        description: true,
        shortDescription: true,
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        ogImage: true,
        structuredData: true,
        seoKeywords: true,
        searchableText: true,
        altText: true,
        composition: true,
        benefits: true,
        usageInstructions: true,
        faqs: true,
        ingredients: true,
        specifications: true,
        strengths: true,
        forms: true,
        images: true,
        tags: true,
        symptoms: true,
        price: true,
        mrp: true,
        discount_percent: true,
        prescription_required: true,
        rating: true,
        reviews: true,
        views: true,
        isFeatured: true,
        isTrending: true,
        isActive: true,
        clickThroughRate: true,
        searchImpressions: true,
        lastSeoUpdate: true,
        country: true,
        stock: true,
        min_order_quantity: true,
        max_order_quantity: true,
        weight: true,
        dimensions: true,
        createdAt: true,
        updatedAt: true,
        brand: {
          select: {
            id: true,
            name: true,
            logo: true,
            website: true,
            description: true,
            slug: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            catLogo: true,
            catColor: true,
            description: true,
            parent: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        },
        variants: {
          where: { isDeleted: false, isActive: true },
          include: {
            options: {
              where: { isDeleted: false, isActive: true },
              select: {
                id: true,
                label: true,
                price: true,
                mrp: true,
                stock: true,
                sku: true,
                weight: true,
                dimensions: true,
                isActive: true,
                createdAt: true,
                updatedAt: true
              }
            }
          }
        },
        searchKeywords: {
          select: {
            id: true,
            keyword: true,
            rank: true,
            volume: true,
            difficulty: true
          },
          take: 10,
          orderBy: { rank: 'asc' }
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    // Increment views and update search impressions only for active products
    if (product.isActive) {
      await prisma.product.update({
        where: { id: Number(id) },
        data: {
          views: { increment: 1 },
          searchImpressions: { increment: 1 }
        }
      });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({
      error: 'Failed to fetch product'
    });
  }
};

// PUBLIC — FIXED: now matches admin variant count exactly
const getProductBySlug = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { slug } = req.params;

    // Clean, simple where clause
    const where = {
      slug: slug,
      isDeleted: false,
      isActive: true
    };

    const product = await prisma.product.findFirst({
      where: where,
      select: {
        id: true,
        sku: true,
        name: true,
        slug: true,
        description: true,
        shortDescription: true,
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        ogImage: true,
        structuredData: true,
        seoKeywords: true,
        searchableText: true,
        altText: true,
        composition: true,
        benefits: true,
        usageInstructions: true,
        faqs: true,
        ingredients: true,
        specifications: true,
        strengths: true,
        forms: true,
        images: true,
        tags: true,
        symptoms: true,
        price: true,
        mrp: true,
        discount_percent: true,
        prescription_required: true,
        rating: true,
        reviews: true,
        views: true,
        isFeatured: true,
        isTrending: true,
        isActive: true,
        clickThroughRate: true,
        searchImpressions: true,
        lastSeoUpdate: true,
        country: true,
        stock: true,
        min_order_quantity: true,
        max_order_quantity: true,
        weight: true,
        dimensions: true,
        createdAt: true,
        updatedAt: true,

        brand: {
          select: {
            id: true,
            name: true,
            logo: true,
            website: true,
            description: true,
            slug: true
          }
        },

        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            catLogo: true,
            catColor: true,
            description: true,
            parent: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        },

        variants: {
          where: { isDeleted: false },
          include: {
            options: {
              where: { isDeleted: false }
            }
          }
        },

        searchKeywords: {
          select: {
            id: true,
            keyword: true,
            rank: true,
            volume: true,
            difficulty: true
          },
          take: 10,
          orderBy: { rank: "asc" }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Update counters (optional)
    await prisma.product.update({
      where: { id: product.id },
      data: {
        views: { increment: 1 },
        searchImpressions: { increment: 1 }
      }
    });

    res.json(product);

  } catch (error) {
    console.error("Get product by slug error:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
};

// 🆕 NEW: Admin-specific function without country filtering
const getProductBySlugForAdmin = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { slug } = req.params;

    const product = await prisma.product.findFirst({
      where: {
        slug: slug,
        isDeleted: false
      },
      select: {
        id: true,
        sku: true,
        name: true,
        slug: true,
        description: true,
        shortDescription: true,
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        ogImage: true,
        structuredData: true,
        seoKeywords: true,
        searchableText: true,
        altText: true,
        composition: true,
        benefits: true,
        usageInstructions: true,
        faqs: true,
        ingredients: true,
        specifications: true,
        strengths: true,
        forms: true,
        images: true,
        tags: true,
        symptoms: true,
        price: true,
        mrp: true,
        discount_percent: true,
        prescription_required: true,
        rating: true,
        reviews: true,
        views: true,
        isFeatured: true,
        isTrending: true,
        isActive: true,
        clickThroughRate: true,
        searchImpressions: true,
        lastSeoUpdate: true,
        country: true,
        stock: true,
        min_order_quantity: true,
        max_order_quantity: true,
        weight: true,
        dimensions: true,
        createdAt: true,
        updatedAt: true,
        brand: {
          select: {
            id: true,
            name: true,
            logo: true,
            website: true,
            description: true,
            slug: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            catLogo: true,
            catColor: true,
            description: true,
            parent: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        },
        variants: {
          where: { isDeleted: false, isActive: true },
          include: {
            options: {
              where: { isDeleted: false, isActive: true }
            }
          }
        },
        searchKeywords: {
          select: {
            id: true,
            keyword: true,
            rank: true,
            volume: true,
            difficulty: true
          },
          take: 10,
          orderBy: { rank: 'asc' }
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product by slug for admin error:', error);
    res.status(500).json({
      error: 'Failed to fetch product'
    });
  }
};

const updateProduct = async (req, res) => {
  let uploadedImages = null;
  let variantsData = [];

  try {
    const prisma = req.prisma;
    const productId = parseInt(req.params.id, 10);
    const productData = req.body;

    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    // Parse variants JSON if sent as string
    if (productData.variants && typeof productData.variants === 'string') {
      try {
        variantsData = JSON.parse(productData.variants);
        if (!Array.isArray(variantsData)) variantsData = [];
      } catch (err) {
        return res.status(400).json({ error: 'Invalid variants JSON format.' });
      }
    } else if (Array.isArray(productData.variants)) {
      variantsData = productData.variants;
    }

    // Handle uploaded images
    if (req.files) {
      uploadedImages = processUploadedFiles(req, 'products');
    }

    // Parse numeric fields
    const brandId = parseInt(productData.brand_id, 10);
    const categoryId = parseInt(productData.category_id, 10);
    const price = parseFloat(productData.price);
    const mrp = parseFloat(productData.mrp);

    // 🆕 PARSE NEW FIELDS
    const stock = parseInt(productData.stock, 10) || 0;
    const minOrderQuantity = parseInt(productData.min_order_quantity, 10) || 1;
    const maxOrderQuantity = parseInt(productData.max_order_quantity, 10) || 10;
    const weight = productData.weight ? parseFloat(productData.weight) : 0;
    const country = productData.country || 'Global';

    // Ensure the product exists first
    const existing = await prisma.product.findUnique({
      where: { id: productId, isDeleted: false },
      include: { variants: { include: { options: true } } }
    });
    if (!existing) {
      if (uploadedImages) cleanupUploadedFiles(uploadedImages);
      return res.status(404).json({ error: 'Product not found' });
    }

    // Validate brand and category
    const [brand, category] = await Promise.all([
      prisma.brand.findFirst({
        where: { id: brandId, isDeleted: false, isActive: true }
      }),
      prisma.category.findFirst({
        where: { id: categoryId, isDeleted: false, isActive: true }
      })
    ]);
    if (!brand || !category) {
      if (uploadedImages) cleanupUploadedFiles(uploadedImages);
      return res.status(400).json({ error: 'Invalid or inactive brand/category' });
    }

    // --- Image Handling Logic ---
    let updatedImages = [...(existing.images || [])];

    // Helper: normalize URL for comparison (strip base URL, keep only path)
    const normalizeUrl = (url) => {
      if (!url) return '';
      try {
        // If it's a full URL, extract just the pathname
        const parsed = new URL(url);
        return parsed.pathname;
      } catch (e) {
        // It's already a relative path
        return url.startsWith('/') ? url : `/${url}`;
      }
    };

    // Parse imagesToRemove from frontend if provided
    let imagesToRemove = [];
    if (productData.imagesToRemove && typeof productData.imagesToRemove === 'string') {
      try {
        imagesToRemove = JSON.parse(productData.imagesToRemove);
      } catch (err) {
        console.warn('Failed to parse imagesToRemove, ignoring:', err);
      }
    }

    // Normalize the URLs to remove for comparison
    const normalizedImagesToRemove = imagesToRemove.map(url => normalizeUrl(url));
    console.log('📋 Images to remove (normalized):', normalizedImagesToRemove);
    console.log('📋 Existing images:', updatedImages.map(img => img.url));

    // Remove images marked for deletion AND delete files from disk
    if (normalizedImagesToRemove.length > 0) {
      // Find the image objects that match the URLs to be removed
      const imagesToDelete = updatedImages.filter(img =>
        normalizedImagesToRemove.includes(normalizeUrl(img.url))
      );

      console.log(`🗑️ Found ${imagesToDelete.length} images to delete from ${normalizedImagesToRemove.length} requested`);

      // Delete actual files from disk
      for (const img of imagesToDelete) {
        const filePath = img.url || img.path;
        if (filePath) {
          const deleted = deleteFile(filePath);
          console.log(`🗑️ Deleted image file: ${filePath} -> ${deleted ? 'SUCCESS' : 'NOT FOUND/FAILED'}`);
        }
      }

      // Remove from the images array
      updatedImages = updatedImages.filter(img =>
        !normalizedImagesToRemove.includes(normalizeUrl(img.url))
      );
    }

    // Handle new uploaded images
    if (uploadedImages) {
      if (uploadedImages.primaryImage) {
        // Add new primary image to the beginning
        updatedImages.unshift(uploadedImages.primaryImage);
      }

      if (uploadedImages.secondaryImages && uploadedImages.secondaryImages.length > 0) {
        updatedImages.push(...uploadedImages.secondaryImages);
      }
    }

    // ALWAYS ensure correct isPrimary flags: first image = primary, rest = not primary
    updatedImages = updatedImages.map((img, index) => ({
      ...img,
      isPrimary: index === 0
    }));

    console.log(`📸 Final images array (${updatedImages.length}):`, updatedImages.map((img, i) => `${i}: ${img.url} (primary: ${img.isPrimary})`));

    const metaTitle = productData.metaTitle || `${productData.name} | ${brand.name} | Your Store`;
    const metaDescription = productData.metaDescription || (productData.shortDescription?.substring(0, 160) || '');
    const searchableText = [
      productData.name,
      productData.shortDescription,
      productData.tags ? JSON.stringify(productData.tags) : '',
      productData.symptoms ? JSON.stringify(productData.symptoms) : '',
      productData.benefits ? JSON.stringify(productData.benefits) : ''
    ].filter(Boolean).join(' ').substring(0, 1000);
    const discount_percent = productData.discount_percent
      ? parseFloat(productData.discount_percent)
      : Math.round(((mrp - price) / mrp) * 100);

    // 🆕 PARSE JSON FIELDS
    const strengths = productData.strengths ? (typeof productData.strengths === 'string' ? JSON.parse(productData.strengths) : productData.strengths) : existing.strengths;
    const forms = productData.forms ? (typeof productData.forms === 'string' ? JSON.parse(productData.forms) : productData.forms) : existing.forms;
    const tags = productData.tags ? (typeof productData.tags === 'string' ? JSON.parse(productData.tags) : productData.tags) : existing.tags;
    const symptoms = productData.symptoms ? (typeof productData.symptoms === 'string' ? JSON.parse(productData.symptoms) : productData.symptoms) : existing.symptoms;

    // --- Build base update data ---
    const dataToUpdate = {
      sku: productData.sku,
      name: productData.name,
      slug: productData.slug,
      description: productData.description,
      shortDescription: productData.shortDescription,
      metaTitle,
      metaDescription,
      canonicalUrl: productData.canonicalUrl,
      ogImage: uploadedImages?.ogImage?.url || productData.ogImage || existing.ogImage,
      structuredData: productData.structuredData,
      seoKeywords: productData.seoKeywords,
      searchableText,
      altText: productData.altText,
      composition: productData.composition,
      benefits: productData.benefits,
      usageInstructions: productData.usageInstructions,
      faqs: productData.faqs,
      ingredients: productData.ingredients,
      specifications: productData.specifications,
      strengths: strengths,
      forms: forms,
      images: updatedImages,
      tags: tags,
      symptoms: symptoms,
      price,
      mrp,
      discount_percent,
      prescription_required: productData.prescription_required === 'true' || productData.prescription_required === true,
      isFeatured: productData.isFeatured === 'true' || productData.isFeatured === true,
      isTrending: productData.isTrending === 'true' || productData.isTrending === true,
      isActive: productData.isActive === 'true' || productData.isActive === true,

      // 🆕 NEW FIELDS
      country: country,
      stock: stock,
      min_order_quantity: minOrderQuantity,
      max_order_quantity: maxOrderQuantity,
      weight: weight,
      dimensions: productData.dimensions || existing.dimensions,

      brand_id: brandId,
      category_id: categoryId,
      lastSeoUpdate: (productData.metaTitle || productData.metaDescription || productData.seoKeywords)
        ? new Date()
        : existing.lastSeoUpdate
    };

    // --- Handle Variants + Options ---
    if (variantsData.length > 0) {
      dataToUpdate.variants = {
        deleteMany: {},
        create: variantsData.map(variant => ({
          country: variant.country,
          shipping: variant.shipping,
          currency: variant.currency,
          isActive: variant.isActive ?? true,
          isDeleted: false,
          options: {
            create: (variant.options || []).map(option => ({
              label: option.label,
              price: parseFloat(option.price),
              mrp: parseFloat(option.mrp),
              stock: parseInt(option.stock, 10),
              sku: option.sku,
              weight: option.weight ? parseFloat(option.weight) : null,
              dimensions: option.dimensions || null,
              isActive: option.isActive ?? true,
              isDeleted: false
            }))
          }
        }))
      };
    }

    // --- Update in Prisma ---
    const updated = await prisma.product.update({
      where: { id: productId },
      data: dataToUpdate,
      include: {
        brand: { select: { id: true, name: true, logo: true, slug: true } },
        category: { select: { id: true, name: true, slug: true, catLogo: true } },
        variants: { include: { options: true } }
      }
    });

    return res.status(200).json({
      message: 'Product updated successfully',
      product: updated
    });

  } catch (error) {
    console.error('Update product error:', error);
    if (uploadedImages) cleanupUploadedFiles(uploadedImages);
    res.status(500).json({
      error: 'Failed to update product',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const deleteProduct = async (req, res) => {
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
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    // Check if product has associated orders
    const orderItemsCount = await prisma.orderItem.count({
      where: { productId: Number(id) }
    });

    if (orderItemsCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete product with associated orders. Consider archiving instead.'
      });
    }

    // Soft delete product and its variants using transaction
    await prisma.$transaction(async (tx) => {
      // Soft delete product
      await tx.product.update({
        where: { id: Number(id) },
        data: {
          isDeleted: true,
          isActive: false,
          sku: `deleted_${product.sku}_${Date.now()}`,
          slug: `deleted_${product.slug}_${Date.now()}`
        }
      });

      // Soft delete variants
      await tx.productVariant.updateMany({
        where: { product_id: Number(id) },
        data: {
          isDeleted: true,
          isActive: false
        }
      });

      // Soft delete variant options
      await tx.variantOption.updateMany({
        where: {
          variant: {
            product_id: Number(id)
          }
        },
        data: {
          isDeleted: true,
          isActive: false
        }
      });
    });

    res.json({
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      error: 'Failed to delete product'
    });
  }
};

const bulkUpdateProducts = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { ids, updateData } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: 'Product IDs are required'
      });
    }

    // Validate all IDs are numbers
    const numericIds = ids.map(id => Number(id));
    if (numericIds.some(isNaN)) {
      return res.status(400).json({
        error: 'All product IDs must be valid numbers'
      });
    }

    // Prevent updating certain fields in bulk
    const restrictedFields = ['sku', 'slug'];
    const hasRestrictedFields = Object.keys(updateData).some(field =>
      restrictedFields.includes(field)
    );

    if (hasRestrictedFields) {
      return res.status(400).json({
        error: `Cannot update restricted fields in bulk: ${restrictedFields.join(', ')}`
      });
    }

    const result = await prisma.product.updateMany({
      where: {
        id: { in: numericIds },
        isDeleted: false
      },
      data: updateData
    });

    res.json({
      message: `${result.count} products updated successfully`,
      updatedCount: result.count
    });
  } catch (error) {
    console.error('Bulk update products error:', error);
    res.status(500).json({
      error: 'Failed to update products'
    });
  }
};

const getFeaturedProducts = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { limit = 10, country = 'Global' } = req.query;

    const where = {
      isFeatured: true,
      isActive: true,
      isDeleted: false,
      brand: {
        isDeleted: false,
        isActive: true
      },
      category: {
        isDeleted: false,
        isActive: true
      }
    };

    // 🆕 UPDATED: Enhanced country filtering
    if (country && country !== 'all') {
      where.OR = [
        { country: 'Global' },
        { country: country },
        {
          variants: {
            some: {
              country: { in: [country, 'Global'] },
              isDeleted: false,
              isActive: true
            }
          }
        }
      ];
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        sku: true,
        name: true,
        slug: true,
        description: true,
        shortDescription: true,
        price: true,
        mrp: true,
        discount_percent: true,
        prescription_required: true,
        rating: true,
        reviews: true,
        views: true,
        isFeatured: true,
        isTrending: true,
        // 🆕 INCLUDING NEW FIELDS
        country: true,
        stock: true,
        min_order_quantity: true,
        max_order_quantity: true,
        weight: true,
        dimensions: true,
        images: true,
        strengths: true,
        forms: true,
        tags: true,
        symptoms: true,
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
        },
        variants: {
          where: {
            isDeleted: false,
            isActive: true,
            // 🆕 Filter variants by country
            OR: [
              { country: 'Global' },
              { country: country && country !== 'all' ? country : undefined }
            ].filter(Boolean)
          },
          include: {
            options: {
              where: { isDeleted: false, isActive: true },
              select: {
                id: true,
                label: true,
                price: true,
                mrp: true,
                stock: true,
                sku: true,
                weight: true,
                dimensions: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: Math.min(50, Number(limit))
    });

    // 🆕 Filter out products that have no available variants for the country
    const filteredProducts = products.filter(product => {
      // If product has variants, check if any variant is available for the country
      if (product.variants && product.variants.length > 0) {
        const hasAvailableVariant = product.variants.some(variant =>
          variant.country === country || variant.country === 'Global'
        );
        return hasAvailableVariant;
      }
      // If product has no variants, check product's country
      return product.country === country || product.country === 'Global';
    });

    res.json(filteredProducts);
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({
      error: 'Failed to fetch featured products'
    });
  }
};

const getTrendingProducts = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { limit = 10, country = 'Global' } = req.query;

    const where = {
      isTrending: true,
      isActive: true,
      isDeleted: false,
      brand: {
        isDeleted: false,
        isActive: true
      },
      category: {
        isDeleted: false,
        isActive: true
      }
    };

    // 🆕 UPDATED: Enhanced country filtering
    if (country && country !== 'all') {
      where.OR = [
        { country: 'Global' },
        { country: country },
        {
          variants: {
            some: {
              country: { in: [country, 'Global'] },
              isDeleted: false,
              isActive: true
            }
          }
        }
      ];
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        sku: true,
        name: true,
        slug: true,
        description: true,
        shortDescription: true,
        price: true,
        mrp: true,
        discount_percent: true,
        prescription_required: true,
        rating: true,
        reviews: true,
        views: true,
        isFeatured: true,
        isTrending: true,
        // 🆕 INCLUDING NEW FIELDS
        country: true,
        stock: true,
        min_order_quantity: true,
        max_order_quantity: true,
        weight: true,
        dimensions: true,
        images: true,
        strengths: true,
        forms: true,
        tags: true,
        symptoms: true,
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
        },
        variants: {
          where: {
            isDeleted: false,
            isActive: true,
            // 🆕 Filter variants by country
            OR: [
              { country: 'Global' },
              { country: country && country !== 'all' ? country : undefined }
            ].filter(Boolean)
          },
          include: {
            options: {
              where: { isDeleted: false, isActive: true },
              select: {
                id: true,
                label: true,
                price: true,
                mrp: true,
                stock: true,
                sku: true,
                weight: true,
                dimensions: true
              }
            }
          }
        }
      },
      orderBy: [
        { views: 'desc' },
        { createdAt: 'desc' }
      ],
      take: Math.min(50, Number(limit))
    });

    // 🆕 Filter out products that have no available variants for the country
    const filteredProducts = products.filter(product => {
      // If product has variants, check if any variant is available for the country
      if (product.variants && product.variants.length > 0) {
        const hasAvailableVariant = product.variants.some(variant =>
          variant.country === country || variant.country === 'Global'
        );
        return hasAvailableVariant;
      }
      // If product has no variants, check product's country
      return product.country === country || product.country === 'Global';
    });

    res.json(filteredProducts);
  } catch (error) {
    console.error('Get trending products error:', error);
    res.status(500).json({
      error: 'Failed to fetch trending products'
    });
  }
};

const getProductsNeedingSeo = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Number(limit));
    const take = Math.min(100, Number(limit));

    const where = {
      isDeleted: false,
      isActive: true,
      OR: [
        { metaTitle: null },
        { metaDescription: null },
        { metaTitle: '' },
        { metaDescription: '' },
        { lastSeoUpdate: null }
      ]
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          sku: true,
          name: true,
          slug: true,
          description: true,
          shortDescription: true,
          metaTitle: true,
          metaDescription: true,
          lastSeoUpdate: true,
          // 🆕 INCLUDING NEW FIELDS
          country: true,
          stock: true,
          price: true,
          mrp: true,
          images: true,
          brand: {
            select: {
              id: true,
              name: true
            }
          },
          category: {
            select: {
              id: true,
              name: true
            }
          }
        },
        skip,
        take,
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get products needing SEO error:', error);
    res.status(500).json({
      error: 'Failed to fetch products needing SEO'
    });
  }
};

// SEO-specific controllers
const updateProductSeo = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const seoData = req.body;

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
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    const updatedProduct = await prisma.product.update({
      where: { id: Number(id) },
      data: {
        ...seoData,
        lastSeoUpdate: new Date()
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    res.json({
      message: 'Product SEO updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Update product SEO error:', error);
    res.status(500).json({
      error: 'Failed to update product SEO'
    });
  }
};

const recordSeoAudit = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { productId, url, seoScore, issues, recommendations } = req.body;

    if (!url || seoScore === undefined) {
      return res.status(400).json({
        error: 'URL and seoScore are required'
      });
    }

    // Validate product exists if productId is provided
    if (productId) {
      const product = await prisma.product.findFirst({
        where: { id: Number(productId), isDeleted: false }
      });
      if (!product) {
        return res.status(400).json({ error: 'Product not found' });
      }
    }

    const seoAudit = await prisma.seoAudit.create({
      data: {
        productId: productId ? Number(productId) : null,
        url,
        seoScore: Number(seoScore),
        issues,
        recommendations
      }
    });

    res.status(201).json({
      message: 'SEO audit recorded successfully',
      seoAudit
    });
  } catch (error) {
    console.error('Record SEO audit error:', error);
    res.status(500).json({
      error: 'Failed to record SEO audit'
    });
  }
};

// New function to manage product variants
const updateProductVariants = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const { variants } = req.body;

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

    // Use transaction for variant updates
    const result = await prisma.$transaction(async (tx) => {
      // Soft delete existing variants
      await tx.productVariant.updateMany({
        where: { product_id: Number(id) },
        data: { isDeleted: true, isActive: false }
      });

      // Create new variants
      if (variants && variants.length > 0) {
        for (const variant of variants) {
          await tx.productVariant.create({
            data: {
              product_id: Number(id),
              country: variant.country,
              shipping: variant.shipping,
              currency: variant.currency,
              options: {
                create: variant.options.map(option => ({
                  label: option.label,
                  price: parseFloat(option.price),
                  mrp: parseFloat(option.mrp),
                  stock: parseInt(option.stock),
                  sku: option.sku,
                  weight: option.weight,
                  dimensions: option.dimensions
                }))
              }
            }
          });
        }
      }

      return await tx.product.findFirst({
        where: { id: Number(id) },
        include: {
          variants: {
            include: { options: true }
          }
        }
      });
    });

    res.json({
      message: 'Product variants updated successfully',
      product: result
    });
  } catch (error) {
    console.error('Update product variants error:', error);
    res.status(500).json({
      error: 'Failed to update product variants'
    });
  }
};

// New function to upload product image
const uploadProductImage = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    if (isNaN(Number(id))) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    if (!req.file && !req.files) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const product = await prisma.product.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!product) {
      // Delete uploaded file if product not found
      if (req.file) deleteFile(`/uploads/products/${req.file.filename}`);
      if (req.files) {
        req.files.forEach(file => deleteFile(`/uploads/products/${file.filename}`));
      }
      return res.status(404).json({ error: 'Product not found' });
    }

    const existingImages = product.images || [];
    let updatedImages = [...existingImages];

    // Handle single file upload
    if (req.file) {
      const newImage = {
        url: `/${req.file.path.replace(/\\/g, '/')}`,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        alt: req.body.alt || '',
        isPrimary: req.body.isPrimary === 'true',
        order: existingImages.length
      };

      // If setting as primary, remove existing primary
      if (newImage.isPrimary) {
        updatedImages = updatedImages.map(img => ({ ...img, isPrimary: false }));
      }

      updatedImages.push(newImage);
    }

    // Handle multiple files upload
    if (req.files && Array.isArray(req.files)) {
      const newImages = req.files.map((file, index) => ({
        url: `/${file.path.replace(/\\/g, '/')}`,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        alt: req.body.alt || '',
        isPrimary: false,
        order: existingImages.length + index
      }));

      updatedImages.push(...newImages);
    }

    const updatedProduct = await prisma.product.update({
      where: { id: Number(id) },
      data: { images: updatedImages },
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
      message: 'Image uploaded successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Upload product image error:', error);

    // Delete uploaded file on error
    if (req.file) deleteFile(`/uploads/products/${req.file.filename}`);
    if (req.files) {
      req.files.forEach(file => deleteFile(`/uploads/products/${file.filename}`));
    }

    res.status(500).json({
      error: 'Failed to upload image'
    });
  }
};

// New function to delete product image
const deleteProductImage = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id, imageId } = req.params;

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

    const existingImages = product.images || [];
    const imageToDelete = existingImages.find(img =>
      img.filename === imageId || img.url.includes(imageId)
    );

    if (!imageToDelete) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Remove image from array
    const updatedImages = existingImages.filter(img =>
      !(img.filename === imageId || img.url.includes(imageId))
    );

    const updatedProduct = await prisma.product.update({
      where: { id: Number(id) },
      data: { images: updatedImages }
    });

    // Delete physical file
    deleteFile(imageToDelete.url);

    res.json({
      message: 'Image deleted successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Delete product image error:', error);
    res.status(500).json({
      error: 'Failed to delete image'
    });
  }
};

// New function to get product images
const getProductImages = async (req, res) => {
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
        images: true,
        ogImage: true
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      productId: product.id,
      productName: product.name,
      images: product.images || [],
      ogImage: product.ogImage
    });
  } catch (error) {
    console.error('Get product images error:', error);
    res.status(500).json({
      error: 'Failed to fetch product images'
    });
  }
};

// New function to update product images
const updateProductImages = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    if (isNaN(Number(id))) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const product = await prisma.product.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!product) {
      // Cleanup uploaded files if product not found
      req.files.forEach(file => deleteFile(`/uploads/products/${file.filename}`));
      return res.status(404).json({ error: 'Product not found' });
    }

    // Create new images array from uploaded files
    const newImages = req.files.map((file, index) => ({
      url: `/${file.path.replace(/\\/g, '/')}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      alt: req.body.alt || '',
      isPrimary: index === 0, // First image is primary
      order: index
    }));

    const updatedProduct = await prisma.product.update({
      where: { id: Number(id) },
      data: { images: newImages },
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
      message: 'Product images updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Update product images error:', error);

    // Cleanup uploaded files on error
    if (req.files) {
      req.files.forEach(file => deleteFile(`/uploads/products/${file.filename}`));
    }

    res.status(500).json({
      error: 'Failed to update product images'
    });
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  getProductBySlug,
  updateProduct,
  deleteProduct,
  bulkUpdateProducts,
  getFeaturedProducts,
  getTrendingProducts,
  updateProductSeo,
  getProductsNeedingSeo,
  recordSeoAudit,
  updateProductVariants,
  uploadProductImage,
  deleteProductImage,
  getProductImages,
  updateProductImages,
  getPublicProducts,
  getProductBySlugForAdmin
};