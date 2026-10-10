# SeniorSOS — MongoDB Integration & Realtime Messaging Implementation Plan

This document outlines the detailed, step-by-step execution plan for integrating **MongoDB** into SeniorSOS for **Social Content (Posts, Comments, Reactions)** and **Realtime Messaging (Conversations, Messages, Socket.IO)**, in strict compliance with the **SeniorSOS Database Schema & Integration Design (PDF)** and **FOLDER_STRUCTURE.md**.

---

## 1. Architectural Principles (Polyglot Persistence)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      PostgreSQL (Single Source of Truth)                │
│   • Owns Users, Roles, Academic/Alumni Profiles, Companies, Connections │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                 Logical Foreign Key │ (Reuses PostgreSQL User UUID)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           MongoDB (Document Store)                      │
│   • Owns Posts, Comments, Reactions, Conversations, and Messages        │
└─────────────────────────────────────────────────────────────────────────┘
```

1. **User Identity Reuse**: All MongoDB documents store the **PostgreSQL User UUID** (`authorId`, `userId`, `senderId`, `participantIds`). MongoDB does not duplicate profile data.
2. **Post Visibility Check**: When a post has `visibility = "CONNECTIONS"`, the backend queries PostgreSQL `connections` table to verify if the requesting user is connected to `authorId`.
3. **Manual Cascades**: MongoDB has no foreign key cascades. Deleting a post explicitly deletes its associated comments and reactions in the same backend service operation.
4. **Socket.IO Transport**: Socket.IO provides realtime message delivery; MongoDB persists all chat history.

---

## 2. Detailed Implementation Stages

### Stage 1: Infrastructure & Database Adapter

* **File**: `backend/src/database/mongodb/index.js`
* **Dependencies**: Add `mongoose` to `backend/package.json`.
* **Environment Configuration**: Add `MONGODB_URI` to `.env` and `.env.example`.
* **Connection Lifecycle**: Centralized singleton connection manager with retry logic and graceful shutdown on `SIGINT` / `SIGTERM`.

---

### Stage 2: Mongoose Schemas & Models

Files located under `backend/src/database/mongodb/models/`:

#### 1. `Post.model.js` (`posts` collection)
```javascript
const postSchema = new mongoose.Schema({
  authorId: { type: String, required: true, index: true }, // PostgreSQL User UUID
  content: { type: String, required: true, maxlength: 10000 },
  media: [{
    type: { type: String, enum: ["image", "document", "link"] },
    url: String
  }],
  tags: [String],
  visibility: { type: String, enum: ["COLLEGE", "CONNECTIONS"], default: "COLLEGE" }
}, { timestamps: true });

postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
```

#### 2. `Comment.model.js` (`comments` collection)
```javascript
const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, required: true },
  authorId: { type: String, required: true },
  content: { type: String, required: true, maxlength: 3000 }
}, { timestamps: true });

commentSchema.index({ postId: 1, createdAt: 1 });
```

#### 3. `Reaction.model.js` (`reactions` collection)
```javascript
const reactionSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userId: { type: String, required: true },
  type: { type: String, enum: ["LIKE", "HELPFUL"], required: true }
}, { timestamps: true });

// Ensures 1 reaction per user per post. Toggling updates the existing record's type.
reactionSchema.index({ postId: 1, userId: 1 }, { unique: true });
```

#### 4. `Conversation.model.js` (`conversations` collection)
```javascript
const conversationSchema = new mongoose.Schema({
  participantIds: {
    type: [String],
    required: true,
    validate: {
      validator: ids => ids.length === 2 && new Set(ids).size === 2,
      message: "A direct conversation requires two distinct users."
    }
  },
  pairKey: { type: String, required: true, unique: true },
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

conversationSchema.pre("validate", function () {
  if (this.participantIds && this.participantIds.length === 2) {
    this.pairKey = [...this.participantIds].sort().join(":");
  }
});

conversationSchema.index({ participantIds: 1, lastMessageAt: -1 });
```

#### 5. `Message.model.js` (`messages` collection)
```javascript
const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  senderId: { type: String, required: true },
  content: { type: String, required: true, maxlength: 10000 },
  readAt: { type: Date, default: null }
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: -1 });
```

---

### Stage 3: Community Module Backend

Located under `backend/src/modules/community/`:

* **`community.repository.js`**:
  * Paginated post feed queries.
  * Post creation & deletion.
  * Manual cascading deletion of comments & reactions when a post is deleted.
  * Upsert reaction logic (`LIKE` / `HELPFUL`).
  * Hydration of author metadata (Name, Role, Avatar) from PostgreSQL `users`.
* **`community.service.js`**:
  * Enforces `CONNECTIONS`-only visibility by querying PostgreSQL connections table.
  * Validates post owner for deletion.
* **`community.controller.js` & `community.routes.js`**:
  * `GET /api/posts` — Retrieve feed (with tag filters & visibility checks).
  * `POST /api/posts` — Create a new post.
  * `DELETE /api/posts/:id` — Delete a post (with cascade).
  * `GET /api/posts/:id/comments` — Fetch post comments.
  * `POST /api/posts/:id/comments` — Add a comment.
  * `POST /api/posts/:id/react` — Toggle reaction.

---

### Stage 4: Realtime Messaging Module Backend

Located under `backend/src/modules/messages/` & `backend/src/realtime/`:

* **`messages.repository.js` & `messages.service.js`**:
  * Find or create direct conversation using sorted `pairKey`.
  * Paginated message history retrieval.
  * Update `lastMessageAt` on conversation.
* **`messages.controller.js` & `messages.routes.js`**:
  * `GET /api/conversations` — List direct conversations for current user.
  * `POST /api/conversations` — Start or get existing conversation.
  * `GET /api/conversations/:id/messages` — Fetch chat history.
  * `POST /api/messages` — Send message (HTTP fallback).
* **Socket.IO Realtime Gateway (`backend/src/realtime/socket.js`)**:
  * Authenticates Socket connection using JWT cookie.
  * Joins user to room `user:<userId>`.
  * Emits `new_message` events in real time to conversation participants.

---

### Stage 5: Frontend Integration

* **Services**:
  * `frontend/src/features/community/api.js`
  * `frontend/src/features/messages/api.js`
* **Components & Pages**:
  * `frontend/src/features/community/pages/FeedPage.jsx` — Post creation form, tags, feed listing, like/reaction buttons, comment drawer.
  * `frontend/src/features/messages/pages/MessagesPage.jsx` — Chat sidebar with participant avatars, conversation switcher, auto-scrolling realtime chat box.

---

## 3. Verification & Testing Checklist

1. **MongoDB Connection**: Verify server startup connects to both PostgreSQL and MongoDB without errors.
2. **Post Lifecycle**: Create a post, comment on it, react with `LIKE`/`HELPFUL`. Delete the post and verify comments & reactions are automatically cleaned up in MongoDB.
3. **Visibility Verification**: Create a `CONNECTIONS`-only post as User A. Verify non-connected User B cannot see it, but connected User C can.
4. **Chat & Messaging**: Initiate a conversation between Student and Alumni. Send messages and verify real-time delivery via Socket.IO and durable history in MongoDB.
