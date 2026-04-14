// src/services/emailAutomationService.js
const { processTemplateVariables } = require('../utils/templateProcessor');

const queueAutomationEmails = async (trigger, userId, orderId, variables = {}, prisma, overrideRecipient = null) => {
  try {
    console.log(`Triggering automation: ${trigger} for user: ${userId}, order: ${orderId}`);

    // Use passed prisma instance or create new one
    if (!prisma) {
      const { PrismaClient } = require('@prisma/client');
      prisma = new PrismaClient();
    }

    let user = null;
    if (userId) {
      user = await prisma.user.findFirst({
        where: {
          id: userId,
          isDeleted: false,
          isActive: true
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true
        }
      });
    }

    let order = null;
    if (orderId) {
      order = await prisma.order.findFirst({
        where: {
          id: orderId
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          orderItems: {
            include: {
              product: {
                select: {
                  name: true,
                  sku: true,
                  price: true
                }
              },
              variantOption: {
                select: {
                  label: true
                }
              }
            }
          }
        }
      });
    }

    // If no user from order, try to get from parameters
    if (!user && order?.user) {
      user = order.user;
    }

    // Find active automation rules for this trigger
    const rules = await prisma.automationRule.findMany({
      where: {
        trigger,
        status: 'active', // Changed from enum to string
        isDeleted: false,
        template: {
          status: 'active', // Changed from enum to string
          isDeleted: false
        }
      },
      include: {
        template: true
      },
      orderBy: { priority: 'desc' }
    });

    if (rules.length === 0) {
      console.log(`No active automation rules found for trigger: ${trigger}`);
      return {
        success: true,
        message: 'No active automation rules found for this trigger',
        queued: 0
      };
    }

    const queuedEmails = [];

    for (const rule of rules) {
      if (!rule.template) {
        console.warn(`Template not found for rule: ${rule.name}`);
        continue;
      }

      // Check conditions if any
      if (rule.conditions) {
        const conditions = JSON.parse(rule.conditions);
        const conditionsMet = await checkRuleConditions(conditions, { user, order, variables });
        if (!conditionsMet) {
          console.log(`Conditions not met for rule: ${rule.name}`);
          continue;
        }
      }

      // Calculate scheduled time
      const scheduledFor = new Date();
      scheduledFor.setHours(scheduledFor.getHours() + rule.delayHours);

      // Build default variables
      const defaultVariables = await buildDefaultVariables(trigger, user, order, variables, prisma);

      // Process template with variables
      const processedSubject = processTemplateVariables(rule.template.subject, defaultVariables);
      const processedBody = processTemplateVariables(rule.template.body, defaultVariables);

      // Use override recipient if provided, otherwise use user email
      const recipientEmail = overrideRecipient || user?.email || variables.recipientEmail;

      if (!recipientEmail) {
        console.warn(`No recipient email found for automation rule: ${rule.name}`);
        continue;
      }

      try {
        const queuedEmail = await prisma.queuedEmail.create({
          data: {
            ruleId: rule.id,
            templateId: rule.template.id,
            userId: user?.id,
            orderId: order?.id,
            recipientEmail,
            subject: processedSubject,
            body: processedBody,
            variables: JSON.stringify(defaultVariables),
            scheduledFor,
            status: 'pending', // Changed from enum to string
            maxAttempts: rule.maxAttempts
          }
        });

        queuedEmails.push(queuedEmail);
        console.log(`Queued email for rule "${rule.name}" to ${recipientEmail}, scheduled for: ${scheduledFor}`);
      } catch (emailError) {
        console.error(`Failed to queue email for rule ${rule.name}:`, emailError);
      }
    }

    return {
      success: true,
      message: `Queued ${queuedEmails.length} emails for processing`,
      queued: queuedEmails.length,
      emails: queuedEmails
    };
  } catch (error) {
    console.error('Queue automation emails error:', error);
    throw new Error(`Failed to queue automation emails: ${error.message}`);
  }
};

