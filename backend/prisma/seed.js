// backend/prisma/seed.js
// Comprehensive Database Seed script for SeniorSOS
// Seeds: Departments, Companies, Global Skills, Students, Verified Alumni,
// Academic Profiles, Alumni Profiles, User Skills, User Settings,
// Connections, Connection Requests, Notifications, and MongoDB Chat Conversations.

'use strict';

const nodeCrypto = require('crypto');
if (!global.crypto) {
  global.crypto = nodeCrypto.webcrypto || nodeCrypto;
}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

function getCanonicalPair(id1, id2) {
  return id1 < id2 ? { userA: id1, userB: id2 } : { userA: id2, userB: id1 };
}

async function main() {
  console.log('🚀 [seed] Starting comprehensive database seed for SeniorSOS...');

  // ─── 1. Departments ────────────────────────────────────────────────────────
  console.log('📚 [seed] Seeding departments...');
  const departmentsData = [
    { code: 'CSE', name: 'Computer Science and Engineering' },
    { code: 'IT', name: 'Information Technology' },
    { code: 'ECE', name: 'Electronics and Communication Engineering' },
    { code: 'EEE', name: 'Electrical and Electronics Engineering' },
    { code: 'MECH', name: 'Mechanical Engineering' },
    { code: 'CIVIL', name: 'Civil Engineering' },
    { code: 'BME', name: 'Biomedical Engineering' },
    { code: 'CHEM', name: 'Chemical Engineering' },
  ];

  const departments = {};
  for (const dept of departmentsData) {
    const record = await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name },
      create: { code: dept.code, name: dept.name },
    });
    departments[dept.code] = record;
  }
  console.log(`  ✓ Seeded ${Object.keys(departments).length} departments`);

  // ─── 2. Companies ──────────────────────────────────────────────────────────
  console.log('🏢 [seed] Seeding top hiring companies...');
  const companiesData = [
    { name: 'Google', nameKey: 'google' },
    { name: 'Microsoft', nameKey: 'microsoft' },
    { name: 'Amazon', nameKey: 'amazon' },
    { name: 'Zoho', nameKey: 'zoho' },
    { name: 'Qualcomm', nameKey: 'qualcomm' },
    { name: 'Cisco', nameKey: 'cisco' },
  ];

  const companies = {};
  for (const comp of companiesData) {
    const record = await prisma.company.upsert({
      where: { nameKey: comp.nameKey },
      update: { name: comp.name },
      create: { name: comp.name, nameKey: comp.nameKey },
    });
    companies[comp.nameKey] = record;
  }
  console.log(`  ✓ Seeded ${Object.keys(companies).length} companies`);

  // ─── 3. Skills ─────────────────────────────────────────────────────────────
  console.log('🛠️ [seed] Seeding skill tags...');
  const skillNames = [
    'React',
    'Node.js',
    'TypeScript',
    'Python',
    'Java',
    'C++',
    'Docker',
    'Kubernetes',
    'AWS',
    'System Design',
    'GraphQL',
    'Machine Learning',
    'PostgreSQL',
    'MongoDB',
    'Embedded Systems',
    'UI/UX Design',
    'Data Structures',
    'FastAPI',
  ];

  const skills = {};
  for (const sName of skillNames) {
    const record = await prisma.skill.upsert({
      where: { name: sName },
      update: {},
      create: { name: sName },
    });
    skills[sName] = record;
  }
  console.log(`  ✓ Seeded ${Object.keys(skills).length} skills`);

  // Shared demo password
  const defaultPasswordHash = await hashPassword('Password@123');

  const defaultNotificationPreferences = {
    connection_requests: true,
    messages: true,
    mentorship_requests: true,
    community_activity: false,
  };

  // ─── 4. Admin Account ──────────────────────────────────────────────────────
  console.log('👑 [seed] Seeding Admin...');
  await prisma.user.upsert({
    where: { email: 'admin@seniorsos.edu.in' },
    update: {
      name: 'System Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    create: {
      name: 'System Admin',
      email: 'admin@seniorsos.edu.in',
      passwordHash: defaultPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  // ─── 5. Students ───────────────────────────────────────────────────────────
  console.log('🎓 [seed] Seeding Students...');
  const studentsData = [
    {
      name: 'Aravind Kumar',
      email: 'student.demo@ssn.edu.in',
      deptCode: 'CSE',
      graduationYear: 2026,
      bio: 'Final year CSE undergraduate passionate about distributed systems and cloud architecture. Currently preparing for product company interviews.',
      careerInterests: 'Backend Engineering, Cloud Systems, Distributed Databases',
      skills: [
        { name: 'Node.js', proficiency: 'ADVANCED' },
        { name: 'React', proficiency: 'INTERMEDIATE' },
        { name: 'PostgreSQL', proficiency: 'INTERMEDIATE' },
        { name: 'System Design', proficiency: 'BEGINNER' },
      ],
    },
    {
      name: 'Sneha Ramesh',
      email: 'sneha.ramesh@ssn.edu.in',
      deptCode: 'IT',
      graduationYear: 2027,
      bio: 'Third year IT student interested in modern frontend architectures, accessible design, and full-stack development.',
      careerInterests: 'Frontend Engineering, Full Stack Development, Product Design',
      skills: [
        { name: 'React', proficiency: 'ADVANCED' },
        { name: 'TypeScript', proficiency: 'INTERMEDIATE' },
        { name: 'UI/UX Design', proficiency: 'ADVANCED' },
        { name: 'Node.js', proficiency: 'BEGINNER' },
      ],
    },
    {
      name: 'Karthik Subramanian',
      email: 'karthik.s@ssn.edu.in',
      deptCode: 'ECE',
      graduationYear: 2026,
      bio: 'Final year ECE student enthusiastic about embedded Linux, robotics, and low-power IoT sensing architectures.',
      careerInterests: 'Embedded Software, Firmware Engineering, Hardware Acceleration',
      skills: [
        { name: 'Embedded Systems', proficiency: 'ADVANCED' },
        { name: 'C++', proficiency: 'ADVANCED' },
        { name: 'Python', proficiency: 'INTERMEDIATE' },
      ],
    },
    {
      name: 'Priya Dharshini',
      email: 'priya.d@ssn.edu.in',
      deptCode: 'CSE',
      graduationYear: 2027,
      bio: 'Passionate about NLP and Deep Learning. Built several open-source generative AI projects and seeking R&D internships.',
      careerInterests: 'AI/ML Engineering, Data Science, Research',
      skills: [
        { name: 'Python', proficiency: 'ADVANCED' },
        { name: 'Machine Learning', proficiency: 'ADVANCED' },
        { name: 'FastAPI', proficiency: 'INTERMEDIATE' },
        { name: 'PostgreSQL', proficiency: 'BEGINNER' },
      ],
    },
    {
      name: 'Rohit Sharma',
      email: 'rohit.sharma@ssn.edu.in',
      deptCode: 'MECH',
      graduationYear: 2026,
      bio: 'Mechanical engineering senior bridging mechanical design with autonomous robotics and automation.',
      careerInterests: 'Robotics, Mechatronics, Automation',
      skills: [
        { name: 'Python', proficiency: 'INTERMEDIATE' },
        { name: 'C++', proficiency: 'BEGINNER' },
      ],
    },
  ];

  const studentUsers = {};
  for (const st of studentsData) {
    const user = await prisma.user.upsert({
      where: { email: st.email },
      update: {
        name: st.name,
        role: 'STUDENT',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
      create: {
        name: st.name,
        email: st.email,
        passwordHash: defaultPasswordHash,
        role: 'STUDENT',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });

    studentUsers[st.email] = user;

    await prisma.academicProfile.upsert({
      where: { userId: user.id },
      update: {
        departmentId: departments[st.deptCode].id,
        graduationYear: st.graduationYear,
        bio: st.bio,
        careerInterests: st.careerInterests,
      },
      create: {
        userId: user.id,
        departmentId: departments[st.deptCode].id,
        graduationYear: st.graduationYear,
        bio: st.bio,
        careerInterests: st.careerInterests,
      },
    });

    await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {
        profileVisibility: 'COLLEGE',
        notificationPreferences: defaultNotificationPreferences,
      },
      create: {
        userId: user.id,
        profileVisibility: 'COLLEGE',
        notificationPreferences: defaultNotificationPreferences,
      },
    });

    // Seed User Skills
    for (const sk of st.skills) {
      if (skills[sk.name]) {
        await prisma.userSkill.upsert({
          where: {
            userId_skillId: {
              userId: user.id,
              skillId: skills[sk.name].id,
            },
          },
          update: { proficiency: sk.proficiency },
          create: {
            userId: user.id,
            skillId: skills[sk.name].id,
            proficiency: sk.proficiency,
          },
        });
      }
    }
  }
  console.log(`  ✓ Seeded ${studentsData.length} students with profiles and skills`);

  // ─── 6. Alumni ─────────────────────────────────────────────────────────────
  console.log('💼 [seed] Seeding Verified Alumni...');
  const alumniData = [
    {
      name: 'Pooja Sundaram',
      email: 'alumni.demo@ssn.edu.in',
      deptCode: 'IT',
      graduationYear: 2022,
      companyKey: 'google',
      designation: 'Senior Software Engineer',
      experienceYears: 4.0,
      bio: 'Google SWE, SSN IT 2022 alumna. Passionate about helping juniors with interview preparation, resume reviews, and career guidance.',
      careerInterests: 'Distributed Systems, Mentorship, Tech Leadership',
      skills: [
        { name: 'System Design', proficiency: 'ADVANCED' },
        { name: 'Node.js', proficiency: 'ADVANCED' },
        { name: 'Kubernetes', proficiency: 'ADVANCED' },
        { name: 'AWS', proficiency: 'INTERMEDIATE' },
      ],
    },
    {
      name: 'Vijay Anand',
      email: 'vijay.anand@alumni.ssn.edu.in',
      deptCode: 'CSE',
      graduationYear: 2020,
      companyKey: 'microsoft',
      designation: 'Principal Software Engineer',
      experienceYears: 6.0,
      bio: 'SSN CSE 2020 alumnus now at Microsoft Azure Core. Always happy to guide students in cloud engineering and algorithmic problem solving.',
      careerInterests: 'Cloud Infrastructure, Distributed Storage, Mentorship',
      skills: [
        { name: 'C++', proficiency: 'ADVANCED' },
        { name: 'System Design', proficiency: 'ADVANCED' },
        { name: 'Data Structures', proficiency: 'ADVANCED' },
        { name: 'Docker', proficiency: 'ADVANCED' },
      ],
    },
    {
      name: 'Ananya Murali',
      email: 'ananya.m@alumni.ssn.edu.in',
      deptCode: 'ECE',
      graduationYear: 2021,
      companyKey: 'qualcomm',
      designation: 'Hardware Design Engineer II',
      experienceYears: 5.0,
      bio: 'SSN ECE 2021 alumna working on high-performance mobile chipsets at Qualcomm. Reach out for semiconductor & hardware core advice.',
      careerInterests: 'Semiconductor Design, SoC Architecture, Embedded Firmware',
      skills: [
        { name: 'Embedded Systems', proficiency: 'ADVANCED' },
        { name: 'C++', proficiency: 'ADVANCED' },
        { name: 'Python', proficiency: 'ADVANCED' },
      ],
    },
    {
      name: 'Siddharth Raman',
      email: 'siddharth.r@alumni.ssn.edu.in',
      deptCode: 'CSE',
      graduationYear: 2023,
      companyKey: 'amazon',
      designation: 'Software Development Engineer II',
      experienceYears: 3.0,
      bio: 'AWS platform engineer. Mentoring juniors on competitive coding, low-level design, and cracking FAANG interviews.',
      careerInterests: 'E-Commerce Systems, Distributed Messaging, Cloud Architecture',
      skills: [
        { name: 'AWS', proficiency: 'ADVANCED' },
        { name: 'Java', proficiency: 'ADVANCED' },
        { name: 'Docker', proficiency: 'ADVANCED' },
        { name: 'Machine Learning', proficiency: 'INTERMEDIATE' },
      ],
    },
    {
      name: 'Divya Krishnan',
      email: 'divya.krishnan@alumni.ssn.edu.in',
      deptCode: 'IT',
      graduationYear: 2019,
      companyKey: 'zoho',
      designation: 'Lead Technical Architect',
      experienceYears: 7.0,
      bio: 'SSN IT 2019 alumna. Leading product architecture for SaaS solutions at Zoho. Passionate about software craftsmanship.',
      careerInterests: 'SaaS Architecture, Product Development, Team Building',
      skills: [
        { name: 'Java', proficiency: 'ADVANCED' },
        { name: 'PostgreSQL', proficiency: 'ADVANCED' },
        { name: 'React', proficiency: 'INTERMEDIATE' },
        { name: 'System Design', proficiency: 'ADVANCED' },
      ],
    },
  ];

  const alumniUsers = {};
  for (const al of alumniData) {
    const user = await prisma.user.upsert({
      where: { email: al.email },
      update: {
        name: al.name,
        role: 'ALUMNI',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
      create: {
        name: al.name,
        email: al.email,
        passwordHash: defaultPasswordHash,
        role: 'ALUMNI',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });

    alumniUsers[al.email] = user;

    await prisma.academicProfile.upsert({
      where: { userId: user.id },
      update: {
        departmentId: departments[al.deptCode].id,
        graduationYear: al.graduationYear,
        bio: al.bio,
        careerInterests: al.careerInterests,
      },
      create: {
        userId: user.id,
        departmentId: departments[al.deptCode].id,
        graduationYear: al.graduationYear,
        bio: al.bio,
        careerInterests: al.careerInterests,
      },
    });

    await prisma.alumniProfile.upsert({
      where: { userId: user.id },
      update: {
        companyId: companies[al.companyKey]?.id,
        designation: al.designation,
        experienceYears: al.experienceYears,
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
      create: {
        userId: user.id,
        companyId: companies[al.companyKey]?.id,
        designation: al.designation,
        experienceYears: al.experienceYears,
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
    });

    await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {
        profileVisibility: 'COLLEGE',
        notificationPreferences: defaultNotificationPreferences,
      },
      create: {
        userId: user.id,
        profileVisibility: 'COLLEGE',
        notificationPreferences: defaultNotificationPreferences,
      },
    });

    // Seed User Skills
    for (const sk of al.skills) {
      if (skills[sk.name]) {
        await prisma.userSkill.upsert({
          where: {
            userId_skillId: {
              userId: user.id,
              skillId: skills[sk.name].id,
            },
          },
          update: { proficiency: sk.proficiency },
          create: {
            userId: user.id,
            skillId: skills[sk.name].id,
            proficiency: sk.proficiency,
          },
        });
      }
    }
  }
  console.log(`  ✓ Seeded ${alumniData.length} alumni with company records and verified profiles`);

  // ─── 7. Connections ────────────────────────────────────────────────────────
  console.log('🤝 [seed] Seeding active connections...');
  const aravind = studentUsers['student.demo@ssn.edu.in'];
  const sneha = studentUsers['sneha.ramesh@ssn.edu.in'];
  const karthik = studentUsers['karthik.s@ssn.edu.in'];
  const priya = studentUsers['priya.d@ssn.edu.in'];
  const rohit = studentUsers['rohit.sharma@ssn.edu.in'];

  const pooja = alumniUsers['alumni.demo@ssn.edu.in'];
  const vijay = alumniUsers['vijay.anand@alumni.ssn.edu.in'];
  const ananya = alumniUsers['ananya.m@alumni.ssn.edu.in'];
  const siddharth = alumniUsers['siddharth.r@alumni.ssn.edu.in'];
  const divya = alumniUsers['divya.krishnan@alumni.ssn.edu.in'];

  const connectionPairs = [
    [aravind.id, pooja.id],
    [aravind.id, siddharth.id],
    [sneha.id, divya.id],
    [karthik.id, ananya.id],
  ];

  for (const [id1, id2] of connectionPairs) {
    const { userA, userB } = getCanonicalPair(id1, id2);
    await prisma.connection.upsert({
      where: {
        userA_userB: { userA, userB },
      },
      update: {},
      create: {
        userA,
        userB,
        connectedAt: new Date(),
      },
    });
  }
  console.log(`  ✓ Seeded ${connectionPairs.length} active connections`);

  // ─── 8. Connection Requests ────────────────────────────────────────────────
  console.log('📩 [seed] Seeding pending connection requests...');
  const pendingRequests = [
    { senderId: priya.id, receiverId: pooja.id },
    { senderId: aravind.id, receiverId: vijay.id },
    { senderId: rohit.id, receiverId: siddharth.id },
  ];

  for (const req of pendingRequests) {
    const existing = await prisma.connectionRequest.findFirst({
      where: { senderId: req.senderId, receiverId: req.receiverId, status: 'PENDING' },
    });
    if (!existing) {
      await prisma.connectionRequest.create({
        data: {
          senderId: req.senderId,
          receiverId: req.receiverId,
          status: 'PENDING',
        },
      });
    }
  }
  console.log(`  ✓ Seeded ${pendingRequests.length} pending connection requests`);

  // ─── 9. Notifications ──────────────────────────────────────────────────────
  console.log('🔔 [seed] Seeding notifications...');
  const notificationsData = [
    {
      recipientId: aravind.id,
      actorId: pooja.id,
      type: 'CONNECTION_REQUEST_ACCEPTED',
      payload: { message: 'Pooja Sundaram accepted your connection request' },
      readAt: null,
    },
    {
      recipientId: pooja.id,
      actorId: priya.id,
      type: 'CONNECTION_REQUEST_RECEIVED',
      payload: { message: 'Priya Dharshini sent you a connection request' },
      readAt: null,
    },
    {
      recipientId: vijay.id,
      actorId: aravind.id,
      type: 'CONNECTION_REQUEST_RECEIVED',
      payload: { message: 'Aravind Kumar sent you a connection request' },
      readAt: null,
    },
    {
      recipientId: sneha.id,
      actorId: divya.id,
      type: 'CONNECTION_REQUEST_ACCEPTED',
      payload: { message: 'Divya Krishnan accepted your connection request' },
      readAt: new Date(),
    },
  ];

  for (const n of notificationsData) {
    await prisma.notification.create({
      data: n,
    });
  }
  console.log(`  ✓ Seeded ${notificationsData.length} notifications`);

  // ─── 10. MongoDB Direct Conversations & Messages ───────────────────────────
  console.log('💬 [seed] Seeding MongoDB chat messages...');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27018/seniorsos';

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    }

    const Conversation = require('../src/database/mongodb/models/Conversation.model');
    const Message = require('../src/database/mongodb/models/Message.model');

    // Conversation 1: Aravind Kumar <-> Pooja Sundaram
    const pairKey1 = [aravind.id, pooja.id].sort().join(':');
    let conv1 = await Conversation.findOne({ pairKey: pairKey1 });
    if (!conv1) {
      conv1 = await Conversation.create({
        participantIds: [aravind.id, pooja.id],
        pairKey: pairKey1,
        lastMessageAt: new Date(),
      });
    }

    await Message.deleteMany({ conversationId: conv1._id });

    const messagesConv1 = [
      {
        conversationId: conv1._id,
        senderId: aravind.id,
        content: 'Hi Pooja akka! Hope you are doing well. I had a quick question regarding preparing for backend system design rounds.',
        readAt: new Date(Date.now() - 3600000 * 2),
        createdAt: new Date(Date.now() - 3600000 * 2),
      },
      {
        conversationId: conv1._id,
        senderId: pooja.id,
        content: 'Hey Aravind! Glad you reached out. Focus on caching patterns, database partitioning, and rate limiters first. Have you checked out Designing Data-Intensive Applications?',
        readAt: new Date(Date.now() - 3600000 * 1.5),
        createdAt: new Date(Date.now() - 3600000 * 1.5),
      },
      {
        conversationId: conv1._id,
        senderId: aravind.id,
        content: 'Yes, I started reading chapter 5 on replication! Thanks for the recommendation.',
        readAt: new Date(Date.now() - 3600000 * 1),
        createdAt: new Date(Date.now() - 3600000 * 1),
      },
      {
        conversationId: conv1._id,
        senderId: pooja.id,
        content: 'That is a great chapter. Try implementing a toy key-value store with consistent hashing—it really solidifies the concepts! Feel free to ping me anytime.',
        readAt: null,
        createdAt: new Date(Date.now() - 1800000),
      },
    ];

    await Message.insertMany(messagesConv1);

    // Conversation 2: Sneha Ramesh <-> Divya Krishnan
    const pairKey2 = [sneha.id, divya.id].sort().join(':');
    let conv2 = await Conversation.findOne({ pairKey: pairKey2 });
    if (!conv2) {
      conv2 = await Conversation.create({
        participantIds: [sneha.id, divya.id],
        pairKey: pairKey2,
        lastMessageAt: new Date(),
      });
    }

    await Message.deleteMany({ conversationId: conv2._id });

    const messagesConv2 = [
      {
        conversationId: conv2._id,
        senderId: sneha.id,
        content: "Hello Divya ma'am! I really enjoyed your session on building reliable SaaS architectures.",
        readAt: new Date(Date.now() - 3600000 * 5),
        createdAt: new Date(Date.now() - 3600000 * 5),
      },
      {
        conversationId: conv2._id,
        senderId: divya.id,
        content: 'Thanks Sneha! Great to see juniors passionate about full stack and systems. Let me know if you need guidance on frontend frameworks or project ideas.',
        readAt: null,
        createdAt: new Date(Date.now() - 3600000 * 4),
      },
    ];

    await Message.insertMany(messagesConv2);
    console.log('  ✓ Seeded 2 MongoDB direct conversations and chat messages');

    await mongoose.disconnect();
  } catch (mongoErr) {
    console.warn('⚠️ [seed] MongoDB seeding skipped or failed (is MongoDB running?):', mongoErr.message);
  }

  console.log('\n🎉 [seed] Database seeding completed successfully! ✨');
}

main()
  .catch((err) => {
    console.error('❌ [seed] Error while seeding database:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
