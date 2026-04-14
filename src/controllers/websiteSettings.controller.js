const { cleanupUploadedFiles } = require('../middlewares/upload');

/* =========================================================
   DEFAULT APPEARANCE SETTINGS
========================================================= */
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

/* =========================================================
   HELPERS
========================================================= */
const normalizeSeo = (data = {}) => ({
  metaTitle: data.metaTitle || data.title || '',
  metaDescription: data.metaDescription || data.description || '',
  keywords: data.keywords || '',
  canonicalUrl: data.canonicalUrl || '',
  ogTitle: data.ogTitle || data.metaTitle || data.title || '',
  ogDescription: data.ogDescription || data.metaDescription || data.description || '',
  ogImage: data.ogImage || data.metaImage || '',
  twitterTitle: data.twitterTitle || data.metaTitle || data.title || '',
  twitterDescription: data.twitterDescription || data.metaDescription || data.description || '',
  twitterImage: data.twitterImage || data.metaImage || '',
  structuredData: data.structuredData || null,
  metaRobots: data.metaRobots || 'index, follow'
});

const escapeXml = (unsafe = '') =>
  String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const safeBaseUrl = (url) => String(url || '').replace(/\/$/, '');

const joinUrl = (baseUrl, path = '') => {
  const base = safeBaseUrl(baseUrl);
  const cleanPath = String(path || '').startsWith('/') ? String(path) : `/${path}`;
  return `${base}${cleanPath}`;
};

const encodePathSegment = (value) => encodeURIComponent(String(value || '').trim());

const buildSitemapUrl = (baseUrl, path) => escapeXml(joinUrl(baseUrl, path));

const getTodayIso = () => new Date().toISOString().split('T')[0];

/* =========================================================
   WEBSITE SETTINGS
========================================================= */
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
          appearanceSettings: getDefaultAppearanceSettings(),
          isActive: true
        }
      });
    } else if (!settings.appearanceSettings) {
      settings = await req.prisma.websiteSettings.update({
        where: { id: settings.id },
        data: {
          appearanceSettings: getDefaultAppearanceSettings()
        }
      });
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

const updateWebsiteSettings = async (req, res) => {
  try {
    const {
      headerLogo,
      headerLogoAlt,
      headerCtaText,
      headerCtaLink,
      headerNavigation,

      footerLogo,
      footerLogoAlt,
      footerDescription,
      footerContactInfo,
      footerSocialLinks,
      footerQuickLinks,
      footerCategories,
      footerPaymentMethods,
      footerCopyrightText,

      siteTitle,
      siteDescription,
      siteKeywords,
      siteUrl,
      siteLogo,
      favicon,

      facebookUrl,
      twitterUrl,
      instagramUrl,
      linkedinUrl,

      googleAnalyticsId,
      googleTagManagerId,
      facebookPixelId,

      structuredData,
      robotsTxt,
      sitemapUrl,

      metaTitle,
      metaDescription,
      metaImage,

      appearanceSettings
    } = req.body;

    const existingSettings = await req.prisma.websiteSettings.findFirst({
      where: {
        isActive: true,
        isDeleted: false
      }
    });

    const settingsData = {
      ...(headerLogo !== undefined && { headerLogo }),
      ...(headerLogoAlt !== undefined && { headerLogoAlt }),
      ...(headerCtaText !== undefined && { headerCtaText }),
      ...(headerCtaLink !== undefined && { headerCtaLink }),
      ...(headerNavigation !== undefined && { headerNavigation }),

      ...(footerLogo !== undefined && { footerLogo }),
      ...(footerLogoAlt !== undefined && { footerLogoAlt }),
      ...(footerDescription !== undefined && { footerDescription }),
      ...(footerContactInfo !== undefined && { footerContactInfo }),
      ...(footerSocialLinks !== undefined && { footerSocialLinks }),
      ...(footerQuickLinks !== undefined && { footerQuickLinks }),
      ...(footerCategories !== undefined && { footerCategories }),
      ...(footerPaymentMethods !== undefined && { footerPaymentMethods }),
      ...(footerCopyrightText !== undefined && { footerCopyrightText }),

      ...(siteTitle !== undefined && { siteTitle }),
      ...(siteDescription !== undefined && { siteDescription }),
      ...(siteKeywords !== undefined && { siteKeywords }),
      ...(siteUrl !== undefined && { siteUrl }),
      ...(siteLogo !== undefined && { siteLogo }),
      ...(favicon !== undefined && { favicon }),

      ...(facebookUrl !== undefined && { facebookUrl }),
      ...(twitterUrl !== undefined && { twitterUrl }),
      ...(instagramUrl !== undefined && { instagramUrl }),
      ...(linkedinUrl !== undefined && { linkedinUrl }),

      ...(googleAnalyticsId !== undefined && { googleAnalyticsId }),
      ...(googleTagManagerId !== undefined && { googleTagManagerId }),
      ...(facebookPixelId !== undefined && { facebookPixelId }),

      ...(structuredData !== undefined && { structuredData }),
      ...(robotsTxt !== undefined && { robotsTxt }),
      ...(sitemapUrl !== undefined && { sitemapUrl }),

      ...(metaTitle !== undefined && { metaTitle }),
      ...(metaDescription !== undefined && { metaDescription }),
      ...(metaImage !== undefined && { metaImage }),

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

/* =========================================================
   SEO
========================================================= */
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

    if (pageSlug) whereClause.pageSlug = pageSlug;
    if (pageId) whereClause.pageId = parseInt(pageId, 10);

    const pageSeo = await req.prisma.seoPage.findFirst({
      where: whereClause
    });

    const globalSettings = await req.prisma.websiteSettings.findFirst({
      where: {
        isActive: true,
        isDeleted: false
      }
    });

    const mergedSeo = normalizeSeo({
      ...globalSettings,
      ...pageSeo
    });

    return res.json({
      success: true,
      data: mergedSeo,
      isDefault: !pageSeo
    });
  } catch (error) {
    console.error('Error fetching page SEO:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching page SEO'
    });
  }
};

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

    if (pageSlug) whereClause.pageSlug = pageSlug;
    if (pageId) whereClause.pageId = parseInt(pageId, 10);

    const existingSeo = await req.prisma.seoPage.findFirst({
      where: whereClause
    });

    const seoData = {
      pageType,
      pageSlug: pageSlug || null,
      pageId: pageId ? parseInt(pageId, 10) : null,
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

/* =========================================================
   NAVIGATION
========================================================= */
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

const createNavigationMenu = async (req, res) => {
  try {
    const { name, slug, location, items } = req.body;

    if (!name || !slug || !location || !items) {
      return res.status(400).json({
        success: false,
        message: 'Name, slug, location, and items are required'
      });
    }

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

const updateNavigationMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, items, isActive } = req.body;

    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({
        success: false,
        message: 'Valid menu ID is required'
      });
    }

    const menuId = parseInt(id, 10);

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

const deleteNavigationMenu = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({
        success: false,
        message: 'Valid menu ID is required'
      });
    }

    const menuId = parseInt(id, 10);

    const menu = await req.prisma.navigationMenu.findUnique({
      where: { id: menuId }
    });

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: 'Navigation menu not found'
      });
    }

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

