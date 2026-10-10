// backend/src/controllers/postController.js
// Social posts, comments, and reactions controller.
// Handles MongoDB storage with cross-database author hydration from PostgreSQL.

'use strict';

const mongoose = require('mongoose');
const { Post, Comment, Reaction } = require('../models');
const { prisma } = require('../database/postgres');
const asyncHandler = require('../shared/utils/asyncHandler');
const AppError = require('../shared/errors/AppError');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validates whether an ID is a valid MongoDB ObjectId.
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Checks if two users have an accepted connection in PostgreSQL.
 */
async function areUsersConnected(user1, user2) {
  if (!user1 || !user2 || user1 === user2) return true;
  const connection = await prisma.connection.findFirst({
    where: {
      OR: [
        { userA: user1, userB: user2 },
        { userA: user2, userB: user1 },
      ],
    },
  });
  return !!connection;
}

/**
 * Hydrates an array of user UUIDs with profile data from PostgreSQL.
 * Returns a Map of userId -> formatted author profile object.
 */
async function fetchAuthorsMap(authorIds) {
  if (!authorIds || authorIds.length === 0) return new Map();

  const uniqueIds = [...new Set(authorIds)];
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    include: {
      academicProfile: {
        include: { department: true },
      },
      alumniProfile: {
        include: { company: true },
      },
    },
  });

  const map = new Map();
  for (const user of users) {
    map.set(user.id, {
      id: user.id,
      name: user.name,
      role: user.role,
      department: user.academicProfile?.department?.code || null,
      graduationYear: user.academicProfile?.graduationYear || null,
      company: user.alumniProfile?.company?.name || null,
      designation: user.alumniProfile?.designation || null,
    });
  }
  return map;
}

/**
 * Aggregates reaction counts grouped by type for a specific post.
 */
