// backend/src/routes/postRoutes.js
// Express routes for social posts, comments, and reactions.
// All operations mounted under /api/posts.

'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const postController = require('../controllers/postController');

const router = express.Router();

// Require JWT authentication for all social feed and interaction routes
router.use(requireAuth);

// Feed & Post CRUD
router.get('/', postController.getFeed);
router.post('/', postController.createPost);
router.get('/:id', postController.getPostById);
router.delete('/:id', postController.deletePost);

// Comments
router.get('/:id/comments', postController.getComments);
router.post('/:id/comments', postController.addComment);

// Reactions
router.post('/:id/react', postController.toggleReaction);

module.exports = router;
