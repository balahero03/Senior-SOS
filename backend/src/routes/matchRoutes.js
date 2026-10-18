// backend/src/routes/matchRoutes.js
// Best-fit alumni recommendations. Mounted at /api/match.

'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const matchController = require('../controllers/matchController');

const router = express.Router();

router.use(requireAuth);

// Role is checked in the controller so students get a clear 403 message
// rather than a generic middleware rejection.
router.get('/alumni', matchController.getAlumniMatches);

module.exports = router;
