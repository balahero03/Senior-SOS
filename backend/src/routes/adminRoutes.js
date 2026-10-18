// backend/src/routes/adminRoutes.js
// Express routes for Admin portal and alumni verification.
// All endpoints mounted under /api/admin and protected with requireAuth and requireAdmin.

'use strict';

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const adminController = require('../controllers/adminController');
const logsController = require('../controllers/logsController');

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

// API transcript logs. Ordered before /:id style routes so the literal
// segments win; all three are admin-only like the rest of this router.
router.get('/logs/meta', logsController.getLogsMeta);
router.get('/logs/download', logsController.downloadLog);
router.get('/logs', logsController.getLogs);

// Master Data Management
router.post('/departments', adminController.createDepartment);
router.post('/companies', adminController.createCompany);

module.exports = router;
