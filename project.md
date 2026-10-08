# SeniorSOS Project Brief

> Consolidated from the six project notes provided by the project owner. This document keeps the product concept, requirements, architecture, technology choices, UI sketches, implementation plans, example data, commands, and caveats together. Repeated ideas are organized once; where the notes propose different priorities, both proposals are recorded in the planning section instead of being silently merged.

## 1. Project identity

**Name:** SeniorSOS  
**Type:** College-centric professional networking, alumni connection, mentorship, career guidance, and referral platform.

### One-line definition

> SeniorSOS is a college-centric professional networking platform that connects students with verified alumni for mentorship, networking, career guidance, and job referrals.

### Short explanation

SeniorSOS is similar in spirit to LinkedIn + an alumni network + a mentorship and referral system, focused on one college community. Its purpose is to help a student find someone from their own college who can help them.

### Product positioning

SeniorSOS should feel like a focused career networking product, not a generic social-media website. The community feed supports the career purpose; it is not the primary purpose.

If asked how SeniorSOS differs from LinkedIn:

> LinkedIn is a global professional network, whereas SeniorSOS focuses on trusted, college-specific professional connections. It helps students discover alumni, understand how they are connected, request mentorship and referrals, and communicate with them within a verified academic community.

Do not describe the product's USP only in terms of Neo4j or Kubernetes; those are implementation choices, not the user problem being solved.

## 2. Problem and goals

### Problem

Students often need help with questions such as:

- How do I prepare for Amazon?
- Can someone refer me for an internship?
- Which company is hiring?
- I want to learn backend development. Who can guide me?
- Does anyone from our college work at Microsoft?
- Can you introduce me to someone at this company?

The college's alumni network may already include people who can help, but students often do not know who to contact, how they are connected, or whether those people are willing to help.

### Goals

- Make relevant students and alumni discoverable within their college network.
- Show professional background and relevant skills.
- Show mutual connections and paths through which a student can reach an alumnus.
- Support connection requests and professional chat.
- Support structured mentorship requests and relationships.
- Support referral requests and status tracking.
- Provide a trusted community through alumni verification, user management, moderation, and reporting.
- Give alumni a way to share career experience and opportunities.

## 3. Users and permissions

### Student

Typical journey:

```text
Create profile
  → Find alumni
  → Review professional background
  → See mutual connections
  → Send connection request
  → Chat after connection
  → Ask for mentorship or a referral
```

Students can maintain a profile, discover alumni by company/skills/department, connect, chat, request mentorship, submit referral requests, and participate in the community.

### Alumni

Typical journey:

```text
Create professional profile
  → Connect with students and alumni
  → Share career experience
  → Mentor students
  → Respond to referral requests
  → Chat with connections
```

Alumni can maintain professional information, build connections, publish posts, mentor students, and accept or reject mentorship and referral requests. Alumni verification is part of establishing trust.

### Admin

Admins manage the community by verifying alumni, managing users, moderating posts, handling reports, and monitoring the platform. Admin actions may include viewing, suspending, activating, or deleting accounts; approving/rejecting alumni verification; and dismissing/removing reported content or warning users.

## 4. Product concepts and core workflows

### 4.1 Student career journey example

Example: Bala wants an internship or job at Amazon.

1. Bala creates a profile, for example `Bala`, `B.Tech IT`, with skills `Java`, `React`, `Node.js`, and `MongoDB`.
2. He searches for `Amazon`.
3. SeniorSOS finds alumni at Amazon.
4. He sees a result such as `Arun Kumar — SDE @ Amazon — 4 mutual connections`.
5. He opens Arun's profile, which may show `SSN '22`, `Java`, `Spring Boot`, `AWS`, and actions `Connect`, `Request Mentorship`, `Request Referral`, and `Message`.
6. Bala sends a connection request.
7. Arun accepts it.
8. They can chat.
9. Bala finds an Amazon `SDE I` job and submits a referral request with job details.
10. Arun accepts and later updates the request to `REFERRED`; Bala receives the opportunity.

### 4.2 Smart networking and graph paths

Example network:

```text
Bala → Arun → Priya → Microsoft
```

SeniorSOS can explain: **“You can reach Priya through Arun.”** This is more useful than only showing Priya's employer. The graph should support queries such as:

- How is Bala connected to Priya?
- How many mutual connections do Bala and Priya have?
- What is the shortest path between two users?
- Which alumni work at a company and can be reached through the student's network?

Example path display:

```text
How are you connected to Priya?
Bala → Arun Kumar → Priya Sharma
2 degrees of connection
```

Example mutual-connection card:

```text
Priya
Software Engineer @ Microsoft
3 mutual connections
You both know: Arun, Karthik, Divya
[Connect] [Message]
```

### 4.3 Search and discovery

Search is limited to the academic network, not the entire internet. Example search: `Java Backend`.

```text
Java Backend
12 alumni found

