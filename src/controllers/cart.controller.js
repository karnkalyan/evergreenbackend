const getCart = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { userId } = req.params;

    // Verify user exists and has permission to access this cart
    if (req.user.id !== parseInt(userId) && !req.user.roles?.some(role => role.permissions?.includes('read_orders'))) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // FIXED: Remove problematic variant relation
    let cart = await prisma.cart.findUnique({
      where: { userId: Number(userId) },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                sku: true,
                images: true,
                price: true,
                mrp: true,
                prescription_required: true,
                isActive: true,
                isDeleted: true,
                brand: {
                  select: {
                    name: true
                  }
                }
              }
            },
            variantOption: {
              select: {
                id: true,
                label: true,
                price: true,
                mrp: true,
                stock: true,
                isActive: true
                // REMOVED: variant relation to fix the error
              }
            }
          }
        }
      }
    });

    if (!cart) {
      // Create empty cart if doesn't exist
      cart = await prisma.cart.create({
        data: {
          userId: Number(userId)
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  sku: true,
                  images: true,
                  price: true,
                  mrp: true,
                  prescription_required: true
                }
              },
              variantOption: {
                select: {
                  id: true,
                  label: true,
                  price: true,
                  mrp: true,
                  stock: true,
                  isActive: true
                }
              }
            }
          }
        }
      });
    }

    // Filter out inactive products and variants
    cart.items = cart.items.filter(item => 
      item.product.isActive && 
      !item.product.isDeleted &&
      (!item.variantOption || (item.variantOption.isActive && item.variantOption.stock > 0))
    );

    // FIXED: Clean up any invalid cart items (with variantOption but no actual variant)
    const invalidItems = cart.items.filter(item => 
      item.variantOption && !item.variantOption.id
    );

    if (invalidItems.length > 0) {
      await prisma.cartItem.deleteMany({
        where: {
          id: { in: invalidItems.map(item => item.id) }
        }
      });
      // Remove from current cart
      cart.items = cart.items.filter(item => !invalidItems.includes(item));
    }

    // Transform to frontend format with safe defaults
    const transformedItems = cart.items.map(item => {
      // Use safe defaults for variant data
      return {
        id: item.id, // 🔑 ADDED: Include cart item ID for proper removal
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          images: item.product.images,
          price: item.product.price,
          mrp: item.product.mrp,
          prescription_required: item.product.prescription_required,
          brand: item.product.brand
        },
        quantity: item.quantity,
        variantDetail: {
          id: item.variantOption?.id,
          country: 'Global', // Default value
          shipping: 'Domestic', // Default value
          currency: 'USD', // Default value
          label: item.variantOption?.label || 'Standard',
          price: item.variantOption?.price || item.product.price,
          mrp: item.variantOption?.mrp || item.product.mrp,
          stock: item.variantOption?.stock || 0
        }
      };
    });

    res.status(200).json({
      success: true,
      data: {
        ...cart,
        items: transformedItems
      }
    });
  } catch (error) {
    console.error('Get cart error:', error);
    
    // FIXED: Better error handling for cart issues
    if (error.message.includes('Inconsistent query result') || error.message.includes('variant is required')) {
      // Try to get cart without variant relations
      try {
        const prisma = req.prisma;
        const { userId } = req.params;
        
        const simpleCart = await prisma.cart.findUnique({
          where: { userId: Number(userId) },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    sku: true,
                    images: true,
                    price: true,
                    mrp: true,
                    prescription_required: true,
                    isActive: true,
                    isDeleted: true
                  }
                }
                // Completely exclude variantOption
              }
            }
          }
        });

        if (simpleCart) {
          // Clean up all items with variantOption to prevent future errors
          await prisma.cartItem.deleteMany({
            where: {
              cartId: simpleCart.id,
              variantOptionId: { not: null }
            }
          });

          return res.status(200).json({
            success: true,
            data: {
              ...simpleCart,
              items: simpleCart.items.filter(item => item.product.isActive && !item.product.isDeleted).map(item => ({
                id: item.id, // 🔑 ADDED: Include cart item ID
                product: item.product,
                quantity: item.quantity,
                variantDetail: {
                  country: 'Global',
                  shipping: 'Domestic',
                  currency: 'USD',
                  label: 'Standard',
                  price: item.product.price,
                  mrp: item.product.mrp
                }
              }))
            },
            message: 'Cart recovered after cleaning invalid items'
          });
        }
      } catch (recoveryError) {
        console.error('Cart recovery failed:', recoveryError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch cart'
    });
  }
};

