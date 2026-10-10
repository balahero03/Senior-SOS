// backend/src/modules/community/repositories/community.repository.js
// All MongoDB queries for the community module.
// Per FOLDER_STRUCTURE.md: only this layer touches the DB models directly.

'use strict';

const Post = require('../../../database/mongodb/models/Post.model');
const Comment = require('../../../database/mongodb/models/Comment.model');
const Reaction = require('../../../database/mongodb/models/Reaction.model');

const PAGE_SIZE = 20;

// ─── Posts ────────────────────────────────────────────────────────────────────

/**
 * Get paginated feed.
 * @param {{ visibility?: string[], tags?: string, page?: number }} opts
 */
async function getFeed({ visibilityFilter = ['COLLEGE'], tag, page = 1 }) {
  const query = { visibility: { $in: visibilityFilter } };
  if (tag) query.tags = tag;

  const [posts, total] = await Promise.all([
    Post.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Post.countDocuments(query),
  ]);

  return { posts, total, page, pageSize: PAGE_SIZE };
}

/**
 * Get a single post by its MongoDB ObjectId.
 */
async function getPostById(postId) {
  return Post.findById(postId).lean();
}

/**
 * Create a new post.
 */
async function createPost({ authorId, content, media, tags, visibility }) {
  const post = await Post.create({ authorId, content, media, tags, visibility });
  return post.toObject();
}

/**
 * Delete a post and cascade-delete its comments & reactions.
 * Per PDF: MongoDB has no auto-cascades; we handle this explicitly.
 */
async function deletePost(postId) {
  await Promise.all([
    Comment.deleteMany({ postId }),
    Reaction.deleteMany({ postId }),
    Post.findByIdAndDelete(postId),
  ]);
}

// ─── Comments ─────────────────────────────────────────────────────────────────

/**
 * Get all comments for a post, sorted oldest-first.
 */
async function getComments(postId) {
  return Comment.find({ postId }).sort({ createdAt: 1 }).lean();
}

/**
 * Add a comment to a post.
 */
async function createComment({ postId, authorId, content }) {
  const comment = await Comment.create({ postId, authorId, content });
  return comment.toObject();
}

// ─── Reactions ────────────────────────────────────────────────────────────────

/**
 * Get the current user's reaction on a post (or null).
 */
async function getUserReaction(postId, userId) {
  return Reaction.findOne({ postId, userId }).lean();
}

/**
 * Get all reactions for a post grouped by type.
 * Returns: { LIKE: 3, HELPFUL: 1 }
 */
async function getReactionCounts(postId) {
  const results = await Reaction.aggregate([
    { $match: { postId: require('mongoose').Types.ObjectId.createFromHexString(String(postId)) } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);

  return results.reduce((acc, r) => {
    acc[r._id] = r.count;
    return acc;
  }, {});
}

/**
 * Toggle reaction. Per PDF: upsert with the new type.
 * If user already has the same type → remove it (unreact).
 * If user has a different type or no reaction → upsert with new type.
 *
 * @returns {{ action: 'added'|'changed'|'removed', type: string|null }}
 */
async function toggleReaction(postId, userId, type) {
  const existing = await Reaction.findOne({ postId, userId });

  if (existing && existing.type === type) {
    // Same reaction type — toggle off (remove)
    await Reaction.deleteOne({ _id: existing._id });
    return { action: 'removed', type: null };
  }

  // Upsert with new type (insert or change)
  const action = existing ? 'changed' : 'added';
  await Reaction.findOneAndUpdate(
    { postId, userId },
    { type },
    { upsert: true, new: true }
  );

  return { action, type };
}

module.exports = {
  getFeed,
  getPostById,
  createPost,
  deletePost,
  getComments,
  createComment,
  getUserReaction,
  getReactionCounts,
  toggleReaction,
};
