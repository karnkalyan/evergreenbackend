// src/controllers/emailTemplates.controller.js
const { processTemplateVariables, extractTemplateVariables } = require('../utils/templateProcessor.js');

const getAllEmailTemplates = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { page = 1, limit = 10, status, search, type } = req.query;

    const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Number(limit));
    const take = Math.min(100, Number(limit));

    const where = {
      isDeleted: false
    };

    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [templates, total] = await Promise.all([
      prisma.emailTemplate.findMany({
        where,
        include: {
          _count: {
            select: {
              automationRules: {
                where: { isDeleted: false }
              },
              queuedEmails: {
                where: { isDeleted: false }
              }
            }
          }
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.emailTemplate.count({ where })
    ]);

    // Parse variables for each template
    const templatesWithParsedVariables = templates.map(template => ({
      ...template,
      variables: template.variables ? JSON.parse(template.variables) : []
    }));

    res.json({
      success: true,
      data: {
        templates: templatesWithParsedVariables,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get email templates error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch email templates' 
    });
  }
};

const getEmailTemplateById = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const template = await prisma.emailTemplate.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      },
      include: {
        automationRules: {
          where: { isDeleted: false },
          include: {
            _count: {
              select: {
                queuedEmails: {
                  where: { isDeleted: false }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            queuedEmails: {
              where: { isDeleted: false }
            }
          }
        }
      }
    });

    if (!template) {
      return res.status(404).json({ 
        success: false,
        error: 'Email template not found' 
      });
    }

    // Parse variables
    const templateWithParsedVariables = {
      ...template,
      variables: template.variables ? JSON.parse(template.variables) : []
    };

    res.json({
      success: true,
      data: templateWithParsedVariables
    });
  } catch (error) {
    console.error('Get email template error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch email template' 
    });
  }
};

const createEmailTemplate = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { name, subject, body, type = 'TRANSACTIONAL', description, status = 'active', variables = [] } = req.body;

    if (!name || !subject || !body) {
      return res.status(400).json({ 
        success: false,
        error: 'Name, subject, and body are required' 
      });
    }

    // Extract variables from subject and body
    const extractedVariables = extractTemplateVariables(subject + ' ' + body);
    const allVariables = [...new Set([...variables, ...extractedVariables])];

    // Check if template with same name exists
    const existingTemplate = await prisma.emailTemplate.findFirst({
      where: {
        name,
        isDeleted: false
      }
    });

    if (existingTemplate) {
      return res.status(400).json({ 
        success: false,
        error: 'Email template with this name already exists' 
      });
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        subject,
        body,
        type,
        description,
        status,
        variables: JSON.stringify(allVariables)
      }
    });

    res.status(201).json({
      success: true,
      message: 'Email template created successfully',
      data: {
        ...template,
        variables: allVariables
      }
    });
  } catch (error) {
    console.error('Create email template error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create email template' 
    });
  }
};

const updateEmailTemplate = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const updateData = req.body;

    const template = await prisma.emailTemplate.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!template) {
      return res.status(404).json({ 
        success: false,
        error: 'Email template not found' 
      });
    }

    // Check name uniqueness if name is being updated
    if (updateData.name && updateData.name !== template.name) {
      const existingTemplate = await prisma.emailTemplate.findFirst({
        where: {
          name: updateData.name,
          isDeleted: false,
          id: { not: Number(id) }
        }
      });

      if (existingTemplate) {
        return res.status(400).json({ 
          success: false,
          error: 'Email template with this name already exists' 
        });
      }
    }

    // Handle variables extraction if subject or body is updated
    if (updateData.subject || updateData.body) {
      const subject = updateData.subject || template.subject;
      const body = updateData.body || template.body;
      const extractedVariables = extractTemplateVariables(subject + ' ' + body);
      const existingVariables = template.variables ? JSON.parse(template.variables) : [];
      const allVariables = [...new Set([...existingVariables, ...extractedVariables])];
      updateData.variables = JSON.stringify(allVariables);
    }

    const updatedTemplate = await prisma.emailTemplate.update({
      where: { id: Number(id) },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Email template updated successfully',
      data: {
        ...updatedTemplate,
        variables: updatedTemplate.variables ? JSON.parse(updatedTemplate.variables) : []
      }
    });
  } catch (error) {
    console.error('Update email template error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update email template' 
    });
  }
};

const deleteEmailTemplate = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const template = await prisma.emailTemplate.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      },
      include: {
        automationRules: {
          where: { isDeleted: false }
        }
      }
    });

    if (!template) {
      return res.status(404).json({ 
        success: false,
        error: 'Email template not found' 
      });
    }

    if (template.isSystem) {
      return res.status(400).json({
        success: false,
        error: 'System templates cannot be deleted'
      });
    }

    // Check if template is used in automation rules
    if (template.automationRules.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete template that is used in automation rules. Please update or delete the automation rules first.'
      });
    }

    await prisma.emailTemplate.update({
      where: { id: Number(id) },
      data: { isDeleted: true }
    });

    res.json({ 
      success: true,
      message: 'Email template deleted successfully' 
    });
  } catch (error) {
    console.error('Delete email template error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete email template' 
    });
  }
};

const previewEmailTemplate = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const { variables = {} } = req.body;

    const template = await prisma.emailTemplate.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!template) {
      return res.status(404).json({ 
        success: false,
        error: 'Email template not found' 
      });
    }

    // Process template with provided variables
    const processedSubject = processTemplateVariables(template.subject, variables);
    const processedBody = processTemplateVariables(template.body, variables);

    res.json({
      success: true,
      data: {
        subject: processedSubject,
        body: processedBody,
        variables: template.variables ? JSON.parse(template.variables) : []
      }
    });
  } catch (error) {
    console.error('Preview email template error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to preview email template' 
    });
  }
};

const duplicateEmailTemplate = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ 
        success: false,
        error: 'New template name is required' 
      });
    }

    const template = await prisma.emailTemplate.findFirst({
      where: {
        id: Number(id),
        isDeleted: false
      }
    });

    if (!template) {
      return res.status(404).json({ 
        success: false,
        error: 'Email template not found' 
      });
    }

    // Check if new name already exists
    const existingTemplate = await prisma.emailTemplate.findFirst({
      where: {
        name,
        isDeleted: false
      }
    });

    if (existingTemplate) {
      return res.status(400).json({ 
        success: false,
        error: 'Email template with this name already exists' 
      });
    }

    const duplicatedTemplate = await prisma.emailTemplate.create({
      data: {
        name,
        subject: template.subject,
        body: template.body,
        type: template.type,
        description: template.description ? `${template.description} (Copy)` : 'Copy',
        variables: template.variables,
        status: 'inactive' // Set to inactive by default for safety
      }
    });

    res.status(201).json({
      success: true,
      message: 'Email template duplicated successfully',
      data: {
        ...duplicatedTemplate,
        variables: duplicatedTemplate.variables ? JSON.parse(duplicatedTemplate.variables) : []
      }
    });
  } catch (error) {
    console.error('Duplicate email template error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to duplicate email template' 
    });
  }
};

module.exports = {
  getAllEmailTemplates,
  getEmailTemplateById,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  previewEmailTemplate,
  duplicateEmailTemplate
};