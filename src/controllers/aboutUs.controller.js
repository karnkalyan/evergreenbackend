// controllers/aboutUs.controller.js

const createAboutUs = async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      title,
      subtitle,
      description,
      mission,
      vision,
      values,
      image,
      isActive = true
    } = req.body;

    // Check if AboutUs already exists (we'll only allow one active record)
    const existingAboutUs = await prisma.aboutUs.findFirst({
      where: {
        isDeleted: false
      }
    });

    if (existingAboutUs) {
      return res.status(400).json({
        error: 'About Us content already exists. Please update the existing content.'
      });
    }

    const aboutUs = await prisma.aboutUs.create({
      data: {
        title,
        subtitle,
        description,
        mission,
        vision,
        values: values || [],
        image,
        isActive
      }
    });

    res.status(201).json({
      message: 'About Us content created successfully',
      aboutUs
    });
  } catch (error) {
    console.error('Create About Us error:', error);
    res.status(500).json({
      error: 'Failed to create About Us content'
    });
  }
};

const updateAboutUs = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const updateData = req.body;

    const aboutUs = await prisma.aboutUs.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!aboutUs) {
      return res.status(404).json({
        error: 'About Us content not found'
      });
    }

    const updatedAboutUs = await prisma.aboutUs.update({
      where: { id: Number(id) },
      data: updateData
    });

    res.status(200).json({
      message: 'About Us content updated successfully',
      aboutUs: updatedAboutUs
    });
  } catch (error) {
    console.error('Update About Us error:', error);
    res.status(500).json({
      error: 'Failed to update About Us content'
    });
  }
};

const deleteAboutUs = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const aboutUs = await prisma.aboutUs.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!aboutUs) {
      return res.status(404).json({
        error: 'About Us content not found'
      });
    }

    await prisma.aboutUs.update({
      where: { id: Number(id) },
      data: { isDeleted: true }
    });

    res.status(200).json({
      message: 'About Us content deleted successfully'
    });
  } catch (error) {
    console.error('Delete About Us error:', error);
    res.status(500).json({
      error: 'Failed to delete About Us content'
    });
  }
};

const getAboutUs = async (req, res) => {
  try {
    const prisma = req.prisma;

    const aboutUs = await prisma.aboutUs.findFirst({
      where: {
        isActive: true,
        isDeleted: false
      }
    });

    if (!aboutUs) {
      return res.status(404).json({
        error: 'No active About Us content found'
      });
    }

    res.status(200).json({
      aboutUs
    });
  } catch (error) {
    console.error('Get About Us error:', error);
    res.status(500).json({
      error: 'Failed to fetch About Us content'
    });
  }
};

const getAllAboutUs = async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      page = 1,
      limit = 10,
      isActive
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = {
      isDeleted: false
    };

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [aboutUsList, total] = await Promise.all([
      prisma.aboutUs.findMany({
        where,
        skip,
        take,
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.aboutUs.count({ where })
    ]);

    res.status(200).json({
      aboutUs: aboutUsList,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get all About Us error:', error);
    res.status(500).json({
      error: 'Failed to fetch About Us content'
    });
  }
};

const getAboutUsById = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const aboutUs = await prisma.aboutUs.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!aboutUs) {
      return res.status(404).json({
        error: 'About Us content not found'
      });
    }

    res.status(200).json({
      aboutUs
    });
  } catch (error) {
    console.error('Get About Us by ID error:', error);
    res.status(500).json({
      error: 'Failed to fetch About Us content'
    });
  }
};

const toggleAboutUsStatus = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const aboutUs = await prisma.aboutUs.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!aboutUs) {
      return res.status(404).json({
        error: 'About Us content not found'
      });
    }

    const updatedAboutUs = await prisma.aboutUs.update({
      where: { id: Number(id) },
      data: { isActive: !aboutUs.isActive }
    });

    res.status(200).json({
      message: `About Us content ${updatedAboutUs.isActive ? 'activated' : 'deactivated'} successfully`,
      aboutUs: updatedAboutUs
    });
  } catch (error) {
    console.error('Toggle About Us status error:', error);
    res.status(500).json({
      error: 'Failed to toggle About Us status'
    });
  }
};

module.exports = {
  createAboutUs,
  updateAboutUs,
  deleteAboutUs,
  getAboutUs,
  getAllAboutUs,
  getAboutUsById,
  toggleAboutUsStatus
};