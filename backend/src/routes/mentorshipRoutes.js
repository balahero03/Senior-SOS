// backend/src/routes/mentorshipRoutes.js
// Express routes for Mentorship lifecycle.
// Mounted under /api/mentorship and guarded with requireAuth.

'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const mentorshipController = require('../controllers/mentorshipController');

const router = express.Router();

router.use(requireAuth);

router.get('/mentors', mentorshipController.getMentors);
router.post('/request', mentorshipController.requestMentorship);
router.get('/my-mentorships', mentorshipController.getMyMentorships);
router.patch('/:id/status', mentorshipController.updateMentorshipStatus);

module.exports = router;
