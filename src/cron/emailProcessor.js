// src/cron/emailProcessor.js
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('../utils/encryption');
require('dotenv').config();

const prisma = new PrismaClient();
let transporter;
let currentSettings = null;

const getSmtpSettings = async () => {
  try {
    // Try environment variables first (more reliable)
    if (process.env.SMTP_HOST && process.env.SMTP_USERNAME && process.env.SMTP_PASSWORD) {
      console.log('Using environment variable SMTP settings...');
      const envSettings = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 465,
        secure: true,
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD
        },
        tls: { rejectUnauthorized: false },
        fromEmail: process.env.SMTP_FROM_EMAIL,
        fromName: process.env.SMTP_FROM_NAME,
        isTested: false
      };
      currentSettings = envSettings;
      return envSettings;
    }

    // Fallback to database settings
    console.log('Fetching SMTP settings from database...');
    const settings = await prisma.integrationSettings.findFirst({
      where: { isActive: true, isDeleted: false }
    });

    if (!settings) {
      throw new Error('No active integration settings found');
    }

    let password;
    try {
      // Try to decrypt the password
      password = decrypt(settings.smtpPassword || '');
      // console.log('Database fetched email', settings)
      // console.log('Password decrypted successfully', password);
    } catch (decryptError) {
      console.error('Password decryption failed, using as plain text:', decryptError.message);
      password = settings.smtpPassword; // Use as plain text if decryption fails
    }

    const dbSettings = {
      host: settings.smtpHost,
      port: settings.smtpPort || 465,
      secure: settings.smtpEncryption === 'ssl',
      auth: {
        user: settings.smtpUsername,
        pass: password
      },
      tls: { rejectUnauthorized: false },
      fromEmail: settings.smtpFromEmail,
      fromName: settings.smtpFromName,
      isTested: settings.isSmtpTested
    };

    console.log('SMTP settings loaded from database');
    currentSettings = dbSettings;
    return dbSettings;

  } catch (error) {
    console.error('Error loading SMTP settings:', error.message);
    throw new Error('Failed to load SMTP configuration');
  }
};

const createTransporter = async () => {
  try {
    const settings = await getSmtpSettings();
    
    if (transporter && currentSettings && 
        JSON.stringify(settings) === JSON.stringify(currentSettings)) {
      return transporter;
    }

    // Create new transporter with current settings
    transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.auth.user,
        pass: settings.auth.pass
      },
      tls: settings.tls
    });

    console.log('SMTP transporter created with database settings');
    return transporter;
  } catch (error) {
    console.error('Error creating SMTP transporter:', error);
    throw error;
  }
};

