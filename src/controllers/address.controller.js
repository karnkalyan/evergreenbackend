// --- GET ALL ADDRESSES FOR THE AUTHENTICATED USER ---
async function getUserAddresses(req, res, next) {
    try {
        // req.user.id is set by the isAuthenticated middleware
        const userId = req.user.id;

        const addresses = await req.prisma.userAddress.findMany({
            where: { 
                userId: userId,
                isDeleted: false,
                isActive: true
            },
            orderBy: {
                isDefault: 'desc' // Prioritize the default address
            }
        });

        res.json(addresses);
    } catch (err) {
        next(err);
    }
}

// --- CREATE NEW ADDRESS ---
async function createAddress(req, res, next) {
    try {
        const userId = req.user.id; // FIXED: Use req.user.id
        console.log('Creating address for userId:', userId);
        const { name, streetAddress, city, state, zipCode, isDefault = false } = req.body;

        // Check if the user already has any addresses
        const addressCount = await req.prisma.userAddress.count({ 
            where: { 
                userId: userId, // FIXED: Just the ID number
                isDeleted: false, 
                isActive: true 
            } 
        });
        
        // If it's the first active address, force it to be the default
        const actualIsDefault = addressCount === 0 ? true : isDefault;

        // Use a transaction to ensure atomic operations if setting a new default
        if (actualIsDefault) {
            const [updatedDefault, newAddress] = await req.prisma.$transaction([
                // 1. Unset the current default address for this user
                req.prisma.userAddress.updateMany({
                    where: { 
                        userId: userId, // FIXED: Just the ID number
                        isDefault: true 
                    },
                    data: { isDefault: false }
                }),
                // 2. Create the new address and set it as default
                req.prisma.userAddress.create({
                    data: {
                        userId: userId, // FIXED: Just the ID number
                        name,
                        streetAddress,
                        city,
                        state,
                        zipCode,
                        isDefault: true,
                    }
                })
            ]);
            return res.status(201).json(newAddress); 
        } else {
            // Create non-default address normally
            const newAddress = await req.prisma.userAddress.create({
                data: {
                    userId: userId, // FIXED: Just the ID number
                    name,
                    streetAddress,
                    city,
                    state,
                    zipCode,
                    isDefault: false,
                }
            });
            return res.status(201).json(newAddress);
        }

    } catch (err) {
        next(err);
    }
}

// --- UPDATE EXISTING ADDRESS ---
async function updateAddress(req, res, next) {
    try {
        const id = Number(req.params.id);
        const userId = req.user.id; // FIXED: Use req.user.id
        // Destructure isDefault separately to check for its existence
        const { isDefault, ...otherData } = req.body;

        // Check if address exists and belongs to the user
        const existingAddress = await req.prisma.userAddress.findUnique({ where: { id } });
        if (!existingAddress || existingAddress.userId !== userId || existingAddress.isDeleted) {
            return res.status(404).json({ error: 'Address not found or unauthorized.' });
        }

        // Prepare data to update (only non-relational, non-undefined fields)
        const data = {
            ...(otherData.name && { name: otherData.name }),
            ...(otherData.streetAddress && { streetAddress: otherData.streetAddress }),
            ...(otherData.city && { city: otherData.city }),
            ...(otherData.state && { state: otherData.state }),
            ...(otherData.zipCode && { zipCode: otherData.zipCode }),
        };

        // Handle setting/unsetting default flag
        if (isDefault !== undefined && isDefault !== existingAddress.isDefault) {
            if (isDefault === true) {
                // If the user wants to set this as default
                const [updatedDefault, updatedAddress] = await req.prisma.$transaction([
                    // 1. Unset the previous default address for this user (must not be the current address ID)
                    req.prisma.userAddress.updateMany({
                        where: { 
                            userId: userId, // FIXED: Just the ID number
                            isDefault: true, 
                            id: { not: id } 
                        },
                        data: { isDefault: false }
                    }),
                    // 2. Update the address details and set it as default
                    req.prisma.userAddress.update({
                        where: { id },
                        data: { ...data, isDefault: true } // Apply details update and set default
                    })
                ]);
                return res.json(updatedAddress);
            } else {
                 // If the user tries to UNSET the default flag (isDefault === false)
                const addressCount = await req.prisma.userAddress.count({ 
                    where: { 
                        userId: userId, // FIXED: Just the ID number
                        isDeleted: false, 
                        isActive: true 
                    } 
                });
                
                if (addressCount === 1) {
                    return res.status(400).json({ error: 'Cannot unset the default flag when only one active address exists.' });
                }
                
                // Unset the default flag for this specific address
                const updatedAddress = await req.prisma.userAddress.update({
                    where: { id },
                    data: { ...data, isDefault: false } // Apply details update and unset default
                });
                return res.json(updatedAddress);
            }
        }
        
        // If no default change, just update details
        const updatedAddress = await req.prisma.userAddress.update({
            where: { id },
            data,
        });

        res.json(updatedAddress);
    } catch (err) {
        next(err);
    }
}

