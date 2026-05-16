module.exports = function checkPermission(permissionName) {
  return (req, res, next) => {
    if (!req.user) {
      console.log("Permission check failed: User not authenticated.");
      return res.status(401).json({ 
        message: 'Authentication required: Please login to access this resource.' 
      });
    }
    // If permissions are not an array, try to continue for Admin role
    if (!Array.isArray(req.user.permissions)) {
      console.log("Permission check: permissions array missing or invalid. Falling back to role check.");
    }

    // Grant all access to Admin role as a safe fallback to avoid locking out admin users
    if (req.user.role && String(req.user.role).toLowerCase() === 'admin') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Permission bypass: user ${req.user.email} is Admin.`);
      }
      return next();
    }

    if (!Array.isArray(req.user.permissions) || !req.user.permissions.includes(permissionName)) {
      console.log(`Permission check failed: User ${req.user.email} does not have '${permissionName}'. Available permissions:`, req.user.permissions);
      return res.status(403).json({ 
        message: `Access Denied: You don't have permission to perform this action.` 
      });
    }

    // Optional: Log successful permission checks in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Permission granted: ${req.user.email} has '${permissionName}'`);
    }
    
    next();
  };
};

// Optional: Check multiple permissions (any of the provided permissions)
module.exports.checkAnyPermission = function checkAnyPermission(permissionNames) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required.' 
      });
    }

    if (!Array.isArray(req.user.permissions)) {
      return res.status(403).json({ 
        message: 'Access denied: User permissions are not properly configured.' 
      });
    }

    const hasAnyPermission = permissionNames.some(permission => 
      req.user.permissions.includes(permission)
    );

    if (!hasAnyPermission) {
      console.log(`AnyPermission check failed: User ${req.user.email} does not have any of [${permissionNames.join(', ')}]. Available:`, req.user.permissions);
      return res.status(403).json({ 
        message: `Access Denied: Insufficient permissions.` 
      });
    }

    next();
  };
};

// Optional: Check all permissions (must have all provided permissions)
module.exports.checkAllPermissions = function checkAllPermissions(permissionNames) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required.' 
      });
    }

    if (!Array.isArray(req.user.permissions)) {
      return res.status(403).json({ 
        message: 'Access denied: User permissions are not properly configured.' 
      });
    }

    const hasAllPermissions = permissionNames.every(permission => 
      req.user.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      console.log(`AllPermissions check failed: User ${req.user.email} missing some of [${permissionNames.join(', ')}]. Available:`, req.user.permissions);
      return res.status(403).json({ 
        message: `Access Denied: Required permissions are missing.` 
      });
    }

    next();
  };
};