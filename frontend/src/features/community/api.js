// frontend/src/features/community/api.js
import api from '../../services/api';

// The feed loads in small slots and appends as the reader scrolls, so the
// page size is passed explicitly rather than relying on the server default.
export const getPosts = (page = 1, tag, limit) =>
  api
    .get('/posts', { params: { page, ...(limit && { limit }), ...(tag && { tag }) } })
    .then(r => r.data.data);

export const createPost = (data) =>
  api.post('/posts', data).then(r => r.data.data);

export const deletePost = (id) =>
  api.delete(`/posts/${id}`).then(r => r.data.data);

export const getComments = (postId) =>
  api.get(`/posts/${postId}/comments`).then(r => r.data.data);

export const addComment = (postId, content) =>
  api.post(`/posts/${postId}/comments`, { content }).then(r => r.data.data);

export const reactToPost = (postId, type) =>
  api.post(`/posts/${postId}/react`, { type }).then(r => r.data.data);
