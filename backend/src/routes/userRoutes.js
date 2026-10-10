// backend/src/routes/userRoutes.js
// Express routes for User Profiles, Department/Company/Skill metadata lookups.
// Handled under /api/users, /api/departments, /api/companies, and /api/skills.

'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const userController = require('../controllers/userController');
const usersController = require('../modules/users/controllers/users.controller');

const router = express.Router();

router.use(requireAuth);

// ─── User Profile & List Endpoints ───────────────────────────────────────────
router.get('/', userController.getUsers);
router.put('/profile', userController.updateProfile);
router.get('/:id/profile', userController.getUserProfile);

module.exports = router;
