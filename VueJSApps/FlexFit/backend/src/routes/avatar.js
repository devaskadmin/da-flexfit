const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const pool = require('../../db');

// Allowed avatar image extensions
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

// Avatar images directory
const AVATAR_DIR = path.join(__dirname, '../images/avatar');

/**
 * GET /api/avatar/list
 * Returns list of available avatar images
 */
router.get('/list', async (req, res) => {
  try {
    // Read all files from avatar directory
    const files = await fs.readdir(AVATAR_DIR);
    
    // Filter valid image files
    const avatars = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ALLOWED_EXTENSIONS.includes(ext);
      })
      .map(file => ({
        name: file,
        path: `/images/avatar/${file}`
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Ensure default.png is always included (should be first)
    const hasDefault = avatars.some(avatar => avatar.name === 'default.png');
    if (!hasDefault) {
      avatars.unshift({
        name: 'default.png',
        path: '/images/avatar/default.png'
      });
    }

    res.json({
      success: true,
      avatars
    });
  } catch (error) {
    console.error('Error listing avatars:', error);
    // Return at least default avatar even if directory read fails
    res.json({
      success: true,
      avatars: [{
        name: 'default.png',
        path: '/images/avatar/default.png'
      }]
    });
  }
});

/**
 * PUT /api/users/avatar
 * Updates user's selected avatar
 * Requires authentication
 */
router.put('/update', async (req, res) => {
  try {
    // Check authentication
    if (!req.session || !req.session.user || !req.session.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { avatarName, avatarPath } = req.body;

    // Validate input
    if (!avatarName || !avatarPath) {
      return res.status(400).json({
        success: false,
        message: 'avatarName and avatarPath are required'
      });
    }

    // Validate file extension
    const ext = path.extname(avatarName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Allowed: ' + ALLOWED_EXTENSIONS.join(', ')
      });
    }

    // Prevent path traversal attacks
    const sanitizedName = path.basename(avatarName);
    if (sanitizedName !== avatarName || avatarName.includes('..')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid avatar name'
      });
    }

    // Verify file exists in avatar directory
    const filePath = path.join(AVATAR_DIR, sanitizedName);
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({
        success: false,
        message: 'Avatar file not found'
      });
    }

    // Validate avatarPath format
    const expectedPath = `/images/avatar/${sanitizedName}`;
    if (avatarPath !== expectedPath) {
      return res.status(400).json({
        success: false,
        message: 'Invalid avatar path'
      });
    }

    // Update user avatar in database
    const userId = req.session.user.id;
    const query = `
      UPDATE users 
      SET avatarName = ?, avatarPath = ?, updatedAt = NOW()
      WHERE id = ?
    `;

    await pool.query(query, [sanitizedName, expectedPath, userId]);

    // Update session with new avatar info
    req.session.user.avatarName = sanitizedName;
    req.session.user.avatarPath = expectedPath;

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      user: {
        avatarName: sanitizedName,
        avatarPath: expectedPath
      }
    });
  } catch (error) {
    console.error('Error updating avatar:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update avatar'
    });
  }
});

module.exports = router;
