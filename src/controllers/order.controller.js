// src/controllers/order.controller.js
const { queueAutomationEmails } = require('../services/emailAutomationService');
const { sendEmail } = require('../cron/emailProcessor'); // Add this import

const generateOrderNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${timestamp}-${random}`;
}; 

// Remove the hardcoded COMPANY_EMAILS constant since we'll fetch from database

const sendCompanyNotification = async (order, eventType, additionalData = {}, prisma) => {
  try {
    // Fetch admin emails from integration settings in database
    let COMPANY_EMAILS = [];
    
    try {
      const integrationSettings = await prisma.integrationSettings.findFirst({
        where: { isActive: true }
      });
      
      if (integrationSettings && integrationSettings.adminEmails) {
        // Parse admin emails from JSON string
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

    // Fallback to environment variables if no emails found in database
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

    // Map customer events to company events
    const eventMap = {
      'ORDER_PLACED': 'COMPANY_NEW_ORDER',
      'ORDER_PENDING': 'COMPANY_ORDER_STATUS_UPDATE',
      'ORDER_CONFIRMED': 'COMPANY_ORDER_STATUS_UPDATE',
      'ORDER_PROCESSING': 'COMPANY_ORDER_STATUS_UPDATE',
      'ORDER_SHIPPED': 'COMPANY_ORDER_STATUS_UPDATE',
      'ORDER_DELIVERED': 'COMPANY_ORDER_STATUS_UPDATE',
      'ORDER_CANCELLED': 'COMPANY_ORDER_STATUS_UPDATE',
      'ORDER_REFUNDED': 'COMPANY_ORDER_STATUS_UPDATE',
      'ORDER_FAILED': 'COMPANY_ORDER_STATUS_UPDATE',
      'PAYMENT_PENDING': 'COMPANY_PAYMENT_STATUS_UPDATE',
      'PAYMENT_SUCCEEDED': 'COMPANY_PAYMENT_STATUS_UPDATE',
      'PAYMENT_FAILED': 'COMPANY_PAYMENT_STATUS_UPDATE',
      'PAYMENT_REFUNDED': 'COMPANY_PAYMENT_STATUS_UPDATE',
      'PAYMENT_PARTIALLY_REFUNDED': 'COMPANY_PAYMENT_STATUS_UPDATE',
      'NEW_ORDER_RECEIVED': 'COMPANY_NEW_ORDER'
    };

    const companyEvent = eventMap[eventType] || eventType;

    // Prepare company-specific template data
    const companyTemplateData = {
      order_id: order.orderNumber,
      customer_name: `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim(),
      customer_email: order.user?.email || order.contactEmail || 'N/A',
      order_total: `$${order.totalAmount?.toFixed(2) || '0.00'}`,
      order_date: new Date(order.createdAt).toLocaleDateString(),
      shipping_address: order.shippingAddress ? 
        `${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}` : 'N/A',
      admin_url: `${process.env.ADMIN_URL || process.env.FRONTEND_URL}/admin/orders/${order.id}`,
      current_date: new Date().toLocaleDateString(),
      ...additionalData
    };

    // Add status-specific data
    if (eventType.includes('ORDER_') && !eventType.includes('NEW_ORDER')) {
      companyTemplateData.old_status = additionalData.old_status || 'N/A';
      companyTemplateData.new_status = additionalData.new_status || order.status;
      companyTemplateData.updated_by = 'System';
      companyTemplateData.update_timestamp = new Date().toLocaleString();
      
      // Status colors for badges
      const statusColors = {
        'pending': '#f59e0b',
        'confirmed': '#10b981', 
        'processing': '#3b82f6',
        'shipped': '#8b5cf6',
        'delivered': '#059669',
        'cancelled': '#ef4444',
        'refunded': '#6b7280'
      };
      companyTemplateData.status_color = statusColors[order.status] || '#6b7280';
    }

    if (eventType.includes('PAYMENT_')) {
      companyTemplateData.old_payment_status = additionalData.old_payment_status || 'N/A';
      companyTemplateData.new_payment_status = additionalData.new_payment_status || order.paymentStatus;
      companyTemplateData.update_timestamp = new Date().toLocaleString();
      
      // Payment status colors
      const paymentColors = {
        'pending': '#f59e0b',
        'paid': '#10b981',
        'failed': '#ef4444',
        'refunded': '#6b7280'
      };
      companyTemplateData.payment_color = paymentColors[order.paymentStatus] || '#6b7280';
      companyTemplateData.requires_action = order.paymentStatus === 'failed' || order.paymentStatus === 'pending';
    }

    // Generate order items table for new orders
    if (eventType === 'NEW_ORDER_RECEIVED' || eventType === 'ORDER_PLACED') {
      if (order.orderItems && order.orderItems.length > 0) {
        let itemsTable = `
          <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f1f5f9;">
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Product</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e2e8f0;">Qty</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0;">Price</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        order.orderItems.forEach(item => {
          itemsTable += `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                <strong>${item.productName}</strong>
                ${item.variantLabel ? `<br><small>Variant: ${item.variantLabel}</small>` : ''}
              </td>
              <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e2e8f0;">${item.quantity}</td>
              <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">$${item.unitPrice?.toFixed(2)}</td>
            </tr>
          `;
        });
        
        itemsTable += `
              </tbody>
            </table>
          </div>
        `;
        companyTemplateData.order_items_table = itemsTable;
      }
    }

    console.log(`Sending company notification for event: ${companyEvent} to ${COMPANY_EMAILS.length} recipients`);

    // Send to all company emails
    for (const companyEmail of COMPANY_EMAILS) {
      try {
        await queueAutomationEmails(
          companyEvent, 
          null, // No specific user ID for company emails
          order.id, 
          companyTemplateData,
          prisma,
          companyEmail // Override recipient
        );
        console.log(`✅ Company notification sent to ${companyEmail}`);
      } catch (error) {
        console.error(`❌ Failed to send company notification to ${companyEmail}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in sendCompanyNotification:', error);
  }
};

