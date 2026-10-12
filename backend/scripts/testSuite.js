// backend/scripts/testSuite.js
// Automated End-to-End Test Suite for SeniorSOS
'use strict';

const nodeCrypto = require('crypto');
if (!global.crypto) {
  global.crypto = nodeCrypto.webcrypto || nodeCrypto;
}

const http = require('http');
const app = require('../src/app');
const { connectMongoDB, disconnectMongoDB } = require('../src/database/mongodb');
const { prisma } = require('../src/database/postgres');

let server;
let baseUrl;

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? '(' + detail + ')' : ''}`);
    failedTests++;
  }
}

function extractToken(headers) {
  if (!headers) return null;
  const cookieList = typeof headers.getSetCookie === 'function' 
    ? headers.getSetCookie() 
    : [headers.get('set-cookie') || ''];
  for (const str of cookieList) {
    const match = str && str.match(/accessToken=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
    headers['Cookie'] = `accessToken=${options.token}`;
  }

  const config = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, config);
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: json, headers: res.headers };
}

async function run() {
  console.log('🧪 Starting SeniorSOS Comprehensive Automated Test Suite...\n');

  // Connect MongoDB
  await connectMongoDB();

  // Start Express server on random free port
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test Server running on ${baseUrl}\n`);

  try {
    // ─── 1. Health & Public Endpoints ──────────────────────────────────────────
    console.log('📌 Testing System & Public Endpoints...');
    const health = await request('/health');
    assert(health.status === 200 && health.data?.status === 'ok', 'GET /health returns 200 ok');

    const depts = await request('/api/departments');
    assert(
      depts.status === 200 && Array.isArray(depts.data?.data?.departments || depts.data?.departments || depts.data) &&
      (depts.data?.data?.departments || depts.data?.departments || depts.data).length >= 8,
      'GET /api/departments returns public list with at least 8 departments'
    );

    // ─── 2. Auth Flow ──────────────────────────────────────────────────────────
    console.log('\n📌 Testing Authentication...');
    // Login Student
    const studentLogin = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'student.demo@ssn.edu.in',
        password: 'Password@123',
      },
    });
    assert(studentLogin.status === 200, 'Student login with valid credentials succeeds (200)');
    const studentToken = extractToken(studentLogin.headers);
    const studentUser = studentLogin.data?.data?.user || studentLogin.data?.user;
    assert(!!studentToken && studentUser?.role === 'STUDENT', 'Student login returns valid token and role');

    // Login Alumni
    const alumniLogin = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'alumni.demo@ssn.edu.in',
        password: 'Password@123',
      },
    });
    assert(alumniLogin.status === 200, 'Alumni login with valid credentials succeeds (200)');
    const alumniToken = extractToken(alumniLogin.headers);
    const alumniUser = alumniLogin.data?.data?.user || alumniLogin.data?.user;
    assert(!!alumniToken && alumniUser?.role === 'ALUMNI', 'Alumni login returns valid token and role');

    // Invalid Login
    const badLogin = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'student.demo@ssn.edu.in',
        password: 'WrongPassword999!',
      },
    });
    assert(badLogin.status === 401, 'Invalid password correctly rejected with 401 Unauthorized');

    // ─── 3. Forgot / Reset Password ───────────────────────────────────────────
    console.log('\n📌 Testing Forgot / Reset Password...');
    const allDepts = depts.data?.data?.departments || depts.data?.departments || depts.data;
    const cseDept = allDepts.find((d) => d.code === 'CSE');
    const civilDept = allDepts.find((d) => d.code === 'CIVIL');

    // Wrong department should fail
    const badReset = await request('/api/auth/reset-password', {
      method: 'POST',
      body: {
        email: 'student.demo@ssn.edu.in',
        departmentId: civilDept.id,
        newPassword: 'NewPassword@123',
        confirmPassword: 'NewPassword@123',
      },
    });
    assert(badReset.status >= 400, 'Reset password rejects mismatched department verification');

    // Correct department should succeed
    const goodReset = await request('/api/auth/reset-password', {
      method: 'POST',
      body: {
        email: 'student.demo@ssn.edu.in',
        departmentId: cseDept.id,
        newPassword: 'NewPassword@123',
        confirmPassword: 'NewPassword@123',
      },
    });
    assert(goodReset.status === 200, 'Reset password succeeds with matching department verification');

    // Verify login with new password
    const testNewLogin = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'student.demo@ssn.edu.in',
        password: 'NewPassword@123',
      },
    });
    assert(testNewLogin.status === 200, 'Can log in with new password after reset');

    // Reset back to Password@123
    await request('/api/auth/reset-password', {
      method: 'POST',
      body: {
        email: 'student.demo@ssn.edu.in',
        departmentId: cseDept.id,
        newPassword: 'Password@123',
        confirmPassword: 'Password@123',
      },
    });

    // ─── 4. User Registration Flow ─────────────────────────────────────────────
    console.log('\n📌 Testing User Registration Flow...');
    const regEmail = `autotest.${Date.now()}@ssn.edu.in`;
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Automated Test User',
        email: regEmail,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'STUDENT',
        departmentId: cseDept.id,
        graduationYear: 2026,
      },
    });
    assert(regRes.status === 201, 'New student registration succeeds (201 Created)');

    // Clean up registered user
    if (regRes.status === 201) {
      const newUserId = regRes.data?.data?.user?.id || regRes.data?.user?.id;
      if (newUserId) {
        await prisma.academicProfile.deleteMany({ where: { userId: newUserId } });
        await prisma.userSettings.deleteMany({ where: { userId: newUserId } });
        await prisma.refreshToken.deleteMany({ where: { userId: newUserId } });
        await prisma.user.delete({ where: { id: newUserId } });
      }
    }

    // ─── 5. Profiles and Users Listing ────────────────────────────────────────
    console.log('\n📌 Testing Profiles & User Listing...');
    const usersList = await request('/api/users', {
      token: studentToken,
    });
    assert(usersList.status === 200, 'GET /api/users returns 200');
    const usersArray = usersList.data?.data?.users || usersList.data?.users || usersList.data;
    assert(Array.isArray(usersArray) && usersArray.length >= 5, 'GET /api/users returns list of users with profiles');

    // Get Student Profile
    const sProfile = await request(`/api/users/${studentUser.id}/profile`, {
      token: studentToken,
    });
    assert(sProfile.status === 200, 'GET /api/users/:id/profile returns student profile');
    const sData = sProfile.data?.data?.profile || sProfile.data?.profile || sProfile.data;
    assert(!!(sData?.academicProfile?.departmentCode || sData?.academicProfile?.departmentName), 'Student profile has academic/department details');

    // Get Alumni Profile
    const aProfile = await request(`/api/users/${alumniUser.id}/profile`, {
      token: studentToken,
    });
    assert(aProfile.status === 200, 'GET /api/users/:id/profile returns alumni profile');
    const aData = aProfile.data?.data?.profile || aProfile.data?.profile || aProfile.data;
    assert(!!(aData?.alumniProfile?.companyName || aData?.alumniProfile?.designation), 'Alumni profile has company and designation details');

    // Update Profile
    const updatedBio = `Updated bio by test suite at ${new Date().toISOString()}`;
    const updateRes = await request('/api/users/profile', {
      method: 'PUT',
      token: studentToken,
      body: {
        name: 'Aravind Kumar',
        bio: updatedBio,
        graduationYear: 2026,
        careerInterests: 'Backend Engineering, Cloud Systems',
        skills: [
          { name: 'Node.js', proficiency: 'ADVANCED' },
          { name: 'React', proficiency: 'INTERMEDIATE' },
          { name: 'Docker', proficiency: 'INTERMEDIATE' },
        ],
      },
    });
    assert(updateRes.status === 200, 'PUT /api/users/profile successfully updates bio and skills');

    // ─── 6. Metadata (Skills & Companies) ─────────────────────────────────────
    console.log('\n📌 Testing Metadata APIs...');
    const skillsRes = await request('/api/skills', {
      token: studentToken,
    });
    assert(skillsRes.status === 200, 'GET /api/skills returns 200');
    const skillsList = skillsRes.data?.data?.skills || skillsRes.data?.skills || skillsRes.data;
    assert(Array.isArray(skillsList) && skillsList.length >= 10, 'Skills list contains seeded skills');

    const compsRes = await request('/api/companies', {
      token: studentToken,
    });
    assert(compsRes.status === 200, 'GET /api/companies returns 200');
    const compsList = compsRes.data?.data?.companies || compsRes.data?.companies || compsRes.data;
    assert(Array.isArray(compsList) && compsList.length >= 5, 'Companies list contains seeded companies');

    // ─── 7. Connections & Networking Flow ─────────────────────────────────────
    console.log('\n📌 Testing Connections & Networking Flow...');
    const connectionsRes = await request('/api/connections', {
      token: studentToken,
    });
    assert(connectionsRes.status === 200, 'GET /api/connections returns 200');
    const activeConns = connectionsRes.data?.data?.connections || connectionsRes.data?.connections || [];
    assert(Array.isArray(activeConns) && activeConns.length >= 1, 'Student has seeded active connections');

    const incomingRes = await request('/api/connections/requests/incoming', {
      token: alumniToken,
    });
    assert(incomingRes.status === 200, 'GET /api/connections/requests/incoming returns 200');
    const incomingReqs = incomingRes.data?.data?.requests || incomingRes.data?.requests || [];
    assert(Array.isArray(incomingReqs), 'Incoming requests returned as array');

    // Log in as Sneha and Rohit to test dynamic connection request + acceptance
    const snehaLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'sneha.ramesh@ssn.edu.in', password: 'Password@123' },
    });
    const snehaToken = extractToken(snehaLogin.headers);
    const snehaId = snehaLogin.data?.data?.user?.id || snehaLogin.data?.user?.id;

    const rohitLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'rohit.sharma@ssn.edu.in', password: 'Password@123' },
    });
    const rohitToken = extractToken(rohitLogin.headers);

    // Rohit sends connection request to Sneha
    const sendReq = await request('/api/connections/request', {
      method: 'POST',
      token: rohitToken,
      body: { targetUserId: snehaId },
    });
    assert(sendReq.status === 201, 'POST /api/connections/request sends connection request (201)');
    const createdReqId = sendReq.data?.data?.request?.id || sendReq.data?.request?.id;

    // Sneha accepts the request
    if (createdReqId) {
      const acceptRes = await request(`/api/connections/requests/${createdReqId}/respond`, {
        method: 'POST',
        token: snehaToken,
        body: { action: 'ACCEPT' },
      });
      assert(acceptRes.status === 200, 'POST /api/connections/requests/:id/respond accepts request');

      // Sneha checks active connections
      const snehaConns = await request('/api/connections', {
        token: snehaToken,
      });
      const snehaList = snehaConns.data?.data?.connections || snehaConns.data?.connections || [];
      const rohitId = rohitLogin.data?.data?.user?.id || rohitLogin.data?.user?.id;
      const foundNew = snehaList.some((c) => c.user?.id === rohitId || c.id === rohitId);
      assert(foundNew, 'New connection appears in active connections list');

      // Clean up test connection
      await request(`/api/connections/${rohitId}`, {
        method: 'DELETE',
        token: snehaToken,
      });
    }

    // ─── 8. Notifications Flow ────────────────────────────────────────────────
    console.log('\n📌 Testing Notifications Flow...');
    const notifsRes = await request('/api/notifications', {
      token: studentToken,
    });
    assert(notifsRes.status === 200, 'GET /api/notifications returns 200');
    const notifsList = notifsRes.data?.data?.notifications || notifsRes.data?.notifications || [];
    assert(Array.isArray(notifsList), 'Notifications returned as array');

    const markAll = await request('/api/notifications/read-all', {
      method: 'PATCH',
      token: studentToken,
    });
    assert(markAll.status === 200, 'PATCH /api/notifications/read-all marks all notifications as read');

    // ─── 9. Chat & Messaging Flow (MongoDB) ───────────────────────────────────
    console.log('\n📌 Testing MongoDB Chat & Conversations Flow...');
    const convsRes = await request('/api/conversations', {
      token: studentToken,
    });
    assert(convsRes.status === 200, 'GET /api/conversations returns 200');
    const convs = convsRes.data?.data?.conversations || convsRes.data?.conversations || [];
    assert(Array.isArray(convs) && convs.length >= 1, 'Student has seeded active chat conversation');

    if (convs.length > 0) {
      const convId = convs[0].id || convs[0]._id;
      const msgsRes = await request(`/api/conversations/${convId}/messages`, {
        token: studentToken,
      });
      assert(msgsRes.status === 200, 'GET /api/conversations/:id/messages returns 200');
      const messagesList = msgsRes.data?.data?.messages || msgsRes.data?.messages || [];
      assert(Array.isArray(messagesList) && messagesList.length >= 2, 'Message history contains seeded messages');

      // Send new message
      const sendMsgRes = await request('/api/messages', {
        method: 'POST',
        token: studentToken,
        body: {
          conversationId: convId,
          content: 'Automated test message sent at ' + new Date().toISOString(),
        },
      });
      assert(sendMsgRes.status === 201, 'POST /api/messages sends chat message successfully (201)');
    }

    console.log('\n========================================');
    console.log(`🎉 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('========================================\n');
  } catch (err) {
    console.error('💥 Test suite encountered fatal error:', err);
    failedTests++;
  } finally {
    if (server) {
      server.close();
    }
    await disconnectMongoDB();
    await prisma.$disconnect();
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

run();