const checkRuleConditions = async (conditions, context) => {
  const { user, order, variables } = context;

  for (const condition of conditions) {
    const { field, operator, value } = condition;

    let actualValue;

    // Get value based on field path
    switch (field) {
      case 'user.isActive':
        actualValue = user?.isActive;
        break;
      case 'order.totalAmount':
        actualValue = order?.totalAmount;
        break;
      case 'order.items.count':
        actualValue = order?.orderItems?.length;
        break;
      case 'user.registrationDate':
        actualValue = user?.createdAt;
        break;
      case 'order.status':
        actualValue = order?.status;
        break;
      case 'order.paymentStatus':
        actualValue = order?.paymentStatus;
        break;
      default:
        actualValue = variables[field];
    }

    // Apply operator
    switch (operator) {
      case 'equals':
        if (actualValue != value) return false;
        break;
      case 'not_equals':
        if (actualValue == value) return false;
        break;
      case 'greater_than':
        if (!actualValue || actualValue <= value) return false;
        break;
      case 'less_than':
        if (!actualValue || actualValue >= value) return false;
        break;
      case 'contains':
        if (!actualValue || !actualValue.includes(value)) return false;
        break;
      case 'in':
        if (!value.includes(actualValue)) return false;
        break;
    }
  }

  return true;
};

