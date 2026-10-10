// backend/src/models/Post.js
// Mongoose model for social posts.
// authorId stores the PostgreSQL User UUID (system of record).

'use strict';

const mongoose = require('mongoose');

const mediaItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['image', 'document', 'link'],
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    authorId: {
      type: String,
      required: true,
      index: true,
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
  {
    timestamps: true,
  }
);

// Primary feed indexes per schema doc:
// - compound index on { authorId: 1, createdAt: -1 } for author profile posts
// - single index on { createdAt: -1 } for global feed pagination
postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

const Post = mongoose.models.Post || mongoose.model('Post', postSchema);

module.exports = Post;
