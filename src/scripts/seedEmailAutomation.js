// src/scripts/seedEmailAutomationFixed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const defaultTemplates = [
  // EXISTING CUSTOMER TEMPLATES
  {
    name: 'Order Confirmation',
    subject: 'Your Evergreen Order #{{order_id}} is confirmed!',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #2d5016; color: #fff; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    .button { background: #2d5016; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Evergreen Medicine</h1>
    </div>
    <div class="content">
      <h2>Thanks for your order, {{customer_name}}!</h2>
      <p>We've received your order <strong>#{{order_id}}</strong> and will start processing it soon.</p>
      <p><strong>Order Total:</strong> {{order_total}}</p>
      <p><strong>Shipping Address:</strong><br>{{shipping_address}}</p>
      <p>You can track your order status anytime from your account dashboard.</p>
      <a href="{{order_tracking_url}}" class="button">Track Your Order</a>
    </div>
    <div class="footer">
      <p>Thank you for choosing Evergreen Medicine</p>
      <p>Contact us: support@evergreenmedicine.com</p>
    </div>
  </div>
</body>
</html>`,
    type: 'TRANSACTIONAL',
    variables: ['customer_name', 'order_id', 'order_total', 'shipping_address', 'order_tracking_url'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Order Pending',
    subject: 'Your Order #{{order_id}} is Being Processed',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #f59e0b; color: #fff; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    .button { background: #f59e0b; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Processing</h1>
    </div>
    <div class="content">
      <h2>Hi {{customer_name}}!</h2>
      <p>Your order <strong>#{{order_id}}</strong> is currently being processed.</p>
      <p>We're preparing your items and will update you as soon as your order moves to the next stage.</p>
      <p><strong>Order Total:</strong> {{order_total}}</p>
      <p><strong>Order Date:</strong> {{order_date}}</p>
      <a href="{{tracking_url}}" class="button">View Order Details</a>
      <p style="margin-top: 20px;">Thank you for your patience!</p>
    </div>
    <div class="footer">
      <p>Evergreen Medicine - Natural Health Solutions</p>
    </div>
  </div>
</body>
</html>`,
    type: 'TRANSACTIONAL',
    variables: ['customer_name', 'order_id', 'order_total', 'order_date', 'tracking_url'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Order Confirmed',
    subject: 'Your Order #{{order_id}} is Confirmed!',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #10b981; color: #fff; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    .button { background: #10b981; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Order Confirmed!</h1>
    </div>
    <div class="content">
      <h2>Great news, {{customer_name}}!</h2>
      <p>Your order <strong>#{{order_id}}</strong> has been confirmed and is now being processed.</p>
      <p><strong>Order Total:</strong> {{order_total}}</p>
      <p><strong>Order Date:</strong> {{order_date}}</p>
      <p>We'll notify you when your order ships. You can track your order status anytime:</p>
      <a href="{{tracking_url}}" class="button">Track Your Order</a>
      <p style="margin-top: 20px;">Thank you for choosing Evergreen Medicine!</p>
    </div>
    <div class="footer">
      <p>Evergreen Medicine - Natural Health Solutions</p>
    </div>
  </div>
</body>
</html>`,
    type: 'TRANSACTIONAL',
    variables: ['customer_name', 'order_id', 'order_total', 'order_date', 'tracking_url'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Order Processing',
    subject: 'Your Order #{{order_id}} is Being Processed',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #3b82f6; color: #fff; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    .button { background: #3b82f6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔄 Processing Your Order</h1>
    </div>
    <div class="content">
      <h2>Hi {{customer_name}}!</h2>
      <p>We're currently processing your order <strong>#{{order_id}}</strong>.</p>
      <p>Our team is preparing your items for shipment. You'll receive another notification with tracking information once your order ships.</p>
      <p><strong>Expected Next Update:</strong> Within 24-48 hours</p>
      <a href="{{tracking_url}}" class="button">View Order Details</a>
      <p style="margin-top: 20px;">We appreciate your patience!</p>
    </div>
    <div class="footer">
      <p>Evergreen Medicine - Quality Natural Products</p>
    </div>
  </div>
</body>
</html>`,
    type: 'TRANSACTIONAL',
    variables: ['customer_name', 'order_id', 'tracking_url'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Shipping Confirmation',
    subject: 'Your Evergreen Order #{{order_id}} has shipped!',
    body: `<div class="container">
  <div class="header">
    <h1>Your Order is on the Way! 🚚</h1>
  </div>
  <div class="content">
    <p>Good news, {{customer_name}}! Your order <strong>#{{order_id}}</strong> has been shipped.</p>
    <p><strong>Tracking Number:</strong> {{tracking_number}}</p>
    <p><strong>Carrier:</strong> {{shipping_carrier}}</p>
    <p><strong>Estimated Delivery:</strong> {{estimated_delivery}}</p>
    <a href="{{tracking_link}}" class="button">Track Package</a>
    <p style="margin-top: 20px;">We hope you love your products. If you have any questions, reply to this email!</p>
  </div>
</div>`,
    type: 'TRANSACTIONAL',
    variables: ['customer_name', 'order_id', 'tracking_number', 'shipping_carrier', 'estimated_delivery', 'tracking_link'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Order Delivered',
    subject: 'Your Order #{{order_id}} Has Been Delivered',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #10b981; color: #fff; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    .button { background: #10b981; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Order Delivered!</h1>
    </div>
    <div class="content">
      <h2>Hi {{customer_name}}!</h2>
      <p>Great news! Your order <strong>#{{order_id}}</strong> has been delivered.</p>
      <p>We hope you're satisfied with your purchase. Your feedback helps us improve and helps other customers make informed decisions.</p>
      <a href="{{review_url}}" class="button">Leave a Review</a>
      <p style="margin-top: 20px;">Having issues with your order? <a href="{{support_url}}">Contact our support team</a>.</p>
    </div>
    <div class="footer">
      <p>Evergreen Medicine - Thank You for Your Order</p>
    </div>
  </div>
</body>
</html>`,
    type: 'TRANSACTIONAL',
    variables: ['customer_name', 'order_id', 'review_url', 'support_url'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Order Cancelled',
    subject: 'Your Order #{{order_id}} has been cancelled',
    body: `<div class="container">
  <div class="content">
    <p>Your order <strong>#{{order_id}}</strong> has been cancelled as requested.</p>
    <p><strong>Cancellation Date:</strong> {{cancellation_date}}</p>
    <p>If this was a mistake or you have any questions, please contact our support team.</p>
    <a href="{{support_url}}" class="button">Contact Support</a>
    <p style="margin-top: 20px;">We hope to see you again soon!</p>
  </div>
</div>`,
    type: 'TRANSACTIONAL',
    variables: ['order_id', 'cancellation_date', 'support_url'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Order Refunded',
    subject: 'Refund Processed for Order #{{order_id}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #8b5cf6; color: #fff; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    .button { background: #8b5cf6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💸 Refund Processed</h1>
    </div>
    <div class="content">
      <h2>Hi {{customer_name}},</h2>
      <p>We've processed your refund for order <strong>#{{order_id}}</strong>.</p>
      <p><strong>Refund Amount:</strong> {{refund_amount}}</p>
      <p><strong>Refund Date:</strong> {{refund_date}}</p>
      <p>The refund has been issued to your original payment method. It may take 5-10 business days to appear in your account.</p>
      <p>If you have any questions about your refund, please contact our support team.</p>
      <a href="{{support_url}}" class="button">Contact Support</a>
    </div>
    <div class="footer">
      <p>Evergreen Medicine - Customer Care</p>
    </div>
  </div>
</body>
</html>`,
    type: 'TRANSACTIONAL',
    variables: ['customer_name', 'order_id', 'refund_amount', 'refund_date', 'support_url'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Order Failed',
    subject: 'Issue with Your Order #{{order_id}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #ef4444; color: #fff; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    .button { background: #ef4444; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Order Issue</h1>
    </div>
    <div class="content">
      <h2>Hi {{customer_name}},</h2>
      <p>We encountered an issue with your order <strong>#{{order_id}}</strong>.</p>
      <p><strong>Issue:</strong> {{failure_reason}}</p>
      <p>Our team is looking into this and will contact you shortly to resolve the issue.</p>
      <p>If you need immediate assistance, please contact our support team:</p>
      <a href="{{support_url}}" class="button">Contact Support</a>
      <p style="margin-top: 20px;">We apologize for any inconvenience.</p>
    </div>
    <div class="footer">
      <p>Evergreen Medicine - Support Team</p>
    </div>
  </div>
</body>
</html>`,
    type: 'TRANSACTIONAL',
    variables: ['customer_name', 'order_id', 'failure_reason', 'support_url'],
    status: 'active',
    isSystem: true
  },

  // PAYMENT STATUS TEMPLATES
  {
    name: 'Payment Pending',
    subject: 'Payment Pending for Order #{{order_id}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #f59e0b; color: #fff; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    .button { background: #f59e0b; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏳ Payment Pending</h1>
    </div>
    <div class="content">
      <h2>Hi {{customer_name}},</h2>
      <p>We're waiting for your payment to be processed for order <strong>#{{order_id}}</strong>.</p>
      <p><strong>Amount Due:</strong> {{amount_paid}}</p>
      <p><strong>Payment Method:</strong> {{payment_method}}</p>
      <p>Once your payment is confirmed, we'll start processing your order immediately.</p>
      <a href="{{tracking_url}}" class="button">View Order Details</a>
      <p style="margin-top: 20px;">If you've already made the payment, please allow some time for processing.</p>
    </div>
    <div class="footer">
      <p>Evergreen Medicine - Payment Processing</p>
    </div>
  </div>
</body>
</html>`,
    type: 'TRANSACTIONAL',
    variables: ['customer_name', 'order_id', 'amount_paid', 'payment_method', 'tracking_url'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Payment Succeeded',
    subject: 'Payment Received for Order #{{order_id}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #10b981; color: #fff; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    .button { background: #10b981; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Payment Successful</h1>
    </div>
    <div class="content">
      <h2>Hi {{customer_name}},</h2>
      <p>We've successfully received your payment for order <strong>#{{order_id}}</strong>.</p>
      <p><strong>Amount Paid:</strong> {{amount_paid}}</p>
      <p><strong>Payment Method:</strong> {{payment_method}}</p>
      <p><strong>Transaction ID:</strong> {{transaction_id}}</p>
      <p>Your order is now being processed. We'll notify you when it ships.</p>
      <a href="{{tracking_url}}" class="button">Track Your Order</a>
    </div>
    <div class="footer">
      <p>Evergreen Medicine - Secure Payments</p>
    </div>
  </div>
</body>
</html>`,
    type: 'TRANSACTIONAL',
    variables: ['customer_name', 'order_id', 'amount_paid', 'payment_method', 'transaction_id', 'tracking_url'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Payment Failed',
    subject: 'Payment Issue with Order #{{order_id}}',
    body: `<div class="container">
  <div class="content">
    <p>We encountered an issue processing your payment for order <strong>#{{order_id}}</strong>.</p>
    <p><strong>Amount:</strong> {{order_total}}</p>
    <p><strong>Reason:</strong> {{failure_reason}}</p>
    <p>Please update your payment method to complete your order:</p>
    <a href="{{payment_retry_url}}" class="button">Update Payment Method</a>
    <p style="margin-top: 20px;">If you believe this is an error, please contact our support team.</p>
  </div>
</div>`,
    type: 'SYSTEM',
    variables: ['order_id', 'order_total', 'failure_reason', 'payment_retry_url'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Payment Refunded',
    subject: 'Payment Refunded for Order #{{order_id}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #8b5cf6; color: #fff; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    .button { background: #8b5cf6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💸 Payment Refunded</h1>
    </div>
    <div class="content">
      <h2>Hi {{customer_name}},</h2>
      <p>We've processed a refund for your order <strong>#{{order_id}}</strong>.</p>
      <p><strong>Refund Amount:</strong> {{amount_paid}}</p>
      <p><strong>Refund Date:</strong> {{refund_date}}</p>
      <p>The refund has been issued to your original payment method and should appear in your account within 5-10 business days.</p>
      <p>If you have any questions, please contact our support team.</p>
      <a href="{{support_url}}" class="button">Contact Support</a>
    </div>
    <div class="footer">
      <p>Evergreen Medicine - Customer Care</p>
    </div>
  </div>
</body>
</html>`,
    type: 'TRANSACTIONAL',
    variables: ['customer_name', 'order_id', 'amount_paid', 'refund_date', 'support_url'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Payment Partially Refunded',
    subject: 'Partial Refund for Order #{{order_id}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #8b5cf6; color: #fff; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    .button { background: #8b5cf6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💸 Partial Refund Processed</h1>
    </div>
    <div class="content">
      <h2>Hi {{customer_name}},</h2>
      <p>We've processed a partial refund for your order <strong>#{{order_id}}</strong>.</p>
      <p><strong>Refund Amount:</strong> {{refund_amount}}</p>
      <p><strong>Original Amount:</strong> {{order_total}}</p>
      <p><strong>Refund Date:</strong> {{refund_date}}</p>
      <p>The refund has been issued to your original payment method and should appear in your account within 5-10 business days.</p>
      <p>If you have any questions, please contact our support team.</p>
      <a href="{{support_url}}" class="button">Contact Support</a>
    </div>
    <div class="footer">
      <p>Evergreen Medicine - Customer Care</p>
    </div>
  </div>
</body>
</html>`,
    type: 'TRANSACTIONAL',
    variables: ['customer_name', 'order_id', 'refund_amount', 'order_total', 'refund_date', 'support_url'],
    status: 'active',
    isSystem: true
  },

  // COMPANY NOTIFICATION TEMPLATES
  {
    name: 'New Order Received',
    subject: '📦 New Order Received: #{{order_id}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #10b981; color: #fff; padding: 20px; text-align: center; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
    .order-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .button { background: #10b981; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 New Order Received!</h1>
  </div>
  <div class="content">
    <h2>Order #{{order_id}}</h2>
    
    <div class="order-details">
      <h3>Customer Information</h3>
      <p><strong>Customer:</strong> {{customer_name}}</p>
      <p><strong>Email:</strong> {{customer_email}}</p>
      <p><strong>Order Total:</strong> {{order_total}}</p>
      <p><strong>Payment Method:</strong> {{payment_method}}</p>
      <p><strong>Payment Status:</strong> {{payment_status}}</p>
      <p><strong>Order Date:</strong> {{order_date}}</p>
      <p><strong>Shipping Address:</strong><br>{{shipping_address}}</p>
    </div>

    <p style="text-align: center;">
      <a href="{{admin_url}}" class="button">View Order in Admin Panel</a>
    </p>
  </div>
  <div class="footer">
    <p>This is an automated notification from Evergreen Medicine Order System</p>
  </div>
</body>
</html>`,
    type: 'NOTIFICATION',
    variables: ['order_id', 'customer_name', 'customer_email', 'order_total', 'payment_method', 'payment_status', 'order_date', 'shipping_address', 'admin_url'],
    status: 'active',
    isSystem: true
  },

  // EXISTING TEMPLATES (Welcome, Delivery Follow-up, Low Stock Alert)
  {
    name: 'Welcome Email',
    subject: 'Welcome to Evergreen Medicine, {{customer_name}}!',
    body: `<div class="container">
  <div class="header">
    <h1>Welcome to Evergreen Medicine! 🌿</h1>
  </div>
  <div class="content">
    <p>Hi {{customer_name}}, thanks for signing up! We're excited to have you as part of our natural health community.</p>
    <p>Here's a special welcome gift - use code <strong>WELCOME10</strong> for 10% off your first order!</p>
    <a href="{{shop_url}}" class="button">Start Shopping</a>
    <p style="margin-top: 20px;">At Evergreen Medicine, we're committed to providing high-quality natural health products.</p>
  </div>
</div>`,
    type: 'MARKETING',
    variables: ['customer_name', 'shop_url'],
    status: 'active',
    isSystem: false
  },
  {
    name: 'Delivery Follow-up',
    subject: 'How was your order, {{customer_name}}?',
    body: `<div class="container">
  <div class="content">
    <p>We see your order <strong>#{{order_id}}</strong> was delivered on {{delivery_date}}. We hope you are satisfied with your products!</p>
    <p>Your feedback helps us improve and helps other customers make better decisions.</p>
    <a href="{{review_url}}" class="button">Leave a Review</a>
    <p style="margin-top: 20px;">Having issues with your order? <a href="{{support_url}}">Contact our support team</a>.</p>
  </div>
</div>`,
    type: 'TRANSACTIONAL',
    variables: ['customer_name', 'order_id', 'delivery_date', 'review_url', 'support_url'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Low Stock Alert',
    subject: 'Low Stock Alert: {{product_name}}',
    body: `<div class="container">
  <div class="content">
    <h3>Low Stock Alert</h3>
    <p><strong>Product:</strong> {{product_name}}</p>
    <p><strong>Current Stock:</strong> {{current_stock}}</p>
    <p><strong>Reorder Level:</strong> {{reorder_level}}</p>
    <p>Please consider restocking this product soon to avoid running out.</p>
    <p style="color: #d97706; font-weight: bold;">⚠️ This is an automated alert from your inventory system.</p>
  </div>
</div>`,
    type: 'NOTIFICATION',
    variables: ['product_name', 'current_stock', 'reorder_level'],
    status: 'active',
    isSystem: true
  },
   {
    name: 'Company New Order Received',
    subject: '📦 New Order Received: #{{order_id}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; }
    .header { background: #2563eb; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 25px; border-radius: 0 0 8px 8px; }
    .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
    .customer-info { background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .button { background: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; }
    .footer { text-align: center; margin-top: 25px; color: #64748b; font-size: 14px; padding: 15px; }
    .badge { background: #10b981; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .item-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .item-name { flex: 2; }
    .item-qty { flex: 1; text-align: center; }
    .item-price { flex: 1; text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 NEW ORDER RECEIVED</h1>
    <p>Order #{{order_id}} • <span class="badge">{{payment_status}}</span></p>
  </div>
  
  <div class="content">
    <h2>Order Summary</h2>
    
    <div class="customer-info">
      <h3>👤 Customer Information</h3>
      <p><strong>Name:</strong> {{customer_name}}</p>
      <p><strong>Email:</strong> {{customer_email}}</p>
      <p><strong>Phone:</strong> {{contact_phone}}</p>
    </div>

    <div class="order-details">
      <h3>📋 Order Details</h3>
      <p><strong>Order Total:</strong> <span style="font-size: 1.2em; font-weight: bold; color: #059669;">{{order_total}}</span></p>
      <p><strong>Payment Method:</strong> {{payment_method}}</p>
      <p><strong>Items Count:</strong> {{order_items_count}} items</p>
      <p><strong>Order Date:</strong> {{order_date}}</p>
      
      <div style="margin-top: 15px;">
        <h4>📍 Shipping Address</h4>
        <p>{{shipping_address}}</p>
      </div>
    </div>

    <!-- Order Items Table -->
    <div style="margin: 20px 0;">
      <h3>🛍️ Order Items</h3>
      {{order_items_table}}
    </div>

    <div style="text-align: center; margin: 25px 0;">
      <a href="{{admin_url}}" class="button">📊 VIEW ORDER IN ADMIN PANEL</a>
    </div>

    <div style="background: #fffbeb; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
      <h4>🚀 Action Required</h4>
      <p>Please process this order within 24 hours. Contact customer if any prescription validation is needed.</p>
    </div>
  </div>

  <div class="footer">
    <p>This is an automated notification from Evergreen Medicine Order System</p>
    <p>🕒 Generated on: {{current_date}}</p>
  </div>
</body>
</html>`,
    type: 'NOTIFICATION',
    variables: ['order_id', 'customer_name', 'customer_email', 'order_total', 'payment_method', 'payment_status', 'order_date', 'shipping_address', 'admin_url', 'contact_phone', 'order_items_count', 'order_items_table', 'current_date'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Company Order Status Update',
    subject: '🔄 Order Status Updated: #{{order_id}} - {{new_status}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; }
    .header { background: #7c3aed; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #faf5ff; padding: 25px; border-radius: 0 0 8px 8px; }
    .status-change { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed; }
    .button { background: #7c3aed; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; }
    .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 14px; }
    .status-badge { 
      background: {{status_color}}; 
      color: #fff; 
      padding: 6px 16px; 
      border-radius: 20px; 
      font-weight: bold;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ORDER STATUS UPDATED</h1>
    <p>Order #{{order_id}}</p>
  </div>
  
  <div class="content">
    <div class="status-change">
      <h3>Status Change</h3>
      <p><strong>From:</strong> <span class="status-badge" style="background: #6b7280;">{{old_status}}</span></p>
      <p><strong>To:</strong> <span class="status-badge">{{new_status}}</span></p>
      <p><strong>Customer:</strong> {{customer_name}} ({{customer_email}})</p>
      <p><strong>Updated By:</strong> {{updated_by}}</p>
      <p><strong>Timestamp:</strong> {{update_timestamp}}</p>
      
      {{#if tracking_number}}
      <div style="margin-top: 15px; padding: 12px; background: #f0f9ff; border-radius: 6px;">
        <h4>🚚 Shipping Information</h4>
        <p><strong>Tracking Number:</strong> {{tracking_number}}</p>
        {{#if estimated_delivery}}
        <p><strong>Estimated Delivery:</strong> {{estimated_delivery}}</p>
        {{/if}}
      </div>
      {{/if}}

      {{#if notes}}
      <div style="margin-top: 15px; padding: 12px; background: #fffbeb; border-radius: 6px;">
        <h4>📝 Notes</h4>
        <p>{{notes}}</p>
      </div>
      {{/if}}
    </div>

    <div style="text-align: center;">
      <a href="{{admin_url}}" class="button">VIEW ORDER DETAILS</a>
    </div>
  </div>

  <div class="footer">
    <p>Evergreen Medicine - Order Management System</p>
    <p>Automated notification • {{current_date}}</p>
  </div>
</body>
</html>`,
    type: 'NOTIFICATION',
    variables: ['order_id', 'old_status', 'new_status', 'customer_name', 'customer_email', 'updated_by', 'update_timestamp', 'tracking_number', 'estimated_delivery', 'notes', 'admin_url', 'status_color', 'current_date'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Company Payment Status Update',
    subject: '💳 Payment Status Updated: #{{order_id}} - {{new_payment_status}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; }
    .header { background: {{payment_color}}; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 25px; border-radius: 0 0 8px 8px; }
    .payment-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid {{payment_color}}; }
    .button { background: {{payment_color}}; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; }
    .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 14px; }
    .amount { font-size: 1.4em; font-weight: bold; color: #059669; }
  </style>
</head>
<body>
  <div class="header">
    <h1>PAYMENT STATUS UPDATED</h1>
    <p>Order #{{order_id}}</p>
  </div>
  
  <div class="content">
    <div class="payment-info">
      <h3>Payment Details</h3>
      <p><strong>Status:</strong> <span style="background: {{payment_color}}; color: #fff; padding: 4px 12px; border-radius: 15px; font-weight: bold;">{{new_payment_status}}</span></p>
      <p><strong>Previous Status:</strong> {{old_payment_status}}</p>
      <p><strong>Amount:</strong> <span class="amount">{{order_total}}</span></p>
      <p><strong>Payment Method:</strong> {{payment_method}}</p>
      
      {{#if transaction_id}}
      <p><strong>Transaction ID:</strong> {{transaction_id}}</p>
      {{/if}}
      
      {{#if payment_gateway}}
      <p><strong>Payment Gateway:</strong> {{payment_gateway}}</p>
      {{/if}}
      
      <p><strong>Customer:</strong> {{customer_name}} ({{customer_email}})</p>
      <p><strong>Updated At:</strong> {{update_timestamp}}</p>
    </div>

    <div style="text-align: center;">
      <a href="{{admin_url}}" class="button">VIEW ORDER DETAILS</a>
    </div>

    {{#if requires_action}}
    <div style="background: #fef3c7; padding: 15px; border-radius: 6px; margin-top: 20px; border-left: 4px solid #f59e0b;">
      <h4>⚠️ Action Required</h4>
      <p>This payment status may require manual verification or follow-up.</p>
    </div>
    {{/if}}
  </div>

  <div class="footer">
    <p>Evergreen Medicine - Payment System</p>
    <p>Automated notification • {{current_date}}</p>
  </div>
</body>
</html>`,
    type: 'NOTIFICATION',
    variables: ['order_id', 'old_payment_status', 'new_payment_status', 'order_total', 'payment_method', 'transaction_id', 'payment_gateway', 'customer_name', 'customer_email', 'update_timestamp', 'admin_url', 'payment_color', 'requires_action', 'current_date'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Company Low Stock Alert',
    subject: '⚠️ Low Stock Alert: {{product_name}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #dc2626; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #fef2f2; padding: 25px; border-radius: 0 0 8px 8px; }
    .stock-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
    .button { background: #dc2626; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; }
    .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 14px; }
    .urgent { color: #dc2626; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚨 LOW STOCK ALERT</h1>
  </div>
  
  <div class="content">
    <div class="stock-info">
      <h3>{{product_name}}</h3>
      <p><strong>Current Stock:</strong> <span class="urgent">{{current_stock}} units</span></p>
      <p><strong>Reorder Level:</strong> {{reorder_level}} units</p>
      <p><strong>SKU:</strong> {{product_sku}}</p>
      <p><strong>Category:</strong> {{product_category}}</p>
      
      {{#if last_restocked}}
      <p><strong>Last Restocked:</strong> {{last_restocked}}</p>
      {{/if}}
    </div>

    <div style="background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <h4>📋 Action Required</h4>
      <p>Please reorder this product immediately to avoid stockouts and lost sales.</p>
      <p><strong>Recommended reorder quantity:</strong> {{recommended_quantity}} units</p>
    </div>

    <div style="text-align: center;">
      <a href="{{inventory_url}}" class="button">MANAGE INVENTORY</a>
    </div>
  </div>

  <div class="footer">
    <p>Evergreen Medicine - Inventory Management System</p>
    <p>Automated alert • {{current_date}}</p>
  </div>
</body>
</html>`,
    type: 'NOTIFICATION',
    variables: ['product_name', 'current_stock', 'reorder_level', 'product_sku', 'product_category', 'last_restocked', 'recommended_quantity', 'inventory_url', 'current_date'],
    status: 'active',
    isSystem: true
  },

{
    name: 'Contact Us Confirmation',
    subject: 'Thank you for contacting Evergreen Medicine!',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #2d5016; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 25px; border-radius: 0 0 8px 8px; }
    .ticket-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #2d5016; }
    .button { background: #2d5016; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📧 Message Received</h1>
    <p>We've received your inquiry</p>
  </div>
  
  <div class="content">
    <h2>Hello {{customer_name}},</h2>
    <p>Thank you for reaching out to Evergreen Medicine. We have received your message and our team will get back to you within 24-48 hours.</p>
    
    <div class="ticket-info">
      <h3>📋 Inquiry Details</h3>
      <p><strong>Ticket ID:</strong> {{ticket_id}}</p>
      <p><strong>Subject:</strong> {{contact_subject}}</p>
      <p><strong>Message:</strong><br>{{contact_message}}</p>
    </div>

    <p>We appreciate your patience and look forward to assisting you with your health and wellness needs.</p>
    
    <div style="text-align: center; margin: 20px 0;">
      <a href="{{website_url}}" class="button">Visit Our Website</a>
    </div>

    <div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin-top: 20px;">
      <h4>📞 Need Immediate Assistance?</h4>
      <p>If your matter is urgent, please call us directly at <strong>{{support_phone}}</strong> or email <strong>{{support_email}}</strong>.</p>
    </div>
  </div>

  <div class="footer">
    <p>Evergreen Medicine - Your Trusted Health Partner</p>
    <p>🌿 Natural Solutions for Better Health</p>
  </div>
</body>
</html>`,
    type: 'TRANSACTIONAL',
    variables: ['customer_name', 'customer_email', 'contact_subject', 'contact_message', 'ticket_id', 'support_email', 'support_phone', 'website_url'],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Contact Us Request',
    subject: '📧 New Contact Request: {{contact_subject}}',
    body: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; }
    .header { background: #2563eb; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 25px; border-radius: 0 0 8px 8px; }
    .contact-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
    .message-box { background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 15px 0; border: 1px solid #bae6fd; }
    .button { background: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; }
    .footer { text-align: center; margin-top: 25px; color: #64748b; font-size: 14px; }
    .urgent { background: #fef3c7; padding: 10px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📧 NEW CONTACT REQUEST</h1>
    <p>Ticket #{{ticket_id}} • {{contact_date}} at {{contact_time}}</p>
  </div>
  
  <div class="content">
    <div class="contact-info">
      <h3>👤 Contact Information</h3>
      <p><strong>Name:</strong> {{contact_name}}</p>
      <p><strong>Email:</strong> {{contact_email}}</p>
      <p><strong>Phone:</strong> {{contact_phone}}</p>
      <p><strong>Subject:</strong> {{contact_subject}}</p>
    </div>

    <div class="message-box">
      <h3>💬 Message</h3>
      <p style="white-space: pre-line; line-height: 1.8;">{{contact_message}}</p>
    </div>

    <div class="urgent">
      <h4>🚀 Action Required</h4>
      <p>Please respond to this inquiry within <strong>24 hours</strong>. The customer is expecting a timely response.</p>
    </div>

    <div style="text-align: center; margin: 25px 0;">
      <a href="{{admin_url}}" class="button">📋 VIEW IN ADMIN PANEL</a>
    </div>

    <div style="background: #ecfdf5; padding: 15px; border-radius: 6px; margin-top: 20px;">
      <h4>📝 Suggested Response Time</h4>
      <p><strong>General Inquiries:</strong> Within 24 hours</p>
      <p><strong>Product Questions:</strong> Within 12 hours</p>
      <p><strong>Urgent Matters:</strong> Within 4 hours (respond immediately)</p>
    </div>
  </div>

  <div class="footer">
    <p>This is an automated notification from Evergreen Medicine Contact System</p>
    <p>🕒 Generated on: {{current_date}}</p>
  </div>
</body>
</html>`,
    type: 'NOTIFICATION',
    variables: ['contact_name', 'contact_email', 'contact_phone', 'contact_subject', 'contact_message', 'contact_date', 'contact_time', 'admin_url', 'ticket_id', 'current_date'],
    status: 'active',
    isSystem: true
  },
  {
  name: 'Contact Status Update',
  subject: 'Update on Your Contact Request #{{ticket_id}}',
  body: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: {{status_color}}; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 25px; border-radius: 0 0 8px 8px; }
    .status-info { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid {{status_color}}; }
    .button { background: {{status_color}}; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 Status Update</h1>
    <p>Ticket #{{ticket_id}}</p>
  </div>
  
  <div class="content">
    <h2>Hello {{customer_name}},</h2>
    <p>We wanted to update you on the status of your contact request.</p>
    
    <div class="status-info">
      <h3>Status Changed</h3>
      <p><strong>New Status:</strong> <span style="background: {{status_color}}; color: #fff; padding: 4px 12px; border-radius: 15px; font-weight: bold;">{{new_status}}</span></p>
      <p><strong>Previous Status:</strong> {{old_status}}</p>
      <p><strong>Updated:</strong> {{update_timestamp}}</p>
    </div>

    <p>Our team is working on your request and will keep you updated on any further progress.</p>
    
    <div style="text-align: center; margin: 20px 0;">
      <a href="{{website_url}}/contact" class="button">View Your Request</a>
    </div>

    <div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin-top: 20px;">
      <h4>📞 Need Immediate Assistance?</h4>
      <p>If you have any questions, please contact us at <strong>{{support_email}}</strong>.</p>
    </div>
  </div>

  <div class="footer">
    <p>Evergreen Medicine - Your Trusted Health Partner</p>
  </div>
</body>
</html>`,
  type: 'TRANSACTIONAL',
  variables: ['customer_name', 'customer_email', 'ticket_id', 'old_status', 'new_status', 'status_color', 'update_timestamp', 'support_email', 'website_url'],
  status: 'active',
  isSystem: true
}


];


const defaultRules = [
  // ORDER STATUS RULES
  {
    name: 'Order Confirmation',
    description: 'Send immediate confirmation when order is placed',
    trigger: 'ORDER_PLACED',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Order Pending',
    description: 'Notify customer when order is pending',
    trigger: 'ORDER_PENDING',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Order Confirmed',
    description: 'Notify customer when order is confirmed',
    trigger: 'ORDER_CONFIRMED',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Order Processing',
    description: 'Notify customer when order starts processing',
    trigger: 'ORDER_PROCESSING',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Shipping Confirmation',
    description: 'Notify customer when order ships with tracking information',
    trigger: 'ORDER_SHIPPED',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Order Delivered',
    description: 'Notify customer when order is delivered',
    trigger: 'ORDER_DELIVERED',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Order Cancelled',
    description: 'Notify customer when order is cancelled',
    trigger: 'ORDER_CANCELLED',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Order Refunded',
    description: 'Notify customer when order is refunded',
    trigger: 'ORDER_REFUNDED',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Order Failed',
    description: 'Notify customer when order fails',
    trigger: 'ORDER_FAILED',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },

  // PAYMENT STATUS RULES
  {
    name: 'Payment Pending',
    description: 'Notify customer when payment is pending',
    trigger: 'PAYMENT_PENDING',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Payment Succeeded',
    description: 'Notify customer when payment is successful',
    trigger: 'PAYMENT_SUCCEEDED',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Payment Failed',
    description: 'Notify customer when payment fails with retry link',
    trigger: 'PAYMENT_FAILED',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Payment Refunded',
    description: 'Notify customer when payment is refunded',
    trigger: 'PAYMENT_REFUNDED',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Payment Partially Refunded',
    description: 'Notify customer when payment is partially refunded',
    trigger: 'PAYMENT_PARTIALLY_REFUNDED',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },

  // COMPANY NOTIFICATION RULES
  {
    name: 'Company New Order Received',
    description: 'Notify company team when new order is received',
    trigger: 'COMPANY_NEW_ORDER', // Updated trigger name
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Company Order Status Update',
    description: 'Notify company team when order status changes',
    trigger: 'COMPANY_ORDER_STATUS_UPDATE', // Updated trigger name
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Company Payment Status Update',
    description: 'Notify company team when payment status changes',
    trigger: 'COMPANY_PAYMENT_STATUS_UPDATE', // Updated trigger name
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Company Low Stock Alert',
    description: 'Notify company team when product stock is low',
    trigger: 'COMPANY_LOW_STOCK', // Updated trigger name
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },

  // EXISTING RULES (Welcome, Delivery Follow-up, Low Stock Alert)
  {
    name: 'Welcome Email',
    description: 'Send welcome email to new users with discount code',
    trigger: 'USER_REGISTERED',
    delayHours: 1,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Delivery Follow-up',
    description: 'Request review 3 days after delivery',
    trigger: 'ORDER_DELIVERED',
    delayHours: 72,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 2,
    maxAttempts: 3
  },
  {
    name: 'Low Stock Alert',
    description: 'Notify admin when product stock is low',
    trigger: 'LOW_STOCK',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Contact Us Confirmation',
    description: 'Send confirmation email to customer when contact form is submitted',
    trigger: 'CONTACT_US_CONFIRMATION',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Contact Us Request',
    description: 'Notify company team when new contact request is submitted',
    trigger: 'CONTACT_US_REQUEST',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  },
  {
    name: 'Contact Status Update',
    description: 'Notify customer when contact request status is updated',
    trigger: 'CONTACT_STATUS_UPDATE',
    delayHours: 0,
    conditions: [],
    status: 'active', // Changed from enum to string
    priority: 1,
    maxAttempts: 3
  }
];

// ... rest of the seed file remains the same ...

async function seedEmailAutomation() {
  try {
    console.log('🌱 Starting email automation seeding...');

    // Check if templates already exist
    const existingTemplates = await prisma.emailTemplate.findMany({
      where: { isSystem: true }
    });

    if (existingTemplates.length > 0) {
      console.log(`📧 Found ${existingTemplates.length} existing templates. Updating templates...`);
      
      // Update existing templates and create new ones
      for (const templateData of defaultTemplates) {
        const { category, ...cleanTemplateData } = templateData;
        
        const existing = await prisma.emailTemplate.findFirst({
          where: { name: cleanTemplateData.name, isSystem: true }
        });

        if (existing) {
          // Update existing template
          await prisma.emailTemplate.update({
            where: { id: existing.id },
            data: {
              ...cleanTemplateData,
              variables: JSON.stringify(cleanTemplateData.variables)
            }
          });
          console.log(`✅ Updated template: ${cleanTemplateData.name}`);
        } else {
          // Create new template
          await prisma.emailTemplate.create({
            data: {
              ...cleanTemplateData,
              variables: JSON.stringify(cleanTemplateData.variables)
            }
          });
          console.log(`✅ Created template: ${cleanTemplateData.name}`);
        }
      }
    } else {
      // Create all templates
      console.log('📝 Creating email templates...');
      for (const templateData of defaultTemplates) {
        const { category, ...cleanTemplateData } = templateData;
        
        await prisma.emailTemplate.create({
          data: {
            ...cleanTemplateData,
            variables: JSON.stringify(cleanTemplateData.variables)
          }
        });
        console.log(`✅ Created template: ${cleanTemplateData.name}`);
      }
    }

    // Check if rules already exist
    const existingRules = await prisma.automationRule.findMany({
      where: { isDeleted: false }
    });

    if (existingRules.length > 0) {
      console.log(`⚙️ Found ${existingRules.length} existing rules. Updating rules...`);
      
      // Get all templates to map names to IDs
      const templates = await prisma.emailTemplate.findMany();
      const templateMap = {};
      templates.forEach(template => {
        templateMap[template.name] = template.id;
      });

      // Update existing rules and create new ones
      for (const ruleData of defaultRules) {
        const templateName = ruleData.name;
        const templateId = templateMap[templateName];
        
        if (!templateId) {
          console.log(`❌ Template not found for rule: ${ruleData.name}`);
          continue;
        }

        const existing = await prisma.automationRule.findFirst({
          where: { name: ruleData.name, isDeleted: false }
        });

        if (existing) {
          // Update existing rule
          await prisma.automationRule.update({
            where: { id: existing.id },
            data: {
              ...ruleData,
              templateId: templateId,
              conditions: JSON.stringify(ruleData.conditions)
            }
          });
          console.log(`✅ Updated rule: ${ruleData.name}`);
        } else {
          // Create new rule
          await prisma.automationRule.create({
            data: {
              ...ruleData,
              templateId: templateId,
              conditions: JSON.stringify(ruleData.conditions)
            }
          });
          console.log(`✅ Created rule: ${ruleData.name}`);
        }
      }
    } else {
      // Get all templates to map names to IDs
      const templates = await prisma.emailTemplate.findMany();
      const templateMap = {};
      templates.forEach(template => {
        templateMap[template.name] = template.id;
      });

      // Create all rules
      console.log('🔧 Creating automation rules...');
      for (const ruleData of defaultRules) {
        const templateName = ruleData.name;
        const templateId = templateMap[templateName];
        
        if (!templateId) {
          console.log(`❌ Template not found for rule: ${ruleData.name}`);
          continue;
        }

        await prisma.automationRule.create({
          data: {
            ...ruleData,
            templateId: templateId,
            conditions: JSON.stringify(ruleData.conditions)
          }
        });
        console.log(`✅ Created rule: ${ruleData.name}`);
      }
    }

    console.log('🎉 Email automation seeding completed successfully!');
    
    // Display summary
    const templateCount = await prisma.emailTemplate.count({ where: { isDeleted: false } });
    const ruleCount = await prisma.automationRule.count({ where: { isDeleted: false } });
    const activeRuleCount = await prisma.automationRule.count({ 
      where: { isDeleted: false, status: 'active' } 
    });

    console.log('\n📊 Summary:');
    console.log(`   Templates: ${templateCount}`);
    console.log(`   Rules: ${ruleCount} (${activeRuleCount} active)`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    console.error('Error details:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedEmailAutomation()
    .then(() => {
      console.log('✨ Seeding process finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding process failed:', error);
      process.exit(1);
    });
}

module.exports = { seedEmailAutomation };