const buildDefaultVariables = async (trigger, user, order, customVariables, prisma) => {
  // Parse shipping address from JSON
  let shippingAddressString = '';
  if (order?.shippingAddress) {
    try {
      const shippingAddress = typeof order.shippingAddress === 'string'
        ? JSON.parse(order.shippingAddress)
        : order.shippingAddress;

      shippingAddressString = [
        shippingAddress.streetAddress || shippingAddress.street,
        shippingAddress.city,
        shippingAddress.state,
        shippingAddress.zipCode || shippingAddress.postalCode
      ].filter(Boolean).join(', ');
    } catch (error) {
      console.error('Error parsing shipping address:', error);
      shippingAddressString = 'Address not available';
    }
  }

  // Get website settings for contact info
  let websiteSettings = null;
  try {
    websiteSettings = await prisma.websiteSettings.findFirst({
      where: { isActive: true }
    });
  } catch (error) {
    console.error('Error fetching website settings:', error);
  }

  // Get contact info from settings or use defaults
  let contactInfo = {
    phone: '+1-555-111111',
    email: 'support@evergreenpharma.us'
  };

  if (websiteSettings?.footerContactInfo) {
    try {
      const footerContactInfo = typeof websiteSettings.footerContactInfo === 'string'
        ? JSON.parse(websiteSettings.footerContactInfo)
        : websiteSettings.footerContactInfo;

      if (footerContactInfo.phone) contactInfo.phone = footerContactInfo.phone;
      if (footerContactInfo.email) contactInfo.email = footerContactInfo.email;
    } catch (error) {
      console.error('Error parsing footer contact info:', error);
    }
  }

  const variables = {
    // User variables
    customer_name: user ? `${user.firstName} ${user.lastName}` : 'Customer',
    customer_first_name: user?.firstName || 'Customer',
    customer_email: user?.email,
    customer_phone: user?.phoneNumber,

    // Order variables
    order_id: order?.orderNumber,
    order_date: order?.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    order_total: order?.totalAmount ? `$${order.totalAmount.toFixed(2)}` : '$0.00',
    order_status: order?.status,
    payment_status: order?.paymentStatus,
    payment_method: order?.paymentMethod,

    // System variables
    current_date: new Date().toISOString().split('T')[0],
    current_year: new Date().getFullYear(),
    site_name: 'Evergreen Pharma',
    support_email: contactInfo.email,
    support_phone: contactInfo.phone,
    website_url: process.env.FRONTEND_URL || 'https://evergreenpharma.us',
    admin_url: process.env.ADMIN_URL || process.env.FRONTEND_URL || 'https://evergreenpharma.us',

    // Tracking URLs
    order_tracking_url: order ? `${process.env.FRONTEND_URL}/account/orders/${order.id}` : '#',
    tracking_url: order ? `${process.env.FRONTEND_URL}/account/orders/${order.id}` : '#',
    account_url: `${process.env.FRONTEND_URL}/account`,
    shop_url: `${process.env.FRONTEND_URL}/shop`,
    unsubscribe_url: `${process.env.FRONTEND_URL}/unsubscribe`,
    support_url: `${process.env.FRONTEND_URL}/contact`,
    review_url: order ? `${process.env.FRONTEND_URL}/account/orders/${order.id}/review` : '#',

    // Shipping address (from JSON field)
    shipping_address: shippingAddressString,

    // Payment variables
    amount_paid: order?.totalAmount ? `$${order.totalAmount.toFixed(2)}` : '$0.00',
    transaction_id: order?.transactionId || 'N/A',

    ...customVariables
  };

  // Add order-specific variables
  if (order) {
    // Build order items string
    variables.order_items = order.orderItems?.map(item => {
      const productName = item.product?.name || item.productName;
      const price = item.unitPrice || 0;
      return `${item.quantity}x ${productName} - $${price.toFixed(2)}`;
    }).join('\n') || '';

    // Add order items count
    variables.order_items_count = order.orderItems?.length || 0;

    // Build order items table for company notifications
    variables.order_items_table = order.orderItems?.map(item => {
      const productName = item.product?.name || item.productName;
      const variant = item.variantOption?.label ? ` (${item.variantOption.label})` : '';
      const price = item.unitPrice || 0;
      const total = (item.quantity * price).toFixed(2);
      return `
        <div class="item-row">
          <div class="item-name">${productName}${variant}</div>
          <div class="item-qty">${item.quantity}</div>
          <div class="item-price">$${total}</div>
        </div>
      `;
    }).join('') || '';
  }

  // Add trigger-specific variables
  switch (trigger) {
    case 'ORDER_PLACED':
      variables.order_tracking_url = order ? `${process.env.FRONTEND_URL}/orders/${order.id}` : '#';
      break;

    case 'ORDER_PENDING':
      variables.order_status = 'pending';
      break;

    case 'ORDER_CONFIRMED':
      variables.order_status = 'confirmed';
      break;

    case 'ORDER_PROCESSING':
      variables.order_status = 'processing';
      break;

    case 'ORDER_SHIPPED':
      variables.tracking_number = customVariables.tracking_number || order?.trackingNumber || 'N/A';
      variables.shipping_carrier = customVariables.shipping_carrier || order?.shippingMethod || 'Standard Shipping';
      variables.estimated_delivery = customVariables.estimated_delivery ||
        (order?.estimatedDelivery ? order.estimatedDelivery.toISOString().split('T')[0] : '3-5 business days');
      variables.tracking_link = customVariables.tracking_link ||
        (order?.trackingNumber ? `${process.env.FRONTEND_URL}/track-order/${order.trackingNumber}` : '#');
      break;

    case 'ORDER_DELIVERED':
      variables.delivery_date = order?.deliveredAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0];
      variables.order_status = 'delivered';
      break;

    case 'ORDER_CANCELLED':
      variables.cancellation_date = new Date().toISOString().split('T')[0];
      variables.cancellation_reason = customVariables.cancellation_reason || 'Customer request';
      variables.order_status = 'cancelled';
      break;

    case 'ORDER_REFUNDED':
      variables.refund_date = new Date().toISOString().split('T')[0];
      variables.refund_amount = customVariables.refund_amount || (order?.totalAmount ? `$${order.totalAmount.toFixed(2)}` : '$0.00');
      variables.order_status = 'refunded';
      break;

    case 'ORDER_FAILED':
      variables.failure_reason = customVariables.failure_reason || 'Order processing failed';
      variables.order_status = 'failed';
      break;

    case 'PAYMENT_PENDING':
      variables.payment_status = 'pending';
      break;

    case 'PAYMENT_SUCCEEDED':
      variables.payment_date = order?.paidAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0];
      variables.payment_method = order?.paymentMethod || 'Unknown';
      variables.payment_status = 'paid';
      variables.transaction_id = customVariables.transaction_id || order?.transactionId || 'N/A';
      break;

    case 'PAYMENT_FAILED':
      variables.failure_reason = customVariables.failure_reason || 'Payment was declined';
      variables.payment_retry_url = customVariables.payment_retry_url ||
        (order ? `${process.env.FRONTEND_URL}/orders/${order.id}/payment/retry` : '#');
      variables.payment_status = 'failed';
      break;

    case 'PAYMENT_REFUNDED':
      variables.refund_date = new Date().toISOString().split('T')[0];
      variables.refund_amount = customVariables.refund_amount || (order?.totalAmount ? `$${order.totalAmount.toFixed(2)}` : '$0.00');
      variables.payment_status = 'refunded';
      break;

    case 'PAYMENT_PARTIALLY_REFUNDED':
      variables.refund_date = new Date().toISOString().split('T')[0];
      variables.refund_amount = customVariables.refund_amount || 'Partial amount';
      variables.payment_status = 'partially_refunded';
      break;

    case 'NEW_ORDER_RECEIVED':
    case 'COMPANY_NEW_ORDER':
      variables.order_items_count = order?.orderItems?.length || 0;
      variables.payment_method = order?.paymentMethod || 'Unknown';
      variables.payment_status = order?.paymentStatus || 'pending';
      variables.contact_phone = order?.contactPhone || user?.phoneNumber || 'N/A';
      break;

    case 'COMPANY_ORDER_STATUS_UPDATE':
      variables.old_status = customVariables.old_status || 'Unknown';
      variables.new_status = customVariables.new_status || 'Unknown';
      variables.updated_by = customVariables.updated_by || 'System';
      variables.update_timestamp = customVariables.update_timestamp || new Date().toLocaleString();
      variables.tracking_number = customVariables.tracking_number || order?.trackingNumber || 'N/A';
      variables.estimated_delivery = customVariables.estimated_delivery ||
        (order?.estimatedDelivery ? order.estimatedDelivery.toISOString().split('T')[0] : 'N/A');
      variables.notes = customVariables.notes || '';
      variables.status_color = customVariables.status_color || '#6b7280';
      break;

    case 'COMPANY_PAYMENT_STATUS_UPDATE':
      variables.old_payment_status = customVariables.old_payment_status || 'Unknown';
      variables.new_payment_status = customVariables.new_payment_status || 'Unknown';
      variables.payment_method = order?.paymentMethod || 'Unknown';
      variables.transaction_id = order?.transactionId || 'N/A';
      variables.payment_gateway = customVariables.payment_gateway || 'N/A';
      variables.updated_by = customVariables.updated_by || 'System';
      variables.update_timestamp = customVariables.update_timestamp || new Date().toLocaleString();
      variables.payment_color = customVariables.payment_color || '#6b7280';
      variables.requires_action = customVariables.requires_action || false;
      break;

    case 'LOW_STOCK':
    case 'COMPANY_LOW_STOCK':
      variables.product_name = customVariables.product_name || 'Product';
      variables.current_stock = customVariables.current_stock || 0;
      variables.reorder_level = customVariables.reorder_level || 10;
      variables.product_sku = customVariables.product_sku || 'N/A';
      variables.product_category = customVariables.product_category || 'Uncategorized';
      variables.last_restocked = customVariables.last_restocked || 'Never';
      variables.recommended_quantity = customVariables.recommended_quantity || 50;
      variables.inventory_url = `${process.env.ADMIN_URL}/inventory` || '#';
      break;

    case 'USER_REGISTERED':
      variables.welcome_code = 'WELCOME10';
      variables.shop_url = `${process.env.FRONTEND_URL}/shop`;
      break;

    case 'CONTACT_US_REQUEST':
      variables.contact_name = customVariables.contact_name || variables.customer_name;
      variables.contact_email = customVariables.contact_email || variables.customer_email;
      variables.contact_phone = customVariables.contact_phone || variables.customer_phone || 'N/A';
      variables.contact_subject = customVariables.contact_subject || 'Contact Request';
      variables.contact_message = customVariables.contact_message || 'No message provided';
      variables.contact_date = customVariables.contact_date || variables.current_date;
      variables.contact_time = customVariables.contact_time || new Date().toLocaleTimeString();
      variables.ticket_id = customVariables.ticket_id || `CT-${Date.now()}`;
      break;

    case 'CONTACT_US_CONFIRMATION':
      variables.customer_name = customVariables.customer_name || variables.customer_name;
      variables.customer_email = customVariables.customer_email || variables.customer_email;
      variables.contact_subject = customVariables.contact_subject || 'Contact Request';
      variables.contact_message = customVariables.contact_message || 'No message provided';
      variables.support_email = customVariables.support_email || variables.support_email;
      variables.support_phone = customVariables.support_phone || variables.support_phone;
      variables.ticket_id = customVariables.ticket_id || `CT-${Date.now()}`;
      break;

    case 'CONTACT_STATUS_UPDATE':
      variables.customer_name = customVariables.customer_name || variables.customer_name;
      variables.customer_email = customVariables.customer_email || variables.customer_email;
      variables.ticket_id = customVariables.ticket_id || 'N/A';
      variables.old_status = customVariables.old_status || 'Unknown';
      variables.new_status = customVariables.new_status || 'Unknown';
      variables.status_color = customVariables.status_color || '#6b7280';
      variables.update_timestamp = customVariables.update_timestamp || new Date().toLocaleString();
      variables.support_email = customVariables.support_email || variables.support_email;
      variables.support_phone = customVariables.support_phone || variables.support_phone;
      break;
  }

  return variables;
};

