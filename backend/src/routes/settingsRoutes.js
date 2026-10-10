// backend/src/routes/settingsRoutes.js
// Express routes for User settings and privacy controls.
// All endpoints mounted under /api/settings and protected with requireAuth.

'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const settingsController = require('../controllers/settingsController');

const router = express.Router();

router.use(requireAuth);

router.get('/', settingsController.getSettings);
router.put('/privacy', settingsController.updatePrivacySettings);
router.put('/notifications', settingsController.updateNotificationSettings);

module.exports = router;
