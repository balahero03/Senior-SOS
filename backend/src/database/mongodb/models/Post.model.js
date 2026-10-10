// backend/src/database/mongodb/models/Post.model.js
// MongoDB document for a community post.
// Per PDF §MongoDB schema: authorId stores the PostgreSQL User UUID.
// visibility "CONNECTIONS" means only connected users can see the post.

'use strict';

const mongoose = require('mongoose');

const mediaItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['image', 'document', 'link'], required: true },
    url: { type: String, required: true, maxlength: 2000 },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    authorId: {
      type: String,
      required: true,
      index: true, // Needed for per-user post queries
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000,
      trim: true,
    },
    media: {
      type: [mediaItemSchema],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    visibility: {
      type: String,
      enum: ['COLLEGE', 'CONNECTIONS'],
      default: 'COLLEGE',
    },
  },
  { timestamps: true }
);

// Compound index for the primary feed query: sorted by newest
postSchema.index({ createdAt: -1 });
// For filtering/fetching posts by a specific author
postSchema.index({ authorId: 1, createdAt: -1 });
// For tag-based filtering
postSchema.index({ tags: 1 });

const Post = mongoose.model('Post', postSchema);
module.exports = Post;
