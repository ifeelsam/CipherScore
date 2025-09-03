import { PrismaClient, UserTier } from './generated/prisma';
import { randomBytes } from 'crypto';

// Tier limits configuration
const TIER_LIMITS = {
  NORMAL: 5,   // 5 free credit scores per month
  PREMIUM: 15, // 15 free credit scores per month
} as const;

class DatabaseService {
  public prisma: PrismaClient; // Make public for direct access in routes

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Create a new user with wallet address
  async createUser(walletAddress: string, name?: string, email?: string, tier: UserTier = 'NORMAL') {
    return await this.prisma.user.create({
      data: {
        walletAddress,
        name,
        email,
        tier,
      },
    });
  }

  // Generate a new API key for a user
  async generateAPIKey(userId: string, name: string) {
    const apiKey = `cypher_${randomBytes(32).toString('hex')}`;
    
    return await this.prisma.apiKey.create({
      data: {
        key: apiKey,
        name,
        userId,
      },
      include: {
        user: true,
      },
    });
  }

  // Create user and API key in one step (for wallet signup)
  async createUserWithAPIKey(walletAddress: string, name?: string, email?: string, tier: UserTier = 'NORMAL', keyName: string = 'Default') {
    const user = await this.createUser(walletAddress, name, email, tier);
    const apiKey = await this.generateAPIKey(user.id, keyName);
    return { user, apiKey };
  }

  // Validate API key and check monthly usage limits
  async validateAPIKey(apiKey: string) {
    // Get API key with user info
    const key = await this.prisma.apiKey.findUnique({
      where: {
        key: apiKey,
        isActive: true,
      },
      include: {
        user: true,
      },
    });

    if (!key) {
      return { valid: false };
    }

    // Check if user needs monthly reset
    const now = new Date();
    const lastReset = new Date(key.user.lastResetAt);
    const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
    
    // Reset monthly usage if it's been 30+ days
    if (daysSinceReset >= 30) {
      await this.prisma.user.update({
        where: { id: key.user.id },
        data: {
          monthlyUsage: 0,
          lastResetAt: now,
        },
      });
      key.user.monthlyUsage = 0;
    }

    // Check monthly usage limits based on tier
    const monthlyLimit = TIER_LIMITS[key.user.tier];
    if (key.user.monthlyUsage >= monthlyLimit) {
      return { 
        valid: true, 
        key, 
        monthlyLimitExceeded: true,
        usage: key.user.monthlyUsage,
        limit: monthlyLimit,
        resetDate: new Date(lastReset.getTime() + 30 * 24 * 60 * 60 * 1000)
      };
    }

    return { valid: true, key };
  }

  // Log API key usage and increment monthly usage for credit score calculations
  async logAPIKeyUsage(apiKeyId: string, endpoint: string, ipAddress?: string, userAgent?: string) {
    await this.prisma.apiKeyUsage.create({
      data: {
        apiKeyId,
        endpoint,
        ipAddress,
        userAgent,
      },
    });

    // Update last_used and usage_count for API key
    const apiKey = await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        lastUsed: new Date(),
        usageCount: {
          increment: 1,
        },
      },
      include: {
        user: true,
      },
    });


  }

  // Get all API keys
  async getAllAPIKeys() {
    return await this.prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            usage: true,
          },
        },
      },
    });
  }

  // Get API key by ID
  async getAPIKeyById(id: string) {
    return await this.prisma.apiKey.findUnique({
      where: { id },
      include: {
        usage: {
          take: 10,
          orderBy: { timestamp: 'desc' },
        },
      },
    });
  }

  // Deactivate API key
  async deactivateAPIKey(id: string) {
    try {
      await this.prisma.apiKey.update({
        where: { id },
        data: { isActive: false },
      });
      return true;
    } catch {
      return false;
    }
  }

  // Get usage stats for an API key
  async getAPIKeyStats(apiKeyId: string, days: number = 7) {
    const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    return await this.prisma.apiKeyUsage.groupBy({
      by: ['endpoint'],
      where: {
        apiKeyId,
        timestamp: {
          gt: daysAgo,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });
  }

  // Get hourly usage stats
  async getHourlyUsageStats(apiKeyId: string, hours: number = 24) {
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await this.prisma.apiKeyUsage.findMany({
      where: {
        apiKeyId,
        timestamp: {
          gt: hoursAgo,
        },
      },
      select: {
        timestamp: true,
        endpoint: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}

// Singleton instance
export const db = new DatabaseService();
export { PrismaClient } from './generated/prisma';