const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../../prisma/client');
const { OAuth2Client } = require('google-auth-library');

// --- CONFIGURATION ---
const ACCESS_SECRET = process.env.ACCESS_SECRET || 'everGreenMedicine@!23!@#$%';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'everGreenMedicine@Refresh!3429!@#$%';
const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '30d';

// IMPORTANT: Add your Google Client ID to your backend's .env file
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// --- JWT HELPER FUNCTIONS ---
function signAccessToken(userId) {
  return jwt.sign({ userId }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

function signRefreshToken(userId) {
  return jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

// 🔑 ADDRESS SELECT FRAGMENT (Reused across controllers)
const DEFAULT_ADDRESS_SELECT = {
    addresses: {
        where: { isDefault: true, isActive: true, isDeleted: false },
        select: {
            id: true,
            name: true,
            streetAddress: true,
            city: true,
            state: true,
            zipCode: true,
        }
    }
}

// --- REUSABLE LOGIN HELPER ---
async function issueTokensAndSetCookies(res, user, rememberMe = true) {
  try {
    // Update last login in credential table
    await prisma.credential.update({
      where: { userId: user.id },
      data: { lastLogin: new Date() }
    });

    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        id: refreshToken,
        userId: user.credential.id,
        revoked: false
      }
    });

    // Set standard access token cookie (short-lived)
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/',
      maxAge: 15 * 60 * 1000
    });

    // Set refresh token cookie with conditional expiration
    const refreshTokenMaxAge = rememberMe
      ? 30 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/auth/refresh',
      maxAge: refreshTokenMaxAge
    });

    // Remove sensitive data and flatten address
    const { credential, addresses, ...safeUser } = user;
    const defaultAddress = addresses.length > 0 ? addresses[0] : null;
    
    res.json({ 
      message: 'Logged in successfully', 
      accessToken, 
      user: { ...safeUser, defaultAddress } // Flatten the default address for easy client access
    });
  } catch (error) {
    console.error('Error issuing tokens:', error);
    throw new Error('Failed to complete login process');
  }
}

// --- CONTROLLER FUNCTIONS ---

async function login(req, res) {
  try {
    const { email, password, rememberMe = true } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({ 
      where: { 
        email,
        isDeleted: false,
        isActive: true
      },
      include: { 
        credential: {
          select: {
            id: true,
            password: true
          }
        },
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
        },
        // 🔑 Fetch the default address
        ...DEFAULT_ADDRESS_SELECT
      }
    });

    if (!user || !user.credential) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (user.status === 'inactive' || user.status === 'disabled' || user.status === 'pending') {
      return res.status(403).json({ error: 'Account is disabled or pending approval. Please contact administrator.' });
    }

    const valid = await bcrypt.compare(password, user.credential.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    return await issueTokensAndSetCookies(res, user, rememberMe);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
}

async function googleLogin(req, res) {
  try {
    if (!client) {
      return res.status(500).json({ error: 'Google OAuth is not configured.' });
    }

    const { credential: googleToken, rememberMe = true } = req.body;
    if (!googleToken) {
      return res.status(400).json({ error: 'No Google credential provided.' });
    }

    const ticket = await client.verifyIdToken({
      idToken: googleToken,
      audience: GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'Invalid Google token payload.' });
    }

    const email = payload.email;
    let user = await prisma.user.findUnique({ 
      where: { 
        email,
        isDeleted: false,
        isActive: true
      },
      include: { 
        credential: {
          select: { id: true }
        },
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
        },
        // 🔑 Fetch the default address
        ...DEFAULT_ADDRESS_SELECT
      }
    });

    if (!user) {
      return res.status(403).json({ 
        error: 'No account is associated with this Google email. Please contact administrator.' 
      });
    }

    if (user.status === 'inactive' || user.status === 'disabled') {
      return res.status(403).json({ error: 'Account is disabled. Please contact administrator.' });
    }

    const updateData = {};
    if (payload.given_name && user.firstName !== payload.given_name) {
      updateData.firstName = payload.given_name;
    }
    if (payload.family_name && user.lastName !== payload.family_name) {
      updateData.lastName = payload.family_name;
    }
    if (payload.picture && user.profilePicture !== payload.picture) {
      updateData.profilePicture = payload.picture;
    }

    if (Object.keys(updateData).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
        include: { 
          credential: { select: { id: true } },
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
          },
          // 🔑 Fetch the default address after update
          ...DEFAULT_ADDRESS_SELECT
        }
      });
    }

    return await issueTokensAndSetCookies(res, user, rememberMe);

  } catch (error) {
    console.error('Google login verification error:', error);
    
    if (error.message.includes('Token used too late')) {
      return res.status(401).json({ error: 'Google token has expired.' });
    }
    
    return res.status(401).json({ error: 'Invalid or expired Google credential.' });
  }
}

