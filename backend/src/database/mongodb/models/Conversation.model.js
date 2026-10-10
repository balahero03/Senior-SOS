// backend/src/database/mongodb/models/Conversation.model.js
// MongoDB document for a direct one-to-one conversation between two users.
// Per PDF §MongoDB schema:
//   - participantIds: exactly 2 PostgreSQL User UUIDs.
//   - pairKey: sorted join of both IDs ("uuidA:uuidB") — unique, prevents duplicates.
//   - lastMessageAt updated whenever a message is sent.

'use strict';

const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participantIds: {
      type: [String],
      required: true,
      validate: {
        validator: (ids) => ids.length === 2 && new Set(ids).size === 2,
        message: 'A direct conversation requires exactly two distinct user IDs.',
      },
    },
    // Pre-computed sorted pair key to prevent duplicate conversation creation.
    // Set automatically by pre-validate hook.
    pairKey: {
      type: String,
      required: true,
      unique: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Pre-validate hook: auto-build pairKey from sorted participantIds.
conversationSchema.pre('validate', function () {
  if (this.participantIds && this.participantIds.length === 2) {
    this.pairKey = [...this.participantIds].sort().join(':');
  }
});

// Queries: find all conversations for a user, sorted by most recent message.
conversationSchema.index({ participantIds: 1, lastMessageAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
