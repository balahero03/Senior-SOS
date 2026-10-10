// backend/prisma/seed.js
// Database seed script for SeniorSOS
// Seeds core departments, demo student, demo verified alumnus with company,
// plus academic profiles and user settings for both.

'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

async function main() {
  console.log('[seed] Starting database seed...');

  // 1. Core Departments
  const departmentsData = [
    { code: 'CSE', name: 'Computer Science and Engineering' },
    { code: 'IT', name: 'Information Technology' },
    { code: 'ECE', name: 'Electronics and Communication Engineering' },
  ];

  const departments = {};
  for (const dept of departmentsData) {
    const record = await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name },
      create: { code: dept.code, name: dept.name },
    });
    departments[dept.code] = record;
    console.log(`[seed] Upserted department: ${record.code} (${record.name})`);
  }

  // 2. Demo Company
  const company = await prisma.company.upsert({
    where: { nameKey: 'google' },
    update: { name: 'Google' },
    create: {
      name: 'Google',
      nameKey: 'google',
    },
  });
  console.log(`[seed] Upserted company: ${company.name}`);

  // Shared demo password
  const demoPasswordHash = await hashPassword('Password@123');

  // Default notification preferences
  const defaultNotificationPreferences = {
    connection_requests: true,
    messages: true,
    mentorship_requests: true,
    referral_updates: true,
    community_activity: false,
  };

  // 3. Demo Student
  const studentEmail = 'student.demo@ssn.edu.in';
  const studentUser = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {
      name: 'Aravind Kumar',
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    create: {
      name: 'Aravind Kumar',
      email: studentEmail,
      passwordHash: demoPasswordHash,
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.academicProfile.upsert({
    where: { userId: studentUser.id },
    update: {
      departmentId: departments['CSE'].id,
      graduationYear: 2026,
      bio: 'Final year CSE undergraduate passionate about distributed systems, backend engineering, and cloud architecture.',
      careerInterests: 'Backend Engineering, Cloud Systems, Distributed Databases',
    },
    create: {
      userId: studentUser.id,
      departmentId: departments['CSE'].id,
      graduationYear: 2026,
      bio: 'Final year CSE undergraduate passionate about distributed systems, backend engineering, and cloud architecture.',
      careerInterests: 'Backend Engineering, Cloud Systems, Distributed Databases',
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: studentUser.id },
    update: {
      profileVisibility: 'COLLEGE',
      notificationPreferences: defaultNotificationPreferences,
    },
    create: {
      userId: studentUser.id,
      profileVisibility: 'COLLEGE',
      notificationPreferences: defaultNotificationPreferences,
    },
  });
  console.log(`[seed] Upserted demo student: ${studentUser.email} with academic profile and settings`);

  // 4. Demo Verified Alumnus
  const alumniEmail = 'alumni.demo@ssn.edu.in';
  const alumniUser = await prisma.user.upsert({
    where: { email: alumniEmail },
    update: {
      name: 'Pooja Sundaram',
      role: 'ALUMNI',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    create: {
      name: 'Pooja Sundaram',
      email: alumniEmail,
      passwordHash: demoPasswordHash,
      role: 'ALUMNI',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.academicProfile.upsert({
    where: { userId: alumniUser.id },
    update: {
      departmentId: departments['IT'].id,
      graduationYear: 2022,
      bio: 'Alumna from Batch of 2022. Working on scalable microservices and database engines. Happy to mentor juniors on career prep and system design.',
      careerInterests: 'Software Engineering, System Design, Mentorship',
    },
    create: {
      userId: alumniUser.id,
      departmentId: departments['IT'].id,
      graduationYear: 2022,
      bio: 'Alumna from Batch of 2022. Working on scalable microservices and database engines. Happy to mentor juniors on career prep and system design.',
      careerInterests: 'Software Engineering, System Design, Mentorship',
    },
  });

  await prisma.alumniProfile.upsert({
    where: { userId: alumniUser.id },
    update: {
      companyId: company.id,
      designation: 'Senior Software Engineer',
      experienceYears: 4.0,
      verificationStatus: 'APPROVED',
      verifiedAt: new Date(),
    },
    create: {
      userId: alumniUser.id,
      companyId: company.id,
      designation: 'Senior Software Engineer',
      experienceYears: 4.0,
      verificationStatus: 'APPROVED',
      verifiedAt: new Date(),
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: alumniUser.id },
    update: {
      profileVisibility: 'COLLEGE',
      notificationPreferences: defaultNotificationPreferences,
    },
    create: {
      userId: alumniUser.id,
      profileVisibility: 'COLLEGE',
      notificationPreferences: defaultNotificationPreferences,
    },
  });
  console.log(`[seed] Upserted demo verified alumnus: ${alumniUser.email} with company, academic profile, and settings`);

  console.log('[seed] Database seeding completed successfully! ✨');
}

main()
  .catch((err) => {
    console.error('[seed] Error while seeding database:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
