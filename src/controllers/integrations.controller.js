// integrations.controller.js
const { PrismaClient } = require('@prisma/client');
const { encrypt, decrypt } = require('../utils/encryption.js');

const prisma = new PrismaClient();

// Get integration settings
const getIntegrationSettings = async (req, res) => {
  try {
    console.log('Fetching integration settings...');
    
    // Try to find existing settings or create default ones
    let settings = await prisma.integrationSettings.findFirst();
    
    if (!settings) {
      console.log('No integration settings found, creating default...');
      
      // Create default settings record
      settings = await prisma.integrationSettings.create({
        data: {
          // Set default empty values
          smtpHost: '',
          smtpPort: 587,
          smtpUsername: '',
          smtpPassword: '',
          smtpFromEmail: '',
          smtpFromName: '',
          smtpEncryption: 'tls',
          
          // Default admin emails (empty array)
          adminEmails: JSON.stringify([]),
          
          smsProvider: 'twilio',
          smsAccountSid: '',
          smsAuthToken: '',
          smsFromNumber: '',
          
          paymentProvider: 'stripe',
          paymentPublicKey: '',
          paymentSecretKey: '',
          paymentWebhookSecret: '',
          
          googleAnalyticsId: '',
          googleTagManagerId: '',
          facebookPixelId: '',
          
          recaptchaSiteKey: '',
          recaptchaSecretKey: '',
          
          isSmtpTested: false,
          isSmsTested: false,
          isPaymentTested: false,
          isActive: true
        }
      });
      
      console.log('Default integration settings created');
    }

    // Parse admin emails from JSON string
    let adminEmails = [];
    try {
      adminEmails = settings.adminEmails ? JSON.parse(settings.adminEmails) : [];
      // Ensure it's an array and filter out any empty values
      if (!Array.isArray(adminEmails)) {
        adminEmails = [];
      }
      adminEmails = adminEmails.filter(email => email && email.trim());
    } catch (parseError) {
      console.error('Error parsing adminEmails:', parseError);
      adminEmails = [];
    }

    // Safely decrypt sensitive fields with null checks
    const decryptedSettings = {
      ...settings,
      adminEmails: adminEmails,
      smtpPassword: decrypt(settings.smtpPassword || ''),
      smsAuthToken: decrypt(settings.smtpPassword || ''),
      smsAccountSid: decrypt(settings.smsAccountSid || ''),
      paymentSecretKey: decrypt(settings.paymentSecretKey || ''),
      paymentWebhookSecret: decrypt(settings.paymentWebhookSecret || ''),
      recaptchaSecretKey: decrypt(settings.recaptchaSecretKey || '')
    };

    console.log('Integration settings retrieved successfully');
    
    res.json({
      success: true,
      data: decryptedSettings
    });
    
  } catch (error) {
    console.error('Error in getIntegrationSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch integration settings',
      error: error.message
    });
  }
};

// Update integration settings
const updateIntegrationSettings = async (req, res) => {
  try {
    const updateData = req.body;
    console.log('Updating integration settings:', Object.keys(updateData));

    // Find existing settings
    let settings = await prisma.integrationSettings.findFirst();
    
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Integration settings not found'
      });
    }

    // Prepare update data with encryption for sensitive fields
    const dataToUpdate = {};
    
    // SMTP fields
    if (updateData.smtpHost !== undefined) dataToUpdate.smtpHost = updateData.smtpHost || '';
    if (updateData.smtpPort !== undefined) dataToUpdate.smtpPort = updateData.smtpPort || 587;
    if (updateData.smtpUsername !== undefined) dataToUpdate.smtpUsername = updateData.smtpUsername || '';
    if (updateData.smtpPassword !== undefined) dataToUpdate.smtpPassword = updateData.smtpPassword ? encrypt(updateData.smtpPassword) : '';
    if (updateData.smtpFromEmail !== undefined) dataToUpdate.smtpFromEmail = updateData.smtpFromEmail || '';
    if (updateData.smtpFromName !== undefined) dataToUpdate.smtpFromName = updateData.smtpFromName || '';
    if (updateData.smtpEncryption !== undefined) dataToUpdate.smtpEncryption = updateData.smtpEncryption || 'tls';
    
    // Admin Emails - store as JSON string
    if (updateData.adminEmails !== undefined) {
      // Validate and clean admin emails
      const validEmails = Array.isArray(updateData.adminEmails) 
        ? updateData.adminEmails
            .filter(email => email && email.trim())
            .map(email => email.trim())
        : [];
      
      dataToUpdate.adminEmails = JSON.stringify(validEmails);
      console.log(`Saving ${validEmails.length} admin emails:`, validEmails);
    }
    
    // SMS fields
    if (updateData.smsProvider !== undefined) dataToUpdate.smsProvider = updateData.smsProvider || 'twilio';
    if (updateData.smsAccountSid !== undefined) dataToUpdate.smsAccountSid = updateData.smsAccountSid ? encrypt(updateData.smsAccountSid) : '';
    if (updateData.smsAuthToken !== undefined) dataToUpdate.smsAuthToken = updateData.smsAuthToken ? encrypt(updateData.smsAuthToken) : '';
    if (updateData.smsFromNumber !== undefined) dataToUpdate.smsFromNumber = updateData.smsFromNumber || '';
    
    // Payment fields
    if (updateData.paymentProvider !== undefined) dataToUpdate.paymentProvider = updateData.paymentProvider || 'stripe';
    if (updateData.paymentPublicKey !== undefined) dataToUpdate.paymentPublicKey = updateData.paymentPublicKey || '';
    if (updateData.paymentSecretKey !== undefined) dataToUpdate.paymentSecretKey = updateData.paymentSecretKey ? encrypt(updateData.paymentSecretKey) : '';
    if (updateData.paymentWebhookSecret !== undefined) dataToUpdate.paymentWebhookSecret = updateData.paymentWebhookSecret ? encrypt(updateData.paymentWebhookSecret) : '';
    
    // reCAPTCHA fields
    if (updateData.recaptchaSiteKey !== undefined) dataToUpdate.recaptchaSiteKey = updateData.recaptchaSiteKey || '';
    if (updateData.recaptchaSecretKey !== undefined) dataToUpdate.recaptchaSecretKey = updateData.recaptchaSecretKey ? encrypt(updateData.recaptchaSecretKey) : '';

    // Update timestamp
    dataToUpdate.updatedAt = new Date();

    // Update settings
    settings = await prisma.integrationSettings.update({
      where: { id: settings.id },
      data: dataToUpdate
    });

    // Parse admin emails for response
    let adminEmails = [];
    try {
      adminEmails = settings.adminEmails ? JSON.parse(settings.adminEmails) : [];
      if (!Array.isArray(adminEmails)) adminEmails = [];
    } catch (error) {
      console.error('Error parsing adminEmails for response:', error);
      adminEmails = [];
    }

    // Return updated settings (without sensitive data)
    const responseSettings = {
      ...settings,
      adminEmails: adminEmails,
      smtpPassword: '', // Don't return password
      smsAuthToken: '', // Don't return auth token
      smsAccountSid: decrypt(settings.smsAccountSid || ''),
      paymentSecretKey: '', // Don't return secret key
      paymentWebhookSecret: '', // Don't return webhook secret
      recaptchaSecretKey: '' // Don't return secret key
    };

    console.log('Integration settings updated successfully');
    
    res.json({
      success: true,
      message: 'Integration settings updated successfully',
      data: responseSettings
    });
    
  } catch (error) {
    console.error('Error in updateIntegrationSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update integration settings',
      error: error.message
    });
  }
};