Arun Kumar
Software Engineer @ Amazon
Java · Spring Boot · AWS
4 mutual connections
[View Profile] [Connect]
```

Discovery can search by name, skill, company, and other profile information, with filters for role, department, company, and skills.

### 4.4 Mentorship

A student may request help with `Backend Development`, `System Design`, and `Placement Preparation`. Mentor recommendations can consider:

- Relevant skills
- Relevant experience
- Same college
- Compatible interests
- Mutual connections

The student requests mentorship; the alumnus can accept or reject. If accepted, SeniorSOS records the mentor/mentee relationship and can provide chat and scheduling actions.

Example focus areas include Java, Backend, System Design, Placement Preparation, Frontend Development, Career Guidance, Higher Studies, and Entrepreneurship. Preferred industry can be selected (example: Software). Preferred frequency can be one-time, weekly, or monthly.

### 4.5 Referral workflow

The student selects an alumnus and submits company, position, job URL, reason for interest, additional message, and resume. The alumnus sees the request and can accept or reject it.

Canonical lifecycle shown in the notes:

```text
PENDING → ACCEPTED → REFERRED → INTERVIEW → COMPLETED
```

The referral detail page can include the requested company and role, recipient alumnus, request date, status timeline, messages, documents, and notes.

### 4.6 Chat and presence

After two people connect, they can chat. Example:

```text
Bala: Hi Arun, I'm preparing for backend roles. Could you suggest what I should focus on?
Arun: Sure. Start with Java, Spring Boot, SQL and basic system design.
```

Realtime capabilities listed in the notes:

- Online/offline status
- Typing indicator
- One-to-one chat
- Notifications
- Group chat (later)
- Read status
- Attachments (later)
- Group conversations (later)

### 4.7 Community feed

Alumni can share career updates, advice, or job opportunities. Example post: an alumnus announces joining Microsoft and offers help to college students preparing for interviews. Users can like, comment, share, and report posts. The community feed is a supporting career feature.

## 5. Functional requirements

### Authentication and account

- Register, log in, log out, retrieve current user (`/me`), and protect authenticated routes.
- Registration fields: full name, college email, password, confirm password, student/alumni choice, department, graduation year.
- Alumni can later provide company, designation, graduation year, and verification evidence.
- Forgot password and reset password using a token.
- Password hashing with bcrypt.
- JWT authentication using secure httpOnly cookies; use short-lived access token and longer-lived refresh token rather than a long-lived token in `localStorage`.
- Account settings include email, phone, college, and department.
- Security settings include change password, active sessions, and logout all devices.

Initial API endpoints:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Profiles

- Personal and professional information.
- Education, college, department, graduation year.
- Bio, skills, company, designation, experience, career interests, and mentorship preferences.
- Editable self-profile and public profile view.
- Profile completion/strength indicator (example: 80%).
- The initial example User model has `name`, `email`, `password`, `role` (`student`, `alumni`, `admin`, default `student`), and profile fields `bio`, `department`, `graduationYear`, `company`, `designation`, and `skills`; timestamps are enabled.

### Connections and networking

- Send, accept, and reject connection requests.
- View current network, incoming requests, sent requests, and suggestions.
- Show mutual connections, degrees of connection, and shortest paths.
- Suggestions can be based on mutual connections, department, company, and skills.
- Later calculate connection strength using common connections, interaction frequency, same college, same department, same company, and messages.

### Mentorship

- Discover mentors by focus areas and preferred industry.
- Submit mentorship request with focus area, need/help description, goals, and preferred frequency.
- Accept/reject requests and view My Mentors/My Mentees.
- Show focus areas, profile, and chat action.

### Referrals

- Student creates referral request with company, position, job URL, why interested, additional message, resume, and selected alumnus.
- Alumnus accepts/rejects.
- Track `PENDING`, `ACCEPTED`, `REFERRED`, `INTERVIEW`, and `COMPLETED` states.
- Detail page includes messages, documents, notes, date, and a status timeline.

### Community content

- Create posts with text, optional image/document/link, and visibility set to `College` or `Connections`.
- List feed posts, open post detail, like/react, comment, share, and report.
- Example UI shows likes and comments counts.

### Notifications

- Notification types: `Connection`, `Message`, `Referral`, `Mentorship`, `Post`, `System`.
- Examples: connection accepted, referral received, comment on post, new connection.
- Notification preferences can be toggled for connection requests, messages, mentorship requests, referral updates, and community activity.
- Support realtime notification delivery as the realtime stack is introduced.

### Search

- Discover/search people by name, skill, company, and profile details.
- Later global search can include people, companies, posts, and skills.

### Privacy and settings

- Profile visibility options: everyone in college or connections only.
- Settings sections: Account, Security, Privacy, Notifications, Preferences.

### Administration and trust

- Admin overview statistics (illustrative only): Users 2,481; Alumni 1,204; Students 1,277; Pending 23; Reports 7.
- User management table with name, role, status, and actions.
- User actions: view, suspend, activate, delete.
- Alumni verification queue: view graduation, department, company, documents; approve/reject; approved users receive a verified-alumni indicator.
- Content moderation: review reported post, report reason, reporter; view, dismiss, remove, warn user.
- Report categories: user, content, referral, mentorship.
- Optional audit log of admin actions, e.g. alumni verified, post removed, user suspended.

## 6. Frontend information architecture and routes

### Public routes

```text
/
/login
/register
/forgot-password
/reset-password/:token
```

Landing page content:

- Header with SeniorSOS, Login, Register.
- Headline: “Your College Network. Your Career Advantage.”
- Copy: connect with seniors and alumni, find mentors, get referrals, build a professional network.
- Actions: Get Started, Explore Network.
- “How SeniorSOS Works”: Discover → Connect → Learn → Grow.
- Value propositions: Verified Alumni | Mentorship | Referrals.

### Main application routes

```text
/dashboard
/discover
/search
/profile
/profile/:userId
/network
/network/graph
/messages
/referrals
/referrals/new
/referrals/:id
/mentorship
/mentorship/discover
/mentorship/request/:userId
/community
/community/create
/community/post/:id
/notifications
/settings
```

### Admin routes

```text
/admin
/admin/users
/admin/verification
/admin/moderation
/admin/reports
/admin/audit-logs
```

### Page-level UI requirements

#### Dashboard `/dashboard`

- Main home page after login; personalize based on role.
- Header with brand, search, notification icon, and profile.
- Navigation to Dashboard, Discover, Network, Messages, Referrals, Mentorship, Community.
- Greeting (example: “Good morning, Bala”).
- Profile completion card/progress bar (example: 80%).
- Recommended alumni cards (example names Arun, Priya, Karthik).
- Pending requests and upcoming mentorship.
- Main-screen concept also includes search prompt “Search alumni, companies, skills…”, recommended alumni at Amazon/Google/TCS in backend/SDE/manager roles, and network counts such as 42 Connections and 8 Mutual Connections.

#### Discover `/discover`

- “Find people who can help you grow.”
- Search by name, skill, company.
- Filters: role (student/alumni), department (examples IT, CSE, ECE), company (examples Amazon, Microsoft, Google), skills (examples Java, React, Python, AWS).
- Result cards show name, role/employer, skills, mutual count, View Profile, and Connect.
- Basic user/profile information is associated with PostgreSQL and graph/mutual information with Neo4j in the frontend planning notes.

#### Public profile `/profile/:userId`

- Header with name, job title/company, college/degree/year.
- Actions: Connect, Message, Request Referral; mentorship action also appears in the student journey.
- Sections: About, Experience, Skills, Education, Network.
- Network section shows mutual count and View Connection Path.
- Example: Arun Kumar; Software Engineer @ Amazon; SSN • B.Tech IT • 2024; skills Java, Spring Boot, AWS, SQL; 12 mutual connections.

#### Own profile `/profile`

- Editable personal information, professional information, education, skills, experience, career interests, and mentorship preferences.
- Profile-strength indicator and Edit Profile action.

#### Network `/network`

- Tabs: My Network, Requests, Sent, Suggestions.
- My Network shows a connection count (example 124) and people list.
- Requests show Accept/Reject actions.
- Suggestions explain why a person is suggested: mutual connections, department, company, skills.

#### Graph `/network/graph`

- Signature page that visually displays a user network.
- Actions/queries: Mutual Connections, Shortest Connection Path, Companies, Departments.
- Example graph includes Bala, Priya, Arun, Karthik, and Rahul.

#### Messages `/messages`

- Two-panel layout: conversations list and selected conversation.
- Show online status, messages, composer/send button.
- Features: realtime messages, online status, typing indicator, read status; attachments and group conversations later.

#### Referrals `/referrals`

- Tabs: My Requests, Received Requests.
- Cards show company, role, alumnus, status, and View Details.
- Referral creation fields and referral details/status timeline as listed above.

#### Mentorship `/mentorship`

- Two sections: My Mentors and My Mentees.
- Mentor card shows name, company/title, focus areas, Chat, View Profile.

#### Mentor discovery `/mentorship/discover`

- Areas: Placement, Backend Development, Frontend Development, System Design, Career Guidance, Higher Studies, Entrepreneurship.
- Preferred industry selector (example Software).
- Recommended mentor card shows employer, skills, years of experience, mutual count, Request Mentorship.

#### Mentorship request `/mentorship/request/:userId`

- Mentor, requested area, help needed, goals, preferred frequency (one-time/weekly/monthly), Send Request.

#### Community `/community`

- Feed composer and posts; examples include Arun at Amazon and Priya at Microsoft.
- Actions: create post, like, comment, share, report.

#### Create post `/community/create`

- Text composer, image/document/link attachments, visibility (College/Connections), Publish.

#### Post detail `/community/post/:id`

- Author and role, post content, like/comment counts, comment composer.

#### Notifications `/notifications`

- Group notifications by Today/Yesterday and show relative times (examples 5 min ago, 20 min ago, 1 hour ago).

#### Settings `/settings`

- Sections: Account, Security, Privacy, Notifications, Preferences.
- Account: Email, Phone, College, Department.
- Security: Change Password, Active Sessions, Logout All Devices.
- Privacy: Everyone in college or Connections only.
- Notification switches: Connection Requests ON, Messages ON, Mentorship Requests ON, Referral Updates ON, Community Activity OFF (illustrative defaults).

#### Admin pages

- Admin dashboard with summary counts; charts/statistics can come later.
- User list with search and View/Suspend/Activate/Delete actions.
- Alumni verification detail with graduation, department, company, documents, Approve/Reject, verified state.
- Moderation queue includes report reason and reporter with View/Dismiss/Remove/Warn User.
- Reports page groups User Reports, Content Reports, Referral Reports, Mentorship Reports.
- Optional audit logs list admin identity/action/target.

## 7. Product scope: MVP and advanced

The notes distinguish the eventual full product from a first release. The explicit MVP list is:

1. Login
2. Register
3. Dashboard
4. Profile
5. Discover
6. Profile by user ID
7. Network
8. Messages
9. Referrals
10. Community
11. Notifications
12. Settings

Advanced list:

13. Network Graph
14. Mentorship
15. Mentor Discovery
16. Referral Tracking
17. Global Search
18. Admin Dashboard
19. Alumni Verification
20. Content Moderation
21. Audit Logs

Note: mentorship/referral workflows and admin capabilities are described in detail as core product concepts elsewhere, while the later route plan labels some of them advanced. Treat sequencing as a project planning decision, not a change to the feature definitions.

Core journey:

```text
REGISTER → PROFILE → DISCOVER ALUMNI → VIEW PROFILE → SEE MUTUAL CONNECTIONS
→ CONNECT → CHAT → MENTORSHIP / REFERRAL → CAREER OPPORTUNITY
```

## 8. Architecture

### Architecture style: modular monolith

SeniorSOS has multiple business domains but initially uses one deployable Node.js/Express backend organized into modules. This gives separation in code without the operational overhead of multiple microservices.

Modules/domains:

```text
Authentication, Profiles/Users, Posts/Content, Networking, Mentorship,
Referrals, Chat, Notifications, Administration
```

Suggested backend module structure:

```text
backend/
├── modules/
│   ├── auth/
│   │   ├── controller.js
│   │   ├── service.js
│   │   ├── routes.js
│   │   └── repository.js
│   ├── users/
│   ├── posts/
│   ├── networking/
│   ├── mentorship/
│   ├── referrals/
│   └── chat/
├── infrastructure/
│   ├── postgres/
│   ├── mongodb/
│   ├── neo4j/
│   └── redis/
└── app.js
```

Another suggested high-level repo layout is included in the implementation plans below (`client/server`, or `frontend/backend` depending on the note). The final folder names are not yet fixed.

### Why not begin with microservices

The project examples assume a small student team (example: 3 developers), one application, one primary backend language, one repository, moderate traffic, and an academic/demo deployment. Microservices would add service discovery, networking, service-to-service authentication, distributed debugging, deployments, logging, health checks, configuration, and inter-service communication before those costs are justified.

A referral operation can create a request, update status, and create a notification. Keeping related business behavior in a modular monolith makes the transaction and workflow easier to reason about.

The design does not prevent later decomposition: identify a real bottleneck, then extract a module such as Chat into a service incrementally. Kubernetes does not require microservices; it can run one backend Deployment with several replicas, each containing all modules.

### Logical module-to-storage mapping

| Module/data | Main storage |
|---|---|
| Authentication, identity, roles, structured user/profile data | PostgreSQL in the final stack; the first implementation note uses MongoDB for the initial User/auth vertical slice |
| Posts, comments, reactions, feed, flexible content/activity | MongoDB |
| Connections, mutual connections, paths, professional network | Neo4j |
| Referrals, mentorship requests, notifications, audit logs | PostgreSQL |
| Chat/presence/realtime cross-replica coordination | Socket.io with Redis for presence/Pub/Sub; MongoDB may store messages if durable message history is required |
| Cache and rate limiting | Redis |

The earlier product explanation contains a rough “where technology fits” table saying MongoDB can hold users, profiles, posts, and referral data. Later architecture notes make PostgreSQL the authoritative owner of structured users and referrals, MongoDB the content store, and Neo4j the graph store. The latter is the final stack's explicit logical ownership; the initial MongoDB-only foundation is a staged prototype plan.

## 9. Data architecture and ownership

### PostgreSQL — transactional system of record

Use for data requiring relational integrity, transactions, constraints, and consistency:

```text
users
roles
student_profiles
alumni_profiles
referral_requests
mentorship_requests
notifications
audit_logs
```

Example `User` fields: id, name, email, password hash, role, created_at. Example `ReferralRequest`: id, student_id, alumni_id, company, job_title, job_url, status, created_at.

Benefits cited: foreign keys, transactions, constraints, indexes, ACID consistency, SQL queries. Prisma is the planned access layer.

### MongoDB — flexible social/content data

Use for:

```text
posts
comments
reactions
feed items
user activity
profile extensions / flexible content
```

Example post document:

```json
{
  "authorId": "123",
  "content": "Happy to announce...",
  "media": [],
  "tags": ["career", "amazon"],
  "reactions": { "likes": 34, "helpful": 12 },
  "createdAt": "..."
}
```

Use Mongoose. A flexible document structure can accommodate different post metadata. Chat messages/activity were listed as possible MongoDB data only if those capabilities are needed; message persistence is not fully settled.

### Neo4j — relationship intelligence

Keep the graph for relationships and network traversal, not as a second complete profile database.

Possible nodes:

```text
(:User)
(:Company)
(:College)
```

Possible relationships:

```text
(:User)-[:CONNECTED_TO]->(:User)
(:User)-[:MENTORS]->(:User)
(:User)-[:WORKS_AT]->(:Company)
(:User)-[:STUDIED_AT]->(:College)
```

Use Neo4j JavaScript Driver and Cypher. Query examples include mutual connections and shortest connection paths.

### Redis — infrastructure layer, not a fourth primary database

Planned uses:

- Cache/session-related data
- Online/offline presence
- Rate limiting
- Socket.io Pub/Sub across backend replicas

Cross-replica example: Bala is connected to Backend A and Arun to Backend B; Bala sends a message; Redis Pub/Sub distributes the event to Backend B so Arun receives it. Redis makes Socket.io events work across multiple backend replicas.

### One shared identity

Avoid maintaining three independent complete copies of every user.

- PostgreSQL owns authoritative identity: e.g. User ID `123`, Bala, email, role.
- MongoDB content documents refer to `authorId: 123`.
- Neo4j graph nodes use `(:User {userId: 123})`.

Use one logical identity across specialized stores.

## 10. Technology stack

| Layer | Technology | Purpose / notes |
|---|---|---|
| Frontend | React + Vite | Web application; fast development, components, REST and WebSocket ecosystem |
| UI | Tailwind CSS | Responsive dashboard, cards, forms, profile, chat, admin UI |
| State management | Zustand | Auth user, notifications, connection/chat/UI state; selected instead of Redux to avoid unnecessary boilerplate |
| Routing | React Router | Frontend navigation |
| HTTP client | Axios | REST API communication |
| Realtime client | Socket.io Client | Chat, presence, notifications |
| Backend | Node.js + Express.js | REST API and application logic; modular monolith |
| Realtime server | Socket.io | WebSocket/realtime communication |
| Authentication | JWT + httpOnly cookies | Secure session/auth pattern; access and refresh tokens |
| Password security | bcrypt | Password hashing |
| SQL database | PostgreSQL | Structured/transactional data |
| SQL ORM | Prisma | PostgreSQL access |
| NoSQL database | MongoDB | Flexible posts/comments/content |
| MongoDB ODM | Mongoose | MongoDB data modeling |
| Graph database | Neo4j | Connections and network intelligence |
| Graph driver | Neo4j JavaScript Driver | Cypher queries |
| Cache/Pub/Sub | Redis | Cache, presence, rate limiting, Socket.io scaling |
| Containers | Docker | Package application and services |
| Local Kubernetes | Kind | Local development/demo cluster; Minikube is also mentioned as a viable alternative, with Kind preferred if learning Kubernetes itself is the goal |
| Orchestration | Kubernetes | Deployment, scaling, service discovery |
| Ingress | NGINX Ingress | External HTTP routing |
| Persistent storage | Kubernetes PVC | Persistent database data |
| Kubernetes configuration | ConfigMap + Secret | Non-sensitive config and secrets |
| Testing | Jest + Supertest | Backend/API tests |
| Manual API testing | Postman | Development/API testing |
| Version control | Git + GitHub | Source control |
| CI/CD | GitHub Actions | Build/test/deployment workflow; stretch goal |
| Monitoring | Prometheus + Grafana | Optional metrics and monitoring |

Explicitly not planned initially: Kafka, RabbitMQ, Elasticsearch, microservices, and a service mesh because the notes do not identify a sufficiently important current problem for them to solve.

## 11. Docker and Kubernetes plan

### Docker Compose development environment

Eventually run:

```text
frontend
backend
postgres
mongodb
neo4j
redis
```

Team members should eventually be able to start the complete local environment with:

```bash
docker compose up -d
```

An earlier MongoDB-only starter compose example:

```yaml
services:
  mongodb:
    image: mongo:8
    container_name: seniorsos-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

