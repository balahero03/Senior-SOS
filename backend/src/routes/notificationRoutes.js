// backend/src/routes/notificationRoutes.js
// Express routes for notifications.
// All endpoints mounted under /api/notifications and protected with requireAuth.

'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.use(requireAuth);

router.get('/', notificationController.getNotifications);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);

module.exports = router;
