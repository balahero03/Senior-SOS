// backend/src/modules/users/controllers/users.controller.js
'use strict';

const usersService = require('../services/users.service');

async function getUsers(req, res, next) {
  try {
    const { search, role } = req.query;
    const currentUserId = req.user?.id;
    const users = await usersService.getUsers({ search, role, currentUserId });

    res.status(200).json({
      success: true,
      data: { users },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getUsers,
};
