const bcrypt = require('bcrypt');
const { queueAutomationEmails } = require('../services/emailAutomationService'); // Add this import

// --- CREATE USER ---
async function createUser(req, res, next) {
    try {
        const {
            firstName,
            middleName,
            lastName,
            email,
            phoneNumber,
            streetAddress, 
            city,
            state,
            zipCode,
            status = 'pending',
            roleId,
            password
        } = req.body;

        if (!email || !password || !firstName || !lastName || !phoneNumber || !roleId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const profilePicture = req.file ? `/uploads/${req.file.filename}` : null;

        const existingUser = await req.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        // Use transaction to ensure all operations succeed or fail together
        const result = await req.prisma.$transaction(async (prisma) => {
            // Step 1: Create User
            const newUser = await prisma.user.create({
                data: {
                    firstName,
                    middleName,
                    lastName,
                    email,
                    phoneNumber,
                    profilePicture,
                    status,
                    roleId: Number(roleId)
                }
            });

            // Step 2: Create Credential linked to User
            await prisma.credential.create({
                data: {
                    email,
                    password: hashedPassword,
                    userId: newUser.id
                }
            });
            
            let createdAddress = null;
            // Step 3: Create Default UserAddress if address fields are provided
            if (streetAddress && city && zipCode) {
                createdAddress = await prisma.userAddress.create({
                    data: {
                        userId: newUser.id,
                        name: 'Default',
                        streetAddress,
                        city,
                        state,
                        zipCode,
                        isDefault: true,
                        isActive: true,
                        isDeleted: false,
                    }
                });
            }

            return { newUser, createdAddress };
        });

        // ✅ TRIGGER WELCOME EMAIL AFTER USER REGISTRATION
        try {
            await queueAutomationEmails('USER_REGISTERED', result.newUser.id, null, {
                customer_name: `${result.newUser.firstName} ${result.newUser.lastName}`,
                customer_email: result.newUser.email,
                welcome_code: 'WELCOME10',
                shop_url: process.env.FRONTEND_URL || 'https://evergreenmedicine.com',
                account_url: `${process.env.FRONTEND_URL || 'https://evergreenmedicine.com'}/account`
            }, req.prisma);
            
            console.log('User registration automation triggered successfully');
        } catch (automationError) {
            console.error('Failed to trigger user registration automation:', automationError);
            // Don't fail user creation because of email error
        }

        res.status(201).json({
            success: true,
            id: result.newUser.id,
            firstName: result.newUser.firstName,
            middleName: result.newUser.middleName,
            lastName: result.newUser.lastName,
            email: result.newUser.email,
            phoneNumber: result.newUser.phoneNumber,
            status: result.newUser.status,
            profilePicture: result.newUser.profilePicture,
            roleId: result.newUser.roleId,
            createdAt: result.newUser.createdAt,
            defaultAddress: result.createdAddress
        });

    } catch (err) {
        next(err);
    }
}

// --- GET ALL USERS ---
async function getAllUsers(req, res, next) {
    try {
        const users = await req.prisma.user.findMany({
            where: { isDeleted: false },
            select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
                status: true,
                profilePicture: true,
                createdAt: true,
                // 🚨 Include addresses, filter to get only the default one
                addresses: {
                    where: { isDefault: true, isDeleted: false },
                    select: {
                        streetAddress: true,
                        city: true,
                        state: true,
                        zipCode: true,
                    }
                },
                role: {
                    select: {
                        id: true,
                        name: true,
                        permissions: { select: { id: true, name: true, menuName: true } }
                    }
                },
                credential: {
                    select: { lastLogin: true }
                }
            }
        });
        
        // Map to flatten the default address into the user object (optional, but often desired)
        const flattenedUsers = users.map(user => ({
            ...user,
            // Take the first (and should be only) default address, or null
            defaultAddress: user.addresses.length > 0 ? user.addresses[0] : null,
            addresses: undefined, // Remove the nested addresses array
        }));
        
        res.json(flattenedUsers);
    } catch (err) {
        next(err);
    }
}

