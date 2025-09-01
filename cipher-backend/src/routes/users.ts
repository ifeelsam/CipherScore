import express from 'express';
import { db } from '../database.js';
import { UserTier } from '../generated/prisma';

const router = express.Router();

// Public signup endpoint - create user and get API key
router.post('/signup', async (req, res) => {
  try {
    const { email, name, tier = 'NORMAL' } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        error: 'Email is required',
        timestamp: new Date().toISOString()
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        timestamp: new Date().toISOString()
      });
    }

    // Validate tier
    if (tier && !['NORMAL', 'PREMIUM'].includes(tier)) {
      return res.status(400).json({
        error: 'Invalid tier. Must be NORMAL or PREMIUM',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user already exists
    const existingUser = await db.prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User with this email already exists',
        timestamp: new Date().toISOString()
      });
    }

    // Create user with API key
    const { user, apiKey } = await db.createUserWithAPIKey(
      email,
      name,
      tier as UserTier,
      'Default API Key'
    );

    const tierLimits = { NORMAL: 5, PREMIUM: 15 };

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier,
          createdAt: user.createdAt,
          monthlyLimit: tierLimits[user.tier],
          monthlyUsage: user.monthlyUsage,
        },
        apiKey: {
          id: apiKey.id,
          key: apiKey.key,
          name: apiKey.name,
          createdAt: apiKey.createdAt,
        }
      },
      message: 'Account created successfully! Store your API key securely - it will not be shown again.',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({
      error: 'Failed to create account',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get user profile and usage info (requires API key)
router.get('/profile', async (req, res) => {
  try {
    if (!req.apiKey?.user) {
      return res.status(401).json({
        error: 'API key required',
        timestamp: new Date().toISOString()
      });
    }

    const user = await db.prisma.user.findUnique({
      where: { id: req.apiKey.user.id },
      include: {
        apiKeys: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            lastUsed: true,
            usageCount: true,
          }
        },
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const tierLimits = { NORMAL: 5, PREMIUM: 15 };
    const resetDate = new Date(user.lastResetAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const daysUntilReset = Math.max(0, Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        createdAt: user.createdAt,
        usage: {
          monthly: user.monthlyUsage,
          limit: tierLimits[user.tier],
          remaining: Math.max(0, tierLimits[user.tier] - user.monthlyUsage),
          resetDate,
          daysUntilReset,
        },
        apiKeys: user.apiKeys.map(key => ({
          ...key,
          keyPreview: `cypher_${key.id.substring(0, 8)}...`
        })),
        upgradeInfo: user.tier === 'NORMAL' ? {
          message: 'Upgrade to PREMIUM for 15 credit score calculations per month',
          benefits: [
            '15 credit score calculations per month (vs 5 for NORMAL)',
            'Priority support',
            'Advanced analytics'
          ]
        } : null
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Upgrade user tier (for now, just a simple endpoint - in production you'd integrate with Stripe)
router.post('/upgrade', async (req, res) => {
  try {
    if (!req.apiKey?.user) {
      return res.status(401).json({
        error: 'API key required',
        timestamp: new Date().toISOString()
      });
    }

    const { tier } = req.body;

    if (!['NORMAL', 'PREMIUM'].includes(tier)) {
      return res.status(400).json({
        error: 'Invalid tier. Must be NORMAL or PREMIUM',
        timestamp: new Date().toISOString()
      });
    }

    const updatedUser = await db.prisma.user.update({
      where: { id: req.apiKey.user.id },
      data: { tier: tier as UserTier },
    });

    const tierLimits = { NORMAL: 5, PREMIUM: 15 };

    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        tier: updatedUser.tier,
        monthlyLimit: tierLimits[updatedUser.tier],
        message: `Successfully upgraded to ${tier} tier!`
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error upgrading user:', error);
    res.status(500).json({
      error: 'Failed to upgrade account',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;