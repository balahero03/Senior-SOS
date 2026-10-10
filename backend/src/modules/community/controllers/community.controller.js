// backend/src/modules/community/controllers/community.controller.js
// HTTP translation layer for the community module.
// No business logic here — all in community.service.js.

'use strict';

const asyncHandler = require('../../../shared/utils/asyncHandler');
const communityService = require('../services/community.service');

/**
 * GET /api/posts?page=1&tag=career
 * Returns paginated community feed.
 */
const getFeed = asyncHandler(async (req, res) => {
  const requesterId = req.user.sub;
  const page = parseInt(req.query.page) || 1;
  const tag = req.query.tag || null;

  const result = await communityService.getFeed({ requesterId, tag, page });

  res.json({ success: true, data: result });
});

/**
 * POST /api/posts
 * Create a new post.
 */
const createPost = asyncHandler(async (req, res) => {
  const authorId = req.user.sub;
  const { content, media, tags, visibility } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Post content is required.' },
    });
  }

  const post = await communityService.createPost({ authorId, content, media, tags, visibility });

  res.status(201).json({ success: true, data: { post } });
});

/**
 * DELETE /api/posts/:id
 * Delete a post (author only). Cascades to comments + reactions.
 */
const deletePost = asyncHandler(async (req, res) => {
  const requesterId = req.user.sub;
  const postId = req.params.id;

  await communityService.deletePost({ postId, requesterId });

  res.json({ success: true, data: { message: 'Post deleted successfully.' } });
});

/**
 * GET /api/posts/:id/comments
 * Get all comments for a post.
 */
const getComments = asyncHandler(async (req, res) => {
  const requesterId = req.user.sub;
  const postId = req.params.id;

  const comments = await communityService.getComments({ postId, requesterId });

  res.json({ success: true, data: { comments } });
});

/**
 * POST /api/posts/:id/comments
 * Add a comment to a post.
 */
const addComment = asyncHandler(async (req, res) => {
  const authorId = req.user.sub;
  const postId = req.params.id;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Comment content is required.' },
    });
  }

  const comment = await communityService.addComment({ postId, authorId, content });

  res.status(201).json({ success: true, data: { comment } });
});

/**
 * POST /api/posts/:id/react
 * Toggle a reaction (LIKE / HELPFUL) on a post.
 */
const toggleReaction = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const postId = req.params.id;
  const { type } = req.body;

  if (!['LIKE', 'HELPFUL'].includes(type)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Reaction type must be LIKE or HELPFUL.' },
    });
  }

  const result = await communityService.toggleReaction({ postId, userId, type });

  res.json({ success: true, data: result });
});

module.exports = {
  getFeed,
  createPost,
  deletePost,
  getComments,
  addComment,
  toggleReaction,
};