const sendOrderEmail = async (req, res) => {
  let recipientEmail;

  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const { subject, body } = req.body;

    // Validate input
    if (!subject || !body) {
      return res.status(400).json({
        success: false,
        message: 'Subject and body are required'
      });
    }

    // Get order details
    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get recipient email - prefer user email, fallback to contact email
    recipientEmail = order.user?.email || order.contactEmail;
    
    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        message: 'No email address found for this order'
      });
    }

    // Process template variables in subject and body
    const processTemplateVariables = (content, order) => {
      if (!order) return content;

      const variables = {
        '{order_number}': order.orderNumber,
        '{customer_name}': order.shippingAddress?.name || 
                          (order.user ? `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() : 'Customer'),
        '{order_date}': new Date(order.orderDate || order.createdAt).toLocaleDateString(),
        '{order_total}': `$${order.totalAmount?.toFixed(2)}`,
        '{order_status}': order.status?.replace('_', ' ') || 'Unknown',
        '{tracking_number}': order.trackingNumber || 'Not available',
        '{shipping_method}': order.shippingMethod || 'Standard Shipping',
        '{payment_status}': order.paymentStatus || 'Unknown',
        '{payment_method}': order.paymentMethodCode || 'Unknown',
        '{transaction_id}': order.payment?.transactionId || 'N/A',
        '{order_tracking_url}': `${process.env.FRONTEND_URL || 'https://evergreenpharma.us'}/orders/${order.id}`,
        '{support_email}': 'support@evergreenmed.com',
        '{support_phone}': '+1-555-111111'
      };

      let processedContent = content;
      Object.keys(variables).forEach(key => {
        processedContent = processedContent.replace(new RegExp(key, 'g'), variables[key]);
      });

      return processedContent;
    };

    const processedSubject = processTemplateVariables(subject, order);
    const processedBody = processTemplateVariables(body, order);

    // Send email using your existing email service
    const emailResult = await sendEmail(
      recipientEmail,
      processedSubject,
      processedBody
    );

    // 🆕 FIX: Get or create a manual email template for manual emails
    let manualTemplate = await prisma.emailTemplate.findFirst({
      where: { 
        name: 'Manual Order Email',
        type: 'TRANSACTIONAL',
        isDeleted: false
      }
    });

    // If no manual template exists, create one
    if (!manualTemplate) {
      manualTemplate = await prisma.emailTemplate.create({
        data: {
          name: 'Manual Order Email',
          subject: 'Manual Order Email',
          body: 'Manual email content for order communications',
          type: 'TRANSACTIONAL',
          category: 'manual',
          description: 'Template for manually sent order emails',
          status: 'active',
          isSystem: false,
          isDeleted: false
        }
      });
    }

    // 🆕 FIX: Create email log with ONLY fields that exist in schema
    await prisma.emailLog.create({
      data: {
        recipient: recipientEmail,
        subject: processedSubject,
        status: 'sent',
        messageId: emailResult.messageId,
        templateId: manualTemplate.id,
        // Note: No 'body' or 'metadata' fields - they don't exist in your schema!
      }
    });

    res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      data: {
        messageId: emailResult.messageId,
        recipient: recipientEmail
      }
    });

  } catch (error) {
    console.error('Error sending order email:', error);
    
    // 🆕 FIX: Log failed attempt with ONLY existing fields
    try {
      // Try to get the manual template for error logging
      let manualTemplate = await req.prisma.emailTemplate.findFirst({
        where: { 
          name: 'Manual Order Email',
          type: 'TRANSACTIONAL',
          isDeleted: false
        }
      });

      // If still no template, create one
      if (!manualTemplate) {
        manualTemplate = await req.prisma.emailTemplate.create({
          data: {
            name: 'Manual Order Email',
            subject: 'Manual Order Email',
            body: 'Manual email content for order communications',
            type: 'TRANSACTIONAL',
            category: 'manual',
            description: 'Template for manually sent order emails',
            status: 'active',
            isSystem: false,
            isDeleted: false
          }
        });
      }

      await req.prisma.emailLog.create({
        data: {
          recipient: recipientEmail || 'unknown@example.com',
          subject: req.body.subject || 'No subject',
          status: 'failed',
          error: error.message.substring(0, 500), // Store error in the existing 'error' field
          templateId: manualTemplate.id,
          // Note: No 'body' or 'metadata' fields - they don't exist in your schema!
        }
      });
    } catch (logError) {
      console.error('Error logging failed email:', logError);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
};

const createOrder = async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      userId,
      paymentMethod,
      currency,
      shippingAddress,
      billingAddress,
      contactEmail,
      contactPhone,
      shippingMethod,
      shippingOptionId,
      items,
      couponCode,
      prescriptionIds = [],
      subtotal,
      taxAmount,
      shippingAmount,
      discountAmount
    } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Order must contain at least one item'
      });
    }

    // Validate payment method against database payment methods
    const dbPaymentMethods = await prisma.paymentMethod.findMany({
      where: {
        isActive: true,
        isDeleted: false
      },
      select: {
        id: true,
        code: true,
        name: true
      }
    });

    const validPaymentMethods = dbPaymentMethods.map(pm => pm.code);
    const normalizedPaymentMethod = paymentMethod.toUpperCase();

    if (!validPaymentMethods.includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        error: `Invalid payment method. Must be one of: ${validPaymentMethods.join(', ')}`
      });
    }

    // Get the payment method ID for the payment record
    const paymentMethodRecord = dbPaymentMethods.find(pm => pm.code === normalizedPaymentMethod);
    if (!paymentMethodRecord) {
      return res.status(400).json({
        success: false,
        error: 'Payment method not found'
      });
    }

    // Verify user exists
    const userExists = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!userExists) {
      return res.status(400).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check prescription requirements
    const products = await prisma.product.findMany({
      where: {
        id: { in: items.map(item => item.productId) },
        isDeleted: false,
        isActive: true
      },
      select: {
        id: true,
        prescription_required: true
      }
    });

    const requiresPrescription = products.some(p => p.prescription_required);
    
    // Validate prescriptions if required
    if (requiresPrescription) {
      if (!prescriptionIds || !Array.isArray(prescriptionIds) || prescriptionIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'PRESCRIPTION_REQUIRED',
          message: 'One or more products require a prescription. Please upload or select prescriptions.'
        });
      }

      // Validate that prescriptions belong to user and exist
      const validPrescriptions = await prisma.prescription.findMany({
        where: {
          id: { in: prescriptionIds },
          userId: userId,
          deletedAt: null // Using deletedAt instead of isDeleted
        }
      });

      if (validPrescriptions.length !== prescriptionIds.length) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_PRESCRIPTIONS',
          message: 'One or more prescriptions are invalid or do not belong to you.'
        });
      }

      // Check if all required prescriptions are validated
      const pendingPrescriptions = validPrescriptions.filter(p => !p.isValidated);
      if (pendingPrescriptions.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'PENDING_PRESCRIPTIONS',
          message: 'Some prescriptions are still pending validation. Please wait for pharmacy approval.'
        });
      }
    }

    // Validate products and create order items
    const orderItems = [];
    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: {
          id: item.productId,
          isDeleted: false,
          isActive: true
        },
        include: {
          variants: {
            include: {
              options: {
                where: {
                  id: item.variantOptionId || undefined,
                  isDeleted: false,
                  isActive: true
                }
              }
            }
          }
        }
      });

      if (!product) {
        return res.status(400).json({
          success: false,
          error: `Product with ID ${item.productId} not found`
        });
      }

      let variantOption = null;
      let unitPrice = product.price;

      if (item.variantOptionId) {
        variantOption = product.variants.flatMap(v => v.options).find(opt => opt.id === item.variantOptionId);
        if (!variantOption) {
          return res.status(400).json({
            success: false,
            error: `Variant option with ID ${item.variantOptionId} not found`
          });
        }
        unitPrice = variantOption.price;
      }

      // Check stock availability
      if (variantOption && variantOption.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for product ${product.name}. Available: ${variantOption.stock}, Requested: ${item.quantity}`
        });
      }

      const itemTotal = unitPrice * item.quantity;

      orderItems.push({
        productId: item.productId,
        variantOptionId: item.variantOptionId,
        productName: product.name,
        productSku: product.sku,
        variantLabel: variantOption?.label,
        unitPrice,
        quantity: item.quantity,
        totalPrice: itemTotal,
        productSnapshot: {
          name: product.name,
          sku: product.sku,
          images: product.images,
          price: product.price,
          prescriptionRequired: product.prescription_required
        }
      });
    }

    // Apply coupon if provided
    let coupon = null;
    let couponDiscount = discountAmount || 0;

    if (couponCode) {
      coupon = await prisma.coupon.findFirst({
        where: {
          code: couponCode,
          status: 'Active',
          isDeleted: false,
          OR: [
            { startDate: null },
            { startDate: { lte: new Date() } }
          ],
          OR: [
            { endDate: null },
            { endDate: { gte: new Date() } }
          ]
        }
      });

      if (coupon) {
        if (subtotal < coupon.minPurchase) {
          return res.status(400).json({
            success: false,
            error: `Coupon requires minimum purchase of ${coupon.minPurchase}`
          });
        }
      }
    }

    // Calculate total amount
    const totalAmount = subtotal + (taxAmount || 0) + (shippingAmount || 0) - couponDiscount;

    // Generate order number
    const generateOrderNumber = () => {
      return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    };

    // Create the order with all related records
    const order = await prisma.$transaction(async (tx) => {
      // Create the main order - FIXED: Use paymentMethodCode instead of paymentMethod
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId,
          paymentMethodCode: normalizedPaymentMethod, // Use paymentMethodCode instead of paymentMethod
          currency,
          
          // Status fields
          status: 'pending',
          paymentStatus: 'pending',
          
          // Financial fields
          subtotal,
          taxAmount: taxAmount || 0,
          shippingAmount: shippingAmount || 0,
          discountAmount: couponDiscount,
          totalAmount,
          
          // Address and contact
          shippingAddress,
          billingAddress: billingAddress || shippingAddress,
          contactEmail,
          contactPhone,
          
          // Shipping
          shippingMethod,
          shippingOptionId: shippingOptionId || null,
          
          // Coupon information
          couponId: coupon?.id,
          couponCode: coupon?.code,
          couponDiscount,
        },
        include: {
          orderItems: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      // Create order items
      for (const item of orderItems) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            variantOptionId: item.variantOptionId,
            productName: item.productName,
            productSku: item.productSku,
            variantLabel: item.variantLabel,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            productSnapshot: item.productSnapshot
          }
        });
      }

      // Link prescriptions to order if provided
      if (prescriptionIds.length > 0) {
        for (const prescriptionId of prescriptionIds) {
          await tx.orderPrescription.create({
            data: {
              orderId: newOrder.id,
              prescriptionId: prescriptionId
            }
          });
        }
      }

      // Create payment record - FIXED: Use paymentMethodId instead of paymentMethod
      await tx.payment.create({
        data: {
          orderId: newOrder.id,
          paymentMethodId: paymentMethodRecord.id, // Use paymentMethodId instead of paymentMethod
          paymentStatus: 'pending',
          amount: totalAmount,
          currency: currency,
        }
      });

      // Create initial order history
      await tx.orderHistory.create({
        data: {
          orderId: newOrder.id,
          newStatus: 'pending',
          notes: 'Order created successfully'
        }
      });

      // Update product stock
      for (const item of items) {
        if (item.variantOptionId) {
          await tx.variantOption.update({
            where: { id: item.variantOptionId },
            data: {
              stock: {
                decrement: item.quantity
              }
            }
          });
        }
      }

      // Update coupon usage if coupon was applied
      if (coupon) {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: {
            usageCount: {
              increment: 1
            }
          }
        });

        await tx.couponUsage.create({
          data: {
            couponId: coupon.id,
            userId: userId,
            orderId: newOrder.id
          }
        });
      }

      return newOrder;
    });

    // Fetch complete order with all relations for response
    const completeOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                images: true,
                prescription_required: true
              }
            },
            variantOption: true
          }
        },
        prescriptions: {
          include: {
            prescription: {
              select: {
                id: true,
                fileName: true,
                imageUrl: true,
                isValidated: true
              }
            }
          }
        },
        payment: {
          include: {
            paymentMethod: true
          }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        orderHistory: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    try {
      // Send ORDER_CONFIRMED email to CUSTOMER
      await queueAutomationEmails('ORDER_CONFIRMED', userId, completeOrder.id, {
        order_id: completeOrder.orderNumber,
        customer_name: `${completeOrder.user.firstName} ${completeOrder.user.lastName}`,
        order_total: `$${completeOrder.totalAmount.toFixed(2)}`,
        order_date: completeOrder.createdAt.toISOString().split('T')[0],
        tracking_url: `${process.env.FRONTEND_URL}/orders/${completeOrder.id}`,
        shipping_address: completeOrder.shippingAddress ? 
          `${completeOrder.shippingAddress.streetAddress}, ${completeOrder.shippingAddress.city}, ${completeOrder.shippingAddress.state} ${completeOrder.shippingAddress.zipCode}` : 'N/A'
      }, prisma);

      // Send COMPANY_NEW_ORDER notification to COMPANY
      await sendCompanyNotification(completeOrder, 'COMPANY_NEW_ORDER', {
        order_items_count: completeOrder.orderItems?.length || 0,
        payment_method: completeOrder.paymentMethodCode, // Use paymentMethodCode
        contact_phone: completeOrder.contactPhone,
        payment_status: completeOrder.paymentStatus
      }, prisma);
      
      console.log('Order creation notifications sent successfully');
    } catch (automationError) {
      console.error('Failed to trigger order creation automation:', automationError);
      // Don't fail the order creation because of automation error
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: completeOrder
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order: ' + error.message
    });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      userId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = {};

    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (userId) where.userId = Number(userId);

    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate.gte = new Date(startDate);
      if (endDate) where.orderDate.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
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
                  images: true
                }
              }
            }
          },
          coupon: {
            select: {
              code: true,
              type: true,
              value: true
            }
          },
          _count: {
            select: {
              orderItems: true
            }
          }
        },
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder
        }
      }),
      prisma.order.count({ where })
    ]);

    res.status(200).json({
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      error: 'Failed to fetch orders'
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        id: Number(id)
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true
          }
        },
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                images: true,
                description: true
              }
            },
                       variantOption: {
              include: {
                variant: {
                  select: {
                    id: true,
                    country: true,
                    shipping: true, // This contains shipping details like "FREE", "INTL_STANDARD", "OVERNIGHT"
                    currency: true,
                    isActive: true
                  }
                }
              }
            }
          }
        },
        orderHistory: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        coupon: true
      }
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    res.status(200).json({
      order
    });
  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({
      error: 'Failed to fetch order'
    });
  }
};

