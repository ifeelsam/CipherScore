import { Request, Response, NextFunction } from 'express';
import { db } from '../database.js';

// Extend Request interface to include apiKey
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        key: string;
        name: string;
        usageCount: number;
        user: {
          id: string;
          email: string;
          name?: string;
          tier: 'NORMAL' | 'PREMIUM';
          monthlyUsage: number;
        };
      };
    }
  }
}

// API Key authentication middleware
export const authenticateAPIKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip CORS preflight
    if (req.method === 'OPTIONS') {
      return next();
    }

    // Get API key from headers
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(401).json({
        error: 'API key required',
        message: 'Provide API key in X-API-Key header or Authorization: Bearer header',
        timestamp: new Date().toISOString()
      });
    }

    // Validate API key
    const validation = await db.validateAPIKey(apiKey);

    if (!validation.valid) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or inactive',
        timestamp: new Date().toISOString()
      });
    }

    if (validation.monthlyLimitExceeded) {
      const tierLimits = { NORMAL: 5, PREMIUM: 15 };
      return res.status(429).json({
        error: 'Monthly limit exceeded',
        message: `Monthly limit of ${validation.limit} credit score calculations exceeded for ${validation.key?.user.tier} tier`,
        tier: validation.key?.user.tier,
        usage: validation.usage,
        limit: validation.limit,
        resetDate: validation.resetDate,
        upgradeMessage: validation.key?.user.tier === 'NORMAL' 
          ? 'Upgrade to PREMIUM for 15 calculations per month' 
          : 'Contact support for enterprise options',
        timestamp: new Date().toISOString()
      });
    }

    // Attach API key info to request
    req.apiKey = validation.key!;

    // Log API key usage
    const endpoint = `${req.method} ${req.path}`;
    const ipAddress = req.ip || (req.connection as any).remoteAddress;
    const userAgent = req.headers['user-agent'] as string | undefined;

    await db.logAPIKeyUsage(validation.key!.id, endpoint, ipAddress, userAgent);

    next();

  } catch (error) {
    console.error('Error in API key authentication:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication',
      timestamp: new Date().toISOString()
    });
  }
};

// Optional: Admin-only middleware (for API key management endpoints)
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  // For now, we'll use a simple admin key check
  // In production, you might want a more sophisticated admin system
  const adminKey = process.env.ADMIN_API_KEY;
  const providedKey = req.headers['x-admin-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!adminKey) {
    return res.status(503).json({
      error: 'Admin functionality not configured',
      message: 'ADMIN_API_KEY environment variable not set',
      timestamp: new Date().toISOString()
    });
  }

  if (providedKey !== adminKey) {
    return res.status(403).json({
      error: 'Admin access required',
      message: 'Valid admin key required for this operation',
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export default authenticateAPIKey;