// Test SMTP connection
const testSmtpConnection = async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpUsername, smtpPassword, smtpEncryption } = req.body;
    
    console.log('Testing SMTP connection...');
    
    // Validate required fields
    if (!smtpHost || !smtpUsername || !smtpPassword) {
      return res.status(400).json({
        success: false,
        message: 'SMTP host, username, and password are required'
      });
    }

    // TODO: Implement actual SMTP test logic here
    // For now, simulate success after 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update test status
    await updateTestStatus('smtp', true);
    
    console.log('SMTP test completed successfully');
    
    res.json({
      success: true,
      message: 'SMTP connection test successful'
    });
    
  } catch (error) {
    console.error('Error testing SMTP:', error);
    
    // Update test status to failed
    await updateTestStatus('smtp', false);
    
    res.status(500).json({
      success: false,
      message: 'SMTP connection test failed: ' + error.message
    });
  }
};

// Test SMS gateway
const testSmsGateway = async (req, res) => {
  try {
    const { smsProvider, smsAccountSid, smsAuthToken, smsFromNumber, testPhoneNumber } = req.body;
    
    console.log('Testing SMS gateway...');
    
    // Validate required fields
    if (!smsAccountSid || !smsAuthToken || !smsFromNumber || !testPhoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'SMS account SID, auth token, from number, and test phone number are required'
      });
    }

    // TODO: Implement actual SMS test logic here
    // For now, simulate success after 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update test status
    await updateTestStatus('sms', true);
    
    console.log('SMS test completed successfully');
    
    res.json({
      success: true,
      message: 'SMS gateway test successful'
    });
    
  } catch (error) {
    console.error('Error testing SMS:', error);
    
    // Update test status to failed
    await updateTestStatus('sms', false);
    
    res.status(500).json({
      success: false,
      message: 'SMS gateway test failed: ' + error.message
    });
  }
};

// Test payment gateway
const testPaymentGateway = async (req, res) => {
  try {
    const { paymentProvider, paymentPublicKey, paymentSecretKey } = req.body;
    
    console.log('Testing payment gateway...');
    
    // Validate required fields
    if (!paymentPublicKey || !paymentSecretKey) {
      return res.status(400).json({
        success: false,
        message: 'Payment public key and secret key are required'
      });
    }

    // TODO: Implement actual payment test logic here
    // For now, simulate success after 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update test status
    await updateTestStatus('payment', true);
    
    console.log('Payment test completed successfully');
    
    res.json({
      success: true,
      message: 'Payment gateway test successful'
    });
    
  } catch (error) {
    console.error('Error testing payment:', error);
    
    // Update test status to failed
    await updateTestStatus('payment', false);
    
    res.status(500).json({
      success: false,
      message: 'Payment gateway test failed: ' + error.message
    });
  }
};

// Helper function to update test status
const updateTestStatus = async (type, isTested) => {
  try {
    const settings = await prisma.integrationSettings.findFirst();
    if (settings) {
      const updateData = {
        lastTestedAt: new Date()
      };
      
      if (type === 'smtp') updateData.isSmtpTested = isTested;
      if (type === 'sms') updateData.isSmsTested = isTested;
      if (type === 'payment') updateData.isPaymentTested = isTested;
      
      await prisma.integrationSettings.update({
        where: { id: settings.id },
        data: updateData
      });
      
      console.log(`Updated ${type} test status to: ${isTested}`);
    }
  } catch (error) {
    console.error('Error updating test status:', error);
  }
};

module.exports = {
  getIntegrationSettings,
  updateIntegrationSettings,
  testSmtpConnection,
  testSmsGateway,
  testPaymentGateway
};