// Manual email sending (for admin purposes)
const sendManualEmail = async (templateId, recipientEmail, variables = {}, prisma) => {
  try {
    // Use passed prisma instance or create new one
    if (!prisma) {
      const { PrismaClient } = require('@prisma/client');
      prisma = new PrismaClient();
    }

    const template = await prisma.emailTemplate.findFirst({
      where: {
        id: templateId,
        isDeleted: false,
        status: 'active' // Changed from enum to string
      }
    });

    if (!template) {
      throw new Error('Email template not found or inactive');
    }

    // Build variables
    const defaultVariables = await buildDefaultVariables('CUSTOM', null, null, variables, prisma);
    const processedSubject = processTemplateVariables(template.subject, defaultVariables);
    const processedBody = processTemplateVariables(template.body, defaultVariables);

    const queuedEmail = await prisma.queuedEmail.create({
      data: {
        templateId: template.id,
        recipientEmail,
        subject: processedSubject,
        body: processedBody,
        variables: JSON.stringify(defaultVariables),
        scheduledFor: new Date(),
        status: 'pending' // Changed from enum to string
      }
    });

    return {
      success: true,
      message: 'Email queued for sending',
      emailId: queuedEmail.id
    };
  } catch (error) {
    console.error('Send manual email error:', error);
    throw new Error(`Failed to send manual email: ${error.message}`);
  }
};