### Kubernetes topology

For the local project/demo, the notes propose running frontend, backend, PostgreSQL, MongoDB, Neo4j, and later Redis in Kubernetes. Ingress routes browser traffic to frontend and `/api` to backend. A backend Service can route to multiple backend replicas; databases use persistent volumes.

```text
Browser → Ingress → Frontend Service
                  → Backend Service → Backend replicas
                                      → PostgreSQL
                                      → MongoDB
                                      → Neo4j
                                      → Redis (later)
```

Possible resources:

| Component | Kubernetes resources |
|---|---|
| Frontend | Deployment, Service |
| Backend | Deployment, Service, ConfigMap, Secret |
| PostgreSQL | StatefulSet, Service, PVC, Secret |
| MongoDB | StatefulSet, Service, PVC |
| Neo4j | StatefulSet, Service, PVC |
| Redis (later) | Deployment or StatefulSet, Service |
| External routing | NGINX Ingress and Ingress resource |
| General | Namespace, ConfigMaps, Secrets |

Deployments are for stateless frontend/backend (and Redis may be deployed as a Deployment in the initial outline). Databases are stateful and need persistent storage: pods may be recreated, but data must survive. The notes recommend StatefulSet + persistent volume for databases.

ConfigMap examples: `NODE_ENV`, `PORT`, database hostnames. Secret examples: database password, `JWT_SECRET`, Neo4j password. PVCs preserve PostgreSQL, MongoDB, and Neo4j data.

