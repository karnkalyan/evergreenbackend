const { PrismaClient } = require('@prisma/client');

const getAllBlogPosts = async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      page = 1,
      limit = 10,
      status,
      search,
      author,
      sortBy = 'publishDate',
      sortOrder = 'desc',
      includeInactive = false,
      includeDrafts = true,
      admin = false
    } = req.query;

    const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Number(limit));
    const take = Math.min(100, Number(limit));

    const where = {
      isDeleted: false
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (status) {
      where.status = status;
    } else if (!includeDrafts && !admin) {
      where.status = 'published';
    }

    if (author) where.author = { contains: author, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } }
      ];
    }

    const allowedSortFields = ['publishDate', 'createdAt', 'updatedAt', 'title', 'views'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'publishDate';
    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const orderBy = {};
    orderBy[safeSortBy] = safeSortOrder;

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          author: true,
          status: true,
          publishDate: true,
          featuredImage: true,
          excerpt: true,
          views: true,
          likes: true,
          shares: true,
          createdAt: true,
          updatedAt: true,
          metaTitle: true,
          metaDescription: true,
          canonicalUrl: true,
          seoKeywords: true,
          content: true,
          isActive: true
        },
        skip,
        take,
        orderBy
      }),
      prisma.blogPost.count({ where })
    ]);

    // Add full URLs to featured images
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const postsWithFullUrls = posts.map(post => ({
      ...post,
      featuredImage: post.featuredImage ? 
        (post.featuredImage.startsWith('http') ? post.featuredImage : `${baseUrl}/${post.featuredImage.replace(/^\/?/, '')}`) 
        : null
    }));

    res.json({
      success: true,
      data: {
        posts: postsWithFullUrls,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get blog posts error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch blog posts' 
    });
  }
};

const getBlogPostById = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const post = await prisma.blogPost.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      },
      include: {
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        }
      }
    });

    if (!post) {
      return res.status(404).json({ 
        success: false,
        error: 'Blog post not found' 
      });
    }

    // Add full URL to featured image
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const postWithFullUrl = {
      ...post,
      featuredImage: post.featuredImage ? 
        (post.featuredImage.startsWith('http') ? post.featuredImage : `${baseUrl}/${post.featuredImage.replace(/^\/?/, '')}`) 
        : null
    };

    // Increment views only for published posts
    if (post.status === 'published') {
      await prisma.blogPost.update({
        where: { id: Number(id) },
        data: { views: { increment: 1 } }
      });
    }

    res.json({
      success: true,
      data: postWithFullUrl
    });
  } catch (error) {
    console.error('Get blog post error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch blog post' 
    });
  }
};

const getBlogPostBySlug = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { slug } = req.params;

    const post = await prisma.blogPost.findFirst({
      where: {
        slug,
        isDeleted: false,
        isActive: true,
        status: 'published'
      },
      include: {
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        }
      }
    });

    if (!post) {
      return res.status(404).json({ 
        success: false,
        error: 'Blog post not found' 
      });
    }

    // Add full URL to featured image
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const postWithFullUrl = {
      ...post,
      featuredImage: post.featuredImage ? 
        (post.featuredImage.startsWith('http') ? post.featuredImage : `${baseUrl}/${post.featuredImage.replace(/^\/?/, '')}`) 
        : null
    };

    // Increment views
    await prisma.blogPost.update({
      where: { id: post.id },
      data: { views: { increment: 1 } }
    });

    res.json({
      success: true,
      data: postWithFullUrl
    });
  } catch (error) {
    console.error('Get blog post by slug error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch blog post' 
    });
  }
};

