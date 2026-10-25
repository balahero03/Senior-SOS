// backend/src/controllers/presenceController.js
// GET /api/presence?ids=<id>,<id>,...
// Online status and last-seen for people the requester is connected to.

'use strict';

const asyncHandler = require('../shared/utils/asyncHandler');
const AppError = require('../shared/errors/AppError');
const presence = require('../services/presenceService');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getPresence = asyncHandler(async (req, res) => {
  const viewerId = req.user.sub || req.user.id;
  const raw = typeof req.query.ids === 'string' ? req.query.ids : '';
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    throw new AppError('ids is required (comma-separated user ids)', 400, 'VALIDATION_ERROR');
  }
  if (ids.length > presence.MAX_IDS) {
    throw new AppError(`At most ${presence.MAX_IDS} ids per request`, 400, 'VALIDATION_ERROR');
  }
  if (!ids.every((id) => UUID_RE.test(id))) {
    throw new AppError('ids must be valid user ids', 400, 'VALIDATION_ERROR');
  }

  // Only connections are reported; everyone else is simply absent.
  const result = await presence.getPresenceFor(viewerId, ids);
  res.json({ success: true, data: { presence: result } });
});

module.exports = { getPresence };
