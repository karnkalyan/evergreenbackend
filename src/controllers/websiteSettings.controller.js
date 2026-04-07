const { cleanupUploadedFiles } = require('../middlewares/upload');

/**
 * Get website settings
 */
// Add this helper function at the top of your controller
const getDefaultAppearanceSettings = () => ({
  colors: {
    primaryColor: '#3b82f6',
    secondaryColor: '#1e40af',
    accentColor: '#f59e0b',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    mutedTextColor: '#6b7280',
    borderColor: '#e5e7eb'
  },
  gradient: {
    type: 'gradient',
    direction: 'to right',
    colors: ['#3b82f6', '#1e40af'],
    customGradient: ''
  },
  fonts: {
    primaryFont: 'Poppins',
    secondaryFont: 'Inter',
    fontSize: {
      base: '16px',
      sm: '14px',
      lg: '18px',
      xl: '24px'
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700'
    }
  },
  borderRadius: '8px',
  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
});

// Update the getWebsiteSettings function
const getWebsiteSettings = async (req, res) => {
  try {
    let settings = await req.prisma.websiteSettings.findFirst({
      where: { 
        isActive: true,
        isDeleted: false 
      }
    });

    if (!settings) {
      settings = await req.prisma.websiteSettings.create({
        data: {
          // ... your existing default fields ...
          appearanceSettings: getDefaultAppearanceSettings()
        }
      });
    } else {
      // If settings exist but appearanceSettings is missing, update it
      if (!settings.appearanceSettings) {
        settings = await req.prisma.websiteSettings.update({
          where: { id: settings.id },
          data: {
            appearanceSettings: getDefaultAppearanceSettings()
          }
        });
      }
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching website settings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching website settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update website settings
 */
const updateWebsiteSettings = async (req, res) => {
  try {
    const {
      // Header
      headerLogo,
      headerLogoAlt,
      headerCtaText,
      headerCtaLink,
      headerNavigation,
      
      // Footer
      footerLogo,
      footerLogoAlt,
      footerDescription,
      footerContactInfo,
      footerSocialLinks,
      footerQuickLinks,
      footerCategories,
      footerPaymentMethods,
      footerCopyrightText,
      
      // SEO Global
      siteTitle,
      siteDescription,
      siteKeywords,
      siteUrl,
      siteLogo,
      favicon,
      
      // Social Media
      facebookUrl,
      twitterUrl,
      instagramUrl,
      linkedinUrl,
      
      // Analytics
      googleAnalyticsId,
      googleTagManagerId,
      facebookPixelId,
      
      // Additional SEO
      structuredData,
      robotsTxt,
      sitemapUrl,
      
      // Meta
      metaTitle,
      metaDescription,
      metaImage,

      // Appearance Settings
      appearanceSettings
    } = req.body;

    // Get existing settings or create if doesn't exist
    let existingSettings = await req.prisma.websiteSettings.findFirst({
      where: { 
        isActive: true,
        isDeleted: false 
      }
    });

    const settingsData = {
      // Header
      ...(headerLogo !== undefined && { headerLogo }),
      ...(headerLogoAlt !== undefined && { headerLogoAlt }),
      ...(headerCtaText !== undefined && { headerCtaText }),
      ...(headerCtaLink !== undefined && { headerCtaLink }),
      ...(headerNavigation !== undefined && { headerNavigation }),
      
      // Footer
      ...(footerLogo !== undefined && { footerLogo }),
      ...(footerLogoAlt !== undefined && { footerLogoAlt }),
      ...(footerDescription !== undefined && { footerDescription }),
      ...(footerContactInfo !== undefined && { footerContactInfo }),
      ...(footerSocialLinks !== undefined && { footerSocialLinks }),
      ...(footerQuickLinks !== undefined && { footerQuickLinks }),
      ...(footerCategories !== undefined && { footerCategories }),
      ...(footerPaymentMethods !== undefined && { footerPaymentMethods }),
      ...(footerCopyrightText !== undefined && { footerCopyrightText }),
      
      // SEO Global
      ...(siteTitle !== undefined && { siteTitle }),
      ...(siteDescription !== undefined && { siteDescription }),
      ...(siteKeywords !== undefined && { siteKeywords }),
      ...(siteUrl !== undefined && { siteUrl }),
      ...(siteLogo !== undefined && { siteLogo }),
      ...(favicon !== undefined && { favicon }),
      
      // Social Media
      ...(facebookUrl !== undefined && { facebookUrl }),
      ...(twitterUrl !== undefined && { twitterUrl }),
      ...(instagramUrl !== undefined && { instagramUrl }),
      ...(linkedinUrl !== undefined && { linkedinUrl }),
      
      // Analytics
      ...(googleAnalyticsId !== undefined && { googleAnalyticsId }),
      ...(googleTagManagerId !== undefined && { googleTagManagerId }),
      ...(facebookPixelId !== undefined && { facebookPixelId }),
      
      // Additional SEO
      ...(structuredData !== undefined && { structuredData }),
      ...(robotsTxt !== undefined && { robotsTxt }),
      ...(sitemapUrl !== undefined && { sitemapUrl }),
      
      // Meta
      ...(metaTitle !== undefined && { metaTitle }),
      ...(metaDescription !== undefined && { metaDescription }),
      ...(metaImage !== undefined && { metaImage }),

      // Appearance Settings
      ...(appearanceSettings !== undefined && { appearanceSettings })
    };

    let updatedSettings;

    if (existingSettings) {
      updatedSettings = await req.prisma.websiteSettings.update({
        where: { id: existingSettings.id },
        data: settingsData
      });
    } else {
      updatedSettings = await req.prisma.websiteSettings.create({
        data: {
          ...settingsData,
          isActive: true
        }
      });
    }

    res.json({
      success: true,
      message: 'Website settings updated successfully',
      data: updatedSettings
    });

  } catch (error) {
    console.error('Error updating website settings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating website settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get SEO settings for a specific page
 */
const getPageSeo = async (req, res) => {
  try {
    const { pageType, pageSlug, pageId } = req.query;

    if (!pageType) {
      return res.status(400).json({
        success: false,
        message: 'Page type is required'
      });
    }

    const whereClause = {
      pageType,
      isActive: true,
      isDeleted: false
    };

    if (pageSlug) {
      whereClause.pageSlug = pageSlug;
    }

    if (pageId) {
      whereClause.pageId = parseInt(pageId);
    }

    const seoData = await req.prisma.seoPage.findFirst({
      where: whereClause
    });

    // If no specific SEO data found, return global settings
    if (!seoData) {
      const globalSettings = await req.prisma.websiteSettings.findFirst({
        where: { 
          isActive: true,
          isDeleted: false 
        },
        select: {
          siteTitle: true,
          siteDescription: true,
          siteKeywords: true,
          siteLogo: true,
          metaTitle: true,
          metaDescription: true,
          metaImage: true,
          appearanceSettings: true
        }
      });

      return res.json({
        success: true,
        data: globalSettings,
        isDefault: true
      });
    }

    res.json({
      success: true,
      data: seoData,
      isDefault: false
    });

  } catch (error) {
    console.error('Error fetching page SEO:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching page SEO',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create or update SEO for a page
 */
const updatePageSeo = async (req, res) => {
  try {
    const {
      pageType,
      pageSlug,
      pageId,
      title,
      description,
      keywords,
      canonicalUrl,
      ogTitle,
      ogDescription,
      ogImage,
      ogType,
      twitterCard,
      twitterTitle,
      twitterDescription,
      twitterImage,
      structuredData,
      schemaType,
      metaRobots,
      metaViewport
    } = req.body;

    // Validate required fields
    if (!pageType || !title) {
      return res.status(400).json({
        success: false,
        message: 'Page type and title are required'
      });
    }

    const whereClause = {
      pageType,
      isActive: true,
      isDeleted: false
    };

    if (pageSlug) {
      whereClause.pageSlug = pageSlug;
    }

    if (pageId) {
      whereClause.pageId = parseInt(pageId);
    }

    const existingSeo = await req.prisma.seoPage.findFirst({
      where: whereClause
    });

    const seoData = {
      pageType,
      pageSlug: pageSlug || null,
      pageId: pageId ? parseInt(pageId) : null,
      title,
      description,
      keywords,
      canonicalUrl,
      ogTitle,
      ogDescription,
      ogImage,
      ogType,
      twitterCard,
      twitterTitle,
      twitterDescription,
      twitterImage,
      structuredData,
      schemaType,
      metaRobots,
      metaViewport
    };

    let result;

    if (existingSeo) {
      result = await req.prisma.seoPage.update({
        where: { id: existingSeo.id },
        data: seoData
      });
    } else {
      result = await req.prisma.seoPage.create({
        data: seoData
      });
    }

    res.json({
      success: true,
      message: 'Page SEO updated successfully',
      data: result
    });

  } catch (error) {
    console.error('Error updating page SEO:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'SEO settings for this page already exist'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while updating page SEO',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get navigation menus
 */
const getNavigationMenus = async (req, res) => {
  try {
    const { location } = req.query;

    const whereClause = {
      isActive: true,
      isDeleted: false
    };

    if (location) {
      whereClause.location = location;
    }

    const menus = await req.prisma.navigationMenu.findMany({
      where: whereClause,
      orderBy: {
        name: 'asc'
      }
    });

    res.json({
      success: true,
      data: menus
    });

  } catch (error) {
    console.error('Error fetching navigation menus:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching navigation menus',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create navigation menu
 */
const createNavigationMenu = async (req, res) => {
  try {
    const { name, slug, location, items } = req.body;

    if (!name || !slug || !location || !items) {
      return res.status(400).json({
        success: false,
        message: 'Name, slug, location, and items are required'
      });
    }

    // Check if slug already exists
    const existingMenu = await req.prisma.navigationMenu.findUnique({
      where: { slug }
    });

    if (existingMenu) {
      return res.status(400).json({
        success: false,
        message: 'Navigation menu with this slug already exists'
      });
    }

    const menu = await req.prisma.navigationMenu.create({
      data: {
        name,
        slug,
        location,
        items
      }
    });

    res.status(201).json({
      success: true,
      message: 'Navigation menu created successfully',
      data: menu
    });

  } catch (error) {
    console.error('Error creating navigation menu:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Navigation menu with this slug already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while creating navigation menu',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update navigation menu
 */
const updateNavigationMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, items, isActive } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid menu ID is required'
      });
    }

    const menuId = parseInt(id);

    // Check if menu exists
    const existingMenu = await req.prisma.navigationMenu.findUnique({
      where: { id: menuId }
    });

    if (!existingMenu) {
      return res.status(404).json({
        success: false,
        message: 'Navigation menu not found'
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (items !== undefined) updateData.items = items;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedMenu = await req.prisma.navigationMenu.update({
      where: { id: menuId },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Navigation menu updated successfully',
      data: updatedMenu
    });

  } catch (error) {
    console.error('Error updating navigation menu:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Navigation menu not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while updating navigation menu',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete navigation menu
 */
const deleteNavigationMenu = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid menu ID is required'
      });
    }

    const menuId = parseInt(id);

    // Check if menu exists
    const menu = await req.prisma.navigationMenu.findUnique({
      where: { id: menuId }
    });

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: 'Navigation menu not found'
      });
    }

    // Soft delete
    await req.prisma.navigationMenu.update({
      where: { id: menuId },
      data: { isDeleted: true, isActive: false }
    });

    res.json({
      success: true,
      message: 'Navigation menu deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting navigation menu:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Navigation menu not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting navigation menu',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get sitemap XML
 */
const getSitemap = async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'https://evergreenpharma.us';
    
    // Get all products
    const products = await req.prisma.product.findMany({
      where: { isActive: true, isDeleted: false },
      select: { slug: true, updatedAt: true }
    });

    // Get all categories
    const categories = await req.prisma.category.findMany({
      where: { isActive: true, isDeleted: false },
      select: { slug: true, updatedAt: true }
    });

    // Get all blogs
    const blogs = await req.prisma.blogPost.findMany({
      where: {
        status: 'published',
        isDeleted: false,
        isActive: true
      },
      select: { slug: true, updatedAt: true }
    });

    // Static routes
    const staticRoutes = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/category/all', priority: '0.9', changefreq: 'weekly' },
      { url: '/manufacturers', priority: '0.8', changefreq: 'weekly' },
      { url: '/offers', priority: '0.8', changefreq: 'weekly' },
      { url: '/blog', priority: '0.8', changefreq: 'daily' },
      { url: '/about', priority: '0.7', changefreq: 'monthly' },
      { url: '/contact', priority: '0.7', changefreq: 'monthly' },
      { url: '/privacy-policy', priority: '0.5', changefreq: 'yearly' },
      { url: '/terms-and-conditions', priority: '0.5', changefreq: 'yearly' },
      { url: '/shipping-policy', priority: '0.5', changefreq: 'yearly' },
      { url: '/refund-policy', priority: '0.5', changefreq: 'yearly' },
      { url: '/disclaimer', priority: '0.5', changefreq: 'yearly' }
    ];

    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add static routes
    staticRoutes.forEach(route => {
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}${route.url}</loc>\n`;
      sitemap += `    <priority>${route.priority}</priority>\n`;
      sitemap += `    <changefreq>${route.changefreq}</changefreq>\n`;
      sitemap += '  </url>\n';
    });

    // Add product routes
    products.forEach(product => {
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}/product/${product.slug}</loc>\n`;
      sitemap += `    <lastmod>${product.updatedAt.toISOString().split('T')[0]}</lastmod>\n`;
      sitemap += '    <priority>0.8</priority>\n';
      sitemap += '    <changefreq>weekly</changefreq>\n';
      sitemap += '  </url>\n';
    });

    // Add category routes
    categories.forEach(category => {
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}/category/${category.slug}</loc>\n`;
      sitemap += `    <lastmod>${category.updatedAt.toISOString().split('T')[0]}</lastmod>\n`;
      sitemap += '    <priority>0.7</priority>\n';
      sitemap += '    <changefreq>weekly</changefreq>\n';
      sitemap += '  </url>\n';
    });

    // Add blog routes
    blogs.forEach(blog => {
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}/blog/${blog.slug}</loc>\n`;
      sitemap += `    <lastmod>${blog.updatedAt.toISOString().split('T')[0]}</lastmod>\n`;
      sitemap += '    <priority>0.6</priority>\n';
      sitemap += '    <changefreq>monthly</changefreq>\n';
      sitemap += '  </url>\n';
    });

    sitemap += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(sitemap);

  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating sitemap'
    });
  }
};

/**
 * Get robots.txt
 */
const getRobotsTxt = async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'https://evergreenpharma.us';
    
    // Get robots.txt content from settings
    const settings = await req.prisma.websiteSettings.findFirst({
      where: { isActive: true, isDeleted: false },
      select: { robotsTxt: true }
    });

    let robotsContent = settings?.robotsTxt;

    if (!robotsContent) {
      // Default robots.txt
      robotsContent = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;
    }

    res.header('Content-Type', 'text/plain');
    res.send(robotsContent);

  } catch (error) {
    console.error('Error serving robots.txt:', error);
    res.status(500).json({
      success: false,
      message: 'Error serving robots.txt'
    });
  }
};

module.exports = {
  getWebsiteSettings,
  updateWebsiteSettings,
  getPageSeo,
  updatePageSeo,
  getNavigationMenus,
  createNavigationMenu,
  updateNavigationMenu,
  deleteNavigationMenu,
  getSitemap,
  getRobotsTxt
};