// backend/src/database/mongodb/models/Reaction.model.js
// MongoDB document for a reaction on a post.
// Per PDF §MongoDB schema:
//   - One reaction per user per post (unique compound index).
//   - Toggling sends a new type value; the upsert updates the existing record.
//   - type enum: "LIKE" | "HELPFUL"

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
      // PostgreSQL User UUID
    },
    type: {
      type: String,
      enum: ['LIKE', 'HELPFUL'],
      required: true,
    },
  },
  { timestamps: true }
);

// Unique: exactly one reaction per user per post.
// The service uses findOneAndUpdate with upsert to toggle/update the type.
reactionSchema.index({ postId: 1, userId: 1 }, { unique: true });

const Reaction = mongoose.model('Reaction', reactionSchema);
module.exports = Reaction;
