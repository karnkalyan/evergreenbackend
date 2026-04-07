const { cleanupUploadedFiles } = require('../middlewares/upload');

/**
 * Create a new role
 */
const createRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Role name is required'
      });
    }

    // Check if role name already exists
    const existingRole = await req.prisma.role.findUnique({
      where: { name: name.trim() }
    });

    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: 'Role with this name already exists'
      });
    }

    // Prepare role data
    const roleData = {
      name: name.trim()
    };

    // Create role
    const newRole = await req.prisma.role.create({
      data: roleData,
      include: {
        permissions: {
          select: {
            id: true,
            name: true,
            menuName: true
          }
        },
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        _count: {
          select: {
            users: true,
            permissions: true
          }
        }
      }
    });

    // Format response
    const response = {
      success: true,
      message: 'Role created successfully',
      data: newRole
    };

    res.status(201).json(response);

  } catch (error) {
    console.error('Error creating role:', error);

    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Role with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while creating role',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update an existing role
 */
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, permissionIds } = req.body;

    // Validate role ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid role ID is required'
      });
    }

    const roleId = parseInt(id);

    // Check if role exists
    const existingRole = await req.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: true,
        users: true
      }
    });

    if (!existingRole) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Prepare update data
    const updateData = {};

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    // Handle permissions update if provided
    if (permissionIds && Array.isArray(permissionIds)) {
      updateData.permissions = {
        set: permissionIds.map(pid => ({ id: parseInt(pid) }))
      };
    }

    // Check if new name already exists (excluding current role)
    if (updateData.name && updateData.name !== existingRole.name) {
      const existingName = await req.prisma.role.findUnique({
        where: { name: updateData.name }
      });

      if (existingName && existingName.id !== roleId) {
        return res.status(400).json({
          success: false,
          message: 'Role name already exists. Please use a different name.'
        });
      }
    }

    // Update the role
    const updatedRole = await req.prisma.role.update({
      where: { id: roleId },
      data: updateData,
      include: {
        permissions: {
          select: {
            id: true,
            name: true,
            menuName: true
          }
        },
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        _count: {
          select: {
            users: true,
            permissions: true
          }
        }
      }
    });

    // Format response
    const response = {
      success: true,
      message: 'Role updated successfully',
      data: updatedRole
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error updating role:', error);

    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Role with this name already exists'
      });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while updating role',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete a role
 */
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid role ID is required'
      });
    }

    const roleId = parseInt(id);

    // Check if role exists
    const role = await req.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Check if role has users
    if (role._count.users > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete role that has users assigned. Please reassign users first.'
      });
    }

    // Delete the role
    await req.prisma.role.delete({
      where: { id: roleId }
    });

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting role:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting role',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all roles
 */
const getAllRoles = async (req, res) => {
  try {
    const roles = await req.prisma.role.findMany({
      include: {
        permissions: {
          select: {
            id: true,
            name: true,
            menuName: true
          }
        },
        _count: {
          select: {
            users: true,
            permissions: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({
      success: true,
      data: {
        roles: roles
      }
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching roles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get role by ID
 */
const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid role ID is required'
      });
    }

    const roleId = parseInt(id);

    const role = await req.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          select: {
            id: true,
            name: true,
            menuName: true
          }
        },
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true
          }
        },
        _count: {
          select: {
            users: true,
            permissions: true
          }
        }
      }
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    res.json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching role',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get roles for dropdown/select
 */
const getRolesForSelect = async (req, res) => {
  try {
    const roles = await req.prisma.role.findMany({
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    console.error('Error fetching roles for select:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching roles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createRole,
  updateRole,
  deleteRole,
  getAllRoles,
  getRoleById,
  getRolesForSelect
};