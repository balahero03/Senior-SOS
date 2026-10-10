// backend/src/modules/community/routes/community.routes.js
// HTTP route definitions for the community module.
// All routes require authentication.

'use strict';

const { Router } = require('express');
const { requireAuth } = require('../../../middleware/auth.middleware');
const communityController = require('../controllers/community.controller');

const router = Router();

// All community routes require a valid JWT access token
router.use(requireAuth);

// Feed
router.get('/posts', communityController.getFeed);

// Post CRUD
router.post('/posts', communityController.createPost);
router.delete('/posts/:id', communityController.deletePost);

// Comments
router.get('/posts/:id/comments', communityController.getComments);
router.post('/posts/:id/comments', communityController.addComment);

// Reactions
router.post('/posts/:id/react', communityController.toggleReaction);

module.exports = router;
