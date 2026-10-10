// frontend/src/features/networking/api.js
import api from '../../services/api';

export const getConnections = () =>
  api.get('/connections').then((r) => r.data.data.connections);

export const getIncomingRequests = () =>
  api.get('/connections/requests/incoming').then((r) => r.data.data.requests);

export const getOutgoingRequests = () =>
  api.get('/connections/requests/outgoing').then((r) => r.data.data.requests);

export const respondToRequest = (requestId, action) =>
  api.post(`/connections/requests/${requestId}/respond`, { action }).then((r) => r.data.data);

export const cancelRequest = (requestId) =>
  api.delete(`/connections/requests/${requestId}/cancel`).then((r) => r.data.data);

export const removeConnection = (userId) =>
  api.delete(`/connections/${userId}`).then((r) => r.data.data);
