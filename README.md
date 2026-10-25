# SeniorSOS 🎓🤝

> **A college-centric networking and mentorship platform connecting students with verified alumni.**  
> Think of it like LinkedIn, but exclusively built for our college campus community where seniors actually reply, guide, and mentor.

---

##  The Problem We Are Solving

As college students, we frequently run into questions like:
- *"Who from our college is currently working at Google or Amazon?"*
- *"I'm preparing for backend developer roles — which senior can review my resume or guide me?"*
- *"Can someone from our department introduce me to an engineer at this startup?"*

On global platforms like LinkedIn, reaching out to working professionals usually ends in cold messages that get ignored. College alumni groups on WhatsApp or Telegram are messy, unsearchable, and unverified.

**SeniorSOS** bridges this gap. It gives our college a trusted, private professional network where:
1. Students can easily discover seniors by **company, designation, department, graduation year, or tech stack**.
2. Alumni are **officially verified by college admins** before they can claim alumni status or mentor juniors.
3. Students and alumni can **connect 1-on-1, chat in real-time, ask for mentorship, and share career guidance** in a dedicated campus feed.

---

##  What Makes SeniorSOS Special?

- **Campus-First Trust:** Only people with verified college affiliations can join. Alumni must have their company credentials approved by an Admin.
- **Search & Discovery Hub:** Filter seniors by specific target companies (e.g., *Amazon*, *Zoho*), departments (*CSE*, *IT*, *ECE*), or skills (*React*, *Docker*, *Node.js*).
- **Structured Mentorship:** Students send formal mentorship inquiries with custom goals and notes. Seniors can accept, decline, or manage active mentees.
- **Real-Time 1-on-1 Chat:** Instant messaging powered by WebSockets (`Socket.IO`) with read receipts and room isolation.
- **Notification Center & Bell Badge:** Live notifications for new connection invites, accepted requests, and mentorship alerts.
- **Admin Control Center:** A dedicated dashboard for college administrators to approve/reject alumni applications and manage student account statuses.
- **Privacy & Visibility Controls:** Users can set their profiles to be visible across the whole college or restricted only to accepted connections.

---

## 🏗️ Architecture 

Rather than building a messy monolithic app or an overly complicated microservices setup that would slow down development, we built SeniorSOS as a **Modular Monolith**:

```text
[ Browser / User Interface ]
       │  React + Tailwind + Zustand (Vite)
       ▼
[ Express.js REST APIs & Socket.IO Real-Time Engine ]
       │  Organized cleanly into business modules (auth, users, community, messages)
       ├────────────────────────┬────────────────────────┐
       ▼                        ▼                        ▼
[ PostgreSQL + Prisma ]   [ MongoDB + Mongoose ]   [ Neo4j (Planned) ]
  ACID Transactions         Flexible Social Content  Graph Network
  - Users & Passwords       - Community Posts        - Mutual Connection Paths
  - Student Profiles        - Comments & Likes       - "How are you connected?"
  - Alumni Verifications    - Real-Time Chat Logs
  - Mentorship Records
```

### Why use two different databases?
We use a **Polyglot Persistence** approach because different features have completely different data needs:
1. **PostgreSQL (via Prisma ORM):** Handles critical structured data where correctness, foreign keys, and security matter most. If a student's role or an alumni's verification status changes, we need strict ACID guarantees.
2. **MongoDB (via Mongoose):** Handles dynamic social data. Feed posts, nested comments, and reactions change format often and have high read/write volume. MongoDB documents fit this naturally.

---

## 🛠️ Tech Stack Overview

### Frontend
- **React 18 (Single Page App):** Component-based, responsive user interface.
- **Vite:** Blazing-fast development server and production bundler.
- **Tailwind CSS:** Modern, clean UI styling without bulky UI libraries.
- **Zustand:** Lightweight global state management for user authentication and session caching.
- **Socket.io-Client:** Powers instant peer-to-peer real-time messaging.

### Backend
- **Node.js & Express.js:** Asynchronous, non-blocking REST API server.
- **Prisma ORM:** Type-safe database queries and declarative migrations for PostgreSQL.
- **Mongoose:** Object data modeling for MongoDB.
- **Socket.IO:** Full-duplex WebSocket server for live chat and notifications.
- **JSON Web Tokens (JWT) + httpOnly Cookies:** Secure authentication with short-lived access tokens and refresh token rotation.
- **bcryptjs & Zod:** Salted password hashing and runtime schema validation.