async function getPostReactionCounts(postId) {
  const objId = new mongoose.Types.ObjectId(postId);
  const agg = await Reaction.aggregate([
    { $match: { postId: objId } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);

  const counts = { LIKE: 0, HELPFUL: 0 };
  for (const item of agg) {
    counts[item._id] = item.count;
  }
  return counts;
}

// ─── Controller Handlers ─────────────────────────────────────────────────────

/**
 * POST /api/posts
 * Create a new social post.
 */
const createPost = asyncHandler(async (req, res) => {
  const authorId = req.user.sub || req.user.id;
  const { content, media, tags, visibility } = req.body;

  if (!content || !content.trim()) {
    throw new AppError('Post content is required', 400, 'VALIDATION_ERROR');
  }

  const cleanTags = Array.isArray(tags)
    ? tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10)
    : [];

  const post = await Post.create({
    authorId,
    content: content.trim(),
    media: Array.isArray(media) ? media : [],
    tags: cleanTags,
    visibility: ['COLLEGE', 'CONNECTIONS'].includes(visibility) ? visibility : 'COLLEGE',
  });

  const authorsMap = await fetchAuthorsMap([authorId]);
  const author = authorsMap.get(authorId) || { id: authorId, name: 'Unknown', role: req.user.role || 'STUDENT' };

  res.status(201).json({
    success: true,
    data: {
      post: {
        ...post.toObject(),
        author,
        reactions: { LIKE: 0, HELPFUL: 0 },
        commentCount: 0,
        userReaction: null,
      },
    },
  });
});

/**
 * GET /api/posts
 * Feed retrieval with pagination (page, limit) and batch author hydration from PostgreSQL.
 */
const getFeed = asyncHandler(async (req, res) => {
  const requesterId = req.user?.sub || req.user?.id;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  const tag = req.query.tag?.trim()?.toLowerCase();

  // Determine allowed posts based on connections
  let visibilityCondition = [{ visibility: 'COLLEGE' }];

  if (requesterId) {
    // Also include posts authored by the requester
    visibilityCondition.push({ authorId: requesterId });

    // Find all accepted connection IDs in PostgreSQL
    const userConnections = await prisma.connection.findMany({
      where: {
        OR: [{ userA: requesterId }, { userB: requesterId }],
      },
      select: { userA: true, userB: true },
    });

    const connectedUserIds = userConnections.map((c) =>
      c.userA === requesterId ? c.userB : c.userA
    );

    if (connectedUserIds.length > 0) {
      visibilityCondition.push({
        visibility: 'CONNECTIONS',
        authorId: { $in: connectedUserIds },
      });
    }
  }

  const query = { $or: visibilityCondition };
  if (tag) {
    query.tags = tag;
  }

  const [posts, total] = await Promise.all([
    Post.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Post.countDocuments(query),
  ]);

  if (posts.length === 0) {
    return res.json({
      success: true,
      data: {
        posts: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      },
    });
  }

  const postIds = posts.map((p) => p._id);
  const authorIds = posts.map((p) => p.authorId);

  // Batch query PostgreSQL to hydrate all authors in 1 query
  const authorsMap = await fetchAuthorsMap(authorIds);

  // Batch query MongoDB for reaction counts
  const reactionAgg = await Reaction.aggregate([
    { $match: { postId: { $in: postIds } } },
    { $group: { _id: { postId: '$postId', type: '$type' }, count: { $sum: 1 } } },
  ]);

  const reactionMap = {};
  for (const item of reactionAgg) {
    const pId = item._id.postId.toString();
    if (!reactionMap[pId]) reactionMap[pId] = { LIKE: 0, HELPFUL: 0 };
    reactionMap[pId][item._id.type] = item.count;
  }

  // Batch query MongoDB for comment counts
  const commentAgg = await Comment.aggregate([
    { $match: { postId: { $in: postIds } } },
    { $group: { _id: '$postId', count: { $sum: 1 } } },
  ]);

  const commentCountMap = {};
  for (const item of commentAgg) {
    commentCountMap[item._id.toString()] = item.count;
  }

  // Current user's reactions
  const userReactionMap = {};
  if (requesterId) {
    const userReactions = await Reaction.find({
      postId: { $in: postIds },
      userId: requesterId,
    }).lean();

    for (const r of userReactions) {
      userReactionMap[r.postId.toString()] = r.type;
    }
  }

  // Combine into final feed items
  const hydratedPosts = posts.map((post) => {
    const pId = post._id.toString();
    return {
      ...post,
      author: authorsMap.get(post.authorId) || {
        id: post.authorId,
        name: 'SSN Member',
        role: 'STUDENT',
      },
      reactions: reactionMap[pId] || { LIKE: 0, HELPFUL: 0 },
      commentCount: commentCountMap[pId] || 0,
      userReaction: userReactionMap[pId] || null,
    };
  });

  res.json({
    success: true,
    data: {
      posts: hydratedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * GET /api/posts/:id
 * Retrieve a single post with author details and reaction counts.
 */
const getPostById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const requesterId = req.user?.sub || req.user?.id;

  if (!isValidObjectId(id)) {
    throw new AppError('Invalid post ID', 400, 'INVALID_ID');
  }

  const post = await Post.findById(id).lean();
  if (!post) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }

  // Visibility authorization check
  if (post.visibility === 'CONNECTIONS' && post.authorId !== requesterId) {
    const connected = await areUsersConnected(requesterId, post.authorId);
    if (!connected) {
      throw new AppError('Access denied: Connections only post', 403, 'FORBIDDEN');
    }
  }

  const [authorsMap, reactions, commentCount] = await Promise.all([
    fetchAuthorsMap([post.authorId]),
    getPostReactionCounts(post._id),
    Comment.countDocuments({ postId: post._id }),
  ]);

  let userReaction = null;
  if (requesterId) {
    const r = await Reaction.findOne({ postId: post._id, userId: requesterId }).lean();
    if (r) userReaction = r.type;
  }

  const author = authorsMap.get(post.authorId) || {
    id: post.authorId,
    name: 'SSN Member',
    role: 'STUDENT',
  };

  res.json({
    success: true,
    data: {
      post: {
        ...post,
        author,
        reactions,
        commentCount,
        userReaction,
      },
    },
  });
});

/**
 * POST /api/posts/:id/comments
 * Add a comment to a post.
 */
const addComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const authorId = req.user.sub || req.user.id;
  const { content } = req.body;

  if (!isValidObjectId(id)) {
    throw new AppError('Invalid post ID', 400, 'INVALID_ID');
  }

  if (!content || !content.trim()) {
    throw new AppError('Comment content is required', 400, 'VALIDATION_ERROR');
  }

  const post = await Post.findById(id);
  if (!post) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }

  const comment = await Comment.create({
    postId: post._id,
    authorId,
    content: content.trim(),
  });

  const authorsMap = await fetchAuthorsMap([authorId]);
  const author = authorsMap.get(authorId) || {
    id: authorId,
    name: 'SSN Member',
    role: req.user.role || 'STUDENT',
  };

  res.status(201).json({
    success: true,
    data: {
      comment: {
        ...comment.toObject(),
        author,
      },
    },
  });
});

