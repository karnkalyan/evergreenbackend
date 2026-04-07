/**
 * Create a new permission
 */
const createPermission = async (req, res) => {
  try {
    const { name, menuName } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Permission name is required'
      });
    }

    if (!menuName || !menuName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Menu name is required'
      });
    }

    // Check if permission name already exists
    const existingPermission = await req.prisma.permission.findUnique({
      where: { name: name.trim() }
    });

    if (existingPermission) {
      return res.status(400).json({
        success: false,
        message: 'Permission with this name already exists'
      });
    }

    // Prepare permission data
    const permissionData = {
      name: name.trim(),
      menuName: menuName.trim()
    };

    // Create permission
    const newPermission = await req.prisma.permission.create({
      data: permissionData,
      include: {
        roles: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            roles: true
          }
        }
      }
    });

    // Format response
    const response = {
      success: true,
      message: 'Permission created successfully',
      data: newPermission
    };

    res.status(201).json(response);

  } catch (error) {
    console.error('Error creating permission:', error);

    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Permission with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while creating permission',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update an existing permission
 */
const updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, menuName } = req.body;

    // Validate permission ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid permission ID is required'
      });
    }

    const permissionId = parseInt(id);

    // Check if permission exists
    const existingPermission = await req.prisma.permission.findUnique({
      where: { id: permissionId }
    });

    if (!existingPermission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found'
      });
    }

    // Prepare update data
    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (menuName !== undefined) updateData.menuName = menuName.trim();

    // Check if new name already exists (excluding current permission)
    if (updateData.name && updateData.name !== existingPermission.name) {
      const existingName = await req.prisma.permission.findUnique({
        where: { name: updateData.name }
      });

      if (existingName && existingName.id !== permissionId) {
        return res.status(400).json({
          success: false,
          message: 'Permission name already exists. Please use a different name.'
        });
      }
    }

    // Update the permission
    const updatedPermission = await req.prisma.permission.update({
      where: { id: permissionId },
      data: updateData,
      include: {
        roles: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            roles: true
          }
        }
      }
    });

    // Format response
    const response = {
      success: true,
      message: 'Permission updated successfully',
      data: updatedPermission
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error updating permission:', error);

    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Permission with this name already exists'
      });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Permission not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while updating permission',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete a permission
 */
const deletePermission = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid permission ID is required'
      });
    }

    const permissionId = parseInt(id);

    // Check if permission exists
    const permission = await req.prisma.permission.findUnique({
      where: { id: permissionId },
      include: {
        _count: {
          select: {
            roles: true
          }
        }
      }
    });

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found'
      });
    }

    // Check if permission has roles assigned
    if (permission._count.roles > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete permission that is assigned to roles. Please remove from roles first.'
      });
    }

    // Delete the permission
    await req.prisma.permission.delete({
      where: { id: permissionId }
    });

    res.json({
      success: true,
      message: 'Permission deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting permission:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Permission not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting permission',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all permissions
 */
const getAllPermissions = async (req, res) => {
  try {
    const permissions = await req.prisma.permission.findMany({
      include: {
        roles: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            roles: true
          }
        }
      },
      orderBy: [
        { menuName: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json({
      success: true,
      data: {
        permissions: permissions
      }
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching permissions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get permission by ID
 */
const getPermissionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid permission ID is required'
      });
    }

    const permissionId = parseInt(id);

    const permission = await req.prisma.permission.findUnique({
      where: { id: permissionId },
      include: {
        roles: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            roles: true
          }
        }
      }
    });

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found'
      });
    }

    res.json({
      success: true,
      data: permission
    });
  } catch (error) {
    console.error('Error fetching permission:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching permission',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get permissions grouped by menu
 */
const getPermissionsByMenu = async (req, res) => {
  try {
    const permissions = await req.prisma.permission.findMany({
      include: {
        roles: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { menuName: 'asc' },
        { name: 'asc' }
      ]
    });

    // Group permissions by menuName
    const groupedPermissions = permissions.reduce((acc, permission) => {
      const menuName = permission.menuName;
      if (!acc[menuName]) {
        acc[menuName] = [];
      }
      acc[menuName].push(permission);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        permissions: groupedPermissions
      }
    });
  } catch (error) {
    console.error('Error fetching permissions by menu:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching permissions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createPermission,
  updatePermission,
  deletePermission,
  getAllPermissions,
  getPermissionById,
  getPermissionsByMenu
};