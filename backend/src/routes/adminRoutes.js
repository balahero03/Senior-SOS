// backend/src/routes/adminRoutes.js
// Express routes for Admin portal and alumni verification.
// All endpoints mounted under /api/admin and protected with requireAuth and requireAdmin.

'use strict';

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const adminController = require('../controllers/adminController');

const router = express.Router();

// Enforce both JWT authentication and ADMIN role for all routes in this module
router.use(requireAuth, requireAdmin);

// Analytics & Dashboard Stats
router.get('/stats', adminController.getAdminStats);

// Alumni Verification Queue
router.get('/verifications', adminController.getPendingVerifications);
router.patch('/verifications/:id', adminController.updateVerificationStatus);

// User Management
router.patch('/users/:id/status', adminController.updateUserStatus);

// Audit Logs
router.get('/audit-logs', adminController.getAuditLogs);

// Master Data Management
router.post('/departments', adminController.createDepartment);
router.post('/companies', adminController.createCompany);

module.exports = router;
