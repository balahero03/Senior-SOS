// frontend/src/features/messages/api.js
import api from '../../services/api';

export const getConversations = () =>
  api.get('/conversations').then((r) => r.data.data);

export const getOrCreateConversation = (targetUserId) =>
  api.post('/conversations', { targetUserId }).then((r) => r.data.data);

export const getMessages = (conversationId, page = 1) =>
  api.get(`/conversations/${conversationId}/messages`, { params: { page } }).then((r) => r.data.data);

export const sendMessage = (conversationId, content) =>
  api.post('/messages', { conversationId, content }).then((r) => r.data.data);

export const getUsers = (params = {}) =>
  api.get('/users', { params }).then((r) => r.data.data.users);

