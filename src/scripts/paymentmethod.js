const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migratePaymentMethods() {
  console.log('Starting payment method migration...');

  try {
    // 1. Create default payment methods based on common payment methods
    const defaultPaymentMethods = [
      { 
        code: 'CREDIT_CARD', 
        name: 'Credit Card', 
        description: 'Pay with Visa, MasterCard, American Express', 
        instructions: 'Enter your card details to complete the payment',
        isActive: true, 
        isDefault: true,
        supportsRefunds: true,
        processingFee: 2.5
      },
      { 
        code: 'DEBIT_CARD', 
        name: 'Debit Card', 
        description: 'Pay with your debit card', 
        instructions: 'Enter your debit card details',
        isActive: true,
        supportsRefunds: true,
        processingFee: 1.5
      },
      { 
        code: 'PAYPAL', 
        name: 'PayPal', 
        description: 'Pay using your PayPal account', 
        instructions: 'You will be redirected to PayPal to complete your payment',
        isActive: true,
        supportsRefunds: true,
        processingFee: 2.9
      },
      { 
        code: 'STRIPE', 
        name: 'Stripe', 
        description: 'Secure online payments via Stripe', 
        instructions: 'Enter your card details for secure processing',
        isActive: true,
        supportsRefunds: true,
        processingFee: 2.9
      },
      { 
        code: 'BANK_TRANSFER', 
        name: 'Bank Transfer', 
        description: 'Direct bank transfer', 
        instructions: 'Transfer the amount to our bank account. Use order ID as reference.',
        isActive: true,
        requiresAuthorization: true,
        supportsRefunds: false,
        processingFee: 0
      },
      { 
        code: 'CASH_ON_DELIVERY', 
        name: 'Cash on Delivery', 
        description: 'Pay when you receive your order', 
        instructions: 'Pay cash to the delivery person when you receive your order',
        isActive: true,
        requiresAuthorization: false,
        supportsRefunds: false,
        processingFee: 0
      },
      { 
        code: 'GIFT_CARD', 
        name: 'Gift Card', 
        description: 'Pay with gift card', 
        instructions: 'Enter your gift card code during checkout',
        isActive: true,
        supportsRefunds: false,
        processingFee: 0
      }
    ];

    console.log('Creating default payment methods...');
    
    for (const methodData of defaultPaymentMethods) {
      const existing = await prisma.paymentMethod.findFirst({
        where: { code: methodData.code }
      });
      
      if (!existing) {
        await prisma.paymentMethod.create({
          data: methodData
        });
        console.log(`Created payment method: ${methodData.name}`);
      } else {
        console.log(`Payment method already exists: ${methodData.name}`);
      }
    }

    // 2. Get all payment methods for mapping
    const paymentMethods = await prisma.paymentMethod.findMany();
    const paymentMethodMap = {};
    paymentMethods.forEach(pm => {
      paymentMethodMap[pm.code] = pm.id;
    });

    // 3. Set a default payment method for all orders that don't have one
    console.log('Setting default payment methods for orders...');
    const defaultPaymentMethod = await prisma.paymentMethod.findFirst({
      where: { isDefault: true }
    });

    if (defaultPaymentMethod) {
      // Update orders with null paymentMethodCode
      const ordersToUpdate = await prisma.order.findMany({
        where: { 
          paymentMethodCode: null 
        }
      });

      let orderUpdates = 0;
      for (const order of ordersToUpdate) {
        await prisma.order.update({
          where: { id: order.id },
          data: { 
            paymentMethodCode: defaultPaymentMethod.code
          }
        });
        orderUpdates++;
      }
      console.log(`Set default payment method for ${orderUpdates} Order records`);
    }

    // 4. Set paymentMethodId for all payments that don't have one
    console.log('Setting payment methods for payments...');
    const paymentsToUpdate = await prisma.payment.findMany({
      where: {
        paymentMethodId: null
      },
      include: {
        order: true
      }
    });

    let paymentUpdates = 0;
    for (const payment of paymentsToUpdate) {
      let paymentMethodCode = null;
      
      // Try to get payment method from order first
      if (payment.order && payment.order.paymentMethodCode) {
        paymentMethodCode = payment.order.paymentMethodCode;
      }
      // Fallback to default payment method
      else if (defaultPaymentMethod) {
        paymentMethodCode = defaultPaymentMethod.code;
      }

      if (paymentMethodCode && paymentMethodMap[paymentMethodCode]) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { 
            paymentMethodId: paymentMethodMap[paymentMethodCode]
          }
        });
        paymentUpdates++;
      }
    }
    console.log(`Updated ${paymentUpdates} Payment records`);

    console.log('Payment method migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migratePaymentMethods();