/**
 * GET /api/posts/:id/comments
 * Get comments for a post, hydrated with author profiles from PostgreSQL.
 */
const getComments = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    throw new AppError('Invalid post ID', 400, 'INVALID_ID');
  }

  const post = await Post.findById(id).lean();
  if (!post) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }

  const comments = await Comment.find({ postId: post._id }).sort({ createdAt: 1 }).lean();

  if (comments.length === 0) {
    return res.json({ success: true, data: { comments: [] } });
  }

  const authorIds = comments.map((c) => c.authorId);
  const authorsMap = await fetchAuthorsMap(authorIds);

  const hydratedComments = comments.map((c) => ({
    ...c,
    author: authorsMap.get(c.authorId) || {
      id: c.authorId,
      name: 'SSN Member',
      role: 'STUDENT',
    },
  }));

  res.json({
    success: true,
    data: {
      comments: hydratedComments,
    },
  });
});

/**
 * POST /api/posts/:id/react
 * Toggle or upsert reaction (LIKE / HELPFUL).
 * - Same type -> removes reaction
 * - Different type -> updates reaction
 * - No reaction -> creates reaction
 */
const toggleReaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.sub || req.user.id;
  const { type } = req.body;

  if (!isValidObjectId(id)) {
    throw new AppError('Invalid post ID', 400, 'INVALID_ID');
  }

  if (!['LIKE', 'HELPFUL'].includes(type)) {
    throw new AppError('Reaction type must be LIKE or HELPFUL', 400, 'VALIDATION_ERROR');
  }

  const post = await Post.findById(id);
  if (!post) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }

  const existing = await Reaction.findOne({ postId: post._id, userId });

  let action;
  let userReaction;

  if (existing && existing.type === type) {
    // User clicked the same reaction: remove it
    await Reaction.deleteOne({ _id: existing._id });
    action = 'removed';
    userReaction = null;
  } else {
    // New reaction or changing from LIKE <-> HELPFUL
    await Reaction.findOneAndUpdate(
      { postId: post._id, userId },
      { type },
      { upsert: true, returnDocument: 'after' }
    );
    action = existing ? 'updated' : 'added';
    userReaction = type;
  }

  const reactionCounts = await getPostReactionCounts(post._id);

  res.json({
    success: true,
    data: {
      action,
      userReaction,
      reactionCounts,
    },
  });
});

/**
 * DELETE /api/posts/:id
 * Author-only deletion. Cascades and cleans up associated comments and reactions in MongoDB.
 */
const deletePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const requesterId = req.user.sub || req.user.id;

  if (!isValidObjectId(id)) {
    throw new AppError('Invalid post ID', 400, 'INVALID_ID');
  }

  const post = await Post.findById(id);
  if (!post) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }

  if (post.authorId !== requesterId && req.user.role !== 'ADMIN') {
    throw new AppError('You are only authorized to delete your own posts', 403, 'FORBIDDEN');
  }

  // Clean up post, comments, and reactions simultaneously in MongoDB
  await Promise.all([
    Comment.deleteMany({ postId: post._id }),
    Reaction.deleteMany({ postId: post._id }),
    Post.findByIdAndDelete(post._id),
  ]);

  res.json({
    success: true,
    data: {
      message: 'Post and associated comments and reactions deleted successfully.',
    },
  });
});

module.exports = {
  createPost,
  getFeed,
  getPostById,
  addComment,
  getComments,
  toggleReaction,
  deletePost,
};
