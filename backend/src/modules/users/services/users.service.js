// backend/src/modules/users/services/users.service.js
'use strict';

const { prisma } = require('../../../database/postgres');

/**
 * Get all users with search and role filters.
 */
async function getUsers({ search, role, currentUserId, limit = 50 }) {
  const where = {};

  if (currentUserId) {
    where.id = { not: currentUserId };
  }

  if (role && role !== 'ALL') {
    where.role = role;
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      academicProfile: {
        select: {
          graduationYear: true,
          bio: true,
          department: {
            select: { name: true, code: true },
          },
        },
      },
      alumniProfile: {
        select: {
          designation: true,
          company: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
    take: limit,
  });

  return users;
}

module.exports = {
  getUsers,
};
