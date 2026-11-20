# SeniorSOS 🎓🤝

> **A college-centric networking and mentorship platform connecting students with verified alumni.**  
> Think of it like LinkedIn, but exclusively built for our college campus community where seniors actually reply, guide, and mentor.

---

## The Problem We Are Solving

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

## What Makes SeniorSOS Special?

- **Campus-First Trust:** Only people with verified college affiliations can join. Alumni must have their company credentials approved by an Admin.
- **Search & Discovery Hub:** Filter seniors by specific target companies (e.g., *Amazon*, *Zoho*), departments (*CSE*, *IT*, *ECE*), or skills (*React*, *Docker*, *Node.js*).
- **Structured Mentorship:** Students send formal mentorship inquiries with custom goals and notes. Seniors can accept, decline, or manage active mentees.
- **Real-Time 1-on-1 Chat:** Instant messaging powered by WebSockets (`Socket.IO`) with read receipts and room isolation.
- **Notification Center & Bell Badge:** Live notifications for new connection invites, accepted requests, and mentorship alerts.
- **Admin Control Center:** A dedicated dashboard for college administrators to approve/reject alumni applications and manage student account statuses.
- **Privacy & Visibility Controls:** Users can set their profiles to be visible across the whole college or restricted only to accepted connections.
- **Graph-Based Alumni & Peer Recommendations:** Neo4j models relationships within the college network and powers recommendations to help students discover relevant alumni and peers.

---

## 🏗️ Architecture

Rather than building a messy monolithic app or an overly complicated microservices setup that would slow down development, we built SeniorSOS as a **Modular Monolith** with a polyglot persistence architecture:

```text
[ Browser / User Interface ]
       │ React + Tailwind + Zustand (Vite)
       ▼
[ Express.js REST APIs & Socket.IO Real-Time Engine ]
       │
       ├──────────────────────┬──────────────────────┬──────────────────────┐
       ▼                      ▼                      ▼
[ PostgreSQL + Prisma ] [ MongoDB + Mongoose ] [ Neo4j ]
 ACID Transactions       Flexible Social Content   Graph Relationships
 - Users & Passwords     - Community Posts         - Alumni Recommendations
 - Student Profiles      - Comments & Likes        - Peer Recommendations
 - Alumni Verifications  - Real-Time Chat Logs
 - Mentorship Records
```

### Why use three different databases?

We use a **Polyglot Persistence** approach because different features have completely different data needs:

1. **PostgreSQL (via Prisma ORM):** Handles critical structured data where correctness, foreign keys, and security matter most. Student accounts, alumni verification status, and mentorship records require reliable relational data management and ACID guarantees.

2. **MongoDB (via Mongoose):** Handles dynamic social data such as community posts, nested comments, reactions, and real-time chat logs. Its document-oriented structure supports flexible content models.

3. **Neo4j:** Handles graph-based relationships between students and alumni. It powers alumni and peer recommendation functionality by leveraging relationships represented within the campus network.

---

## Advanced Architecture & Implementation

### 1. Graph-Based Alumni & Peer Recommendations (Neo4j)

Integrated Neo4j as the graph database layer in SeniorSOS to support alumni and peer recommendations.

- Represents relationships within the college community using a graph-based data model.
- Enables students to discover relevant alumni and fellow students through graph-based recommendations.
- Complements PostgreSQL and MongoDB by handling relationship-oriented data and recommendation use cases.

### 2. Kubernetes Deployment

SeniorSOS is deployed on a local Kubernetes cluster using Docker Desktop.

- **Stateless Application Tier:** The frontend (Nginx) and backend run as Kubernetes `Deployments` with health probes, rolling updates, rollbacks, a CPU-based autoscaler for backend replicas (2 to 4 copies), and disruption budgets.
- **Managed Data Tier:** PostgreSQL (Neon), MongoDB (Atlas), and Neo4j (Aura) are hosted as external managed cloud databases. The Kubernetes cluster connects to these databases without hosting their data as Kubernetes StatefulSets.
- **Multi-Replica Backend:** Supports multiple frontend and backend replicas for the deployed application.

See [`k8s/README.md`](k8s/README.md) for deployment details.

### 3. Redis Pub/Sub for Real-Time Scaling