const createBlogPost = async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      title,
      slug,
      author,
      content,
      excerpt,
      status = 'draft',
      publishDate,
      featuredImage,
      images,
      metaTitle,
      metaDescription,
      canonicalUrl,
      ogImage,
      structuredData,
      seoKeywords,
      categoryIds = []
    } = req.body;

    console.log('Received blog post data:', {
      title, slug, author, status, 
      contentLength: content?.length,
      excerptLength: excerpt?.length
    });

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Title is required' 
      });
    }
    if (!slug || !slug.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Slug is required' 
      });
    }
    if (!author || !author.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Author is required' 
      });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Content is required' 
      });
    }

    // Check if slug already exists
    const existingPost = await prisma.blogPost.findFirst({
      where: {
        slug: slug.trim(),
        isDeleted: false
      }
    });

    if (existingPost) {
      return res.status(400).json({ 
        success: false,
        error: 'Blog post with this slug already exists' 
      });
    }

    // Handle featured image - use the URL directly
    let finalFeaturedImage = null;
    
    if (featuredImage) {
      let normalizedImage = featuredImage.replace(/\\/g, '/');
      
      const baseUrl = `${req.protocol}://${req.get('host')}/`;
      if (normalizedImage.startsWith(baseUrl)) {
        normalizedImage = normalizedImage.replace(baseUrl, '');
      }
      
      normalizedImage = normalizedImage.replace(/^\//, '');
      
      finalFeaturedImage = normalizedImage;
      console.log('Using featured image URL:', finalFeaturedImage);
    }

    // Auto-generate SEO fields if not provided
    const finalMetaTitle = metaTitle || title;
    const finalMetaDescription = metaDescription || (excerpt ? excerpt.substring(0, 160) : null);

    console.log('Creating blog post with data:', {
      title: title.substring(0, 50) + '...',
      slug,
      author,
      contentLength: content.length,
      excerptLength: excerpt?.length,
      featuredImage: finalFeaturedImage ? 'Yes' : 'No'
    });

    const post = await prisma.blogPost.create({
      data: {
        title: title.trim(),
        slug: slug.trim(),
        author: author.trim(),
        content,
        excerpt: excerpt || null,
        status,
        publishDate: status === 'published' && !publishDate ? new Date() : publishDate,
        featuredImage: finalFeaturedImage,
        images: images || null,
        metaTitle: finalMetaTitle,
        metaDescription: finalMetaDescription,
        canonicalUrl: canonicalUrl || null,
        ogImage: ogImage || null,
        structuredData: structuredData || null,
        seoKeywords: seoKeywords || null,
        categories: categoryIds && categoryIds.length > 0 ? {
          create: categoryIds.map(categoryId => ({
            categoryId
          }))
        } : undefined
      },
      include: {
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        }
      }
    });

    // Add full URL to featured image in response
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const postWithFullUrl = {
      ...post,
      featuredImage: post.featuredImage ? 
        (post.featuredImage.startsWith('http') ? post.featuredImage : `${baseUrl}/${post.featuredImage.replace(/^\/?/, '')}`) 
        : null
    };

    console.log('Blog post created successfully:', postWithFullUrl.id);

    res.status(201).json({
      success: true,
      message: 'Blog post created successfully',
      data: postWithFullUrl
    });
  } catch (error) {
    console.error('Create blog post error:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Blog post with this slug already exists'
      });
    }

    if (error.code === 'P2000') {
      return res.status(400).json({
        success: false,
        error: 'Data too large for one or more fields'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Failed to create blog post: ' + error.message 
    });
  }
};

const updateBlogPost = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const updateData = req.body;

    const post = await prisma.blogPost.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!post) {
      return res.status(404).json({ 
        success: false,
        error: 'Blog post not found' 
      });
    }

    // Check slug uniqueness if slug is being updated
    if (updateData.slug && updateData.slug !== post.slug) {
      const existingPost = await prisma.blogPost.findFirst({
        where: {
          slug: updateData.slug.trim(),
          isDeleted: false,
          id: { not: Number(id) }
        }
      });

      if (existingPost) {
        return res.status(400).json({ 
          success: false,
          error: 'Blog post with this slug already exists' 
        });
      }
      updateData.slug = updateData.slug.trim();
    }

    // Handle featured image
    if (updateData.featuredImage && updateData.featuredImage.startsWith('http')) {
      const baseUrl = `${req.protocol}://${req.get('host')}/`;
      updateData.featuredImage = updateData.featuredImage.replace(baseUrl, '');
    }

    // Handle categories update
    let categoriesUpdate = {};
    if (updateData.categoryIds) {
      await prisma.blogPostCategory.deleteMany({
        where: { blogPostId: Number(id) }
      });

      if (updateData.categoryIds.length > 0) {
        categoriesUpdate.categories = {
          create: updateData.categoryIds.map(categoryId => ({
            categoryId
          }))
        };
      }
      delete updateData.categoryIds;
    }

    // Auto-update SEO fields if title or excerpt changes
    if (updateData.title || updateData.excerpt) {
      if (!updateData.metaTitle && updateData.title) {
        updateData.metaTitle = updateData.title;
      }
      if (!updateData.metaDescription && updateData.excerpt) {
        updateData.metaDescription = updateData.excerpt.substring(0, 160);
      }
    }

    // Set publish date if status is changing to published
    if (updateData.status === 'published' && post.status !== 'published') {
      updateData.publishDate = new Date();
    }

    // Trim string fields
    if (updateData.title) updateData.title = updateData.title.trim();
    if (updateData.author) updateData.author = updateData.author.trim();

    const updatedPost = await prisma.blogPost.update({
      where: { id: Number(id) },
      data: {
        ...updateData,
        ...categoriesUpdate
      },
      include: {
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        }
      }
    });

    // Add full URL to featured image in response
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const postWithFullUrl = {
      ...updatedPost,
      featuredImage: updatedPost.featuredImage ? 
        (updatedPost.featuredImage.startsWith('http') ? updatedPost.featuredImage : `${baseUrl}/${updatedPost.featuredImage.replace(/^\/?/, '')}`) 
        : null
    };

    res.json({
      success: true,
      message: 'Blog post updated successfully',
      data: postWithFullUrl
    });
  } catch (error) {
    console.error('Update blog post error:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Blog post with this slug already exists'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Failed to update blog post' 
    });
  }
};

