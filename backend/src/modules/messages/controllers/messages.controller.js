// backend/src/modules/messages/controllers/messages.controller.js
// HTTP translation layer for the messages module.

'use strict';

const asyncHandler = require('../../../shared/utils/asyncHandler');
const messagesService = require('../services/messages.service');

/**
 * GET /api/conversations
 * List all conversations for the current user.
 */
const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const conversations = await messagesService.getConversations(userId);
  res.json({ success: true, data: { conversations } });
});

/**
 * POST /api/conversations
 * Start or retrieve a direct conversation with another user.
 * Body: { targetUserId: string }
 */
const startConversation = asyncHandler(async (req, res) => {
  const requesterId = req.user.sub;
  const { targetUserId } = req.body;

  if (!targetUserId) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'targetUserId is required.' },
    });
  }

  const conversation = await messagesService.getOrStartConversation(requesterId, targetUserId);
  res.status(201).json({ success: true, data: { conversation } });
});

/**
 * GET /api/conversations/:id/messages?page=1
 * Fetch paginated message history for a conversation.
 */
const getMessages = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const conversationId = req.params.id;
  const page = parseInt(req.query.page) || 1;

  const result = await messagesService.getMessages(conversationId, userId, page);
  res.json({ success: true, data: result });
});

/**
 * POST /api/messages
 * Send a message in a conversation.
 * Body: { conversationId: string, content: string }
 */
const sendMessage = asyncHandler(async (req, res) => {
  const senderId = req.user.sub;
  const { conversationId, content } = req.body;

  if (!conversationId || !content) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'conversationId and content are required.' },
    });
  }

  const message = await messagesService.sendMessage({ conversationId, senderId, content });
  res.status(201).json({ success: true, data: { message } });
});

module.exports = {
  getConversations,
  startConversation,
  getMessages,
  sendMessage,
};
