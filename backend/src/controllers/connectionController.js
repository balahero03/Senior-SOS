// backend/src/controllers/connectionController.js
// Connection workflow controller for SeniorSOS.
// Enforces canonical connection pair ordering (userA < userB) and
// atomic single-transaction acceptance.

'use strict';

const { prisma } = require('../database/postgres');
const asyncHandler = require('../shared/utils/asyncHandler');
const AppError = require('../shared/errors/AppError');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns user IDs in canonical order: userA < userB
 * Uses standard string comparison on UUIDs.
 */
function getCanonicalPair(id1, id2) {
  return id1 < id2 ? { userA: id1, userB: id2 } : { userA: id2, userB: id1 };
}

/**
 * Hydrates an array of user UUIDs with profile data from PostgreSQL.
 * Returns a Map of userId -> formatted user profile object.
 */
async function fetchProfilesMap(userIds) {
  if (!userIds || userIds.length === 0) return new Map();

  const uniqueIds = [...new Set(userIds)];
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    include: {
      academicProfile: {
        include: { department: true },
      },
      alumniProfile: {
        include: { company: true },
      },
    },
  });

  const map = new Map();
  for (const user of users) {
    map.set(user.id, {
      id: user.id,
      name: user.name,
      role: user.role,
      status: user.status,
      department: user.academicProfile?.department?.code || null,
      departmentName: user.academicProfile?.department?.name || null,
      graduationYear: user.academicProfile?.graduationYear || null,
      bio: user.academicProfile?.bio || null,
      careerInterests: user.academicProfile?.careerInterests || null,
      company: user.alumniProfile?.company?.name || null,
      designation: user.alumniProfile?.designation || null,
      experienceYears: user.alumniProfile?.experienceYears || null,
      verificationStatus: user.alumniProfile?.verificationStatus || null,
    });
  }
  return map;
}

// ─── Controller Handlers ─────────────────────────────────────────────────────

/**
 * POST /api/connections/request
 * Send a connection request to a target user.
 */
const sendConnectionRequest = asyncHandler(async (req, res) => {
  const senderId = req.user.id || req.user.sub;
  const { targetUserId } = req.body;

  if (!targetUserId || typeof targetUserId !== 'string') {
    throw new AppError('targetUserId is required', 400, 'VALIDATION_ERROR');
  }

  if (senderId === targetUserId) {
    throw new AppError('You cannot send a connection request to yourself', 400, 'SELF_CONNECTION_FORBIDDEN');
  }

  // Verify target user exists and is ACTIVE
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, status: true, name: true },
  });

  if (!targetUser) {
    throw new AppError('Target user not found', 404, 'USER_NOT_FOUND');
  }

  if (targetUser.status !== 'ACTIVE') {
    throw new AppError('Target user account is not active', 400, 'USER_INACTIVE');
  }

  // Check if users are already connected in canonical order
  const { userA, userB } = getCanonicalPair(senderId, targetUserId);
  const existingConnection = await prisma.connection.findUnique({
    where: {
      userA_userB: { userA, userB },
    },
  });

  if (existingConnection) {
    throw new AppError('You are already connected with this user', 400, 'ALREADY_CONNECTED');
  }

  // Check if an active PENDING request already exists in either direction
  const pendingRequest = await prisma.connectionRequest.findFirst({
    where: {
      status: 'PENDING',
      OR: [
        { senderId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: senderId },
      ],
    },
  });

  if (pendingRequest) {
    if (pendingRequest.senderId === senderId) {
      throw new AppError('A pending connection request has already been sent to this user', 400, 'REQUEST_ALREADY_SENT');
    } else {
      throw new AppError('This user has already sent you a connection request. Please respond to it.', 400, 'INCOMING_REQUEST_PENDING');
    }
  }

  const newRequest = await prisma.connectionRequest.create({
    data: {
      senderId,
      receiverId: targetUserId,
      status: 'PENDING',
    },
    include: {
      receiver: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  res.status(201).json({
    success: true,
    data: {
      request: newRequest,
      message: 'Connection request sent successfully',
    },
  });
});

/**
 * GET /api/connections/requests/incoming
 * Get pending connection requests received by the current user.
 */
const getIncomingRequests = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;

  const requests = await prisma.connectionRequest.findMany({
    where: {
      receiverId: currentUserId,
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (requests.length === 0) {
    return res.json({ success: true, data: { requests: [] } });
  }

  const senderIds = requests.map((r) => r.senderId);
  const profilesMap = await fetchProfilesMap(senderIds);

  const hydratedRequests = requests.map((reqItem) => ({
    ...reqItem,
    sender: profilesMap.get(reqItem.senderId) || { id: reqItem.senderId, name: 'Unknown User' },
  }));

  res.json({
    success: true,
    data: { requests: hydratedRequests },
  });
});

/**
 * GET /api/connections/requests/outgoing
 * Get pending connection requests sent by the current user.
 */
const getOutgoingRequests = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;

  const requests = await prisma.connectionRequest.findMany({
    where: {
      senderId: currentUserId,
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (requests.length === 0) {
    return res.json({ success: true, data: { requests: [] } });
  }

  const receiverIds = requests.map((r) => r.receiverId);
  const profilesMap = await fetchProfilesMap(receiverIds);

  const hydratedRequests = requests.map((reqItem) => ({
    ...reqItem,
    receiver: profilesMap.get(reqItem.receiverId) || { id: reqItem.receiverId, name: 'Unknown User' },
  }));

  res.json({
    success: true,
    data: { requests: hydratedRequests },
  });
});

/**
 * POST /api/connections/requests/:requestId/respond
 * Respond to an incoming connection request (ACCEPT | REJECT).
 * Acceptance is executed inside a single interactive transaction.
 */
const respondToRequest = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;
  const { requestId } = req.params;
  const { action } = req.body;

  if (!action || !['ACCEPT', 'REJECT'].includes(action)) {
    throw new AppError("Action must be either 'ACCEPT' or 'REJECT'", 400, 'VALIDATION_ERROR');
  }

  const connectionRequest = await prisma.connectionRequest.findUnique({
    where: { id: requestId },
  });

  if (!connectionRequest) {
    throw new AppError('Connection request not found', 404, 'REQUEST_NOT_FOUND');
  }

  if (connectionRequest.receiverId !== currentUserId) {
    throw new AppError('You are not authorized to respond to this connection request', 403, 'FORBIDDEN');
  }

  if (connectionRequest.status !== 'PENDING') {
    throw new AppError(`Cannot respond to a request with status ${connectionRequest.status}`, 400, 'REQUEST_NOT_PENDING');
  }

  if (action === 'REJECT') {
    const updated = await prisma.connectionRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' },
    });

    return res.json({
      success: true,
      data: {
        request: updated,
        message: 'Connection request rejected',
      },
    });
  }

  // ACCEPT workflow: Interactive single transaction
  const { userA, userB } = getCanonicalPair(connectionRequest.senderId, connectionRequest.receiverId);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update request status to ACCEPTED
    const updatedRequest = await tx.connectionRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED' },
    });

    // 2. Insert accepted connection in canonical order (userA < userB)
    const connection = await tx.connection.create({
      data: {
        userA,
        userB,
        connectedAt: new Date(),
        graphSyncedAt: null,
      },
    });

    return { updatedRequest, connection };
  });

  res.json({
    success: true,
    data: {
      connection: result.connection,
      request: result.updatedRequest,
      message: 'Connection request accepted successfully',
    },
  });
});