const sendEmail = async (to, subject, body, from = null) => {
  try {
    console.log(`Sending email to: ${to}`);
    console.log(`Subject: ${subject}`);
    
    const mailTransporter = await createTransporter();
    const settings = currentSettings || await getSmtpSettings();

    const fromEmail = from || settings.fromEmail || process.env.SMTP_FROM_EMAIL;
    const fromName = settings.fromName || process.env.SMTP_FROM_NAME || 'Evergreen Medicine';

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: to,
      subject: subject,
      html: body,
      text: body.replace(/<[^>]*>/g, ''), // Basic HTML to text conversion
      headers: {
        'X-Auto-Response-Suppress': 'OOF, AutoReply'
      }
    };

    const result = await mailTransporter.sendMail(mailOptions);
    console.log(`Email sent successfully: ${result.messageId}`);
    
    return { 
      success: true, 
      messageId: result.messageId,
      response: result.response 
    };
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

const processQueuedEmails = async () => {
  try {
    console.log('Processing queued emails...');
    
    const now = new Date();
    
    // Find pending emails that are scheduled for now or earlier
    const queuedEmails = await prisma.queuedEmail.findMany({
      where: {
        status: 'pending',
        scheduledFor: {
          lte: now
        },
        isDeleted: false,
        attempts: {
          lt: 3 // max attempts
        }
      },
      include: {
        template: true,
        rule: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      take: 50 // Process in batches
    });

    console.log(`Found ${queuedEmails.length} emails to process`);

    for (const email of queuedEmails) {
      try {
        // Update status to processing
        await prisma.queuedEmail.update({
          where: { id: email.id },
          data: { 
            status: 'processing',
            attempts: { increment: 1 }
          }
        });

        // Send the email
        await sendEmail(email.recipientEmail, email.subject, email.body);

        // Update status to sent and record success
        await prisma.queuedEmail.update({
          where: { id: email.id },
          data: { 
            status: 'sent',
            sentAt: new Date()
          }
        });

        // Log the successful email
        await prisma.emailLog.create({
          data: {
            templateId: email.templateId,
            ruleId: email.ruleId,
            recipient: email.recipientEmail,
            subject: email.subject,
            status: 'sent',
            messageId: `queued-${email.id}`
          }
        });

        console.log(`Successfully sent email ${email.id} to ${email.recipientEmail}`);

      } catch (error) {
        console.error(`Failed to send email ${email.id}:`, error.message);
        
        // Update status based on attempts
        const newStatus = email.attempts + 1 >= 3 ? 'failed' : 'pending';
        
        await prisma.queuedEmail.update({
          where: { id: email.id },
          data: { 
            status: newStatus,
            error: error.message.substring(0, 500) // Limit error length
          }
        });

        // Log the failed email
        await prisma.emailLog.create({
          data: {
            templateId: email.templateId,
            ruleId: email.ruleId,
            recipient: email.recipientEmail,
            subject: email.subject,
            status: 'failed',
            error: error.message.substring(0, 500)
          }
        });
      }
    }

    console.log('Email processing completed');
  } catch (error) {
    console.error('Email processor error:', error);
  }
};

const cleanupOldEmails = async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Clean up sent emails older than 30 days
    const result = await prisma.queuedEmail.deleteMany({
      where: {
        status: 'sent',
        sentAt: {
          lt: thirtyDaysAgo
        }
      }
    });
    
    console.log(`Cleaned up ${result.count} old sent emails`);
  } catch (error) {
    console.error('Cleanup old emails error:', error);
  }
};

const testEmailConnection = async () => {
  try {
    const mailTransporter = await createTransporter();
    
    return new Promise((resolve, reject) => {
      mailTransporter.verify((error, success) => {
        if (error) {
          console.error('Email configuration error:', error);
          reject(error);
        } else {
          console.log('Email server is ready to send messages');
          resolve(success);
        }
      });
    });
  } catch (error) {
    console.error('Email connection test failed:', error);
    throw error;
  }
};

const refreshSmtpSettings = async () => {
  try {
    console.log('Refreshing SMTP settings...');
    currentSettings = null;
    transporter = null;
    await getSmtpSettings();
    console.log('SMTP settings refreshed');
  } catch (error) {
    console.error('Error refreshing SMTP settings:', error);
  }
};

const startEmailProcessor = async () => {
  try {
    console.log('Starting email processor cron job...');
    
    // Test email configuration on startup
    await testEmailConnection();
    
    // Run every 5 minutes for email processing
    cron.schedule('*/5 * * * *', processQueuedEmails);
    
    // Run cleanup daily at 2 AM
    cron.schedule('0 2 * * *', cleanupOldEmails);
    
    // Refresh SMTP settings every hour to pick up changes
    cron.schedule('0 * * * *', refreshSmtpSettings);
    
    // Also run immediately on startup
    setTimeout(processQueuedEmails, 5000); // Delay 5 seconds to ensure everything is loaded
    
    console.log('Email processor started successfully');
  } catch (error) {
    console.error('Failed to start email processor:', error);
    // Don't crash the app, but log the error
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down email processor...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down email processor...');
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = { 
  startEmailProcessor, 
  processQueuedEmails,
  sendEmail,
  createTransporter,
  testEmailConnection,
  getSmtpSettings,
  refreshSmtpSettings
};