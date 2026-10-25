// backend/src/controllers/userController.js
// User Profiles & Skill Management Controller for SeniorSOS.
// Handles lookups for departments, companies, skills, and full user profile CRUD with skill sync.

'use strict';

const { prisma } = require('../database/postgres');
const asyncHandler = require('../shared/utils/asyncHandler');
const AppError = require('../shared/errors/AppError');
const graph = require('../services/graphService');

const PROFILE_PRIVATE_MESSAGE = 'This profile is only visible to connections';

// ─── Metadata & Lookup Handlers ──────────────────────────────────────────────

/**
 * GET /api/departments
 * Returns all departments sorted alphabetically by code.
 */
const getDepartments = asyncHandler(async (req, res) => {
  const departments = await prisma.department.findMany({
    select: {
      id: true,
      code: true,
      name: true,
    },
    orderBy: {
      code: 'asc',
    },
  });

  res.json({
    success: true,
    data: { departments },
  });
});

/**
 * GET /api/companies
 * Returns registered companies (id, name). Supports search query `?q=` filtering by name_key.
 */
const getCompanies = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const where = {};

  if (q && q.trim()) {
    const searchKey = q.trim().toLowerCase();
    where.nameKey = { contains: searchKey };
  }

  const companies = await prisma.company.findMany({
    where,
    select: {
      id: true,
      name: true,
      nameKey: true,
    },
    orderBy: {
      name: 'asc',
    },
    take: 50,
  });

  res.json({
    success: true,
    data: { companies },
  });
});

/**
 * GET /api/skills
 * Returns skills (id, name). Supports search query `?q=` filtering by name.
 */
const getSkills = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const where = {};

  if (q && q.trim()) {
    const searchTerm = q.trim();
    where.name = { contains: searchTerm, mode: 'insensitive' };
  }

  const skills = await prisma.skill.findMany({
    where,
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
    take: 50,
  });

  res.json({
    success: true,
    data: { skills },
  });
});

// ─── Profile Retrieval & Edit Handlers ───────────────────────────────────────

/**
 * Helper to determine connection status between current user and target user:
 * 'SELF' | 'CONNECTED' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'NONE'
 */
async function getConnectionStatus(currentUserId, targetUserId) {
  if (currentUserId === targetUserId) {
    return 'SELF';
  }

  // Check canonical connection
  const [userA, userB] = currentUserId < targetUserId
    ? [currentUserId, targetUserId]
    : [targetUserId, currentUserId];

  const connection = await prisma.connection.findUnique({
    where: {
      userA_userB: { userA, userB },
    },
  });

  if (connection) {
    return 'CONNECTED';
  }

  // Check pending connection request
  const pendingRequest = await prisma.connectionRequest.findFirst({
    where: {
      status: 'PENDING',
      OR: [
        { senderId: currentUserId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: currentUserId },
      ],
    },
  });

  if (pendingRequest) {
    return pendingRequest.senderId === currentUserId ? 'PENDING_SENT' : 'PENDING_RECEIVED';
  }

  return 'NONE';
}

/**
 * GET /api/users/:id/profile
 * Returns detailed user profile with connection status relative to the viewer.
 */
const getUserProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user.id || req.user.sub;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      academicProfile: {
        include: {
          department: {
            select: { id: true, code: true, name: true },
          },
        },
      },
      alumniProfile: {
        include: {
          company: {
            select: { id: true, name: true, nameKey: true },
          },
        },
      },
      userSkills: {
        include: {
          skill: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const connectionStatus = await getConnectionStatus(currentUserId, user.id);

  // Search filtering is not an authorization boundary: enforce visibility on
  // direct profile requests as well. Keep the owner's own profile accessible.
  if (currentUserId !== user.id && connectionStatus !== 'CONNECTED') {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
      select: { profileVisibility: true },
    });

    if (settings?.profileVisibility === 'CONNECTIONS_ONLY') {
      throw new AppError(PROFILE_PRIVATE_MESSAGE, 404, 'PROFILE_NOT_FOUND');
    }
  }

  const formattedSkills = user.userSkills.map((us) => ({
    skillId: us.skillId,
    name: us.skill.name,
    proficiency: us.proficiency,
  }));

  const responseProfile = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    academicProfile: user.academicProfile
      ? {
          departmentId: user.academicProfile.departmentId,
          departmentCode: user.academicProfile.department?.code || null,
          departmentName: user.academicProfile.department?.name || null,
          graduationYear: user.academicProfile.graduationYear,
          bio: user.academicProfile.bio,
          careerInterests: user.academicProfile.careerInterests,
        }
      : null,
    alumniProfile:
      user.role === 'ALUMNI' && user.alumniProfile
        ? {
            companyId: user.alumniProfile.companyId,
            companyName: user.alumniProfile.company?.name || null,
            designation: user.alumniProfile.designation,
            experienceYears: user.alumniProfile.experienceYears,
            verificationStatus: user.alumniProfile.verificationStatus,
          }
        : null,
    skills: formattedSkills,
    connectionStatus,
  };

  res.json({
    success: true,
    data: { profile: responseProfile },
  });
});