Within Kubernetes, use service DNS names (`postgres`, `mongodb`, `neo4j`, `redis`, `backend`), not `localhost`, for service-to-service connections. Example backend config:

```env
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
MONGO_HOST=mongodb
MONGO_PORT=27017
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
```

### Local cluster and deployment demonstration

Kind is recommended for local Kubernetes learning/demo; Minikube is also named. No cloud bill is required for a local cluster. Example commands:

```bash
kind create cluster --name seniorsos
kubectl get nodes
```

Expected node example: `seniorsos-control-plane Ready`.

Scale demonstration:

```bash
kubectl scale deployment seniorsos-backend --replicas=3
```

Then demonstrate two users connected to different backend pods still exchanging Socket.io events through Redis Pub/Sub.

### Kubernetes scope guard

Do not start with every advanced infrastructure component at once. The notes explicitly caution against beginning with Kubernetes, Redis, chat, Neo4j, multiple replicas, Ingress, TLS, HPA, Prometheus, Grafana, Kafka, and everything else in one step. Add capabilities incrementally and make each component serve a demonstrated need.

### Development vs production

For a college project/demo, running PostgreSQL, MongoDB, Neo4j, and Redis in Kubernetes is considered a reasonable learning environment. For serious production, the notes generally prefer managed PostgreSQL, MongoDB, hosted Neo4j, and managed Redis, while application services run in Kubernetes. Self-operating databases adds backups, replication, upgrades, persistent storage, recovery, monitoring, security, and failover responsibilities.

