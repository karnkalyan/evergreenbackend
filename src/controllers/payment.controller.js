// --- GET ALL PAYMENTS FOR THE AUTHENTICATED USER ---
async function getUserPayments(req, res, next) {
    try {
        const userId = req.user.id;

        const payments = await req.prisma.payment.findMany({
            where: { 
                order: {
                    userId: userId
                }
            },
            include: {
                order: {
                    select: {
                        orderNumber: true,
                        totalAmount: true,
                        currency: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json(payments);
    } catch (err) {
        next(err);
    }
}

// --- GET PAYMENT BY ID ---
async function getPaymentById(req, res, next) {
    try {
        const id = Number(req.params.id);
        const userId = req.user.id;

        const payment = await req.prisma.payment.findFirst({
            where: { 
                id: id,
                order: {
                    userId: userId
                }
            },
            include: {
                order: {
                    select: {
                        orderNumber: true,
                        totalAmount: true,
                        currency: true,
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
                    }
                }
            }
        });

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found or unauthorized.' });
        }

        res.json(payment);
    } catch (err) {
        next(err);
    }
}

// --- PROCESS PAYMENT FOR ORDER ---
async function processPayment(req, res, next) {
    try {
        const userId = req.user.id;
        const { orderId, paymentMethod, paymentDetails } = req.body;

        // Validate required fields
        if (!orderId || !paymentMethod) {
            return res.status(400).json({ 
                error: 'Missing required fields: orderId and paymentMethod are required.' 
            });
        }

        // Check if order exists and belongs to the user
        const order = await req.prisma.order.findFirst({
            where: { 
                id: orderId,
                userId: userId
            },
            include: {
                payment: true
            }
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found or unauthorized.' });
        }

        // Check if payment already exists and is completed
        if (order.payment && order.payment.paymentStatus === 'paid') {
            return res.status(400).json({ error: 'Payment already processed for this order.' });
        }

        // Validate payment method
        const validPaymentMethods = [
            'credit_card', 'debit_card', 'paypal', 'stripe', 
            'zelle', 'venmo', 'gift_card', 'bank_transfer', 'cash_on_delivery'
        ];
        
        if (!validPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({ 
                error: 'Invalid payment method.',
                validMethods: validPaymentMethods
            });
        }

        // Process payment based on method
        let transactionId;
        let paymentStatus = 'pending';
        let gatewayResponse = {};

        // Simulate payment processing - in real app, integrate with payment gateways
        switch (paymentMethod) {
            case 'credit_card':
            case 'debit_card':
                // Simulate card payment processing
                transactionId = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                paymentStatus = 'paid';
                gatewayResponse = {
                    gateway: 'stripe_simulated',
                    status: 'succeeded',
                    processedAt: new Date().toISOString()
                };
                break;

            case 'paypal':
                transactionId = `paypal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                paymentStatus = 'paid';
                gatewayResponse = {
                    gateway: 'paypal_simulated',
                    status: 'completed',
                    payerId: `P${Math.random().toString(36).substr(2, 9)}`
                };
                break;

            case 'zelle':
                transactionId = `zelle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                paymentStatus = 'pending'; // Zelle payments may take time
                gatewayResponse = {
                    gateway: 'zelle_simulated',
                    status: 'processing',
                    note: 'Payment processing via Zelle'
                };
                break;

            case 'venmo':
                transactionId = `venmo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                paymentStatus = 'paid';
                gatewayResponse = {
                    gateway: 'venmo_simulated',
                    status: 'completed',
                    venmoUserId: `V${Math.random().toString(36).substr(2, 9)}`
                };
                break;

            case 'gift_card':
                transactionId = `gift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                paymentStatus = 'paid';
                gatewayResponse = {
                    gateway: 'gift_card_simulated',
                    status: 'redeemed',
                    cardLastFour: paymentDetails?.cardLastFour || '1234'
                };
                break;

            case 'bank_transfer':
                transactionId = `bank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                paymentStatus = 'pending'; // Bank transfers take time
                gatewayResponse = {
                    gateway: 'bank_transfer_simulated',
                    status: 'initiated',
                    reference: `REF${Date.now()}`
                };
                break;

            case 'cash_on_delivery':
                transactionId = `cod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                paymentStatus = 'pending'; // Payment on delivery
                gatewayResponse = {
                    gateway: 'cash_on_delivery',
                    status: 'pending_pickup'
                };
                break;

            default:
                return res.status(400).json({ error: 'Unsupported payment method.' });
        }

        // Use transaction to ensure data consistency
        const [payment, updatedOrder, orderHistory] = await req.prisma.$transaction([
            // Create or update payment record
            order.payment 
                ? req.prisma.payment.update({
                    where: { id: order.payment.id },
                    data: {
                        paymentMethod,
                        paymentStatus,
                        amount: order.totalAmount,
                        transactionId,
                        gatewayResponse,
                        lastFourDigits: paymentDetails?.lastFourDigits,
                        cardBrand: paymentDetails?.cardBrand,
                        paidAt: paymentStatus === 'paid' ? new Date() : null,
                        updatedAt: new Date()
                    }
                })
                : req.prisma.payment.create({
                    data: {
                        orderId: orderId,
                        paymentMethod,
                        paymentStatus,
                        amount: order.totalAmount,
                        currency: order.currency,
                        transactionId,
                        gatewayResponse,
                        lastFourDigits: paymentDetails?.lastFourDigits,
                        cardBrand: paymentDetails?.cardBrand,
                        paidAt: paymentStatus === 'paid' ? new Date() : null
                    }
                }),

            // Update order payment status
            req.prisma.order.update({
                where: { id: orderId },
                data: {
                    paymentStatus,
                    paidAt: paymentStatus === 'paid' ? new Date() : null,
                    status: paymentStatus === 'paid' ? 'confirmed' : 'pending_payment'
                }
            }),

            // Create order history record
            req.prisma.orderHistory.create({
                data: {
                    orderId: orderId,
                    oldStatus: order.status,
                    newStatus: paymentStatus === 'paid' ? 'confirmed' : 'pending_payment',
                    notes: `Payment ${paymentStatus} via ${paymentMethod}${transactionId ? ` - Transaction: ${transactionId}` : ''}`
                }
            })
        ]);

        res.status(201).json({
            success: true,
            payment,
            orderStatus: paymentStatus === 'paid' ? 'confirmed' : 'pending_payment',
            message: `Payment ${paymentStatus} successfully.`
        });

    } catch (err) {
        next(err);
    }
}

// --- UPDATE PAYMENT STATUS (Admin/System use) ---
async function updatePaymentStatus(req, res, next) {
    try {
        const id = Number(req.params.id);
        const { paymentStatus, transactionId, gatewayResponse, notes } = req.body;

        // Check if payment exists
        const existingPayment = await req.prisma.payment.findUnique({ 
            where: { id },
            include: {
                order: true
            }
        });

        if (!existingPayment) {
            return res.status(404).json({ error: 'Payment not found.' });
        }

        // Validate payment status
        const validStatuses = ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'];
        if (paymentStatus && !validStatuses.includes(paymentStatus)) {
            return res.status(400).json({ 
                error: 'Invalid payment status.',
                validStatuses: validStatuses
            });
        }

        // Prepare update data
        const updateData = {};
        if (paymentStatus) updateData.paymentStatus = paymentStatus;
        if (transactionId) updateData.transactionId = transactionId;
        if (gatewayResponse) updateData.gatewayResponse = gatewayResponse;
        updateData.updatedAt = new Date();

        // Set paidAt if status changes to paid
        if (paymentStatus === 'paid' && existingPayment.paymentStatus !== 'paid') {
            updateData.paidAt = new Date();
        }

        // Set failedAt if status changes to failed
        if (paymentStatus === 'failed' && existingPayment.paymentStatus !== 'failed') {
            updateData.failedAt = new Date();
        }

        // Set refundedAt if status changes to refunded
        if ((paymentStatus === 'refunded' || paymentStatus === 'partially_refunded') && 
            existingPayment.paymentStatus !== 'refunded' && existingPayment.paymentStatus !== 'partially_refunded') {
            updateData.refundedAt = new Date();
        }

        // Use transaction for data consistency
        const [updatedPayment, updatedOrder, orderHistory] = await req.prisma.$transaction([
            // Update payment
            req.prisma.payment.update({
                where: { id },
                data: updateData
            }),

            // Update order payment status
            req.prisma.order.update({
                where: { id: existingPayment.orderId },
                data: {
                    paymentStatus: paymentStatus || existingPayment.paymentStatus,
                    paidAt: paymentStatus === 'paid' ? new Date() : existingPayment.order.paidAt,
                    status: getOrderStatusFromPaymentStatus(paymentStatus || existingPayment.paymentStatus)
                }
            }),

            // Create order history
            req.prisma.orderHistory.create({
                data: {
                    orderId: existingPayment.orderId,
                    oldStatus: existingPayment.order.status,
                    newStatus: getOrderStatusFromPaymentStatus(paymentStatus || existingPayment.paymentStatus),
                    notes: notes || `Payment status updated to ${paymentStatus}`
                }
            })
        ]);

        res.json({
            success: true,
            payment: updatedPayment,
            message: 'Payment status updated successfully.'
        });

    } catch (err) {
        next(err);
    }
}

// --- INITIATE REFUND ---
async function initiateRefund(req, res, next) {
    try {
        const id = Number(req.params.id);
        const { refundAmount, reason } = req.body;

        if (!refundAmount || refundAmount <= 0) {
            return res.status(400).json({ error: 'Valid refund amount is required.' });
        }

        // Check if payment exists
        const payment = await req.prisma.payment.findUnique({
            where: { id },
            include: {
                order: true
            }
        });

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found.' });
        }

        // Validate refund amount
        if (refundAmount > payment.amount) {
            return res.status(400).json({ 
                error: 'Refund amount cannot exceed original payment amount.' 
            });
        }

        // Check if payment is eligible for refund
        if (payment.paymentStatus !== 'paid') {
            return res.status(400).json({ 
                error: 'Only paid payments can be refunded.' 
            });
        }

        // Determine refund status
        const refundStatus = refundAmount === payment.amount ? 'refunded' : 'partially_refunded';

        // Use transaction for refund processing
        const [updatedPayment, updatedOrder, orderHistory, refundRecord] = await req.prisma.$transaction([
            // Update payment status
            req.prisma.payment.update({
                where: { id },
                data: {
                    paymentStatus: refundStatus,
                    refundedAt: new Date(),
                    updatedAt: new Date()
                }
            }),

            // Update order payment status
            req.prisma.order.update({
                where: { id: payment.orderId },
                data: {
                    paymentStatus: refundStatus,
                    status: refundStatus === 'refunded' ? 'cancelled' : 'partially_refunded'
                }
            }),

            // Create order history
            req.prisma.orderHistory.create({
                data: {
                    orderId: payment.orderId,
                    oldStatus: payment.order.status,
                    newStatus: refundStatus === 'refunded' ? 'cancelled' : 'partially_refunded',
                    notes: `Refund processed: ${refundAmount} ${payment.currency}${reason ? ` - Reason: ${reason}` : ''}`
                }
            }),

            // Create refund record (you might want a separate Refund model)
            req.prisma.paymentHistory.create({
                data: {
                    paymentId: id,
                    action: 'refund',
                    amount: refundAmount,
                    currency: payment.currency,
                    notes: reason || 'Refund processed',
                    createdAt: new Date()
                }
            })
        ]);

        res.json({
            success: true,
            refund: {
                paymentId: id,
                refundAmount,
                currency: payment.currency,
                status: refundStatus,
                reason: reason || 'Refund processed'
            },
            message: `Refund of ${refundAmount} ${payment.currency} processed successfully.`
        });

    } catch (err) {
        next(err);
    }
}

// --- GET PAYMENT METHODS ---
async function getPaymentMethods(req, res, next) {
    try {
        const paymentMethods = [
            {
                id: 'credit_card',
                name: 'Credit Card',
                icon: '💳',
                description: 'Pay with Visa, Mastercard, American Express',
                supportedCurrencies: ['USD', 'GBP', 'EUR'],
                processingFee: 2.9
            },
            {
                id: 'debit_card',
                name: 'Debit Card',
                icon: '💳',
                description: 'Pay with your debit card',
                supportedCurrencies: ['USD', 'GBP', 'EUR'],
                processingFee: 1.9
            },
            {
                id: 'paypal',
                name: 'PayPal',
                icon: '🔵',
                description: 'Pay with your PayPal account',
                supportedCurrencies: ['USD', 'GBP', 'EUR', 'CAD'],
                processingFee: 2.9
            },
            {
                id: 'zelle',
                name: 'Zelle',
                icon: '💰',
                description: 'Send money with Zelle',
                supportedCurrencies: ['USD'],
                processingFee: 0
            },
            {
                id: 'venmo',
                name: 'Venmo',
                icon: '💸',
                description: 'Pay with Venmo',
                supportedCurrencies: ['USD'],
                processingFee: 1.9
            },
            {
                id: 'gift_card',
                name: 'Gift Card',
                icon: '🎁',
                description: 'Use your gift card balance',
                supportedCurrencies: ['USD'],
                processingFee: 0
            },
            {
                id: 'bank_transfer',
                name: 'Bank Transfer',
                icon: '🏦',
                description: 'Direct bank transfer',
                supportedCurrencies: ['USD', 'GBP', 'EUR'],
                processingFee: 0
            },
            {
                id: 'cash_on_delivery',
                name: 'Cash on Delivery',
                icon: '💵',
                description: 'Pay when you receive your order',
                supportedCurrencies: ['USD'],
                processingFee: 0,
                availableFor: ['domestic'] // Only for domestic shipping
            }
        ];

        res.json(paymentMethods);
    } catch (err) {
        next(err);
    }
}

// Helper function to map payment status to order status
function getOrderStatusFromPaymentStatus(paymentStatus) {
    const statusMap = {
        'pending': 'pending_payment',
        'paid': 'confirmed',
        'failed': 'payment_failed',
        'refunded': 'cancelled',
        'partially_refunded': 'partially_refunded'
    };
    return statusMap[paymentStatus] || 'pending_payment';
}

module.exports = {
    getUserPayments,
    getPaymentById,
    processPayment,
    updatePaymentStatus,
    initiateRefund,
    getPaymentMethods
};