/**
 * PUT /api/users/profile
 * Updates the authenticated user's profile inside a single Prisma interactive transaction.
 */
const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user.sub;
  const {
    name,
    departmentId,
    graduationYear,
    bio,
    careerInterests,
    companyName,
    designation,
    experienceYears,
    skills,
  } = req.body;

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!existingUser) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  await prisma.$transaction(async (tx) => {
    // 1. Update name on user if supplied
    if (name && name.trim()) {
      await tx.user.update({
        where: { id: userId },
        data: { name: name.trim() },
      });
    }

    // 2. Upsert academic_profiles
    if (departmentId || graduationYear || bio !== undefined || careerInterests !== undefined) {
      const academicData = {};
      if (bio !== undefined) academicData.bio = bio ? bio.trim() : null;
      if (careerInterests !== undefined) academicData.careerInterests = careerInterests ? careerInterests.trim() : null;
      if (graduationYear !== undefined) academicData.graduationYear = parseInt(graduationYear, 10);
      if (departmentId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(departmentId);
        if (isUuid) {
          academicData.departmentId = departmentId;
        } else {
          const dept = await tx.department.findFirst({
            where: {
              OR: [
                { code: departmentId.toUpperCase().trim() },
                { name: { equals: departmentId.trim(), mode: 'insensitive' } },
              ],
            },
          });
          if (dept) academicData.departmentId = dept.id;
        }
      }

      const existingAcademic = await tx.academicProfile.findUnique({
        where: { userId },
      });

      if (existingAcademic) {
        await tx.academicProfile.update({
          where: { userId },
          data: academicData,
        });
      } else {
        // Must provide departmentId and graduationYear on initial creation
        if (!academicData.departmentId || !graduationYear) {
          throw new AppError('departmentId and graduationYear are required to initialize academic profile', 400, 'VALIDATION_ERROR');
        }
        await tx.academicProfile.create({
          data: {
            userId,
            departmentId: academicData.departmentId,
            graduationYear: parseInt(graduationYear, 10),
            bio: academicData.bio || null,
            careerInterests: academicData.careerInterests || null,
          },
        });
      }
    }

    // 3. If ALUMNI: upsert company and alumni_profiles
    if (existingUser.role === 'ALUMNI') {
      let resolvedCompanyId = undefined;

      if (companyName && companyName.trim()) {
        const cleanName = companyName.trim();
        const nameKey = cleanName.toLowerCase();
        const comp = await tx.company.upsert({
          where: { nameKey },
          update: { name: cleanName },
          create: { name: cleanName, nameKey },
        });
        resolvedCompanyId = comp.id;
      }

      if (resolvedCompanyId !== undefined || designation !== undefined || experienceYears !== undefined) {
        const alumniData = {};
        if (resolvedCompanyId !== undefined) alumniData.companyId = resolvedCompanyId;
        if (designation !== undefined) alumniData.designation = designation ? designation.trim() : null;
        if (experienceYears !== undefined) {
          alumniData.experienceYears =
            experienceYears !== null && experienceYears !== '' && !isNaN(parseFloat(experienceYears))
              ? parseFloat(experienceYears)
              : null;
        }

        const existingAlumni = await tx.alumniProfile.findUnique({
          where: { userId },
        });

        if (existingAlumni) {
          await tx.alumniProfile.update({
            where: { userId },
            data: alumniData,
          });
        } else {
          await tx.alumniProfile.create({
            data: {
              userId,
              companyId: resolvedCompanyId || null,
              designation: alumniData.designation || null,
              experienceYears: alumniData.experienceYears || null,
            },
          });
        }
      }
    }

    // 4. Synchronize user_skills
    if (Array.isArray(skills)) {
      // Upsert all skill records in `skills`
      const resolvedSkillEntries = [];

      for (const item of skills) {
        const rawName = typeof item === 'string' ? item : (item?.name || item?.skillName);
        if (!rawName || !rawName.trim()) continue;

        const cleanSkillName = rawName.trim();
        const skillRecord = await tx.skill.upsert({
          where: { name: cleanSkillName },
          update: {},
          create: { name: cleanSkillName },
        });

        resolvedSkillEntries.push({
          userId,
          skillId: skillRecord.id,
          proficiency: (typeof item === 'object' && item.proficiency) ? item.proficiency.trim() : null,
        });
      }

      // Delete existing user skills
      await tx.userSkill.deleteMany({
        where: { userId },
      });

      // Insert updated skills
      if (resolvedSkillEntries.length > 0) {
        for (const entry of resolvedSkillEntries) {
          await tx.userSkill.create({
            data: entry,
          });
        }
      }
    }
  });

  // Fetch and return the updated profile
  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      academicProfile: {
        include: {
          department: {
            select: { id: true, code: true, name: true },
          },
        },
      },
      alumniProfile: {
        include: {
          company: {
            select: { id: true, name: true },
          },
        },
      },
      userSkills: {
        include: {
          skill: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  // Keep the graph node in step with the edited profile. Department,
  // company and designation are all node properties, so a stale node makes
  // the graph answer "who do we know at X" with the previous employer.
  await graph.syncUserToGraph(updatedUser);

  res.json({
    success: true,
    data: {
      message: 'Profile updated successfully',
      profile: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        academicProfile: updatedUser.academicProfile
          ? {
              departmentId: updatedUser.academicProfile.departmentId,
              departmentCode: updatedUser.academicProfile.department?.code || null,
              departmentName: updatedUser.academicProfile.department?.name || null,
              graduationYear: updatedUser.academicProfile.graduationYear,
              bio: updatedUser.academicProfile.bio,
              careerInterests: updatedUser.academicProfile.careerInterests,
            }
          : null,
        alumniProfile:
          updatedUser.role === 'ALUMNI' && updatedUser.alumniProfile
            ? {
                companyId: updatedUser.alumniProfile.companyId,
                companyName: updatedUser.alumniProfile.company?.name || null,
                designation: updatedUser.alumniProfile.designation,
                experienceYears: updatedUser.alumniProfile.experienceYears,
                verificationStatus: updatedUser.alumniProfile.verificationStatus,
              }
            : null,
        skills: updatedUser.userSkills.map((us) => ({
          skillId: us.skillId,
          name: us.skill.name,
          proficiency: us.proficiency,
        })),
      },
    },
  });
});

