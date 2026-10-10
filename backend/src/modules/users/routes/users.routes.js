// backend/src/modules/users/routes/users.routes.js
'use strict';

const { Router } = require('express');
const { requireAuth } = require('../../../middleware/auth.middleware');
const usersController = require('../controllers/users.controller');

const router = Router();

router.use(requireAuth);

router.get('/', usersController.getUsers);

module.exports = router;
