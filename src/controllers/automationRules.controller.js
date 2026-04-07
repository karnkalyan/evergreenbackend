// src/controllers/automationRules.controller.js
const { queueAutomationEmails } = require('../services/emailAutomationService');

const getAllAutomationRules = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { page = 1, limit = 10, status, trigger, search } = req.query;

    const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Number(limit));
    const take = Math.min(100, Number(limit));

    const where = {
      isDeleted: false
    };

    if (status) where.status = status;
    if (trigger) where.trigger = trigger;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [rules, total] = await Promise.all([
      prisma.automationRule.findMany({
        where,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              subject: true,
              type: true
            }
          },
          _count: {
            select: {
              queuedEmails: {
                where: { 
                  isDeleted: false,
                  createdAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                  }
                }
              }
            }
          }
        },
        skip,
        take,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }]
      }),
      prisma.automationRule.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        rules,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get automation rules error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch automation rules' 
    });
  }
};

const getAutomationRuleById = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const rule = await prisma.automationRule.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      },
      include: {
        template: true,
        queuedEmails: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            },
            order: {
              select: {
                orderNumber: true,
                totalAmount: true
              }
            }
          }
        },
        _count: {
          select: {
            queuedEmails: {
              where: { 
                isDeleted: false,
                createdAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
              }
            }
          }
        }
      }
    });

    if (!rule) {
      return res.status(404).json({ 
        success: false,
        error: 'Automation rule not found' 
      });
    }

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    console.error('Get automation rule error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch automation rule' 
    });
  }
};

const createAutomationRule = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { 
      name, 
      description, 
      trigger, 
      conditions = [], 
      delayHours = 0, 
      templateId, 
      status = 'active', 
      priority = 1,
      maxAttempts = 3 
    } = req.body;

    if (!name || !trigger || !templateId) {
      return res.status(400).json({ 
        success: false,
        error: 'Name, trigger, and template are required' 
      });
    }

    // Check if template exists and is active
    const template = await prisma.emailTemplate.findFirst({
      where: {
        id: templateId,
        isDeleted: false,
        status: 'active'
      }
    });

    if (!template) {
      return res.status(400).json({ 
        success: false,
        error: 'Template not found or inactive' 
      });
    }

    const rule = await prisma.automationRule.create({
      data: {
        name,
        description,
        trigger,
        conditions: JSON.stringify(conditions),
        delayHours,
        templateId,
        status,
        priority,
        maxAttempts
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            subject: true,
            type: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Automation rule created successfully',
      data: rule
    });
  } catch (error) {
    console.error('Create automation rule error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create automation rule' 
    });
  }
};

const updateAutomationRule = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const updateData = req.body;

    const rule = await prisma.automationRule.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!rule) {
      return res.status(404).json({ 
        success: false,
        error: 'Automation rule not found' 
      });
    }

    // Handle conditions if provided
    if (updateData.conditions) {
      updateData.conditions = JSON.stringify(updateData.conditions);
    }

    // Check template if being updated
    if (updateData.templateId) {
      const template = await prisma.emailTemplate.findFirst({
        where: {
          id: updateData.templateId,
          isDeleted: false,
          status: 'active'
        }
      });

      if (!template) {
        return res.status(400).json({ 
          success: false,
          error: 'Template not found or inactive' 
        });
      }
    }

    const updatedRule = await prisma.automationRule.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        template: {
          select: {
            id: true,
            name: true,
            subject: true,
            type: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Automation rule updated successfully',
      data: updatedRule
    });
  } catch (error) {
    console.error('Update automation rule error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update automation rule' 
    });
  }
};

const deleteAutomationRule = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const rule = await prisma.automationRule.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!rule) {
      return res.status(404).json({ 
        success: false,
        error: 'Automation rule not found' 
      });
    }

    await prisma.automationRule.update({
      where: { id: Number(id) },
      data: { isDeleted: true }
    });

    res.json({ 
      success: true,
      message: 'Automation rule deleted successfully' 
    });
  } catch (error) {
    console.error('Delete automation rule error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete automation rule' 
    });
  }
};

const testAutomationRule = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const { userId, orderId, variables = {} } = req.body;

    const rule = await prisma.automationRule.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      },
      include: {
        template: true
      }
    });

    if (!rule) {
      return res.status(404).json({ 
        success: false,
        error: 'Automation rule not found' 
      });
    }

    // Test the automation rule
    const result = await queueAutomationEmails(rule.trigger, userId, orderId, variables);

    if (!result.success) {
      return res.status(400).json({ 
        success: false,
        error: result.message 
      });
    }

    res.json({
      success: true,
      message: 'Automation rule tested successfully',
      data: result
    });
  } catch (error) {
    console.error('Test automation rule error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to test automation rule' 
    });
  }
};

const getAutomationStats = async (req, res) => {
  try {
    const prisma = req.prisma;

    const [
      totalRules,
      activeRules,
      totalTemplates,
      recentEmails,
      triggerStats,
      emailStats
    ] = await Promise.all([
      // Total rules
      prisma.automationRule.count({
        where: { isDeleted: false }
      }),
      // Active rules
      prisma.automationRule.count({
        where: { 
          isDeleted: false,
          status: 'active'
        }
      }),
      // Total templates
      prisma.emailTemplate.count({
        where: { isDeleted: false }
      }),
      // Recent emails (last 30 days)
      prisma.queuedEmail.count({
        where: {
          isDeleted: false,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      // Rules by trigger
      prisma.automationRule.groupBy({
        by: ['trigger'],
        where: { isDeleted: false },
        _count: {
          id: true
        }
      }),
      // Email status stats
      prisma.queuedEmail.groupBy({
        by: ['status'],
        where: {
          isDeleted: false,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        _count: {
          id: true
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalRules,
        activeRules,
        totalTemplates,
        recentEmails,
        triggerStats,
        emailStats
      }
    });
  } catch (error) {
    console.error('Get automation stats error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch automation statistics' 
    });
  }
};

module.exports = {
  getAllAutomationRules,
  getAutomationRuleById,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  testAutomationRule,
  getAutomationStats
};