// --- GET USER BY ID ---
async function getUserById(req, res, next) {
    try {
        const id = Number(req.params.id);
        const user = await req.prisma.user.findUnique({
            where: { id, isDeleted: false }, // Added check for isDeleted
            select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
                status: true,
                profilePicture: true,
                createdAt: true,
                // 🚨 Include all active addresses for profile/address pages
                addresses: { 
                    where: { isActive: true, isDeleted: false },
                    select: {
                        id: true,
                        name: true,
                        streetAddress: true,
                        city: true,
                        state: true,
                        zipCode: true,
                        isDefault: true,
                        createdAt: true,
                    }
                },
                role: { select: { id: true, name: true } },
                credential: { select: { lastLogin: true } }
            }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        next(err);
    }
}

// --- UPDATE USER (Profile details AND Address) ---
async function updateUser(req, res, next) {
    try {
        const id = Number(req.params.id);
        const {
            firstName,
            middleName,
            lastName,
            email,
            phoneNumber,
            // 🚨 ADDED: Address fields for default address update
            streetAddress, 
            city,
            state,
            zipCode,
            status,
            roleId,
            password
        } = req.body;

        // First, check if the user exists
        const existingUser = await req.prisma.user.findUnique({ where: { id } });
        if (!existingUser || existingUser.isDeleted) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check for email collision (excluding the current user)
        if (email && email !== existingUser.email) {
            const existingEmail = await req.prisma.user.findFirst({ 
                where: { 
                    email,
                    id: { not: id }
                } 
            });
            if (existingEmail) {
                return res.status(409).json({ error: 'User with this email already exists' });
            }
        }

        // Use transaction to ensure both user and address updates succeed
        const result = await req.prisma.$transaction(async (prisma) => {
            // Prepare User update data
            const userData = {
                ...(firstName && { firstName }),
                ...(middleName && { middleName }),
                ...(lastName && { lastName }),
                ...(email && { email }),
                ...(phoneNumber && { phoneNumber }),
                ...(status && { status }),
                ...(roleId && { roleId: Number(roleId) }),
                ...(req.file && { profilePicture: `/uploads/${req.file.filename}` })
            };

            // Update User
            const user = await prisma.user.update({
                where: { id },
                data: userData,
            });

            // Prepare credential update data
            const credentialUpdateData = {};
            if (password) {
                const hashedPassword = await bcrypt.hash(password, 10);
                credentialUpdateData.password = hashedPassword;
            }
            if (email && email !== existingUser.email) {
                credentialUpdateData.email = email;
            }

            // Update Credential if needed
            if (Object.keys(credentialUpdateData).length > 0) {
                await prisma.credential.update({
                    where: { userId: user.id }, 
                    data: credentialUpdateData
                });
            }

            // 🚨 HANDLE DEFAULT ADDRESS UPDATE/CREATION
            let defaultAddress = null;
            if (streetAddress || city || state || zipCode) {
                // Check if user already has a default address
                const existingDefaultAddress = await prisma.userAddress.findFirst({
                    where: { 
                        userId: id, 
                        isDefault: true,
                        isDeleted: false 
                    }
                });

                if (existingDefaultAddress) {
                    // Update existing default address
                    defaultAddress = await prisma.userAddress.update({
                        where: { id: existingDefaultAddress.id },
                        data: {
                            ...(streetAddress && { streetAddress }),
                            ...(city && { city }),
                            ...(state && { state }),
                            ...(zipCode && { zipCode }),
                            // Ensure it remains the default address
                            isDefault: true
                        }
                    });
                } else {
                    // Create new default address
                    defaultAddress = await prisma.userAddress.create({
                        data: {
                            userId: id,
                            name: 'Default',
                            streetAddress: streetAddress || '',
                            city: city || '',
                            state: state || '',
                            zipCode: zipCode || '',
                            isDefault: true,
                            isActive: true,
                            isDeleted: false,
                        }
                    });
                }
            }

            return { user, defaultAddress };
        });

        // Fetch the complete updated user data for response
        const updatedUser = await req.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
                status: true,
                profilePicture: true,
                createdAt: true,
                role: { select: { id: true, name: true } },
                credential: { select: { lastLogin: true, email: true } },
                addresses: { 
                    where: { isDeleted: false, isActive: true },
                    select: { 
                        id: true, 
                        name: true, 
                        streetAddress: true, 
                        city: true, 
                        state: true, 
                        zipCode: true, 
                        isDefault: true 
                    }
                } 
            }
        });

        // Format response to include defaultAddress at top level (like in getAllUsers)
        const responseUser = {
            ...updatedUser,
            defaultAddress: updatedUser.addresses.find(addr => addr.isDefault) || null,
            addresses: undefined // Remove the nested addresses array for consistency
        };

        res.json({ 
            message: 'User updated successfully', 
            updatedUser: responseUser 
        });

    } catch (err) {
        next(err);
    }
}

// --- SOFT DELETE USER (Unchanged) ---
async function deleteUser(req, res, next) {
    try {
        const id = Number(req.params.id);
        await req.prisma.user.update({
            where: { id },
            data: { isDeleted: true }
        });
        // 💡 You might also want to soft delete all associated addresses here
        
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser
};