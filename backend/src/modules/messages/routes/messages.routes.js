// backend/src/modules/messages/routes/messages.routes.js
// HTTP route definitions for the messages module.
// All routes require authentication.

'use strict';

const { Router } = require('express');
const { requireAuth } = require('../../../middleware/auth.middleware');
const messagesController = require('../controllers/messages.controller');

const router = Router();

router.use(requireAuth);

// Conversations
router.get('/conversations', messagesController.getConversations);
router.post('/conversations', messagesController.startConversation);
router.get('/conversations/:id/messages', messagesController.getMessages);

// Send a message (HTTP fallback — Socket.IO is the primary transport)
router.post('/messages', messagesController.sendMessage);

module.exports = router;
