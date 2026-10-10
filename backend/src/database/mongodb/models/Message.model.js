// backend/src/database/mongodb/models/Message.model.js
// MongoDB document for a single chat message within a conversation.
// Per PDF §MongoDB schema:
//   - conversationId links to Conversation._id (ObjectId, same DB).
//   - senderId is a PostgreSQL User UUID.
//   - readAt: null = unread; set to Date when recipient reads it.

'use strict';

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderId: {
      type: String,
      required: true,
      // PostgreSQL User UUID
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000,
      trim: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Primary access pattern: paginate all messages in a conversation, newest first.
messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
