// backend/src/modules/messages/repositories/messages.repository.js
// All MongoDB queries for the messages module.
// Per FOLDER_STRUCTURE.md: only this layer imports Mongoose models.

'use strict';

const Conversation = require('../../../database/mongodb/models/Conversation.model');
const Message = require('../../../database/mongodb/models/Message.model');

const PAGE_SIZE = 50;

// ─── Conversations ────────────────────────────────────────────────────────────

/**
 * Find or create a direct conversation between two users.
 * Uses sorted pairKey to prevent duplicates.
 *
 * @param {string} userAId  PostgreSQL User UUID
 * @param {string} userBId  PostgreSQL User UUID
 */
async function getOrCreateConversation(userAId, userBId) {
  const pairKey = [userAId, userBId].sort().join(':');

  let conversation = await Conversation.findOne({ pairKey }).lean();

  if (!conversation) {
    const created = await Conversation.create({
      participantIds: [userAId, userBId],
      pairKey,
    });
    conversation = created.toObject();
  }

  return conversation;
}

/**
 * Get all conversations for a user, sorted by most recent message.
 *
 * @param {string} userId  PostgreSQL User UUID
 */
async function getUserConversations(userId) {
  return Conversation.find({ participantIds: userId })
    .sort({ lastMessageAt: -1 })
    .lean();
}

/**
 * Get a conversation by ID (verifies the requesting user is a participant).
 */
async function getConversationById(conversationId, userId) {
  return Conversation.findOne({
    _id: conversationId,
    participantIds: userId,
  }).lean();
}

// ─── Messages ─────────────────────────────────────────────────────────────────

/**
 * Get paginated messages for a conversation (newest first from DB, reversed for display).
 *
 * @param {string} conversationId  MongoDB ObjectId
 * @param {number} page
 */
async function getMessages(conversationId, page = 1) {
  const [messages, total] = await Promise.all([
    Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Message.countDocuments({ conversationId }),
  ]);

  // Reverse so oldest is first for chat display
  return { messages: messages.reverse(), total, page, pageSize: PAGE_SIZE };
}

/**
 * Persist a new message and bump conversation's lastMessageAt.
 *
 * @param {{ conversationId, senderId, content }} data
 */
async function createMessage({ conversationId, senderId, content }) {
  const [message] = await Promise.all([
    Message.create({ conversationId, senderId, content }),
    Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() }),
  ]);

  return message.toObject();
}

/**
 * Mark all messages in a conversation as read for the given recipient.
 */
async function markMessagesRead(conversationId, recipientId) {
  await Message.updateMany(
    { conversationId, senderId: { $ne: recipientId }, readAt: null },
    { readAt: new Date() }
  );
}

module.exports = {
  getOrCreateConversation,
  getUserConversations,
  getConversationById,
  getMessages,
  createMessage,
  markMessagesRead,
};
