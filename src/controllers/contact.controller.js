const { queueAutomationEmails } = require('../services/emailAutomationService');

// Helper function to generate ticket number
const generateTicketNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CT-${timestamp.slice(-6)}-${random}`;
};

// Helper function to get contact info from website settings
const getContactInfoFromSettings = async (prisma) => {
  try {
    const websiteSettings = await prisma.websiteSettings.findFirst({
      where: { isActive: true }
    });
    
    if (websiteSettings?.footerContactInfo) {
      try {
        const footerContactInfo = typeof websiteSettings.footerContactInfo === 'string' 
          ? JSON.parse(websiteSettings.footerContactInfo)
          : websiteSettings.footerContactInfo;
        
        return {
          email: footerContactInfo.email || 'support@evergreenpharma.us',
          phone: footerContactInfo.phone || '+1-555-111111',
          address: footerContactInfo.address || '123 Health St, Wellness City, CA 90210, USA'
        };
      } catch (parseError) {
        console.error('Error parsing footer contact info:', parseError);
      }
    }
  } catch (error) {
    console.error('Error fetching website settings:', error);
  }
  
  // Fallback defaults
  return {
    email: 'support@evergreenpharma.us',
    phone: '+1-555-111111',
    address: '123 Health St, Wellness City, CA 90210, USA'
  };
};

// Helper function to send company notifications
const sendCompanyNotification = async (contactRequest, eventType, additionalData = {}, prisma) => {
  try {
    console.log('Starting company notification for contact request');
    
    // Fetch admin emails from integration settings
    let COMPANY_EMAILS = [];
    
    try {
      const integrationSettings = await prisma.integrationSettings.findFirst({
        where: { isActive: true }
      });
      
      if (integrationSettings && integrationSettings.adminEmails) {
        try {
          const adminEmailsData = JSON.parse(integrationSettings.adminEmails);
          if (Array.isArray(adminEmailsData) && adminEmailsData.length > 0) {
            COMPANY_EMAILS = adminEmailsData.filter(email => 
              email && email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
            );
            console.log(`Found ${COMPANY_EMAILS.length} admin emails from database:`, COMPANY_EMAILS);
          }
        } catch (parseError) {
          console.error('Error parsing admin emails from database:', parseError);
        }
      }
    } catch (dbError) {
      console.error('Error fetching integration settings:', dbError);
    }

    // Fallback to environment variables
    if (COMPANY_EMAILS.length === 0) {
      COMPANY_EMAILS = [
        process.env.COMPANY_EMAIL_1 || 'karnkalyan@gmail.com',
        process.env.COMPANY_EMAIL_2 || 'kalyan@simulcast.com.np'
      ].filter(Boolean);
      console.log('Using fallback admin emails from environment variables:', COMPANY_EMAILS);
    }

    if (COMPANY_EMAILS.length === 0) {
      console.log('No company emails configured in database or environment');
      return;
    }

    // Get contact info from website settings
    const contactInfo = await getContactInfoFromSettings(prisma);

    // Prepare company template data
    const companyTemplateData = {
      contact_name: contactRequest.name,
      contact_email: contactRequest.email,
      contact_phone: contactRequest.phone || 'N/A',
      contact_subject: contactRequest.subject,
      contact_message: contactRequest.message,
      contact_date: new Date(contactRequest.createdAt).toLocaleDateString(),
      contact_time: new Date(contactRequest.createdAt).toLocaleTimeString(),
      admin_url: `${process.env.ADMIN_URL || process.env.FRONTEND_URL}/admin/contact-requests/${contactRequest.id}`,
      current_date: new Date().toLocaleDateString(),
      ticket_id: contactRequest.ticketNumber, // Use the stored ticket number
      support_email: contactInfo.email, // Use from website settings
      support_phone: contactInfo.phone, // Use from website settings
      ...additionalData
    };

    console.log(`Sending company notification for contact request to ${COMPANY_EMAILS.length} recipients`);

    // Send to all company emails
    for (const companyEmail of COMPANY_EMAILS) {
      try {
        await queueAutomationEmails(
          'CONTACT_US_REQUEST', 
          null, // No specific user ID
          null, // No order ID
          companyTemplateData,
          prisma,
          companyEmail // Override recipient
        );
        console.log(`✅ Contact request notification sent to ${companyEmail}`);
      } catch (error) {
        console.error(`❌ Failed to send contact request notification to ${companyEmail}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in sendCompanyNotification for contact:', error);
  }
};

