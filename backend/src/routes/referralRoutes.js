// backend/src/routes/referralRoutes.js
// Express routes for Job Referrals and status tracking.
// Mounted under /api/referrals and guarded with requireAuth.

'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const referralController = require('../controllers/referralController');

const router = express.Router();

router.use(requireAuth);

router.post('/request', referralController.requestReferral);
router.get('/received', referralController.getReceivedReferrals);
router.get('/sent', referralController.getSentReferrals);
router.patch('/:id/status', referralController.updateReferralStatus);

module.exports = router;
