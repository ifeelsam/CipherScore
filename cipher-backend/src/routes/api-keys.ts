import express from 'express';
import { db } from '../database.js';
import { randomBytes } from 'crypto';

const router = express.Router();

// Create new API key
router.post('/api-keys', async (req, res) => {
  try {
    const { name, rateLimitPerHour = 1000 } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Name is required and must be a string',
        timestamp: new Date().toISOString()
      });
    }

    if (rateLimitPerHour && (typeof rateLimitPerHour !== 'number' || rateLimitPerHour < 1)) {
      return res.status(400).json({
        error: 'Rate limit must be a positive number',
        timestamp: new Date().toISOString()
      });
    }

    const apiKey = await db.generateAPIKey(name, rateLimitPerHour);

    res.status(201).json({
      success: true,
      data: {
        id: apiKey.id,
        key: apiKey.key,
        name: apiKey.name,
        rateLimitPerHour: apiKey.rateLimitPerHour,
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

// Get all API keys (without showing the actual keys)
router.get('/api-keys', async (req, res) => {
  try {
    const apiKeys = await db.getAllAPIKeys();

    const sanitizedKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      createdAt: key.createdAt,
      lastUsed: key.lastUsed,
      isActive: key.isActive,
      rateLimitPerHour: key.rateLimitPerHour,
      usageCount: key.usageCount,
      totalUsageRecords: key._count?.usage || 0,
      keyPreview: `${key.key.substring(0, 8)}...${key.key.substring(key.key.length - 4)}`
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
router.get('/api-keys/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const apiKey = await db.getAPIKeyById(id);

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
        rateLimitPerHour: apiKey.rateLimitPerHour,
        usageCount: apiKey.usageCount,
        keyPreview: `${apiKey.key.substring(0, 8)}...${apiKey.key.substring(apiKey.key.length - 4)}`,
        recentUsage: apiKey.usage?.map(usage => ({
          id: usage.id,
          endpoint: usage.endpoint,
          timestamp: usage.timestamp,
          ipAddress: usage.ipAddress
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching API key:', error);
    res.status(500).json({
      error: 'Failed to fetch API key details',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Deactivate API key
router.delete('/api-keys/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await db.deactivateAPIKey(id);

    if (!success) {
      return res.status(404).json({
        error: 'API key not found',
        timestamp: new Date().toISOString()
      });
    }

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

// Get API key usage statistics
router.get('/api-keys/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = '7', hours = '24' } = req.query;

    const [endpointStats, hourlyUsage] = await Promise.all([
      db.getAPIKeyStats(id, parseInt(days as string)),
      db.getHourlyUsageStats(id, parseInt(hours as string))
    ]);

    // Group hourly usage by hour
    const hourlyStatsMap = new Map<string, number>();
    hourlyUsage.forEach(usage => {
      const hour = new Date(usage.timestamp).toISOString().substring(0, 13) + ':00:00.000Z';
      hourlyStatsMap.set(hour, (hourlyStatsMap.get(hour) || 0) + 1);
    });

    const hourlyStats = Array.from(hourlyStatsMap.entries()).map(([hour, count]) => ({
      hour,
      count
    })).sort((a, b) => a.hour.localeCompare(b.hour));

    res.json({
      success: true,
      data: {
        endpointStats: endpointStats.map(stat => ({
          endpoint: stat.endpoint,
          count: stat._count.id
        })),
        hourlyStats,
        totalRequests: hourlyUsage.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching API key stats:', error);
    res.status(500).json({
      error: 'Failed to fetch API key statistics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;