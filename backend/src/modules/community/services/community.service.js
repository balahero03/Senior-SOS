// backend/src/modules/community/services/community.service.js
// Business rules for the community module.
// Per PDF:
//   - CONNECTIONS-only posts: verify requester is connected to author via PostgreSQL.
//   - Only the post author can delete their post.
//   - Manual cascades handled in the repository.

'use strict';

const AppError = require('../../../shared/errors/AppError');
const communityRepo = require('../repositories/community.repository');
const { prisma } = require('../../../database/postgres');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check if two users are connected in PostgreSQL.
 * Per PDF: connections table has userAId < userBId ordering.
 */
async function areConnected(userAId, userBId) {
  const connection = await prisma.connection.findFirst({
    where: {
      OR: [
        { userAId, userBId },
        { userAId: userBId, userBId: userAId },
      ],
    },
  });
  return !!connection;
}

/**
 * Hydrate posts with author info from PostgreSQL users table.
 * Returns posts with { author: { id, name, role } } merged in.
 */
async function hydratePosts(posts) {
  if (!posts.length) return [];

  const authorIds = [...new Set(posts.map((p) => p.authorId))];

  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, name: true, role: true },
  });

  const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]));

  return posts.map((post) => ({
    ...post,
    author: authorMap[post.authorId] || { id: post.authorId, name: 'Unknown', role: 'STUDENT' },
  }));
}

// ─── Service operations ───────────────────────────────────────────────────────

/**
 * Get paginated feed for the requesting user.
 * Includes COLLEGE posts always; includes CONNECTIONS posts only if connected.
 */
async function getFeed({ requesterId, tag, page }) {
  // Base: always include COLLEGE-wide posts
  const visibilityFilter = ['COLLEGE'];

  // If user is logged in, also include CONNECTIONS posts
  // (service filters per-post in the result if needed — for now include all CONNECTIONS)
  visibilityFilter.push('CONNECTIONS');

  const result = await communityRepo.getFeed({ visibilityFilter, tag, page });

  // Filter CONNECTIONS-only posts: only show if requester is connected to author
  const filteredPosts = await Promise.all(
    result.posts.map(async (post) => {
      if (post.visibility === 'CONNECTIONS' && post.authorId !== requesterId) {
        const connected = await areConnected(requesterId, post.authorId);
        return connected ? post : null;
      }
      return post;
    })
  );

  const posts = filteredPosts.filter(Boolean);
  const hydratedPosts = await hydratePosts(posts);

  return { posts: hydratedPosts, total: result.total, page, pageSize: result.pageSize };
}

/**
 * Create a new post.
 */
async function createPost({ authorId, content, media, tags, visibility }) {
  const cleanTags = (tags || [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);

  const post = await communityRepo.createPost({
    authorId,
    content: content.trim(),
    media: media || [],
    tags: cleanTags,
    visibility: visibility || 'COLLEGE',
  });

  // Hydrate with author info
  const [hydrated] = await hydratePosts([post]);
  return hydrated;
}

/**
 * Delete a post. Only the author can delete it.
 */
async function deletePost({ postId, requesterId }) {
  const post = await communityRepo.getPostById(postId);
  if (!post) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }
  if (post.authorId !== requesterId) {
    throw new AppError('You can only delete your own posts', 403, 'FORBIDDEN');
  }

  // Cascade: delete comments + reactions in repository
  await communityRepo.deletePost(postId);
}

/**
 * Get comments for a post.
 */
async function getComments({ postId, requesterId }) {
  const post = await communityRepo.getPostById(postId);
  if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');

  // Visibility check
  if (post.visibility === 'CONNECTIONS' && post.authorId !== requesterId) {
    const connected = await areConnected(requesterId, post.authorId);
    if (!connected) throw new AppError('Access denied', 403, 'FORBIDDEN');
  }

  const comments = await communityRepo.getComments(postId);

  // Hydrate comment authors
  if (!comments.length) return [];
  const authorIds = [...new Set(comments.map((c) => c.authorId))];
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, name: true, role: true },
  });
  const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]));

  return comments.map((c) => ({
    ...c,
    author: authorMap[c.authorId] || { id: c.authorId, name: 'Unknown', role: 'STUDENT' },
  }));
}

/**
 * Add a comment to a post.
 */
async function addComment({ postId, authorId, content }) {
  const post = await communityRepo.getPostById(postId);
  if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');

  const comment = await communityRepo.createComment({ postId, authorId, content: content.trim() });
  return comment;
}

/**
 * Toggle a reaction on a post (LIKE or HELPFUL).
 * Returns the updated reaction state.
 */
async function toggleReaction({ postId, userId, type }) {
  const post = await communityRepo.getPostById(postId);
  if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');

  const result = await communityRepo.toggleReaction(postId, userId, type);
  const counts = await communityRepo.getReactionCounts(postId);

  return { ...result, counts };
}

module.exports = {
  getFeed,
  createPost,
  deletePost,
  getComments,
  addComment,
  toggleReaction,
};