## 12. Suggested repository layouts

The notes provide two alternatives; exact names are not finalized.

### Monorepo starter layout (implementation note)

```text
senior-sos/
├── client/                 # React application
├── server/                 # Node + Express application
├── docker/
├── k8s/
├── docs/
│   ├── architecture/
│   ├── api/
│   └── database/
├── docker-compose.yml
├── .gitignore
└── README.md
```

### Kubernetes-oriented layout (architecture note)

```text
SeniorSOS/
├── frontend/
├── backend/
├── docker/
├── k8s/
│   ├── namespace.yaml
│   ├── frontend/            # deployment.yaml, service.yaml
│   ├── backend/             # deployment.yaml, service.yaml, configmap.yaml, secret.yaml
│   ├── postgres/            # statefulset.yaml, service.yaml, pvc.yaml
│   ├── mongodb/             # statefulset.yaml, service.yaml, pvc.yaml
│   ├── neo4j/               # statefulset.yaml, service.yaml, pvc.yaml
│   ├── redis/               # deployment.yaml, service.yaml
│   └── ingress.yaml
├── docs/
└── docker-compose.yml
```

### Initial React client tree

```text
client/
├── src/
│   ├── components/
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Dashboard.jsx
│   │   └── Profile.jsx
│   ├── services/api.js
│   ├── store/authStore.js
│   ├── hooks/
│   ├── App.jsx
│   └── main.jsx
└── package.json
```