Implemented Redis integration to support real-time communication across multiple backend replicas.

- Uses the Socket.IO Redis adapter to broadcast messages between backend instances.
- Supports shared real-time communication across replicas.
- Also supports presence, rate limiting, and caching.

See `project.md` for additional details.

---

## 🛠️ Tech Stack Overview

### Frontend

- **React 18 (Single Page App):** Component-based, responsive user interface.
- **Vite:** Development server and production bundler.
- **Tailwind CSS:** Modern, clean UI styling.
- **Zustand:** Lightweight global state management for user authentication and session caching.
- **Socket.io-Client:** Powers instant peer-to-peer real-time messaging.

### Backend

- **Node.js & Express.js:** Asynchronous, non-blocking REST API server.
- **Prisma ORM:** Type-safe database queries and declarative migrations for PostgreSQL.
- **Mongoose:** Object data modeling for MongoDB.
- **Neo4j:** Graph database for alumni and peer recommendations.
- **Socket.IO:** Full-duplex WebSocket server for live chat and notifications.
- **Redis:** Pub/Sub integration for cross-replica Socket.IO communication, presence, rate limiting, and caching.
- **JSON Web Tokens (JWT) + httpOnly Cookies:** Secure authentication with short-lived access tokens and refresh token rotation.
- **bcryptjs & Zod:** Salted password hashing and runtime schema validation.

### Infrastructure & DevOps

- **Docker & Docker Compose:** Containerized local instances of PostgreSQL 16 and MongoDB 7.0 with health checks.
- **Kubernetes:** Deployments, health probes, rolling updates, rollbacks, autoscaling, and disruption budgets.
- **Nginx:** Serves the frontend in the Kubernetes deployment.
- **Bash Automation (`run.sh`):** Single-command script that handles environment creation, dependency checks, database readiness, schema migrations, and concurrent server launch.

---

## How to Run the Project Locally

### Prerequisites

Make sure you have installed on your machine:

- **Node.js** (v18 or newer) & **npm**
- **Docker Desktop** (running in the background)
- **Git**

### Method 1: One-Click Startup (Recommended for Linux / Mac / WSL / Git Bash)

We wrote an automated startup script `run.sh` that checks dependencies, starts the Docker containers, runs database migrations, and boots both frontend and backend:

```bash
chmod +x run.sh
./run.sh
```

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

This starts PostgreSQL on port `5433` and MongoDB on port `27018` without conflicting with existing local ports.

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

### Method 3: Run on Kubernetes (Local Cluster)

Runs multiple backend and frontend replicas and Redis on Docker Desktop's Kubernetes, using the configured cloud databases.

Enable **Settings > Kubernetes > Enable Kubernetes** in Docker Desktop once, then:

```powershell
.\k8s\deploy.ps1 -Build
.\k8s\verify.ps1
# Open http://localhost:8080
.\k8s\teardown.ps1
```

Details, safety notes, and troubleshooting are in [`k8s/README.md`](k8s/README.md).

---

## Testing & Quality Assurance

1. **Unit & Validation Tests:** Every registration, login, and profile update payload is validated using strict **Zod** schemas before hitting the database.
2. **API & Error Handling Tests:** Custom `AppError` class catches operational exceptions. Asynchronous controllers use `asyncHandler` to forward rejected Promises to a central Express error middleware.
3. **Automatic 401 Session Recovery:** Frontend Axios interceptor automatically detects expired access tokens, silently calls `/api/auth/refresh`, and retries failed requests without interrupting the user.
4. **Role-Based Route Guards:** Frontend `<ProtectedRoute requiredRole="ADMIN">` and backend `requireAdmin` middlewares block unauthorized students from viewing the verification queue or user controls.

---

## Project Implementation Highlights

SeniorSOS brings together:

- A modular monolith backend with a polyglot persistence architecture.
- Verified alumni discovery and structured mentorship workflows.
- Real-time messaging and notifications using Socket.IO.
- Neo4j-powered alumni and peer recommendations.
- Redis Pub/Sub for real-time communication across backend replicas.
- Kubernetes-based deployment with health probes, rolling updates, rollbacks, and autoscaling.

---

## Project Team

**Department of Information Technology**  
Sri Sivasubramaniya Nadar College of Engineering, Chennai, India.

