// backend/src/models/Comment.js
// Mongoose model for post comments.
// postId references Post ObjectId; authorId stores PostgreSQL User UUID.

'use strict';

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    authorId: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 3000,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Chronological retrieval of comments per post
commentSchema.index({ postId: 1, createdAt: 1 });

const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);

module.exports = Comment;
