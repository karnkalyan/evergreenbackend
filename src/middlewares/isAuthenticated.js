const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.ACCESS_SECRET || 'IspMainAdminPanel123@!23';

module.exports = (prisma) => {
  return async (req, res, next) => {
    // Attach prisma to request for use in controllers
    req.prisma = prisma;
    
    let token = req.cookies?.access_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }

    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required: No access token provided.' 
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, ACCESS_SECRET);
    } catch (error) {
      console.error('JWT verification failed:', error.message);
      
      // Clear invalid tokens from cookies
      res.clearCookie('access_token', { path: '/' });
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Access token expired. Please refresh your token.' 
        });
      }
      
      return res.status(403).json({ 
        error: 'Invalid access token. Please login again.' 
      });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { 
          id: payload.userId,
          isDeleted: false 
        },
        include: { 
          role: { 
            include: { 
              permissions: {
                select: {
                  id: true,
                  name: true,
                  menuName: true
                }
              }
            } 
          } 
        }
      });

      if (!user) {
        res.clearCookie('access_token', { path: '/' });
        return res.status(401).json({ 
          error: 'User account not found or has been deleted.' 
        });
      }

      // Check user status
      if (!user.isActive || user.status === 'inactive' || user.status === 'disabled') {
        res.clearCookie('access_token', { path: '/' });
        res.clearCookie('refresh_token', { path: '/' });
        return res.status(403).json({ 
          error: 'Account is disabled. Please contact administrator.' 
        });
      }

      // Enhanced user object with more useful information
      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role?.name,
        roleId: user.role?.id,
        permissions: user.role?.permissions.map(p => p.name) || [],
        permissionsDetailed: user.role?.permissions || [], // Include full permission objects if needed
        status: user.status,
        isActive: user.isActive
      };
      
      next();
    } catch (error) {
      console.error('Database error during authentication:', error);
      return res.status(500).json({ 
        error: 'Internal server error during authentication.' 
      });
    }
  };
};