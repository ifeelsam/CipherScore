import express from 'express'
import { db } from '../database.js'
import { authenticateSession } from './wallet-auth.js'

const router = express.Router()

// All routes require session authentication
router.use(authenticateSession)

// Get current user's profile
router.get('/', async (req, res) => {
  try {
    const user = (req as any).user
    res.json({
      success: true,
      data: {
        id: user.id,
        walletAddress: user.walletAddress,
        email: user.email,
        name: user.name,
        tier: user.tier,
        createdAt: user.createdAt,
      },
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Update current user's profile (name/email)
router.patch('/', async (req, res) => {
  try {
    const user = (req as any).user
    const { name, email } = req.body || {}

    if (name !== undefined && typeof name !== 'string') {
      return res.status(400).json({ error: 'name must be a string', timestamp: new Date().toISOString() })
    }
    if (email !== undefined && typeof email !== 'string') {
      return res.status(400).json({ error: 'email must be a string', timestamp: new Date().toISOString() })
    }

    // Optional: simple email format check
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format', timestamp: new Date().toISOString() })
      }
    }

    const updated = await db.prisma.user.update({
      where: { id: user.id },
      data: {
        name: name ?? undefined,
        email: email ?? undefined,
      }
    })

    res.json({
      success: true,
      data: {
        id: updated.id,
        walletAddress: updated.walletAddress,
        email: updated.email,
        name: updated.name,
        tier: updated.tier,
        createdAt: updated.createdAt,
      },
      message: 'Profile updated',
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    if (error?.code === 'P2002') { // unique constraint
      return res.status(409).json({ error: 'Email already in use', timestamp: new Date().toISOString() })
    }
    res.status(500).json({
      error: 'Failed to update profile',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

export default router 