/**
 * DELETE /api/connections/requests/:requestId/cancel
 * Cancel a pending connection request sent by the current user.
 */
const cancelConnectionRequest = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;
  const { requestId } = req.params;

  const connectionRequest = await prisma.connectionRequest.findUnique({
    where: { id: requestId },
  });

  if (!connectionRequest) {
    throw new AppError('Connection request not found', 404, 'REQUEST_NOT_FOUND');
  }

  if (connectionRequest.senderId !== currentUserId) {
    throw new AppError('You can only cancel connection requests you sent', 403, 'FORBIDDEN');
  }

  if (connectionRequest.status !== 'PENDING') {
    throw new AppError(`Cannot cancel a request that is already ${connectionRequest.status}`, 400, 'REQUEST_NOT_PENDING');
  }

  const cancelled = await prisma.connectionRequest.update({
    where: { id: requestId },
    data: { status: 'CANCELLED' },
  });

  res.json({
    success: true,
    data: {
      request: cancelled,
      message: 'Connection request cancelled',
    },
  });
});

/**
 * GET /api/connections
 * Get all accepted connections for the current user, hydrated with profile details.
 */
const getConnections = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;

  const connections = await prisma.connection.findMany({
    where: {
      OR: [{ userA: currentUserId }, { userB: currentUserId }],
    },
    orderBy: { connectedAt: 'desc' },
  });

  if (connections.length === 0) {
    return res.json({ success: true, data: { connections: [] } });
  }

  // Extract the other connected user's ID
  const otherUserIds = connections.map((c) => (c.userA === currentUserId ? c.userB : c.userA));
  const profilesMap = await fetchProfilesMap(otherUserIds);

  const hydratedConnections = connections.map((c) => {
    const otherId = c.userA === currentUserId ? c.userB : c.userA;
    return {
      connectionId: `${c.userA}:${c.userB}`,
      connectedAt: c.connectedAt,
      user: profilesMap.get(otherId) || { id: otherId, name: 'Unknown User' },
    };
  });

  res.json({
    success: true,
    data: { connections: hydratedConnections },
  });
});

/**
 * DELETE /api/connections/:otherUserId
 * Remove an existing connection with another user.
 */
const removeConnection = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;
  const { otherUserId } = req.params;

  if (!otherUserId) {
    throw new AppError('otherUserId is required', 400, 'VALIDATION_ERROR');
  }

  if (currentUserId === otherUserId) {
    throw new AppError('Invalid target user ID', 400, 'VALIDATION_ERROR');
  }

  const { userA, userB } = getCanonicalPair(currentUserId, otherUserId);

  const existingConnection = await prisma.connection.findUnique({
    where: {
      userA_userB: { userA, userB },
    },
  });

  if (!existingConnection) {
    throw new AppError('Connection not found', 404, 'CONNECTION_NOT_FOUND');
  }

  await prisma.connection.delete({
    where: {
      userA_userB: { userA, userB },
    },
  });

  res.json({
    success: true,
    data: {
      message: 'Connection removed successfully',
    },
  });
});

module.exports = {
  sendConnectionRequest,
  getIncomingRequests,
  getOutgoingRequests,
  respondToRequest,
  cancelConnectionRequest,
  getConnections,
  removeConnection,
};
