// backend/src/controllers/review.controller.js

const recalculateProductRating = async (prisma, productId) => {
  try {
    const approvedReviews = await prisma.review.findMany({
      where: {
        productId: Number(productId),
        status: 'APPROVED',
        isDeleted: false,
      },
      select: { rating: true },
    });

    const totalReviews = approvedReviews.length;
    const avgRating =
      totalReviews > 0
        ? Number((approvedReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
        : 0;

    await prisma.product.update({
      where: { id: Number(productId) },
      data: {
        rating: avgRating,
        reviews: totalReviews,
      },
    });
  } catch (error) {
    console.error('Error recalculating product rating:', error);
  }
};

const createReview = (prisma) => async (req, res) => {
  try {
    const { productId, name, email, rating, message } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, error: 'Product ID is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Review message is required' });
    }

    const parsedRating = Number(rating);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be a number between 1 and 5' });
    }

    const numericProductId = Number(productId);
    const product = await prisma.product.findUnique({
      where: { id: numericProductId },
    });

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const newReview = await prisma.review.create({
      data: {
        productId: numericProductId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        rating: parsedRating,
        message: message.trim(),
        status: 'APPROVED', // Guest reviews approved by default (manageable in admin)
      },
    });

    await recalculateProductRating(prisma, numericProductId);

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully!',
      data: newReview,
    });
  } catch (error) {
    console.error('Error creating review:', error);
    return res.status(500).json({ success: false, error: 'Failed to submit review' });
  }
};

const getProductReviews = (prisma) => async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (isNaN(productId)) {
      return res.status(400).json({ success: false, error: 'Invalid product ID' });
    }

    const reviews = await prisma.review.findMany({
      where: {
        productId,
        status: 'APPROVED',
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalReviews = reviews.length;
    const avgRating =
      totalReviews > 0
        ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
        : 0;

    const ratingCounts = {
      5: reviews.filter((r) => r.rating === 5).length,
      4: reviews.filter((r) => r.rating === 4).length,
      3: reviews.filter((r) => r.rating === 3).length,
      2: reviews.filter((r) => r.rating === 2).length,
      1: reviews.filter((r) => r.rating === 1).length,
    };

    return res.status(200).json({
      success: true,
      data: reviews,
      stats: {
        averageRating: avgRating,
        totalReviews,
        ratingCounts,
      },
    });
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
  }
};

const getAdminReviews = (prisma) => async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const { status, search } = req.query;

    const whereClause = {
      isDeleted: false,
    };

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    if (search && search.trim()) {
      const searchTerm = search.trim();
      whereClause.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { message: { contains: searchTerm, mode: 'insensitive' } },
        { product: { name: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const [reviews, totalCount, totalAll, approvedCount, pendingCount, hiddenCount] =
      await Promise.all([
        prisma.review.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: true,
              },
            },
          },
        }),
        prisma.review.count({ where: whereClause }),
        prisma.review.count({ where: { isDeleted: false } }),
        prisma.review.count({ where: { isDeleted: false, status: 'APPROVED' } }),
        prisma.review.count({ where: { isDeleted: false, status: 'PENDING' } }),
        prisma.review.count({ where: { isDeleted: false, status: 'HIDDEN' } }),
      ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    return res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        page,
        limit,
        totalPages,
        totalCount,
      },
      stats: {
        total: totalAll,
        approved: approvedCount,
        pending: pendingCount,
        hidden: hiddenCount,
      },
    });
  } catch (error) {
    console.error('Error fetching admin reviews:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch admin reviews' });
  }
};

const updateReviewStatus = (prisma) => async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!['APPROVED', 'PENDING', 'HIDDEN'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    const updated = await prisma.review.update({
      where: { id },
      data: { status },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    await recalculateProductRating(prisma, existing.productId);

    return res.status(200).json({
      success: true,
      message: `Review status updated to ${status}`,
      data: updated,
    });
  } catch (error) {
    console.error('Error updating review status:', error);
    return res.status(500).json({ success: false, error: 'Failed to update review status' });
  }
};

const deleteReview = (prisma) => async (req, res) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    await prisma.review.update({
      where: { id },
      data: { isDeleted: true },
    });

    await recalculateProductRating(prisma, existing.productId);

    return res.status(200).json({
      success: true,
      message: 'Review removed successfully',
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete review' });
  }
};

module.exports = {
  createReview,
  getProductReviews,
  getAdminReviews,
  updateReviewStatus,
  deleteReview,
};
