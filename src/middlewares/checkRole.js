// Check if user has specific role
function checkRole(roleName) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required.' 
      });
    }

    if (req.user.role !== roleName) {
      console.log(`Role check failed: User ${req.user.email} has role '${req.user.role}' but required '${roleName}'`);
      return res.status(403).json({ 
        message: `Access Denied: Requires ${roleName} role.` 
      });
    }

    next();
  };
}

// Check if user has any of the specified roles
function checkAnyRole(roleNames) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required.' 
      });
    }

    const hasAnyRole = roleNames.includes(req.user.role);

    if (!hasAnyRole) {
      console.log(`AnyRole check failed: User ${req.user.email} has role '${req.user.role}' but required one of [${roleNames.join(', ')}]`);
      return res.status(403).json({ 
        message: `Access Denied: Insufficient role privileges.` 
      });
    }

    next();
  };
}

module.exports = checkRole;
module.exports.checkAnyRole = checkAnyRole;