// backend/src/modules/messages/services/messages.service.js
// Business rules for the messages module.

'use strict';

const AppError = require('../../../shared/errors/AppError');
const messagesRepo = require('../repositories/messages.repository');
const { prisma } = require('../../../database/postgres');

/**
 * Hydrate conversation with participant info from PostgreSQL.
 */
async function hydrateConversations(conversations, currentUserId) {
  if (!conversations.length) return [];

  // Collect all unique participant IDs across all conversations
  const allParticipantIds = [...new Set(conversations.flatMap((c) => c.participantIds))];

  const users = await prisma.user.findMany({
    where: { id: { in: allParticipantIds } },
    select: { id: true, name: true, role: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return conversations.map((conv) => ({
    ...conv,
    participants: conv.participantIds.map((id) => userMap[id] || { id, name: 'Unknown' }),
    otherUser: userMap[conv.participantIds.find((id) => id !== currentUserId)] || null,
  }));
}

// ─── Service operations ───────────────────────────────────────────────────────

/**
 * Get all conversations for the current user.
 */
async function getConversations(userId) {
  const conversations = await messagesRepo.getUserConversations(userId);
  return hydrateConversations(conversations, userId);
}

/**
 * Start or retrieve a direct conversation with another user.
 */
async function getOrStartConversation(requesterId, targetUserId) {
  if (requesterId === targetUserId) {
    throw new AppError('You cannot start a conversation with yourself', 400, 'INVALID_REQUEST');
  }

  // Verify the target user exists in PostgreSQL
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, role: true },
  });

  if (!targetUser) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Direct messages are available only between accepted connections.
  const [userA, userB] = requesterId < targetUserId
    ? [requesterId, targetUserId]
    : [targetUserId, requesterId];
  const connection = await prisma.connection.findUnique({
    where: { userA_userB: { userA, userB } },
    select: { userA: true },
  });

  if (!connection) {
    throw new AppError('You can message users after they accept your connection request', 403, 'CONNECTION_REQUIRED');
  }

  const conversation = await messagesRepo.getOrCreateConversation(requesterId, targetUserId);
  return conversation;
}

/**
 * Get paginated message history for a conversation.
 * Marks messages as read as a side effect.
 */
async function getMessages(conversationId, userId, page) {
  const conversation = await messagesRepo.getConversationById(conversationId, userId);
  if (!conversation) {
    throw new AppError('Conversation not found or access denied', 404, 'NOT_FOUND');
  }

  const result = await messagesRepo.getMessages(conversationId, page);

  // Mark messages from other user as read
  await messagesRepo.markMessagesRead(conversationId, userId);

  return result;
}

/**
 * Send a message in a conversation.
 */
async function sendMessage({ conversationId, senderId, content }) {
  const conversation = await messagesRepo.getConversationById(conversationId, senderId);
  if (!conversation) {
    throw new AppError('Conversation not found or access denied', 404, 'NOT_FOUND');
  }

  if (!content || !content.trim()) {
    throw new AppError('Message content cannot be empty', 400, 'VALIDATION_ERROR');
  }

  // Messaging is mutual and consensual: it requires an accepted connection at
  // the time of sending, not only when the conversation was created. Without
  // this, two people who disconnect could keep texting in the old thread.
  const otherId = conversation.participantIds.find((id) => id !== senderId);
  const [userA, userB] = senderId < otherId ? [senderId, otherId] : [otherId, senderId];
  const stillConnected = await prisma.connection.findUnique({
    where: { userA_userB: { userA, userB } },
    select: { userA: true },
  });
  if (!stillConnected) {
    throw new AppError(
      'You are no longer connected with this user. Send a new connection request to message them again.',
      403,
      'CONNECTION_REQUIRED',
    );
  }

  const message = await messagesRepo.createMessage({
    conversationId,
    senderId,
    content: content.trim(),
  });

  // Emit realtime WebSocket notification to the other participant
  try {
    const { emitToUser } = require('../../../realtime/socket');
    const recipientId = conversation.participantIds.find((id) => id !== senderId);
    if (recipientId) {
      emitToUser(recipientId, 'new_message', { conversationId, message });
    }
  } catch (err) {
    console.warn('⚠️ Realtime socket notification failed:', err.message);
  }

  return message;
}

module.exports = {
  getConversations,
  getOrStartConversation,
  getMessages,
  sendMessage,
};