// Get available triggers for frontend
const getAvailableTriggers = () => {
  return {
    ORDER_STATUS: [
      'ORDER_PLACED',
      'ORDER_PENDING',
      'ORDER_CONFIRMED',
      'ORDER_PROCESSING',
      'ORDER_SHIPPED',
      'ORDER_DELIVERED',
      'ORDER_CANCELLED',
      'ORDER_REFUNDED',
      'ORDER_FAILED'
    ],
    PAYMENT_STATUS: [
      'PAYMENT_PENDING',
      'PAYMENT_SUCCEEDED',
      'PAYMENT_FAILED',
      'PAYMENT_REFUNDED',
      'PAYMENT_PARTIALLY_REFUNDED'
    ],
    COMPANY_NOTIFICATIONS: [
      'NEW_ORDER_RECEIVED',
      'COMPANY_NEW_ORDER',
      'COMPANY_ORDER_STATUS_UPDATE',
      'COMPANY_PAYMENT_STATUS_UPDATE',
      'COMPANY_LOW_STOCK',
      'CONTACT_US_REQUEST'
    ],
    USER_EVENTS: [
      'USER_REGISTERED',
      'CONTACT_US_CONFIRMATION',
      'CONTACT_STATUS_UPDATE'
    ],
    INVENTORY_EVENTS: [
      'LOW_STOCK',
      'OUT_OF_STOCK'
    ],
    FOLLOW_UP: [
      'DELIVERY_FOLLOW_UP'
    ]
  };
};