// Helper function to send status update email to customer
const sendStatusUpdateEmail = async (contactRequest, oldStatus, newStatus, prisma) => {
  try {
    console.log(`Sending status update email for ticket ${contactRequest.ticketNumber}`);
    
    // Get contact info from website settings
    const contactInfo = await getContactInfoFromSettings(prisma);
    
    const statusColors = {
      'PENDING': '#f59e0b',
      'PROCESSING': '#3b82f6', 
      'COMPLETED': '#10b981',
      'CANCELLED': '#ef4444'
    };

    const statusUpdateData = {
      customer_name: contactRequest.name,
      customer_email: contactRequest.email,
      ticket_id: contactRequest.ticketNumber,
      old_status: oldStatus,
      new_status: newStatus,
      status_color: statusColors[newStatus] || '#6b7280',
      update_timestamp: new Date().toLocaleString(),
      support_email: contactInfo.email, // Use from website settings
      support_phone: contactInfo.phone, // Use from website settings
      website_url: process.env.FRONTEND_URL || 'https://evergreenpharma.us'
    };

    await queueAutomationEmails(
      'CONTACT_STATUS_UPDATE',
      null,
      null,
      statusUpdateData,
      prisma,
      contactRequest.email
    );

    console.log(`✅ Status update email sent to ${contactRequest.email}`);
  } catch (error) {
    console.error('❌ Failed to send status update email:', error);
  }
};

// @desc    Create contact request
// @route   POST /api/contact-requests
// @access  Public
async function createContactRequest(req, res, next) {
  try {
    console.log('Creating contact request with data:', req.body);
    
    const { name, email, phone, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, subject, and message are required'
      });
    }

    // Email validation
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    // Check if prisma and contactRequest model are available
    if (!req.prisma) {
      console.error('Prisma client not available on request object');
      return res.status(500).json({
        success: false,
        error: 'Database connection error: Prisma client missing'
      });
    }

    if (!req.prisma.contactRequest) {
      console.error('ContactRequest model not available on Prisma client');
      console.log('Available models:', Object.keys(req.prisma).filter(key => !key.startsWith('_')));
      return res.status(500).json({
        success: false,
        error: 'Database configuration error: ContactRequest model not found. Please run "npx prisma generate" and "npx prisma db push"'
      });
    }

    // Generate ticket number
    const ticketNumber = generateTicketNumber();
    console.log(`Generated ticket number: ${ticketNumber}`);

    const contactRequest = await req.prisma.contactRequest.create({
      data: {
        name,
        email,
        phone: phone || null,
        subject,
        message,
        ticketNumber // Store the ticket number
      }
    });

    console.log('Contact request created successfully:', contactRequest.id);

    // Get contact info from website settings
    const contactInfo = await getContactInfoFromSettings(req.prisma);

    // Send confirmation email to customer
    try {
      await queueAutomationEmails('CONTACT_US_CONFIRMATION', null, null, {
        customer_name: name,
        customer_email: email,
        contact_subject: subject,
        contact_message: message,
        support_email: contactInfo.email, // Use from website settings
        support_phone: contactInfo.phone, // Use from website settings
        current_date: new Date().toLocaleDateString(),
        ticket_id: ticketNumber // Use the same ticket number
      }, req.prisma, email);
      
      console.log('Contact confirmation email sent to customer');
    } catch (emailError) {
      console.error('Failed to send contact confirmation email:', emailError);
    }

    // Send notification to company
    try {
      await sendCompanyNotification(contactRequest, 'CONTACT_US_REQUEST', {}, req.prisma);
      console.log('Contact request notification sent to company');
    } catch (notificationError) {
      console.error('Failed to send company notification:', notificationError);
    }

    res.status(201).json({
      success: true,
      data: contactRequest,
      message: 'Contact request submitted successfully'
    });
  } catch (error) {
    console.error('Error in createContactRequest:', error);
    next(error);
  }
}