### Initial Express server tree

```text
server/
├── src/
│   ├── config/db.js
│   ├── models/User.js
│   ├── controllers/authController.js
│   ├── routes/authRoutes.js
│   ├── routes/userRoutes.js
│   ├── middleware/authMiddleware.js
│   ├── services/
│   ├── app.js
│   └── server.js
├── .env
└── package.json
```

## 13. Implementation roadmap and differing proposals

The source notes contain two different sequencing recommendations. They are recorded separately because one is feature-first and the other is deployment-first; the project owner should choose the execution order based on project constraints.

### Plan A — Working application vertical slice first

The explicit first milestone in the implementation note is:

> A user can register → log in → receive a JWT → access their profile → data is stored in MongoDB.

Initial foundation:

1. Create monorepo and Git branches.
2. Create React/Vite client and Express server.
3. Start only MongoDB through Docker Compose.
4. Connect Express to MongoDB with Mongoose.
5. Create the initial User model.
6. Implement register/login/logout/me, bcrypt password hash, JWT, secure cookie, auth middleware.
7. Build Register, Login, Dashboard, Profile; view/edit profile and verify persistence after page refresh.
8. Add Neo4j for connection requests, accepted connections, mutuals, shortest path; later connection strength.
9. Add Socket.io after REST APIs work: online/offline, typing, one-to-one chat, notifications, group chat later.
10. Add Redis for presence and cross-replica Pub/Sub.
11. Dockerize all services.
12. Add Kubernetes last, then multiple backend replicas and cross-pod realtime demonstration.