const deleteBlogPost = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const post = await prisma.blogPost.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!post) {
      return res.status(404).json({ 
        success: false,
        error: 'Blog post not found' 
      });
    }

    await prisma.blogPost.update({
      where: { id: Number(id) },
      data: {
        isDeleted: true,
        isActive: false,
        slug: `deleted_${post.slug}_${Date.now()}`
      }
    });

    res.json({ 
      success: true,
      message: 'Blog post deleted successfully' 
    });
  } catch (error) {
    console.error('Delete blog post error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete blog post' 
    });
  }
};

const toggleBlogPostStatus = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const post = await prisma.blogPost.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!post) {
      return res.status(404).json({ 
        success: false,
        error: 'Blog post not found' 
      });
    }

    const updatedPost = await prisma.blogPost.update({
      where: { id: Number(id) },
      data: {
        isActive: !post.isActive
      }
    });

    res.json({
      success: true,
      message: `Blog post ${updatedPost.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedPost
    });
  } catch (error) {
    console.error('Toggle blog post status error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to toggle blog post status' 
    });
  }
};

const likeBlogPost = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if blog post exists
    const blogPost = await prisma.blogPost.findFirst({
      where: {
        id: Number(id),
        isDeleted: false,
        isActive: true,
        status: 'published'
      }
    });

    if (!blogPost) {
      return res.status(404).json({
        success: false,
        error: 'Blog post not found or not published'
      });
    }

    // Check if user already liked the post
    const existingLike = await prisma.blogPostLike.findFirst({
      where: {
        blogPostId: Number(id),
        userId: userId
      }
    });

    if (existingLike) {
      return res.status(400).json({
        success: false,
        error: 'You have already liked this post'
      });
    }

    // Create like and update post likes count in a transaction
    const result = await prisma.$transaction([
      prisma.blogPostLike.create({
        data: {
          blogPostId: Number(id),
          userId: userId
        }
      }),
      prisma.blogPost.update({
        where: { id: Number(id) },
        data: { likes: { increment: 1 } }
      })
    ]);

    res.json({
      success: true,
      message: 'Post liked successfully',
      data: {
        likes: result[1].likes
      }
    });
  } catch (error) {
    console.error('Like blog post error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to like blog post'
    });
  }
};

const unlikeBlogPost = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user has liked the post
    const existingLike = await prisma.blogPostLike.findFirst({
      where: {
        blogPostId: Number(id),
        userId: userId
      }
    });

    if (!existingLike) {
      return res.status(400).json({
        success: false,
        error: 'You have not liked this post'
      });
    }

    // Remove like and update post likes count in a transaction
    const result = await prisma.$transaction([
      prisma.blogPostLike.delete({
        where: { id: existingLike.id }
      }),
      prisma.blogPost.update({
        where: { id: Number(id) },
        data: { likes: { decrement: 1 } }
      })
    ]);

    res.json({
      success: true,
      message: 'Post unliked successfully',
      data: {
        likes: result[1].likes
      }
    });
  } catch (error) {
    console.error('Unlike blog post error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlike blog post'
    });
  }
};

const getLikeStatus = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const existingLike = await prisma.blogPostLike.findFirst({
      where: {
        blogPostId: Number(id),
        userId: userId
      }
    });

    res.json({
      success: true,
      data: {
        liked: !!existingLike
      }
    });
  } catch (error) {
    console.error('Get like status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get like status'
    });
  }
};

const shareBlogPost = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const { platform } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if blog post exists
    const blogPost = await prisma.blogPost.findFirst({
      where: {
        id: Number(id),
        isDeleted: false,
        isActive: true,
        status: 'published'
      }
    });

    if (!blogPost) {
      return res.status(404).json({
        success: false,
        error: 'Blog post not found or not published'
      });
    }

    // Create share record
    await prisma.blogPostShare.create({
      data: {
        blogPostId: Number(id),
        userId: userId,
        platform: platform || 'general'
      }
    });

    // Update shares count
    const updatedPost = await prisma.blogPost.update({
      where: { id: Number(id) },
      data: { shares: { increment: 1 } }
    });

    res.json({
      success: true,
      message: 'Post shared successfully',
      data: {
        shares: updatedPost.shares
      }
    });
  } catch (error) {
    console.error('Share blog post error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to share blog post'
    });
  }
};

module.exports = {
  getAllBlogPosts,
  getBlogPostById,
  getBlogPostBySlug,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  toggleBlogPostStatus,
  likeBlogPost,
  unlikeBlogPost,
  getLikeStatus,
  shareBlogPost
};