// Get template variables for a specific trigger
const getTemplateVariablesForTrigger = (trigger) => {
  const commonVariables = [
    'customer_name',
    'customer_first_name',
    'customer_email',
    'order_id',
    'order_total',
    'order_date',
    'order_status',
    'payment_status',
    'shipping_address',
    'support_url',
    'website_url',
    'support_phone',
    'support_email',
    'current_date',
    'current_year'
  ];

  const triggerSpecificVariables = {
    'ORDER_PLACED': ['order_tracking_url', 'order_items'],
    'ORDER_SHIPPED': ['tracking_number', 'tracking_link', 'shipping_carrier', 'estimated_delivery'],
    'ORDER_DELIVERED': ['delivery_date', 'review_url'],
    'ORDER_CANCELLED': ['cancellation_date', 'cancellation_reason'],
    'ORDER_REFUNDED': ['refund_date', 'refund_amount'],
    'ORDER_FAILED': ['failure_reason'],
    'PAYMENT_SUCCEEDED': ['payment_date', 'payment_method', 'transaction_id'],
    'PAYMENT_FAILED': ['failure_reason', 'payment_retry_url'],
    'PAYMENT_REFUNDED': ['refund_date', 'refund_amount'],
    'PAYMENT_PARTIALLY_REFUNDED': ['refund_date', 'refund_amount', 'order_total'],
    'NEW_ORDER_RECEIVED': ['order_items_count', 'payment_method', 'payment_status', 'contact_phone', 'admin_url', 'order_items_table'],
    'COMPANY_NEW_ORDER': ['order_items_count', 'payment_method', 'payment_status', 'contact_phone', 'admin_url', 'order_items_table'],
    'COMPANY_ORDER_STATUS_UPDATE': ['old_status', 'new_status', 'updated_by', 'update_timestamp', 'tracking_number', 'estimated_delivery', 'notes', 'admin_url', 'status_color'],
    'COMPANY_PAYMENT_STATUS_UPDATE': ['old_payment_status', 'new_payment_status', 'payment_method', 'transaction_id', 'payment_gateway', 'update_timestamp', 'admin_url', 'payment_color', 'requires_action'],
    'COMPANY_LOW_STOCK': ['product_name', 'current_stock', 'reorder_level', 'product_sku', 'product_category', 'last_restocked', 'recommended_quantity', 'inventory_url'],
    'LOW_STOCK': ['product_name', 'current_stock', 'reorder_level'],
    'USER_REGISTERED': ['welcome_code', 'shop_url'],
    'CONTACT_US_REQUEST': [
      'contact_name',
      'contact_email',
      'contact_phone',
      'contact_subject',
      'contact_message',
      'contact_date',
      'contact_time',
      'admin_url',
      'ticket_id'
    ],
    'CONTACT_US_CONFIRMATION': [
      'customer_name',
      'customer_email',
      'contact_subject',
      'contact_message',
      'support_email',
      'support_phone',
      'ticket_id',
      'website_url'
    ],
    'CONTACT_STATUS_UPDATE': [
      'customer_name',
      'customer_email',
      'ticket_id',
      'old_status',
      'new_status',
      'status_color',
      'update_timestamp',
      'support_email',
      'support_phone',
      'website_url'
    ]
  };

  return [...commonVariables, ...(triggerSpecificVariables[trigger] || [])];
};

module.exports = {
  queueAutomationEmails,
  sendManualEmail,
  buildDefaultVariables,
  getAvailableTriggers,
  getTemplateVariablesForTrigger
};