### Plan B — Deployment skeleton first

The Kubernetes database note instead proposes beginning with the deployment foundation:

1. Check/install `kubectl`, Docker, and Kind (or Minikube).
2. Create a local cluster (`kind create cluster --name seniorsos`) and check nodes.
3. Deploy PostgreSQL and verify it.
4. Deploy MongoDB and test backend connectivity.
5. Deploy Neo4j and execute a simple Cypher create/match query.
6. Verify all three databases use persistent storage.
7. Deploy a tiny Node backend connected to all three databases; commit an initial Kubernetes infrastructure milestone.
8. Deploy frontend and Ingress.
9. Add Redis when realtime needs it.
10. Scale backend replicas and demonstrate Redis Pub/Sub across pods.

### Plan C — First three days (from the implementation note)

**Day 1 — Foundation**

```text
[ ] Create Git repository
[ ] Create client
[ ] Create server
[ ] Create docker-compose
[ ] Start MongoDB
[ ] Connect Express → MongoDB
[ ] Create User model
[ ] Test API with Postman
```

**Day 2 — Authentication**

```text
[ ] Register
[ ] Login
[ ] Password hashing
[ ] JWT
[ ] Refresh token
[ ] httpOnly cookie
[ ] Auth middleware
[ ] /me endpoint
```

**Day 3 — Profile**

```text
[ ] Profile page
[ ] Get profile
[ ] Edit profile
[ ] Skills
[ ] Department
[ ] Graduation year
[ ] Company
[ ] Student/Alumni role
```

Example commit from the notes:

```bash
git add .
git commit -m "feat: implement authentication and user profiles"
git push origin dev
```

### Suggested starter commands (from the notes)

```bash
mkdir senior-sos
cd senior-sos
mkdir client server docker k8s docs
mkdir -p docs/architecture docs/api docs/database
git init
git branch -M main
git checkout -b dev
```

Frontend:

```bash
npm create vite@latest client -- --template react
cd client
npm install
npm install axios react-router-dom
npm install zustand
npm install socket.io-client
```

Backend:

```bash
cd senior-sos/server
npm init -y
npm install express mongoose cors dotenv bcrypt jsonwebtoken cookie-parser
npm install -D nodemon
```

Tailwind can be added after the basic application is running; do not spend the first day on UI polish. The initial application page set is Login, Register, Dashboard, Profile.

