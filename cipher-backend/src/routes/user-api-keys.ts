import express from 'express';
import { db } from '../database.js';
import { authenticateSession } from './wallet-auth.js';

const router = express.Router();

// All routes require session authentication
router.use(authenticateSession);

// Create new API key for authenticated user
router.post('/create', async (req, res) => {
  try {
    const user = (req as any).user;
    const { name } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'API key name is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if user already has too many API keys
    const existingKeys = await db.prisma.apiKey.count({
      where: { userId: user.id, isActive: true }
    });
    
    if (existingKeys >= 5) {
      return res.status(400).json({
        error: 'Maximum 5 API keys allowed per user',
        timestamp: new Date().toISOString()
      });
    }
    
    const apiKey = await db.generateAPIKey(user.id, name);
    
    res.status(201).json({
      success: true,
      data: {
        id: apiKey.id,
        key: apiKey.key,
        name: apiKey.name,
        createdAt: apiKey.createdAt,
        isActive: apiKey.isActive
      },
      message: 'API key created successfully. Store this key securely - it will not be shown again.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error creating API key:', error);
    res.status(500).json({
      error: 'Failed to create API key',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get user's API keys (without showing actual keys)
router.get('/list', async (req, res) => {
  try {
    const user = (req as any).user;
    
    const apiKeys = await db.prisma.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            usage: true
          }
        }
      }
    });
    
    const sanitizedKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      createdAt: key.createdAt,
      lastUsed: key.lastUsed,
      isActive: key.isActive,
      usageCount: key.usageCount,
      totalUsageRecords: key._count.usage,
      keyPreview: `cypher_${key.key.substring(7, 15)}...${key.key.substring(key.key.length - 8)}`
    }));
    
    res.json({
      success: true,
      data: sanitizedKeys,
      count: sanitizedKeys.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({
      error: 'Failed to fetch API keys',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get specific API key details
router.get('/:keyId', async (req, res) => {
  try {
    const user = (req as any).user;
    const { keyId } = req.params;
    
    const apiKey = await db.prisma.apiKey.findFirst({
      where: {
        id: keyId,
        userId: user.id
      },
      include: {
        usage: {
          take: 20,
          orderBy: { timestamp: 'desc' }
        }
      }
    });
    
    if (!apiKey) {
      return res.status(404).json({
        error: 'API key not found',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        createdAt: apiKey.createdAt,
        lastUsed: apiKey.lastUsed,
        isActive: apiKey.isActive,
        usageCount: apiKey.usageCount,
        keyPreview: `cypher_${apiKey.key.substring(7, 15)}...${apiKey.key.substring(apiKey.key.length - 8)}`,
        recentUsage: apiKey.usage.map(usage => ({
          id: usage.id,
          endpoint: usage.endpoint,
          timestamp: usage.timestamp,
          ipAddress: usage.ipAddress?.substring(0, 8) + '...' // Partially hide IP
        }))
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error fetching API key details:', error);
    res.status(500).json({
      error: 'Failed to fetch API key details',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Deactivate API key
router.delete('/:keyId', async (req, res) => {
  try {
    const user = (req as any).user;
    const { keyId } = req.params;
    
    const apiKey = await db.prisma.apiKey.findFirst({
      where: {
        id: keyId,
        userId: user.id
      }
    });
    
    if (!apiKey) {
      return res.status(404).json({
        error: 'API key not found',
        timestamp: new Date().toISOString()
      });
    }
    
    await db.prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false }
    });
    
    res.json({
      success: true,
      message: 'API key deactivated successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error deactivating API key:', error);
    res.status(500).json({
      error: 'Failed to deactivate API key',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rename API key
router.patch('/:keyId', async (req, res) => {
  try {
    const user = (req as any).user;
    const { keyId } = req.params;
    const { name } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Name is required',
        timestamp: new Date().toISOString()
      });
    }
    
    const apiKey = await db.prisma.apiKey.findFirst({
      where: {
        id: keyId,
        userId: user.id
      }
    });
    
    if (!apiKey) {
      return res.status(404).json({
        error: 'API key not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const updatedKey = await db.prisma.apiKey.update({
      where: { id: keyId },
      data: { name }
    });
    
    res.json({
      success: true,
      data: {
        id: updatedKey.id,
        name: updatedKey.name,
        updatedAt: new Date()
      },
      message: 'API key renamed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error renaming API key:', error);
    res.status(500).json({
      error: 'Failed to rename API key',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get usage statistics for user's API keys
router.get('/stats/usage', async (req, res) => {
  try {
    const user = (req as any).user;
    const { days = '7' } = req.query;
    
    const daysAgo = new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000);
    
    // Get all user's API keys
    const apiKeys = await db.prisma.apiKey.findMany({
      where: { userId: user.id },
      include: {
        usage: {
          where: {
            timestamp: {
              gt: daysAgo
            }
          }
        }
      }
    });
    
    // Aggregate usage by endpoint
    const endpointStats = new Map<string, number>();
    let totalRequests = 0;
    
    apiKeys.forEach(key => {
      key.usage.forEach(usage => {
        endpointStats.set(usage.endpoint, (endpointStats.get(usage.endpoint) || 0) + 1);
        totalRequests++;
      });
    });
    
    const tierLimits = { NORMAL: 5, PREMIUM: 15 };
    const resetDate = new Date(user.lastResetAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    res.json({
      success: true,
      data: {
        totalRequests,
        endpointStats: Array.from(endpointStats.entries()).map(([endpoint, count]) => ({
          endpoint,
          count
        })),
        monthlyUsage: {
          used: user.monthlyUsage,
          limit: tierLimits[user.tier],
          remaining: Math.max(0, tierLimits[user.tier] - user.monthlyUsage),
          resetDate,
          tier: user.tier
        },
        activeApiKeys: apiKeys.filter(k => k.isActive).length,
        totalApiKeys: apiKeys.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({
      error: 'Failed to fetch usage statistics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;