/* =========================================================
   SITEMAP
========================================================= */
const getSitemap = async (req, res) => {
  try {
    const baseUrl = safeBaseUrl(process.env.FRONTEND_URL || 'https://evergreenpharma.us');

    const [products, categories, blogs] = await Promise.all([
      req.prisma.product.findMany({
        where: { isActive: true, isDeleted: false },
        select: { slug: true, updatedAt: true }
      }),
      req.prisma.category.findMany({
        where: { isActive: true, isDeleted: false },
        select: { slug: true, updatedAt: true }
      }),
      req.prisma.blogPost.findMany({
        where: {
          status: 'published',
          isDeleted: false,
          isActive: true
        },
        select: { slug: true, updatedAt: true }
      })
    ]);

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

    const urlEntries = [];

    staticRoutes.forEach(route => {
      urlEntries.push(`
  <url>
    <loc>${buildSitemapUrl(baseUrl, route.url)}</loc>
    <lastmod>${getTodayIso()}</lastmod>
    <priority>${route.priority}</priority>
    <changefreq>${route.changefreq}</changefreq>
  </url>`);
    });

    products.forEach(product => {
      if (!product.slug) return;

      urlEntries.push(`
  <url>
    <loc>${buildSitemapUrl(baseUrl, `/product/${encodePathSegment(product.slug)}`)}</loc>
    <lastmod>${product.updatedAt.toISOString().split('T')[0]}</lastmod>
    <priority>0.8</priority>
    <changefreq>weekly</changefreq>
  </url>`);
    });

    categories.forEach(category => {
      if (!category.slug) return;

      urlEntries.push(`
  <url>
    <loc>${buildSitemapUrl(baseUrl, `/category/${encodePathSegment(category.slug)}`)}</loc>
    <lastmod>${category.updatedAt.toISOString().split('T')[0]}</lastmod>
    <priority>0.7</priority>
    <changefreq>weekly</changefreq>
  </url>`);
    });

    blogs.forEach(blog => {
      if (!blog.slug) return;

      urlEntries.push(`
  <url>
    <loc>${buildSitemapUrl(baseUrl, `/blog/${encodePathSegment(blog.slug)}`)}</loc>
    <lastmod>${blog.updatedAt.toISOString().split('T')[0]}</lastmod>
    <priority>0.6</priority>
    <changefreq>monthly</changefreq>
  </url>`);
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}
</urlset>`;

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

/* =========================================================
   ROBOTS.TXT
========================================================= */
const getRobotsTxt = async (req, res) => {
  try {
    const baseUrl = safeBaseUrl(process.env.FRONTEND_URL || 'https://evergreenpharma.us');

    const settings = await req.prisma.websiteSettings.findFirst({
      where: { isActive: true, isDeleted: false },
      select: { robotsTxt: true }
    });

    let robotsContent = settings?.robotsTxt;

    if (!robotsContent) {
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