const addToCart = async (req, res) => {
  try {
    const prisma = req.prisma;
    const { userId } = req.params;
    const { productId, variantOptionId, quantity = 1 } = req.body;

    // --- DEBUG LOG 1 ---
    console.log('🛒 [Add to Cart Request] Body:', { userId, productId, variantOptionId, quantity });

    if (!productId) {
      return res.status(400).json({ success: false, error: 'Product ID is required.' });
    }

    // Validate product exists and is active, include variants and options
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        isDeleted: false,
        isActive: true
      },
      include: {
        variants: {
          include: {
            options: {
              where: { isDeleted: false, isActive: true }
            }
          }
        }
      }
    });

    if (!product) {
      console.warn('🛒 [Add to Cart] Product not found:', productId);
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    let actualVariantOptionId = null;
    
    // Check if the product has any active variants with active options
    const hasVariants = product.variants.length > 0 && 
                      product.variants.some(v => v.options.length > 0);

    // --- START NEW VARIANT LOGIC ---
    if (hasVariants) {
      // --- DEBUG LOG 2 ---
      console.log('🛒 [Add to Cart] Product has variants. Validating variantOptionId...');
      
      // If product HAS variants, a variantOptionId MUST be provided
      if (!variantOptionId) {
        console.warn('🛒 [Add to Cart] Missing variantOptionId for product with variants.');
        return res.status(400).json({
          success: false,
          error: 'Please select a product option to add to cart.'
        });
      }

      // Validate the provided variantOptionId
      const variantOption = await prisma.variantOption.findFirst({
        where: {
          id: variantOptionId,
          isDeleted: false,
          isActive: true,
          // Ensure this option actually belongs to one of the product's variants
          variant: {
            product_id: productId
          }
        }
      });

      if (!variantOption) {
        console.warn('🛒 [Add to Cart] Invalid or inactive variantOptionId:', variantOptionId);
        return res.status(404).json({ success: false, error: 'Variant option not found' });
      }

      // Check stock for the specific variant
      if (variantOption.stock < quantity) {
        console.warn('🛒 [Add to Cart] Insufficient stock for variant:', variantOptionId);
        return res.status(400).json({ success: false, error: 'Insufficient stock for this option' });
      }
      
      actualVariantOptionId = variantOption.id;

    } else {
      // --- DEBUG LOG 3 ---
      console.log('🛒 [Add to Cart] Product has no variants. Proceeding...');
      
      // Product has NO variants, so variantOptionId should be null
      if (variantOptionId) {
        console.warn('🛒 [Add to Cart] variantOptionId was provided for a product with no variants.');
        // You could choose to ignore this or return an error. Let's return an error for clarity.
        return res.status(400).json({ 
          success: false, 
          error: 'This product does not have variants, but a variant ID was provided.' 
        });
      }
      
      // product-level stock check (if your model had it, e.g., if (product.stock < quantity))
      // Since stock is on VariantOption, we assume non-variant products are always in stock
      // or have stock logic managed elsewhere.
      
      actualVariantOptionId = null;
    }
    // --- END NEW VARIANT LOGIC ---

    // Get or create user's cart
    let cart = await prisma.cart.findUnique({
      where: { userId: Number(userId) }
    });

    if (!cart) {
      console.log('🛒 [Add to Cart] No cart found. Creating new cart for user:', userId);
      cart = await prisma.cart.create({
        data: { userId: Number(userId) }
      });
    }

    // --- USE findUnique WITH COMPOSITE KEY ---
    const existingCartItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId_variantOptionId: {
          cartId: cart.id,
          productId: productId,
          variantOptionId: actualVariantOptionId
        }
      }
    });

    let cartItem;

    if (existingCartItem) {
      // --- DEBUG LOG 4 ---
      console.log('🛒 [Add to Cart] Item exists. Updating quantity for cartItem:', existingCartItem.id);
      // Update existing item quantity
      cartItem = await prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: {
          quantity: {
            increment: quantity
          }
        }
      });
    } else {
      // --- DEBUG LOG 5 ---
      console.log('🛒 [Add to Cart] Creating new cartItem with variantOptionId:', actualVariantOptionId);
      // Create new cart item
      cartItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: productId,
          variantOptionId: actualVariantOptionId,
          quantity: quantity
        }
      });
    }

    // --- DEBUG LOG 6 ---
    console.log('🛒 [Add to Cart] Success! Cart item processed:', cartItem.id);
    
    // Respond with the full cart item (or just success)
    // Fetching the full item with relations for the response:
    const fullCartItem = await prisma.cartItem.findUnique({
      where: { id: cartItem.id },
      include: {
        product: {
          select: { id: true, name: true, slug: true, images: true }
        },
        variantOption: {
          include: {
            variant: {
              select: { country: true, shipping: true, currency: true }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      data: fullCartItem
    });
    
  } catch (error) {
    // --- DEBUG LOG 7 ---
    console.error('❌ [Add to Cart Error]', error);
    
    if (error.code === 'P2002') {
      // This error should be less common now with the findUnique check, but is good to keep.
      console.warn('🛒 [Add to Cart] Unique constraint violation.', error.meta?.target);
      return res.status(400).json({
        success: false,
        error: 'This item is already in your cart.' // Should be handled by update logic
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to add item to cart'
    });
  }
};

  const updateCartItem = async (req, res) => {
    try {
      const prisma = req.prisma;
      const { userId, itemId } = req.params;
      const { quantity } = req.body;

      if (quantity < 1) {
        return res.status(400).json({
          success: false,
          error: 'Quantity must be at least 1'
        });
      }

      const cart = await prisma.cart.findUnique({
        where: { userId: Number(userId) }
      });

      if (!cart) {
        return res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
      }

      const cartItem = await prisma.cartItem.update({
        where: {
          id: Number(itemId),
          cartId: cart.id
        },
        data: { quantity },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              images: true,
              price: true
            }
          },
          variantOption: {
            include: {
              variant: {
                select: {
                  country: true,
                  shipping: true,
                  currency: true
                }
              }
            }
          }
        }
      });

      res.status(200).json({
        success: true,
        message: 'Cart item updated successfully',
        data: cartItem
      });
    } catch (error) {
      console.error('Update cart item error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update cart item'
      });
    }
  };

  const removeFromCart = async (req, res) => {
    try {
      const prisma = req.prisma;
      const { userId, itemId } = req.params;

      const cart = await prisma.cart.findUnique({
        where: { userId: Number(userId) }
      });

      if (!cart) {
        return res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
      }

      await prisma.cartItem.delete({
        where: {
          id: Number(itemId),
          cartId: cart.id
        }
      });

      res.status(200).json({
        success: true,
        message: 'Item removed from cart successfully'
      });
    } catch (error) {
      console.error('Remove from cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove item from cart'
      });
    }
  };

  const clearCart = async (req, res) => {
    try {
      const prisma = req.prisma;
      const { userId } = req.params;

      const cart = await prisma.cart.findUnique({
        where: { userId: Number(userId) }
      });

      if (!cart) {
        return res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
      }

      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id }
      });

      res.status(200).json({
        success: true,
        message: 'Cart cleared successfully'
      });
    } catch (error) {
      console.error('Clear cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear cart'
      });
    }
  };

  const getCartTotal = async (req, res) => {
    try {
      const prisma = req.prisma;
      const { userId } = req.params;

      const cart = await prisma.cart.findUnique({
        where: { userId: Number(userId) },
        include: {
          items: {
            include: {
              product: true,
              variantOption: {
                include: {
                  variant: {
                    select: {
                      country: true,
                      shipping: true,
                      currency: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!cart) {
        return res.status(200).json({
          success: true,
          data: {
            total: 0,
            itemCount: 0
          }
        });
      }

      let total = 0;
      let itemCount = 0;

      for (const item of cart.items) {
        const price = item.variantOption?.price || item.product.price;
        total += price * item.quantity;
        itemCount += item.quantity;
      }

      res.status(200).json({
        success: true,
        data: {
          total,
          itemCount
        }
      });
    } catch (error) {
      console.error('Get cart total error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cart total'
      });
    }
  };

  module.exports = {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getCartTotal
  };