// backend/src/models/Reaction.js
// Mongoose model for post reactions.
// postId references Post ObjectId; userId stores PostgreSQL User UUID.

'use strict';

const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['LIKE', 'HELPFUL'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One reaction per user per post
reactionSchema.index({ postId: 1, userId: 1 }, { unique: true });

const Reaction = mongoose.models.Reaction || mongoose.model('Reaction', reactionSchema);

module.exports = Reaction;