// --- SOFT DELETE ADDRESS ---
async function deleteAddress(req, res, next) {
    try {
        const id = Number(req.params.id);
        const userId = req.user.id; // FIXED: Use req.user.id
        
        // Check if address exists and belongs to the user
        const existingAddress = await req.prisma.userAddress.findUnique({ where: { id } });
        if (!existingAddress || existingAddress.userId !== userId || existingAddress.isDeleted) {
            return res.status(404).json({ error: 'Address not found or unauthorized.' });
        }
        
        // Check active address count BEFORE deletion
        const activeAddressCount = await req.prisma.userAddress.count({ 
            where: { 
                userId: userId, // FIXED: Just the ID number
                isDeleted: false, 
                isActive: true 
            } 
        });

        // Prevent deleting the default address if others exist (must have more than 1 active address to delete the default)
        if (existingAddress.isDefault && activeAddressCount > 1) {
             return res.status(400).json({ error: 'Cannot delete the default address. Please set another address as default first.' });
        }
        
        // Soft delete the address
        const deletedAddress = await req.prisma.userAddress.update({
            where: { id },
            // If it was the only active address, the logic will delete it, and the user will have zero active addresses.
            data: { isDeleted: true, isActive: false, isDefault: false } // Force isDefault to false on deletion for cleanup
        });

        res.json({ message: 'Address deleted successfully', deletedAddress });
    } catch (err) {
        next(err);
    }
}

// --- SET AS DEFAULT ADDRESS ---
async function setDefaultAddress(req, res, next) {
    try {
        const id = Number(req.params.id);
        const userId = req.user.id; // FIXED: Use req.user.id

        // Check if address exists and belongs to the user
        const existingAddress = await req.prisma.userAddress.findUnique({ where: { id } });
        if (!existingAddress || existingAddress.userId !== userId || existingAddress.isDeleted || !existingAddress.isActive) {
            return res.status(404).json({ error: 'Active address not found or unauthorized.' });
        }

        if (existingAddress.isDefault) {
            return res.status(200).json(existingAddress); // Return the existing address if already default
        }

        // Use transaction to ensure only ONE address is default
        const [unsetResult, newDefaultAddress] = await req.prisma.$transaction([
            // 1. Unset the current default address for this user
            req.prisma.userAddress.updateMany({
                where: { 
                    userId: userId, // FIXED: Just the ID number
                    isDefault: true 
                },
                data: { isDefault: false }
            }),
            // 2. Set the requested address as default
            req.prisma.userAddress.update({
                where: { id },
                data: { isDefault: true }
            })
        ]);

        res.json(newDefaultAddress); // Return the newly set default address object

    } catch (err) {
        next(err);
    }
}

module.exports = {
    getUserAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
};