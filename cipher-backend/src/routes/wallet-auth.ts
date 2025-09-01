import express from 'express';
import { db } from '../database.js';
import { UserTier } from '../generated/prisma';
import { WalletAuthService } from '../services/wallet-auth.js';

const router = express.Router();

// Step 1: Request nonce for wallet signature
router.post('/request-nonce', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress || !WalletAuthService.isValidSolanaAddress(walletAddress)) {
      return res.status(400).json({
        error: 'Valid Solana wallet address required',
        timestamp: new Date().toISOString()
      });
    }
    
    const nonce = WalletAuthService.generateNonce();
    const nonceExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Create user if doesn't exist, or update nonce
    await db.prisma.user.upsert({
      where: { walletAddress },
      update: { nonce, nonceExpiry },
      create: {
        walletAddress,
        nonce,
        nonceExpiry,
        tier: 'NORMAL'
      }
    });
    
    const message = WalletAuthService.createSignMessage(walletAddress, nonce);
    
    res.json({
      success: true,
      data: {
        message,
        nonce,
        expiresAt: nonceExpiry
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error generating nonce:', error);
    res.status(500).json({
      error: 'Failed to generate nonce',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Step 2: Verify signature and create session
router.post('/verify-signature', async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;
    
    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        error: 'Wallet address, signature, and message are required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Get user and verify nonce
    const user = await db.prisma.user.findUnique({
      where: { walletAddress }
    });
    
    if (!user || !user.nonce || !user.nonceExpiry) {
      return res.status(400).json({
        error: 'No valid nonce found. Please request a new nonce.',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check nonce expiry
    if (new Date() > user.nonceExpiry) {
      return res.status(400).json({
        error: 'Nonce expired. Please request a new nonce.',
        timestamp: new Date().toISOString()
      });
    }
    
    // Verify signature
    const isValidSignature = WalletAuthService.verifySolanaSignature(
      message,
      signature,
      walletAddress
    );
    
    if (!isValidSignature) {
      return res.status(401).json({
        error: 'Invalid signature',
        timestamp: new Date().toISOString()
      });
    }
    
    // Create session
    const sessionToken = WalletAuthService.generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const session = await db.prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });
    
    // Clear nonce
    await db.prisma.user.update({
      where: { id: user.id },
      data: { nonce: null, nonceExpiry: null }
    });
    
    const tierLimits = { NORMAL: 5, PREMIUM: 15 };
    
    res.json({
      success: true,
      data: {
        sessionToken: session.token,
        expiresAt: session.expiresAt,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          name: user.name,
          tier: user.tier,
          monthlyLimit: tierLimits[user.tier],
          monthlyUsage: user.monthlyUsage
        }
      },
      message: 'Authentication successful',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error verifying signature:', error);
    res.status(500).json({
      error: 'Failed to verify signature',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Middleware to authenticate session token
export const authenticateSession = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const sessionToken = req.headers['x-session-token'] as string;
    
    if (!sessionToken) {
      return res.status(401).json({
        error: 'Session token required',
        message: 'Provide session token in X-Session-Token header',
        timestamp: new Date().toISOString()
      });
    }
    
    const session = await db.prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true }
    });
    
    if (!session) {
      return res.status(401).json({
        error: 'Invalid session token',
        timestamp: new Date().toISOString()
      });
    }
    
    if (new Date() > session.expiresAt) {
      await db.prisma.session.delete({ where: { id: session.id } });
      return res.status(401).json({
        error: 'Session expired',
        message: 'Please authenticate again',
        timestamp: new Date().toISOString()
      });
    }
    
    // Attach user to request
    (req as any).user = session.user;
    (req as any).sessionId = session.id;
    
    next();
    
  } catch (error) {
    console.error('Session authentication error:', error);
    res.status(500).json({
      error: 'Authentication error',
      timestamp: new Date().toISOString()
    });
  }
};

// Get current session info
router.get('/session', authenticateSession, (req, res) => {
  const user = (req as any).user;
  const tierLimits = { NORMAL: 5, PREMIUM: 15 };
  
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        name: user.name,
        tier: user.tier,
        monthlyLimit: tierLimits[user.tier],
        monthlyUsage: user.monthlyUsage,
        createdAt: user.createdAt
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Logout - invalidate session
router.post('/logout', authenticateSession, async (req, res) => {
  try {
    const sessionId = (req as any).sessionId;
    
    await db.prisma.session.delete({
      where: { id: sessionId }
    });
    
    res.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Failed to logout',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;