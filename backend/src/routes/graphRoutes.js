// backend/src/routes/graphRoutes.js
// Graph endpoints — mutual connections, paths, suggestions, network view.
// Mounted at /api/graph. All routes require authentication.

'use strict';

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const graphController = require('../controllers/graphController');

const router = express.Router();

router.use(requireAuth);

// Whether graph features are usable. Checked by the UI before offering them.
router.get('/status', graphController.getStatus);

// Suggestions and the network view are about the requester, so they take no
// id. Declared before /:userId-style routes so the literal paths win.
router.get('/suggestions', graphController.getSuggestions);
router.get('/network', graphController.getNetwork);

// Batch mutual counts for list and card views.
router.post('/mutual-counts', graphController.getMutualCounts);

// Reachability by employer: "who do we know at Amazon?"
router.get('/company/:company', graphController.getReachableAtCompany);

// Pairwise queries against another user.
router.get('/mutual/:userId', graphController.getMutual);
router.get('/path/:userId', graphController.getPath);

// Rebuilding the mirror is an administrative action.
router.post('/resync', requireAdmin, graphController.resync);

module.exports = router;
