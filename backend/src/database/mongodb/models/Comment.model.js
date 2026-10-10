// backend/src/database/mongodb/models/Comment.model.js
// MongoDB document for a post comment.
// Per PDF §MongoDB schema: postId references a Post ObjectId; authorId is a PostgreSQL User UUID.

'use strict';

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    authorId: {
      type: String,
      required: true,
      // PostgreSQL User UUID — no Mongoose ref since different DB
    },
    content: {
      type: String,
      required: true,
      maxlength: 3000,
      trim: true,
    },
  },
  { timestamps: true }
);

// Primary access pattern: fetch all comments for a post, sorted oldest first
commentSchema.index({ postId: 1, createdAt: 1 });

const Comment = mongoose.model('Comment', commentSchema);
module.exports = Comment;