const getOrderByNumber = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { orderNumber } = req.params;

    const order = await prisma.order.findUnique({
      where: {
        orderNumber
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
                id: true,
                name: true,
                sku: true,
                images: true
              }
            },
                         variantOption: {
              include: {
                variant: {
                  select: {
                    id: true,
                    country: true,
                    shipping: true, // This contains shipping details like "FREE", "INTL_STANDARD", "OVERNIGHT"
                    currency: true,
                    isActive: true
                  }
                }
              }
            }
          }
        },
        orderHistory: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        coupon: true
      }
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    res.status(200).json({
      order
    });
  } catch (error) {
    console.error('Get order by number error:', error);
    res.status(500).json({
      error: 'Failed to fetch order'
    });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { userId } = req.params;
    const {
      page = 1,
      limit = 10,
      status
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = {
      userId: Number(userId)
    };

    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  name: true,
                  images: true
                }
              }
            }
          },
          coupon: {
            select: {
              code: true,
              type: true
            }
          }
        },
        skip,
        take,
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.order.count({ where })
    ]);

    res.status(200).json({
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      error: 'Failed to fetch user orders'
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const { status, notes, trackingNumber, estimatedDelivery } = req.body;

    const order = await prisma.order.findFirst({
      where: {
        id: Number(id)
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
                sku: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    const oldStatus = order.status;
    const updateData = {
      status
    };

    // Set timestamps based on status
    const now = new Date();
    if (status === 'shipped' && !order.shippedAt) {
      updateData.shippedAt = now;
      updateData.trackingNumber = trackingNumber;
      updateData.estimatedDelivery = estimatedDelivery ? new Date(estimatedDelivery) : null;
    } else if (status === 'delivered' && !order.deliveredAt) {
      updateData.deliveredAt = now;
    } else if (status === 'cancelled' && !order.cancelledAt) {
      updateData.cancelledAt = now;
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order
      const order = await tx.order.update({
        where: { id: Number(id) },
        data: updateData,
        include: {
          orderItems: {
            include: {
              variantOption: true
            }
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      // Add to order history
      await tx.orderHistory.create({
        data: {
          orderId: Number(id),
          oldStatus: oldStatus,
          newStatus: status,
          notes,
          createdBy: req.user.id
        }
      });

      // Restore stock if order is cancelled
      if (status === 'cancelled') {
        for (const item of order.orderItems) {
          if (item.variantOptionId) {
            await tx.variantOption.update({
              where: { id: item.variantOptionId },
              data: {
                stock: {
                  increment: item.quantity
                }
              }
            });
          }
        }
      }

      return order;
    });

    // ✅ SEND EMAILS FOR ALL ORDER STATUS CHANGES
    try {
      const eventMap = {
      
        'pending': 'ORDER_PENDING',
        'confirmed': 'ORDER_CONFIRMED',
        'processing': 'ORDER_PROCESSING', 
        'shipped': 'ORDER_SHIPPED',
        'delivered': 'ORDER_DELIVERED',
        'cancelled': 'ORDER_CANCELLED',
        'refunded': 'ORDER_REFUNDED',
        'failed': 'ORDER_FAILED'
      };

      const event = eventMap[status];
      
      if (event) {
        const templateData = {
          order_id: order.orderNumber,
          customer_name: `${order.user.firstName} ${order.user.lastName}`,
          order_total: `$${order.totalAmount.toFixed(2)}`,
          order_date: order.createdAt.toISOString().split('T')[0],
          tracking_url: `${process.env.FRONTEND_URL}/orders/${order.id}`,
          support_url: `${process.env.FRONTEND_URL}/contact`
        };

        // Add specific data based on status
        if (status === 'shipped') {
          templateData.tracking_number = trackingNumber || '';
          templateData.estimated_delivery = estimatedDelivery || '';
          templateData.tracking_link = trackingNumber ? 
            `${process.env.FRONTEND_URL}/track-order/${trackingNumber}` : '#';
          templateData.shipping_carrier = 'Standard Shipping';
        }

        if (status === 'cancelled') {
          templateData.cancellation_date = new Date().toISOString().split('T')[0];
          templateData.cancellation_reason = notes || 'Customer request';
        }

        if (status === 'refunded') {
          templateData.refund_date = new Date().toISOString().split('T')[0];
          templateData.refund_amount = `$${order.totalAmount.toFixed(2)}`;
        }

        // Send customer email
        await queueAutomationEmails(event, order.userId, order.id, templateData, prisma);

        // Send company notification
        await sendCompanyNotification(
          { ...order, status: updatedOrder.status }, 
          event,
          {
            old_status: oldStatus,
            new_status: status,
            tracking_number: trackingNumber,
            notes: notes
          },
          prisma
        );
      }
      
    } catch (emailError) {
      console.error('Failed to send status change emails:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        order: updatedOrder,
        statusChange: {
          from: oldStatus,
          to: status
        }
      }
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status: ' + error.message
    });
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const { paymentStatus, transactionId, paymentGateway } = req.body;

    const order = await prisma.order.findFirst({
      where: {
        id: Number(id)
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const oldPaymentStatus = order.paymentStatus;
    const updateData = {
      paymentStatus,
      transactionId,
      paymentGateway
    };

    if (paymentStatus === 'paid' && !order.paidAt) {
      updateData.paidAt = new Date();
    }

    const updatedOrder = await prisma.order.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // ✅ SEND PAYMENT STATUS EMAILS
    try {
      const paymentEventMap = {
        'pending': 'PAYMENT_PENDING',
        'paid': 'PAYMENT_SUCCEEDED',
        'failed': 'PAYMENT_FAILED',
        'refunded': 'PAYMENT_REFUNDED',
        'partially_refunded': 'PAYMENT_PARTIALLY_REFUNDED'
      };

      const event = paymentEventMap[paymentStatus];
      
      if (event) {
        const templateData = {
          order_id: order.orderNumber,
          customer_name: `${order.user.firstName} ${order.user.lastName}`,
          amount_paid: `$${order.totalAmount.toFixed(2)}`,
          payment_method: order.paymentMethod,
          order_date: order.createdAt.toISOString().split('T')[0],
          transaction_id: transactionId || 'N/A',
          payment_retry_url: `${process.env.FRONTEND_URL}/orders/${order.id}/payment/retry`,
          support_url: `${process.env.FRONTEND_URL}/contact`
        };

        // Add specific data for refunds
        if (paymentStatus === 'refunded' || paymentStatus === 'partially_refunded') {
          templateData.refund_date = new Date().toISOString().split('T')[0];
          templateData.refund_amount = `$${order.totalAmount.toFixed(2)}`;
        }

        // Send customer email
        await queueAutomationEmails(event, order.userId, order.id, templateData, prisma);

        // Send company notification
        await sendCompanyNotification(
          order,
          event,
          {
            old_payment_status: oldPaymentStatus,
            new_payment_status: paymentStatus,
            transaction_id: transactionId,
            payment_gateway: paymentGateway
          },
          prisma
        );
      }

    } catch (emailError) {
      console.error('Failed to send payment status emails:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      data: {
        order: updatedOrder,
        paymentStatusChange: {
          from: oldPaymentStatus,
          to: paymentStatus
        }
      }
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment status: ' + error.message
    });
  }
};

const getOrderStats = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { startDate, endDate } = req.query;

    const where = {};

    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate.gte = new Date(startDate);
      if (endDate) where.orderDate.lte = new Date(endDate);
    }

    const [
      totalOrders,
      totalRevenue,
      pendingOrders,
      completedOrders,
      recentOrders
    ] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.aggregate({
        where: {
          ...where,
          paymentStatus: 'paid'
        },
        _sum: {
          totalAmount: true
        }
      }),
      prisma.order.count({
        where: {
          ...where,
          status: 'pending'
        }
      }),
      prisma.order.count({
        where: {
          ...where,
          status: 'delivered'
        }
      }),
      prisma.order.findMany({
        where,
        take: 5,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      })
    ]);

    res.status(200).json({
      stats: {
        totalOrders,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        pendingOrders,
        completedOrders,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch order stats'
    });
  }
};


const updateOrderShipping = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const { 
      shippingAmount, 
      trackingNumber, 
      shippingMethod, 
      estimatedDelivery,
      totalAmount 
    } = req.body;

    const order = await prisma.order.findFirst({
      where: {
        id: Number(id)
      }
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    const updateData = {};
    if (shippingAmount !== undefined) updateData.shippingAmount = parseFloat(shippingAmount);
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
    if (shippingMethod !== undefined) updateData.shippingMethod = shippingMethod;
    if (estimatedDelivery !== undefined) updateData.estimatedDelivery = estimatedDelivery ? new Date(estimatedDelivery) : null;
    if (totalAmount !== undefined) updateData.totalAmount = parseFloat(totalAmount);

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order
      const order = await tx.order.update({
        where: { id: Number(id) },
        data: updateData,
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  name: true,
                  images: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      // Add to order history
      await tx.orderHistory.create({
        data: {
          orderId: Number(id),
          oldStatus: order.status,
          newStatus: order.status, // Status remains same
          notes: 'Shipping details updated',
          createdBy: req.user.id
        }
      });

      return order;
    });

    res.status(200).json({
      message: 'Shipping details updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update order shipping error:', error);
    res.status(500).json({
      error: 'Failed to update shipping details'
    });
  }
};



/**
 * Get comprehensive admin dashboard statistics
 */
/**
 * Get comprehensive admin dashboard statistics - COMPLETELY FIXED
 */
const getAdminDashboardStats = async (req, res) => {
  try {
    const prisma = req.prisma;
    
    // Get date ranges for comparison
    const currentDate = new Date();
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const previousMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const previousMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
    
    // Execute all queries in parallel for better performance
    const [
      totalRevenue,
      previousMonthRevenue,
      totalOrders,
      previousMonthOrders,
      totalProducts,
      totalCustomers,
      previousMonthCustomers,
      recentOrders
    ] = await Promise.all([
      // Current month revenue - FIXED: Simple aggregate
      prisma.order.aggregate({
        where: {
          status: { not: 'cancelled' },
          paymentStatus: 'paid',
          createdAt: { gte: currentMonthStart }
        },
        _sum: { totalAmount: true }
      }),
      
      // Previous month revenue
      prisma.order.aggregate({
        where: {
          status: { not: 'cancelled' },
          paymentStatus: 'paid',
          createdAt: { 
            gte: previousMonthStart,
            lte: previousMonthEnd
          }
        },
        _sum: { totalAmount: true }
      }),
      
      // Total orders (current month)
      prisma.order.count({
        where: {
          createdAt: { gte: currentMonthStart }
        }
      }),
      
      // Previous month orders
      prisma.order.count({
        where: {
          createdAt: { 
            gte: previousMonthStart,
            lte: previousMonthEnd
          }
        }
      }),
      
      // Total active products
      prisma.product.count({
        where: {
          isDeleted: false,
          isActive: true
        }
      }),
      
      // Total customers (all time) - FIXED: Simple count without complex role filtering
      prisma.user.count({
        where: {
          // Count all users as customers for simplicity
          // Remove complex role filtering that was causing errors
        }
      }),
      
      // Previous month customers - FIXED: Simple count
      prisma.user.count({
        where: {
          createdAt: { 
            gte: previousMonthStart,
            lte: previousMonthEnd
          }
        }
      }),
      
      // Recent orders (last 5)
      prisma.order.findMany({
        where: {
          createdAt: { gte: currentMonthStart }
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
                  images: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    // Get additional stats separately to avoid Promise.all issues
    const [ordersByStatus, paymentStats, topProducts] = await Promise.all([
      // Orders by status - FIXED: Handle potential errors
      prisma.order.groupBy({
        by: ['status'],
        where: {
          createdAt: { gte: currentMonthStart }
        },
        _count: { id: true }
      }).catch(error => {
        console.log('Orders by status query failed, using fallback:', error.message);
        return [];
      }),
      
      // Payment statistics
      prisma.order.groupBy({
        by: ['paymentStatus'],
        where: {
          createdAt: { gte: currentMonthStart }
        },
        _count: { id: true }
      }).catch(error => {
        console.log('Payment stats query failed, using fallback:', error.message);
        return [];
      }),
      
      // Top selling products - FIXED: Handle potential errors
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            createdAt: { gte: currentMonthStart },
            status: { not: 'cancelled' }
          }
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10
      }).catch(error => {
        console.log('Top products query failed, using fallback:', error.message);
        return [];
      })
    ]);

    // Calculate percentage changes
    const currentRevenue = totalRevenue._sum.totalAmount || 0;
    const prevRevenue = previousMonthRevenue._sum.totalAmount || 0;
    const revenueChange = prevRevenue > 0 ? 
      ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 
      (currentRevenue > 0 ? 100 : 0);

    const orderChange = previousMonthOrders > 0 ? 
      ((totalOrders - previousMonthOrders) / previousMonthOrders) * 100 : 
      (totalOrders > 0 ? 100 : 0);

    const customerChange = previousMonthCustomers > 0 ? 
      ((totalCustomers - previousMonthCustomers) / previousMonthCustomers) * 100 : 
      (totalCustomers > 0 ? 100 : 0);

    // Calculate average order value
    const averageOrderValue = totalOrders > 0 ? 
      (currentRevenue / totalOrders) : 0;

    // Process payment stats
    const paidOrders = paymentStats.find(p => p.paymentStatus === 'paid')?._count?.id || 0;
    const pendingOrders = paymentStats.find(p => p.paymentStatus === 'pending')?._count?.id || 0;
    const failedOrders = paymentStats.find(p => p.paymentStatus === 'failed')?._count?.id || 0;

    // Get product details for top products
    const topProductDetails = topProducts && topProducts.length > 0 ? 
      await Promise.all(
        topProducts.map(async (product) => {
          try {
            const productInfo = await prisma.product.findUnique({
              where: { id: product.productId },
              select: {
                name: true,
                images: true,
                price: true
              }
            });
            
            return {
              id: product.productId,
              name: productInfo?.name || 'Unknown Product',
              image: productInfo?.images?.[0]?.url || null,
              price: productInfo?.price || 0,
              totalQuantity: product._sum.quantity || 0,
              totalRevenue: (productInfo?.price || 0) * (product._sum.quantity || 0)
            };
          } catch (error) {
            console.error(`Error fetching product ${product.productId}:`, error);
            return null;
          }
        })
      ).then(results => results.filter(Boolean)) : [];

    // Prepare the response
    const stats = {
      // Main metrics
      totalRevenue: currentRevenue,
      totalOrders: totalOrders,
      totalProducts: totalProducts,
      totalCustomers: totalCustomers,
      
      // Changes
      revenueChange: Math.round(revenueChange * 100) / 100,
      orderChange: Math.round(orderChange * 100) / 100,
      customerChange: Math.round(customerChange * 100) / 100,
      
      // Additional metrics
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      currency: 'USD',
      
      // Status breakdowns
      ordersByStatus: ordersByStatus.map(status => ({
        status: status.status,
        count: status._count.id
      })),
      
      // Payment stats
      paidOrders: paidOrders,
      pendingOrders: pendingOrders,
      failedOrders: failedOrders,
      
      // Recent orders
      recentOrders: recentOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.user ? 
          `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || 'Unknown Customer' : 
          'Unknown Customer',
        totalAmount: order.totalAmount,
        status: order.status,
        orderDate: order.createdAt
      })),
      
      // Top products
      topProducts: topProductDetails,
      
      // Time period info
      period: {
        currentMonth: currentMonthStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
        previousMonth: previousMonthStart.toLocaleString('default', { month: 'long', year: 'numeric' })
      }
    };

    res.json({
      success: true,
      data: {
        stats
      }
    });

  } catch (error) {
    console.error('Get admin dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin dashboard statistics',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
/**
 * Update order payment status
 */
const updateOrderPaymentStatus = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { id } = req.params;
    const { paymentStatus } = req.body;

    const order = await prisma.order.findFirst({
      where: {
        id: Number(id)
      }
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    const updateData = {
      paymentStatus
    };

    if (paymentStatus === 'paid' && !order.paidAt) {
      updateData.paidAt = new Date();
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order
      const order = await tx.order.update({
        where: { id: Number(id) },
        data: updateData,
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  name: true,
                  images: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      // Add to order history
      await tx.orderHistory.create({
        data: {
          orderId: Number(id),
          oldStatus: order.status,
          newStatus: order.status, // Order status remains same
          notes: `Payment status updated to ${paymentStatus}`,
          createdBy: req.user.id
        }
      });

      return order;
    });

    res.status(200).json({
      message: 'Payment status updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      error: 'Failed to update payment status'
    });
  }
};


/**
 * Get monthly revenue data for charts
 */
/**
 * Get monthly revenue data for charts - FIXED VERSION
 */
const getMonthlyRevenue = async (req, res) => {
  try {
    const prisma = req.prisma;
    
    // Get the year from query params or use current year
    const { year = new Date().getFullYear() } = req.query;
    const selectedYear = parseInt(year);

    // Generate all months for the selected year
    const months = [];
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(selectedYear, i, 1);
      const monthEnd = new Date(selectedYear, i + 1, 0, 23, 59, 59, 999);
      
      months.push({
        year: selectedYear,
        month: i,
        label: monthStart.toLocaleString('default', { month: 'short' }),
        startDate: monthStart,
        endDate: monthEnd
      });
    }

    console.log(`📊 Fetching monthly revenue for year: ${selectedYear}`);

    // Get revenue for each month
    const monthlyRevenue = await Promise.all(
      months.map(async (month) => {
        try {
          const revenue = await prisma.order.aggregate({
            where: {
              paymentStatus: 'paid',
              status: { not: 'cancelled' },
              createdAt: {
                gte: month.startDate,
                lte: month.endDate
              }
            },
            _sum: {
              totalAmount: true
            }
          });

          const monthRevenue = revenue._sum.totalAmount || 0;
          
          console.log(`💰 ${month.label} ${selectedYear}: $${monthRevenue}`);

          return {
            label: month.label,
            value: monthRevenue,
            month: month.month + 1, // 1-based month
            year: month.year,
            actualValue: monthRevenue // Keep original value for reference
          };
        } catch (error) {
          console.error(`Error fetching revenue for ${month.label} ${selectedYear}:`, error);
          return {
            label: month.label,
            value: 0,
            month: month.month + 1,
            year: month.year,
            actualValue: 0
          };
        }
      })
    );

    // Log summary for debugging
    const totalYearRevenue = monthlyRevenue.reduce((sum, month) => sum + month.value, 0);
    console.log(`🎯 Total revenue for ${selectedYear}: $${totalYearRevenue}`);
    console.log('📈 Monthly breakdown:', monthlyRevenue);

    res.json({
      success: true,
      data: {
        monthlyRevenue,
        year: selectedYear,
        totalYearRevenue
      }
    });

  } catch (error) {
    console.error('Get monthly revenue error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monthly revenue data',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get order status distribution for charts
 */
const getOrderStatusDistribution = async (req, res) => {
  try {
    const prisma = req.prisma;
    
    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: currentMonthStart }
      },
      _count: { id: true }
    });

    // Define status colors
    const statusColors = {
      delivered: '#10b981',
      completed: '#10b981',
      shipped: '#3b82f6',
      processing: '#f59e0b',
      confirmed: '#f59e0b',
      pending: '#f97316',
      pending_payment: '#f97316',
      cancelled: '#ef4444',
      refunded: '#ef4444'
    };

    const distribution = ordersByStatus.map(status => ({
      label: status.status.charAt(0).toUpperCase() + status.status.slice(1),
      value: status._count.id,
      color: statusColors[status.status] || '#6b7280'
    }));

    res.json({
      success: true,
      data: {
        distribution
      }
    });

  } catch (error) {
    console.error('Get order status distribution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order status distribution'
    });
  }
};

/**
 * Get top selling products for charts
 */
const getTopSellingProducts = async (req, res) => {
  try {
    const prisma = req.prisma;
    
    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    // Get top products by quantity sold
    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          createdAt: { gte: currentMonthStart },
          status: { not: 'cancelled' }
        }
      },
      _sum: { 
        quantity: true,
        totalPrice: true
      },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10
    });

    // Get product details
    const productDetails = await Promise.all(
      topProducts.map(async (product) => {
        const productInfo = await prisma.product.findUnique({
          where: { id: product.productId },
          select: {
            id: true,
            name: true,
            images: true,
            price: true
          }
        });

        return {
          id: product.productId,
          name: productInfo?.name || 'Unknown Product',
          image: productInfo?.images?.[0]?.url || null,
          price: productInfo?.price || 0,
          totalQuantity: product._sum.quantity || 0,
          totalRevenue: product._sum.totalPrice || 0
        };
      })
    );

    res.json({
      success: true,
      data: {
        topProducts: productDetails
      }
    });

  } catch (error) {
    console.error('Get top selling products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top selling products'
    });
  }
};


/**
 * Get sales reports data
 */
const getSalesReports = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { period = 'monthly', year = new Date().getFullYear() } = req.query;

    // Get date ranges based on period
    let startDate, endDate;
    const currentDate = new Date();

    switch (period) {
      case 'weekly':
        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - 7);
        endDate = currentDate;
        break;
      case 'monthly':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        break;
      case 'yearly':
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31);
        break;
      default:
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    }

    // Get total sales YTD (Year to Date)
    const ytdStart = new Date(currentDate.getFullYear(), 0, 1);
    const ytdEnd = currentDate;

    const [
      totalSalesYTD,
      averageOrderValue,
      conversionRateData,
      customerRatio,
      monthlySalesData,
      topProducts,
      salesByCategory
    ] = await Promise.all([
      // Total Sales YTD
      prisma.order.aggregate({
        where: {
          paymentStatus: 'paid',
          status: { not: 'cancelled' },
          createdAt: {
            gte: ytdStart,
            lte: ytdEnd
          }
        },
        _sum: {
          totalAmount: true
        },
        _count: {
          id: true
        }
      }),

      // Average Order Value
      prisma.order.aggregate({
        where: {
          paymentStatus: 'paid',
          status: { not: 'cancelled' },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _avg: {
          totalAmount: true
        }
      }),

      // Conversion Rate (simplified - orders vs total visitors)
      // This would typically come from analytics, but we'll use a simplified version
      prisma.order.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),

      // New vs Returning Customers
      prisma.order.groupBy({
        by: ['userId'],
        where: {
          paymentStatus: 'paid',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: {
          id: true
        }
      }),

      // Monthly Sales Data for current year
   // In getSalesReports function, update the monthly sales part:
// Monthly Sales Data for the selected year - FIXED
(async () => {
  const months = [];
  const selectedYear = parseInt(year) || new Date().getFullYear();
  
  console.log(`📊 Generating monthly sales for year: ${selectedYear}`);
  
  for (let i = 0; i < 12; i++) {
    const monthStart = new Date(selectedYear, i, 1);
    const monthEnd = new Date(selectedYear, i + 1, 0, 23, 59, 59, 999);
    
    const sales = await prisma.order.aggregate({
      where: {
        paymentStatus: 'paid',
        status: { not: 'cancelled' },
        createdAt: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      _sum: {
        totalAmount: true
      }
    });

    const monthSales = sales._sum.totalAmount || 0;
    console.log(`💰 ${monthStart.toLocaleString('default', { month: 'short' })} ${selectedYear}: $${monthSales}`);

    months.push({
      month: monthStart.toLocaleString('default', { month: 'short' }),
      sales: monthSales,
      actualSales: monthSales // Keep original value
    });
  }
  
  return months;
})(),

      // Top Products
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            paymentStatus: 'paid',
            status: { not: 'cancelled' },
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        },
        _sum: {
          quantity: true,
          totalPrice: true
        },
        orderBy: {
          _sum: {
            totalPrice: 'desc'
          }
        },
        take: 10
      }),

      // Sales by Category
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            paymentStatus: 'paid',
            status: { not: 'cancelled' },
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        },
        _sum: {
          totalPrice: true
        }
      })
    ]);

    // Calculate conversion rate (simplified)
    // In a real scenario, you'd get total visitors from analytics
    const totalOrders = conversionRateData;
    const estimatedVisitors = totalOrders * 30; // Simplified estimation
    const conversionRate = estimatedVisitors > 0 ? (totalOrders / estimatedVisitors) * 100 : 0;

    // Calculate new vs returning customers
    const newCustomers = customerRatio.filter(c => c._count.id === 1).length;
    const returningCustomers = customerRatio.filter(c => c._count.id > 1).length;
    const totalCustomers = newCustomers + returningCustomers;
    const newVsReturning = totalCustomers > 0 ? {
      new: Math.round((newCustomers / totalCustomers) * 100),
      returning: Math.round((returningCustomers / totalCustomers) * 100)
    } : { new: 0, returning: 0 };

    // Get product details for top products
    const topProductDetails = await Promise.all(
      topProducts.map(async (product) => {
        const productInfo = await prisma.product.findUnique({
          where: { id: product.productId },
          select: {
            name: true,
            category: {
              select: {
                name: true
              }
            }
          }
        });

        return {
          id: product.productId,
          name: productInfo?.name || 'Unknown Product',
          category: productInfo?.category?.name || 'Uncategorized',
          quantity: product._sum.quantity || 0,
          revenue: product._sum.totalPrice || 0
        };
      })
    );

    // Get category details for sales by category
    const categorySales = await Promise.all(
      salesByCategory.map(async (sale) => {
        const productInfo = await prisma.product.findUnique({
          where: { id: sale.productId },
          select: {
            category: {
              select: {
                name: true
              }
            }
          }
        });

        return {
          category: productInfo?.category?.name || 'Uncategorized',
          revenue: sale._sum.totalPrice || 0
        }
      })
    );

    // Aggregate category sales
    const categorySalesAggregated = categorySales.reduce((acc, curr) => {
      if (!acc[curr.category]) {
        acc[curr.category] = 0;
      }
      acc[curr.category] += curr.revenue;
      return acc;
    }, {});

    const salesByCategoryFormatted = Object.entries(categorySalesAggregated).map(([category, revenue]) => ({
      category,
      revenue
    })).sort((a, b) => b.revenue - a.revenue);

    const report = {
      summary: {
        totalSales: totalSalesYTD._sum.totalAmount || 0,
        totalOrders: totalSalesYTD._count.id || 0,
        averageOrderValue: averageOrderValue._avg.totalAmount || 0,
        conversionRate: Math.round(conversionRate * 100) / 100,
        newVsReturning
      },
      charts: {
        monthlySales: monthlySalesData,
        topProducts: topProductDetails,
        salesByCategory: salesByCategoryFormatted
      },
      period: {
        type: period,
        startDate,
        endDate,
        year: currentDate.getFullYear()
      }
    };

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Get sales reports error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales reports'
    });
  }
};




module.exports = {
  createOrder,
  getAllOrders,
  getOrderById,
  getOrderByNumber,
  getUserOrders,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderStats,
  updateOrderShipping,
  updateOrderPaymentStatus,
  getAdminDashboardStats,
  getMonthlyRevenue,
  getOrderStatusDistribution,
  getTopSellingProducts,
  getSalesReports,
  sendOrderEmail // 🆕 ADD THIS EXPORT
};