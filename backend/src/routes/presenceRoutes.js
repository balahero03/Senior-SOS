// backend/src/routes/presenceRoutes.js
// Online status for connections. Mounted at /api/presence.

'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const presenceController = require('../controllers/presenceController');

const router = express.Router();

router.use(requireAuth);
router.get('/', presenceController.getPresence);

module.exports = router;
