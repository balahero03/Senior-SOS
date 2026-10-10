// backend/src/routes/connectionRoutes.js
// Express routes for student and alumni networking connections.
// All endpoints mounted under /api/connections and protected with requireAuth.

'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const connectionController = require('../controllers/connectionController');

const router = express.Router();

// Require JWT authentication for all connection operations
router.use(requireAuth);

// ─── Connection Requests ─────────────────────────────────────────────────────
router.post('/request', connectionController.sendConnectionRequest);
router.get('/requests/incoming', connectionController.getIncomingRequests);
router.get('/requests/outgoing', connectionController.getOutgoingRequests);
router.post('/requests/:requestId/respond', connectionController.respondToRequest);
router.delete('/requests/:requestId/cancel', connectionController.cancelConnectionRequest);

// ─── Active Connections ──────────────────────────────────────────────────────
router.get('/', connectionController.getConnections);
router.delete('/:otherUserId', connectionController.removeConnection);

module.exports = router;