/**
 * GET /api/users
 * Global user discovery and search hub.
 * Supports filters: role, departmentId, companyId, skillId, graduationYear, q, verifiedOnly.
 * Excludes SUSPENDED and DEACTIVATED users.
 * Respects CONNECTIONS_ONLY privacy settings.
 * Computes connectionStatus relative to req.user.id.
 */
const getUsers = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const skip = (page - 1) * limit;

  const {
    role,
    status,
    departmentId,
    companyId,
    skillId,
    graduationYear,
    q,
    verifiedOnly,
  } = req.query;

  const requesterRole = req.user?.role;
  const where = {};

  // Status & Role filtering
  if (requesterRole === 'ADMIN') {
    // Admin can view both ACTIVE and SUSPENDED users, or filter by specific status
    if (status && ['ACTIVE', 'SUSPENDED'].includes(status)) {
      where.status = status;
    }
    if (role && ['STUDENT', 'ALUMNI', 'ADMIN'].includes(role)) {
      where.role = role;
    }
  } else {
    // Regular students/alumni can only discover ACTIVE users, never ADMINs
    where.status = 'ACTIVE';
    if (role && ['STUDENT', 'ALUMNI'].includes(role)) {
      where.role = role;
    } else {
      where.role = { in: ['STUDENT', 'ALUMNI'] };
    }
  }

  // Academic profile filters
  const academicFilter = {};
  if (departmentId) {
    academicFilter.departmentId = departmentId;
  }
  if (graduationYear) {
    const gradYearNum = parseInt(graduationYear, 10);
    if (!isNaN(gradYearNum)) {
      academicFilter.graduationYear = gradYearNum;
    }
  }

  // Alumni profile filters
  const alumniFilter = {};
  if (companyId) {
    alumniFilter.companyId = companyId;
  }
  if (verifiedOnly === 'true') {
    alumniFilter.verificationStatus = 'APPROVED';
  }

  // Text search on name or bio
  if (q && q.trim()) {
    const searchTerm = q.trim();
    where.OR = [
      { name: { contains: searchTerm, mode: 'insensitive' } },
      { academicProfile: { bio: { contains: searchTerm, mode: 'insensitive' } } },
    ];
  }

  // Skill filter
  if (skillId) {
    where.userSkills = {
      some: { skillId },
    };
  }

  if (Object.keys(academicFilter).length > 0) {
    where.academicProfile = {
      ...(where.academicProfile || {}),
      ...academicFilter,
    };
  }

  if (Object.keys(alumniFilter).length > 0) {
    where.alumniProfile = {
      ...(where.alumniProfile || {}),
      ...alumniFilter,
    };
  }

  // Get viewer's active connections for privacy enforcement
  const myConnections = await prisma.connection.findMany({
    where: {
      OR: [{ userA: currentUserId }, { userB: currentUserId }],
    },
    select: { userA: true, userB: true },
  });

  const connectedUserIds = new Set(
    myConnections.map((c) => (c.userA === currentUserId ? c.userB : c.userA))
  );

  // Users who have profileVisibility === 'CONNECTIONS_ONLY' and are NOT connected to currentUserId
  // (and are not the current user) should be excluded from search results.
  const privateSettings = await prisma.userSettings.findMany({
    where: {
      profileVisibility: 'CONNECTIONS_ONLY',
      userId: {
        notIn: [currentUserId, ...Array.from(connectedUserIds)],
      },
    },
    select: { userId: true },
  });

  const hiddenUserIds = privateSettings.map((s) => s.userId);
  if (requesterRole !== 'ADMIN' && hiddenUserIds.length > 0) {
    where.id = { notIn: hiddenUserIds };
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        academicProfile: {
          select: {
            graduationYear: true,
            bio: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
        alumniProfile: {
          select: {
            designation: true,
            experienceYears: true,
            verificationStatus: true,
            company: { select: { id: true, name: true } },
          },
        },
        userSkills: {
          include: {
            skill: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  // Compute connectionStatus for returned users
  const userIds = users.map((u) => u.id).filter((id) => id !== currentUserId);

  // Fetch pending requests involving currentUserId and any of these users
  const pendingRequests = await prisma.connectionRequest.findMany({
    where: {
      status: 'PENDING',
      OR: [
        { senderId: currentUserId, receiverId: { in: userIds } },
        { senderId: { in: userIds }, receiverId: currentUserId },
      ],
    },
    select: { senderId: true, receiverId: true },
  });

  const sentPendingSet = new Set(
    pendingRequests
      .filter((r) => r.senderId === currentUserId)
      .map((r) => r.receiverId)
  );
  const receivedPendingSet = new Set(
    pendingRequests
      .filter((r) => r.receiverId === currentUserId)
      .map((r) => r.senderId)
  );

  const formattedUsers = users.map((user) => {
    let connectionStatus = 'NONE';
    if (user.id === currentUserId) {
      connectionStatus = 'SELF';
    } else if (connectedUserIds.has(user.id)) {
      connectionStatus = 'CONNECTED';
    } else if (sentPendingSet.has(user.id)) {
      connectionStatus = 'PENDING_SENT';
    } else if (receivedPendingSet.has(user.id)) {
      connectionStatus = 'PENDING_RECEIVED';
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      department: user.academicProfile?.department?.code || null,
      departmentName: user.academicProfile?.department?.name || null,
      graduationYear: user.academicProfile?.graduationYear || null,
      bio: user.academicProfile?.bio || null,
      company: user.role === 'ALUMNI' ? user.alumniProfile?.company?.name || null : null,
      companyId: user.role === 'ALUMNI' ? user.alumniProfile?.company?.id || null : null,
      designation: user.role === 'ALUMNI' ? user.alumniProfile?.designation || null : null,
      experienceYears: user.role === 'ALUMNI' && user.alumniProfile?.experienceYears ? Number(user.alumniProfile.experienceYears) : null,
      verificationStatus: user.role === 'ALUMNI' ? user.alumniProfile?.verificationStatus || null : null,
      skills: user.userSkills.map((us) => ({
        skillId: us.skillId,
        name: us.skill.name,
        proficiency: us.proficiency,
      })),
      connectionStatus,
    };
  });

  res.json({
    success: true,
    data: {
      users: formattedUsers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

module.exports = {
  getDepartments,
  getCompanies,
  getSkills,
  getUserProfile,
  updateProfile,
  getUsers,
};