async function refresh(req, res) {
  try {
    const token = req.cookies['refresh_token'];
    if (!token) {
      return res.status(401).json({ error: 'No refresh token provided.' });
    }

    // Verify JWT
    let payload;
    try {
      payload = jwt.verify(token, REFRESH_SECRET);
    } catch (error) {
      console.error('JWT verification error:', error);
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/auth/refresh' });
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }

    // Check if refresh token exists in database and is not revoked
    const storedToken = await prisma.refreshToken.findUnique({
      where: { id: token },
      include: {
        user: {
          include: {
            user: {
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
                },
                // 🔑 Fetch the default address
                ...DEFAULT_ADDRESS_SELECT
              }
            }
          }
        }
      }
    });

    if (!storedToken || storedToken.revoked) {
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/auth/refresh' });
      return res.status(401).json({ error: 'Refresh token revoked.' });
    }

    // Check if user relation exists and is valid
    if (!storedToken.user || !storedToken.user.user) {
      await prisma.refreshToken.update({
        where: { id: token },
        data: { revoked: true }
      });
      
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/auth/refresh' });
      return res.status(401).json({ error: 'User account is no longer active.' });
    }

    const user = storedToken.user.user;

    // Check user status and active state in code
    if (user.isDeleted || !user.isActive || user.status === 'inactive' || user.status === 'disabled') {
      await prisma.refreshToken.update({
        where: { id: token },
        data: { revoked: true }
      });
      
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/auth/refresh' });
      return res.status(401).json({ error: 'User account is no longer active.' });
    }

    // Issue new access token
    const newAccessToken = signAccessToken(user.id);
    
    res.cookie('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/',
      maxAge: 15 * 60 * 1000
    });

    // Remove sensitive data and flatten address
    const { credential, addresses, ...safeUser } = user;
    const defaultAddress = addresses.length > 0 ? addresses[0] : null;

    res.json({ 
      accessToken: newAccessToken,
      user: { ...safeUser, defaultAddress }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error during token refresh.' });
  }
}

async function logout(req, res) {
  try {
    const refreshToken = req.cookies['refresh_token'];
    
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { 
          id: refreshToken,
          revoked: false
        },
        data: { revoked: true }
      });
    }

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
    res.json({ message: 'Logged out successfully' });
  }
}

async function logoutAll(req, res) {
  try {
    const userId = req.user.userId;
    
    const credential = await prisma.credential.findUnique({
      where: { userId: userId }
    });

    if (credential) {
      await prisma.refreshToken.updateMany({
        where: { 
          userId: credential.id,
          revoked: false
        },
        data: { revoked: true }
      });
    }

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
    
    res.json({ message: 'Logged out from all devices successfully' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
    res.json({ message: 'Logged out successfully' });
  }
}

async function authMe(req, res) {
  try {
    const accessToken = req.cookies['access_token'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!accessToken) {
      return res.status(401).json({ error: 'No access token provided.' });
    }

    let payload;
    try {
      payload = jwt.verify(accessToken, ACCESS_SECRET);
    } catch (error) {
      console.error("Access token verification failed:", error.message);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Access token expired.' });
      }
      
      return res.status(401).json({ error: 'Invalid access token.' });
    }

    const user = await prisma.user.findUnique({ 
      where: { 
        id: payload.userId,
        isDeleted: false,
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        profilePicture: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // 🔑 Fetch the default address
        ...DEFAULT_ADDRESS_SELECT,
        role: {
          select: {
            id: true,
            name: true,
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
      return res.status(401).json({ error: 'User not found or deactivated.' });
    }

    if (user.status === 'inactive' || user.status === 'disabled') {
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/auth/refresh' });
      return res.status(403).json({ error: 'Account is disabled. Please contact administrator.' });
    }

    // Remove the nested addresses array and flatten the default address
    const { addresses, ...safeUser } = user;
    const defaultAddress = addresses.length > 0 ? addresses[0] : null;

    return res.json({ user: { ...safeUser, defaultAddress } });
  } catch (error) {
    console.error('Auth me error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = {
  authMe,
  login,
  googleLogin,
  refresh,
  logout,
  logoutAll
};