Example local MongoDB environment for the first slice:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/senior_sos
JWT_SECRET=change_this_later
JWT_EXPIRES_IN=15m
```

Example Mongoose connect function from the note:

```javascript
const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected");
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
};

module.exports = connectDB;
```

### First-team-work guidance

The notes advise inspecting the existing team repository before coding from the planned architecture:

```text
What already exists?
What is partially implemented?
What is broken?
What has already been assigned?
What exactly will you own?
```

The architecture is a plan; the actual repository may already differ. Suggested inspection commands:

```bash
git clone <repo-url>
cd SeniorSOS
tree -L 2
```

## 14. Testing, delivery, and operations

### Testing

- Jest + Supertest for backend/API tests.
- Example endpoints to cover: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/users/me`, `POST /api/referrals`.
- Postman for manual API development/testing.
- Testing appears in the chosen stack; implement it as features are built.

### CI/CD (stretch goal)

Proposed GitHub Actions flow:

```text
Developer → git push → GitHub Actions
  → npm install
  → lint
  → tests
  → Docker build
  → push image
  → eventually deploy through registry to Kubernetes
```

CI/CD should not delay core application implementation.

### Monitoring (optional/advanced)

Prometheus collects metrics and Grafana visualizes them. Possible demo metrics: backend replicas, CPU usage, memory usage, request count, response time, and pod health.

## 15. Architecture diagrams in one place

### Application and data stores

```text
React + Vite (Tailwind, Zustand, React Router, Axios, Socket.io Client)
                         │ REST / Socket.io
                         ▼
           Node.js + Express modular monolith
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        PostgreSQL     MongoDB      Neo4j
        Prisma         Mongoose     Neo4j Driver
        system data    content      network graph
              └──────────┼──────────┘
                         ▼
                   Redis (later)
            cache, presence, Pub/Sub, limits
```

### Kubernetes deployment

```text
Browser
  ↓
NGINX Ingress
  ├── /       → Frontend Service → Frontend Deployment
  └── /api    → Backend Service  → Backend Deployment (1+ replicas)
                                      ├── PostgreSQL StatefulSet + PVC
                                      ├── MongoDB StatefulSet + PVC
                                      ├── Neo4j StatefulSet + PVC
                                      └── Redis Service (when added)
```

## 16. Open decisions and inconsistencies to resolve

These points differ across the supplied notes or remain intentionally conditional:

1. **First build order:** one note says build the user/auth/profile vertical slice and add Kubernetes last; another says establish Kubernetes and all three databases first. Choose one execution plan. The notes do not resolve this conflict.
2. **Initial vs final database ownership:** the initial auth milestone stores users in MongoDB. The final stack says PostgreSQL owns users/auth/roles and MongoDB owns flexible content. Treat MongoDB auth as a starter slice or migrate the model when the final stack is adopted; the migration plan is not specified.
3. **Folder naming:** `client/server` and `frontend/backend` are both proposed; choose one canonical layout.
4. **Message persistence:** MongoDB is suggested for messages only if needed, while Redis is designated for presence/Pub/Sub. Durable chat-history ownership needs a decision.
5. **Mentorship and referrals scope:** described as central product workflows but categorized partly as advanced in the MVP plan. Set release priorities.
6. **Deployment scope:** local Kind/Minikube demo is specified; no cloud provider, production host, or hosting budget is defined.
7. **Profile/data ownership across stores:** PostgreSQL is the system of record in the final stack, with MongoDB and Neo4j referencing one user ID. Exact sync/event/error-recovery mechanics are not specified.
8. **Identity/verification policy:** college email is requested for registration and alumni verification is required, but exact verification evidence, approval rules, and student validation are not defined.
9. **Privacy/access details:** profile visibility choices are given, but exact authorization behavior for messages, posts, referrals, and graph traversal needs implementation decisions.
10. **Status/API details:** referral states are listed; precise allowed transitions, rejection states, and permissions are not fully specified.

## 17. Project principles captured from the notes

- Keep the core user outcome clear: “I need someone from my college who can help me.”
- Build an understandable product journey rather than leading with technology names.
- Use a modular monolith initially; keep business modules cleanly separated.
- Use each database for a distinct data problem and maintain one logical user identity.
- Make Neo4j earn its place through mutual connections and shortest paths.
- Add Socket.io after normal REST request/response flows work.
- Add Redis when realtime state must work across backend replicas or when cache/rate limiting is needed.
- Add infrastructure incrementally; avoid building a debugging festival by starting with every component at once.
- Functionality comes before UI polish in the first vertical slice.
- Inspect the existing team repository and ownership before duplicating work.
- Keep advanced additions such as CI/CD, monitoring, group chat, connection-strength scoring, and global search from delaying the core application.