### Infrastructure & DevOps
- **Docker & Docker Compose:** Containerized local instances of PostgreSQL 16 and MongoDB 7.0 with health checks.
- **Bash Automation (`run.sh`):** Single-command script that handles environment creation, dependency checks, database readiness, schema migrations, and concurrent server launch.

---

##  How to Run the Project Locally

### Prerequisites
Make sure you have installed on your machine:
- **Node.js** (v18 or newer) & **npm**
- **Docker Desktop** (running in the background)
- **Git**

---

### Method 1: One-Click Startup (Recommended for Linux / Mac / WSL / Git Bash)

We wrote an automated startup script `run.sh` that checks dependencies, starts the Docker containers, runs database migrations, and boots both frontend and backend:

```bash
chmod +x run.sh
./run.sh
```

---

### Method 2: Manual Step-by-Step (Windows PowerShell / CMD)

#### Step 1: Clone the repository
```bash
git clone https://github.com/balahero03/Senior-SOS.git
cd Senior-SOS
```

#### Step 2: Start the databases via Docker
```bash
docker compose up -d
```
*(This starts PostgreSQL on port `5433` and MongoDB on port `27018` without conflicting with existing local ports).*

#### Step 3: Setup and run the Backend
```bash
cd backend

# Install packages
npm install

# Setup environment variables
cp .env.example .env

# Generate Prisma client and run migrations
npm run db:generate
npm run db:migrate

# (Optional) Seed initial departments and admin account
npm run db:seed

# Start backend server
npm run dev
```
Backend will be live at: `http://localhost:5000`

#### Step 4: Setup and run the Frontend
In a new terminal window:
```bash
cd frontend

# Install packages
npm install

# Start Vite dev server
npm run dev
```
Frontend will be live at: `http://localhost:5173`

---

### Method 3: Run on Kubernetes (local cluster)

Runs 2+ backend copies, 2+ frontend copies and Redis on Docker Desktop's Kubernetes,
using the same cloud databases as above (they are only connected to, never modified).
Enable *Settings > Kubernetes > Enable Kubernetes* in Docker Desktop once, then:

```powershell
.\k8s\deploy.ps1 -Build    # build the images and deploy
.\k8serify.ps1           # check it is healthy
# open http://localhost:8080
.\k8s	eardown.ps1         # stop it (cloud data untouched)
```

Details, safety notes and troubleshooting are in [`k8s/README.md`](k8s/README.md).

##  Testing & Quality Assurance

1. **Unit & Validation Tests:** Every registration, login, and profile update payload is validated using strict **Zod** schemas before hitting the database.
2. **API & Error Handling Tests:** Custom `AppError` class catches operational exceptions. Asynchronous controllers use `asyncHandler` to forward rejected Promises to a central Express error middleware.
3. **Automatic 401 Session Recovery:** Frontend Axios interceptor automatically detects expired access tokens, silently calls `/api/auth/refresh`, and retries failed requests without interrupting the user.
4. **Role-Based Route Guards:** Frontend `<ProtectedRoute requiredRole="ADMIN">` and backend `requireAdmin` middlewares block unauthorized students from viewing the verification queue or user controls.

---

##  Future Roadmap (Planned for Final Review & End-Sem Lab)

For our upcoming final semester practical demonstration, we plan to take the project to the next level:

### 1. The Tri-Database Graph Differentiator (Neo4j)
Right now, students can search for alumni. With **Neo4j**, SeniorSOS will answer the hardest networking question:
> *"How am I connected to this senior at Microsoft?"*
- Visualizing connection degrees (1st, 2nd, 3rd degree connections).
- Finding shortest introduction paths through mutual college friends.
- Intelligent mentor recommendations based on shared departments, clubs, and skills.

### 2. Local Kubernetes (K8s) Cluster Deployment
To demonstrate production-grade deployment skills, SeniorSOS runs on a local Kubernetes cluster (Docker Desktop):
- **Stateless Application Tier:** Implemented. The frontend (nginx) and backend run as K8s `Deployments` with health probes, rolling updates and rollbacks, a CPU-based autoscaler (backend 2 to 4 copies), and disruption budgets. See [`k8s/README.md`](k8s/README.md).
- **Data tier:** PostgreSQL (Neon), MongoDB (Atlas) and Neo4j (Aura) stay as external managed cloud databases, the usual production choice; the cluster only connects to them. Running them as `StatefulSets` with `PersistentVolumeClaims` remains an option for a fully self-hosted setup.
- **Redis Pub/Sub Scaling:** Implemented. Redis (optional, `REDIS_URL`) powers the Socket.IO adapter so multiple backend replicas can broadcast real-time messages to each other, plus presence, rate limiting and caching. See `project.md`.