// @desc    Update contact request status
// @route   PUT /api/contact-requests/:id
// @access  Private/Admin
async function updateContactRequest(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const validStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    // Check if prisma and contactRequest model are available
    if (!req.prisma || !req.prisma.contactRequest) {
      console.error('Prisma client or ContactRequest model not available');
      return res.status(500).json({
        success: false,
        error: 'Database configuration error'
      });
    }

    // First, check if the contact request exists
    const existingRequest = await req.prisma.contactRequest.findUnique({ 
      where: { id } 
    });
    
    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Contact request not found'
      });
    }

    const oldStatus = existingRequest.status;

    const data = {
      status
    };

    const request = await req.prisma.contactRequest.update({
      where: { id },
      data
    });

    // Send status update email to customer if status changed
    if (oldStatus !== status) {
      try {
        await sendStatusUpdateEmail(request, oldStatus, status, req.prisma);
        console.log(`Status update email sent for ticket ${request.ticketNumber}`);
      } catch (emailError) {
        console.error('Failed to send status update email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({
      success: true,
      data: request,
      message: 'Contact request updated successfully'
    });
  } catch (error) {
    console.error('Error in updateContactRequest:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Contact request not found'
      });
    }
    next(error);
  }
}

// @desc    Get all contact requests
// @route   GET /api/contact-requests
// @access  Private/Admin
async function getContactRequests(req, res, next) {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    // Check if prisma and contactRequest model are available
    if (!req.prisma || !req.prisma.contactRequest) {
      console.error('Prisma client or ContactRequest model not available');
      return res.status(500).json({
        success: false,
        error: 'Database configuration error'
      });
    }

    // Build where clause
    const where = {};
    
    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      // Remove 'mode: 'insensitive'' as it's not supported in current Prisma version
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { subject: { contains: search } },
        { message: { contains: search } },
        { ticketNumber: { contains: search } }
      ];
    }

    console.log('Fetching contact requests with where:', where);

    const [requests, total] = await Promise.all([
      req.prisma.contactRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      req.prisma.contactRequest.count({ where })
    ]);

    console.log(`Found ${requests.length} contact requests out of ${total} total`);

    res.json({
      success: true,
      data: requests,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Error in getContactRequests:', error);
    next(error);
  }
}

// @desc    Get single contact request
// @route   GET /api/contact-requests/:id
// @access  Private/Admin
async function getContactRequest(req, res, next) {
  try {
    const id = Number(req.params.id);

    // Check if prisma and contactRequest model are available
    if (!req.prisma || !req.prisma.contactRequest) {
      console.error('Prisma client or ContactRequest model not available');
      return res.status(500).json({
        success: false,
        error: 'Database configuration error'
      });
    }

    const request = await req.prisma.contactRequest.findUnique({
      where: { id }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Contact request not found'
      });
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    console.error('Error in getContactRequest:', error);
    next(error);
  }
}

// @desc    Delete contact request
// @route   DELETE /api/contact-requests/:id
// @access  Private/Admin
async function deleteContactRequest(req, res, next) {
  try {
    const id = Number(req.params.id);

    // Check if prisma and contactRequest model are available
    if (!req.prisma || !req.prisma.contactRequest) {
      console.error('Prisma client or ContactRequest model not available');
      return res.status(500).json({
        success: false,
        error: 'Database configuration error'
      });
    }

    // First, check if the contact request exists
    const existingRequest = await req.prisma.contactRequest.findUnique({ 
      where: { id } 
    });
    
    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Contact request not found'
      });
    }

    await req.prisma.contactRequest.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Contact request deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteContactRequest:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Contact request not found'
      });
    }
    next(error);
  }
}

// @desc    Get contact requests stats
// @route   GET /api/contact-requests/stats
// @access  Private/Admin
async function getContactRequestStats(req, res, next) {
  try {
    // Check if prisma and contactRequest model are available
    if (!req.prisma || !req.prisma.contactRequest) {
      console.error('Prisma client or ContactRequest model not available');
      return res.status(500).json({
        success: false,
        error: 'Database configuration error'
      });
    }

    const stats = await req.prisma.contactRequest.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });

    const total = await req.prisma.contactRequest.count();
    const pending = await req.prisma.contactRequest.count({
      where: { status: 'PENDING' }
    });

    // Get today's requests
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayRequests = await req.prisma.contactRequest.count({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd
        }
      }
    });

    res.json({
      success: true,
      data: {
        byStatus: stats,
        total,
        pending,
        todayRequests
      }
    });
  } catch (error) {
    console.error('Error in getContactRequestStats:', error);
    next(error);
  }
}

module.exports = {
  createContactRequest,
  getContactRequests,
  getContactRequest,
  updateContactRequest,
  deleteContactRequest,
  getContactRequestStats
};